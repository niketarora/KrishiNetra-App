"""Inference adapter for the supplied-dataset experimental XGBoost model.

This artifact intentionally has a different contract from the future
satellite/probe model. Keeping the adapter separate prevents a reduced-feature
baseline from being loaded through the production ``SoilMoistureModel`` class.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import hmac
import json
import math
from pathlib import Path
from typing import Any, Mapping, Protocol

from .features import FeatureValidationError
from .soil_moisture import ModelNotReadyError, category_and_recommendation


EXPERIMENTAL_FEATURE_NAMES: tuple[str, ...] = (
    "NDVI",
    "SAVI",
    "Temperature",
    "Humidity",
    "Rainfall",
    "Wind_Speed",
    "Soil_pH",
    "Organic_Matter",
    "Leaf_Area_Index",
    "Water_Flow",
    "Elevation_Data",
    "Spatial_Resolution",
    "Crop_Growth_Stage",
    "Crop_Type_Maize",
    "Crop_Type_Rice",
    "Crop_Type_Wheat",
)

EXPERIMENTAL_WARNING = (
    "Experimental baseline only: validation found no improvement over predicting "
    "the median. Do not use this output for irrigation decisions."
)


class Regressor(Protocol):
    def predict(self, features: Any) -> Any: ...


@dataclass(frozen=True, slots=True)
class ExperimentalFeatures:
    ndvi: float
    savi: float
    temperature_c: float
    humidity_percent: float
    rainfall: float
    wind_speed: float
    soil_ph: float
    organic_matter: float
    leaf_area_index: float
    water_flow: float
    elevation: float
    spatial_resolution: float
    crop_growth_stage: int
    crop_type: str

    def __post_init__(self) -> None:
        ranges = {
            "ndvi": (-1.0, 1.0),
            "savi": (-1.0, 1.0),
            "temperature_c": (-20.0, 60.0),
            "humidity_percent": (0.0, 100.0),
            "rainfall": (0.0, 2000.0),
            "wind_speed": (0.0, 250.0),
            "soil_ph": (0.0, 14.0),
            "organic_matter": (0.0, 100.0),
            "leaf_area_index": (0.0, 20.0),
            "water_flow": (0.0, 10000.0),
            "elevation": (-500.0, 9000.0),
            "spatial_resolution": (0.0, 10000.0),
            "crop_growth_stage": (0.0, 20.0),
        }
        for name, (low, high) in ranges.items():
            value = getattr(self, name)
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                raise FeatureValidationError(f"{name} must be numeric")
            if not math.isfinite(float(value)) or not low <= float(value) <= high:
                raise FeatureValidationError(
                    f"{name} must be between {low} and {high}"
                )
        normalized_crop = self.crop_type.strip().lower()
        if normalized_crop not in {"maize", "rice", "wheat"}:
            raise FeatureValidationError("crop_type must be maize, rice, or wheat")

    def to_vector(self) -> list[float]:
        crop = self.crop_type.strip().lower()
        return [
            float(self.ndvi),
            float(self.savi),
            float(self.temperature_c),
            float(self.humidity_percent),
            float(self.rainfall),
            float(self.wind_speed),
            float(self.soil_ph),
            float(self.organic_matter),
            float(self.leaf_area_index),
            float(self.water_flow),
            float(self.elevation),
            float(self.spatial_resolution),
            float(self.crop_growth_stage),
            float(crop == "maize"),
            float(crop == "rice"),
            float(crop == "wheat"),
        ]


@dataclass(frozen=True, slots=True)
class ExperimentalPrediction:
    soil_moisture_percent: float
    category: str
    model_version: str
    production_ready: bool
    experimental: bool
    recommendation: None
    warning: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ExperimentalSoilMoistureModel:
    def __init__(self, model: Regressor, metadata: Mapping[str, Any]) -> None:
        if tuple(metadata.get("feature_names", ())) != EXPERIMENTAL_FEATURE_NAMES:
            raise ModelNotReadyError("experimental model feature contract mismatch")
        if not metadata.get("model_version"):
            raise ModelNotReadyError("experimental model metadata has no version")
        self._model = model
        self.metadata = dict(metadata)

    @staticmethod
    def metadata_path(model_path: str | Path) -> Path:
        return Path(model_path).with_suffix(".metadata.json")

    @classmethod
    def load(cls, model_path: str | Path) -> "ExperimentalSoilMoistureModel":
        artifact = Path(model_path)
        metadata_path = cls.metadata_path(artifact)
        if not artifact.is_file() or not metadata_path.is_file():
            raise ModelNotReadyError("experimental model artifact is unavailable")

        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            expected_digest = metadata.get("artifact_sha256")
            actual_digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
            if not isinstance(expected_digest, str) or not hmac.compare_digest(
                expected_digest, actual_digest
            ):
                raise ModelNotReadyError("experimental model checksum mismatch")
        except ModelNotReadyError:
            raise
        except (OSError, json.JSONDecodeError) as exc:
            raise ModelNotReadyError("experimental model metadata is invalid") from exc

        try:
            import xgboost as xgb
        except ImportError as exc:
            raise ModelNotReadyError("xgboost is required for inference") from exc

        model = xgb.XGBRegressor()
        try:
            model.load_model(artifact)
        except (OSError, ValueError) as exc:
            raise ModelNotReadyError("experimental model artifact is invalid") from exc
        return cls(model, metadata)

    def predict(self, features: ExperimentalFeatures) -> ExperimentalPrediction:
        raw = self._model.predict([features.to_vector()])
        try:
            value = float(raw[0])
        except (IndexError, TypeError, ValueError) as exc:
            raise ModelNotReadyError("experimental model returned an invalid value") from exc
        if not math.isfinite(value):
            raise ModelNotReadyError("experimental model returned a non-finite value")

        moisture = round(max(0.0, min(100.0, value)), 2)
        category, _ = category_and_recommendation(moisture)
        return ExperimentalPrediction(
            soil_moisture_percent=moisture,
            category=category,
            model_version=str(self.metadata["model_version"]),
            production_ready=bool(self.metadata.get("production_ready", False)),
            experimental=True,
            recommendation=None,
            warning=EXPERIMENTAL_WARNING,
        )
