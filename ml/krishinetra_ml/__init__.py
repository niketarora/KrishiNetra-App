"""KrishiNetra Machine Learning Service — OASSM-10 10m Multi-Sensor System."""

from .oassm import (
    OASSM_CATEGORICAL_FEATURES,
    OASSM_NUMERICAL_FEATURES,
    OASSM_VERSION,
    FeatureValidationError,
    ModelNotReadyError,
    OASSMFeatures,
    OASSMPrediction,
    OASSMTransformerPredictor,
    categorize_soil_moisture,
)

__all__ = [
    "OASSM_CATEGORICAL_FEATURES",
    "OASSM_NUMERICAL_FEATURES",
    "OASSM_VERSION",
    "FeatureValidationError",
    "ModelNotReadyError",
    "OASSMFeatures",
    "OASSMPrediction",
    "OASSMTransformerPredictor",
    "categorize_soil_moisture",
]
