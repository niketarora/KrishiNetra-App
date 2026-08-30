"""Versioned soil-moisture model loading and inference."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import hmac
import json
import math
from pathlib import Path
from typing import Any, Mapping, Protocol

from .features import FEATURE_NAMES, SoilMoistureFeatures


class ModelNotReadyError(RuntimeError):
    """Raised when a trained artifact cannot be loaded safely."""


class Regressor(Protocol):
    def predict(self, features: Any) -> Any: ...


@dataclass(frozen=True, slots=True)
class SoilMoisturePrediction:
    soil_moisture_percent: float
    category: str
    irrigation_recommendation: str
    confidence: float
    model_version: str
    out_of_distribution_features: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["out_of_distribution_features"] = list(
            self.out_of_distribution_features
        )
        return result


def category_and_recommendation(moisture_percent: float) -> tuple[str, str]:
    """Translate a measurement into the existing product vocabulary."""

    if moisture_percent < 30.0:
        return "dry", "irrigate_immediately"
    if moisture_percent < 50.0:
        return "moderate", "irrigate_soon"
    if moisture_percent < 70.0:
        return "good", "monitor"
    return "wet", "delay_irrigation"


class SoilMoistureModel:
    """Loaded XGBoost regressor plus the metadata needed for honest output."""

    def __init__(self, model: Regressor, metadata: Mapping[str, Any]) -> None:
        feature_names = tuple(metadata.get("feature_names", ()))
        if feature_names != FEATURE_NAMES:
            raise ModelNotReadyError(
                "model feature contract does not match this application version"
            )
        if not metadata.get("model_version"):
            raise ModelNotReadyError("model metadata has no model_version")
        self._model = model
        self.metadata = dict(metadata)

    @staticmethod
    def metadata_path(model_path: str | Path) -> Path:
        return Path(model_path).with_suffix(".metadata.json")

    @classmethod
    def load(cls, model_path: str | Path) -> "SoilMoistureModel":
        """Load an XGBoost JSON artifact and verify its sidecar metadata."""

        artifact = Path(model_path)
        metadata_path = cls.metadata_path(artifact)
        if not artifact.is_file():
            raise ModelNotReadyError(f"model artifact not found: {artifact}")
        if not metadata_path.is_file():
            raise ModelNotReadyError(f"model metadata not found: {metadata_path}")

        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            expected_digest = metadata.get("artifact_sha256")
            actual_digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
            if not isinstance(expected_digest, str) or not hmac.compare_digest(
                expected_digest, actual_digest
            ):
                raise ModelNotReadyError("model artifact checksum does not match metadata")
        except ModelNotReadyError:
            raise
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            raise ModelNotReadyError(f"invalid model metadata: {exc}") from exc

        try:
            import xgboost as xgb
        except ImportError as exc:
            raise ModelNotReadyError(
                "xgboost is required to load the soil-moisture model"
            ) from exc

        try:
            model = xgb.XGBRegressor()
            model.load_model(artifact)
        except (OSError, ValueError) as exc:
            raise ModelNotReadyError(f"invalid model artifact: {exc}") from exc
        return cls(model, metadata)

    def predict(self, features: SoilMoistureFeatures) -> SoilMoisturePrediction:
        raw = self._model.predict([features.to_vector()])
        try:
            prediction = float(raw[0])
        except (TypeError, ValueError, IndexError) as exc:
            raise ModelNotReadyError("model returned an invalid prediction") from exc
        if not math.isfinite(prediction):
            raise ModelNotReadyError("model returned a non-finite prediction")

        moisture = round(max(0.0, min(100.0, prediction)), 2)
        category, recommendation = category_and_recommendation(moisture)
        out_of_distribution = self._out_of_distribution(features)
        confidence = self._estimate_confidence(out_of_distribution)

        return SoilMoisturePrediction(
            soil_moisture_percent=moisture,
            category=category,
            irrigation_recommendation=recommendation,
            confidence=confidence,
            model_version=str(self.metadata["model_version"]),
            out_of_distribution_features=out_of_distribution,
        )

    def _out_of_distribution(
        self, features: SoilMoistureFeatures
    ) -> tuple[str, ...]:
        ranges = self.metadata.get("training_feature_ranges", {})
        values = features.to_dict()
        outside: list[str] = []
        for name in FEATURE_NAMES:
            observed = ranges.get(name)
            if not isinstance(observed, Mapping):
                continue
            low, high = observed.get("min"), observed.get("max")
            if isinstance(low, (int, float)) and isinstance(high, (int, float)):
                if values[name] < float(low) or values[name] > float(high):
                    outside.append(name)
        return tuple(outside)

    def _estimate_confidence(self, outside: tuple[str, ...]) -> float:
        metrics = self.metadata.get("metrics", {})
        mae = metrics.get("test_mae_percent")
        if not isinstance(mae, (int, float)) or not math.isfinite(float(mae)):
            base = 0.5
        else:
            base = max(0.35, min(0.9, 1.0 - (float(mae) / 50.0)))
        confidence = base * (0.8 ** len(outside))
        return round(max(0.2, min(0.9, confidence)), 3)
