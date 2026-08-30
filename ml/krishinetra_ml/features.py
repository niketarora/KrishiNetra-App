"""Feature contract shared by training and inference.

Keeping this contract independent of pandas, XGBoost, FastAPI, and Supabase
makes it safe to reuse from data-collection jobs and the eventual API adapter.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Any, ClassVar, Mapping


class FeatureValidationError(ValueError):
    """Raised when a model input is missing, non-numeric, or implausible."""


FEATURE_NAMES: tuple[str, ...] = (
    "s1_vv_db",
    "s1_vh_db",
    "vv_vh_ratio_db",
    "ndvi",
    "evi",
    "ndbi",
    "temperature_c",
    "rainfall_mm_7d",
    "humidity_percent",
)


@dataclass(frozen=True, slots=True)
class SoilMoistureFeatures:
    """One aligned satellite/weather observation for a farm.

    Sentinel-1 values are expected in decibels. ``vv_vh_ratio_db`` is the
    decibel ratio (VV dB - VH dB), not division of two negative dB values.
    """

    s1_vv_db: float
    s1_vh_db: float
    vv_vh_ratio_db: float
    ndvi: float
    evi: float
    ndbi: float
    temperature_c: float
    rainfall_mm_7d: float
    humidity_percent: float

    BOUNDS: ClassVar[dict[str, tuple[float, float]]] = {
        "s1_vv_db": (-50.0, 10.0),
        "s1_vh_db": (-60.0, 10.0),
        "vv_vh_ratio_db": (-30.0, 30.0),
        "ndvi": (-1.0, 1.0),
        "evi": (-1.0, 1.0),
        "ndbi": (-1.0, 1.0),
        "temperature_c": (-20.0, 60.0),
        "rainfall_mm_7d": (0.0, 2000.0),
        "humidity_percent": (0.0, 100.0),
    }

    ALIASES: ClassVar[dict[str, tuple[str, ...]]] = {
        "s1_vv_db": ("s1_vv_db", "vv", "s1_vv"),
        "s1_vh_db": ("s1_vh_db", "vh", "s1_vh"),
        "vv_vh_ratio_db": ("vv_vh_ratio_db", "vv_vh_ratio"),
        "ndvi": ("ndvi",),
        "evi": ("evi",),
        "ndbi": ("ndbi",),
        "temperature_c": ("temperature_c", "temperature"),
        "rainfall_mm_7d": ("rainfall_mm_7d", "rainfall_7d", "rainfall"),
        "humidity_percent": ("humidity_percent", "humidity"),
    }

    def __post_init__(self) -> None:
        for name in FEATURE_NAMES:
            value = getattr(self, name)
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                raise FeatureValidationError(f"{name} must be numeric")
            numeric = float(value)
            if not math.isfinite(numeric):
                raise FeatureValidationError(f"{name} must be finite")
            low, high = self.BOUNDS[name]
            if not low <= numeric <= high:
                raise FeatureValidationError(
                    f"{name}={numeric} is outside the supported range [{low}, {high}]"
                )

    @classmethod
    def from_mapping(cls, values: Mapping[str, Any]) -> "SoilMoistureFeatures":
        """Build validated features from canonical columns or known aliases."""

        normalized: dict[str, float] = {}
        for canonical, aliases in cls.ALIASES.items():
            raw = next((values[key] for key in aliases if key in values), None)
            if raw is None and canonical == "vv_vh_ratio_db":
                vv = next((values[key] for key in cls.ALIASES["s1_vv_db"] if key in values), None)
                vh = next((values[key] for key in cls.ALIASES["s1_vh_db"] if key in values), None)
                if vv is not None and vh is not None:
                    raw = float(vv) - float(vh)
            if raw is None or raw == "":
                raise FeatureValidationError(f"missing required feature: {canonical}")
            try:
                normalized[canonical] = float(raw)
            except (TypeError, ValueError) as exc:
                raise FeatureValidationError(f"{canonical} must be numeric") from exc
        return cls(**normalized)

    def to_vector(self) -> list[float]:
        """Return the stable feature order expected by the model artifact."""

        return [float(getattr(self, name)) for name in FEATURE_NAMES]

    def to_dict(self) -> dict[str, float]:
        return dict(zip(FEATURE_NAMES, self.to_vector(), strict=True))


def validate_target(value: Any) -> float:
    """Validate a volumetric soil-moisture percentage label."""

    try:
        target = float(value)
    except (TypeError, ValueError) as exc:
        raise FeatureValidationError("soil_moisture_percent must be numeric") from exc
    if not math.isfinite(target) or not 0.0 <= target <= 100.0:
        raise FeatureValidationError(
            "soil_moisture_percent must be finite and between 0 and 100"
        )
    return target
