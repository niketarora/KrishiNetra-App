from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from krishinetra_ml.features import FEATURE_NAMES, SoilMoistureFeatures
from krishinetra_ml.soil_moisture import (
    ModelNotReadyError,
    SoilMoistureModel,
    category_and_recommendation,
)


class FakeRegressor:
    def __init__(self, prediction: float) -> None:
        self.prediction = prediction
        self.last_features = None

    def predict(self, features):
        self.last_features = features
        return [self.prediction]


def metadata() -> dict:
    return {
        "model_version": "test-v1",
        "feature_names": list(FEATURE_NAMES),
        "metrics": {"test_mae_percent": 8.0},
        "training_feature_ranges": {
            name: {"min": -100.0, "max": 1000.0} for name in FEATURE_NAMES
        },
    }


def features(**overrides: float) -> SoilMoistureFeatures:
    values = {
        "s1_vv_db": -12.5,
        "s1_vh_db": -19.0,
        "vv_vh_ratio_db": 6.5,
        "ndvi": 0.61,
        "evi": 0.38,
        "ndbi": -0.25,
        "temperature_c": 31.0,
        "rainfall_mm_7d": 18.0,
        "humidity_percent": 64.0,
    }
    values.update(overrides)
    return SoilMoistureFeatures(**values)


class SoilMoistureModelTests(unittest.TestCase):
    def test_predicts_with_version_and_product_category(self) -> None:
        regressor = FakeRegressor(44.25)
        prediction = SoilMoistureModel(regressor, metadata()).predict(features())
        self.assertEqual(prediction.soil_moisture_percent, 44.25)
        self.assertEqual(prediction.category, "moderate")
        self.assertEqual(prediction.irrigation_recommendation, "irrigate_soon")
        self.assertEqual(prediction.model_version, "test-v1")
        self.assertEqual(len(regressor.last_features[0]), len(FEATURE_NAMES))

    def test_clips_prediction_to_physical_range(self) -> None:
        prediction = SoilMoistureModel(FakeRegressor(115), metadata()).predict(
            features()
        )
        self.assertEqual(prediction.soil_moisture_percent, 100.0)
        self.assertEqual(prediction.category, "wet")

    def test_reduces_confidence_outside_training_distribution(self) -> None:
        model_metadata = metadata()
        model_metadata["training_feature_ranges"]["temperature_c"] = {
            "min": 20.0,
            "max": 30.0,
        }
        prediction = SoilMoistureModel(
            FakeRegressor(45), model_metadata
        ).predict(features(temperature_c=40.0))
        self.assertEqual(
            prediction.out_of_distribution_features, ("temperature_c",)
        )
        self.assertLess(prediction.confidence, 0.84)

    def test_rejects_artifact_with_wrong_feature_order(self) -> None:
        model_metadata = metadata()
        model_metadata["feature_names"] = list(reversed(FEATURE_NAMES))
        with self.assertRaises(ModelNotReadyError):
            SoilMoistureModel(FakeRegressor(50), model_metadata)

    def test_rejects_artifact_when_checksum_does_not_match(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / "model.json"
            artifact.write_text("changed model", encoding="utf-8")
            model_metadata = metadata()
            model_metadata["artifact_sha256"] = "0" * 64
            SoilMoistureModel.metadata_path(artifact).write_text(
                json.dumps(model_metadata), encoding="utf-8"
            )
            with self.assertRaisesRegex(ModelNotReadyError, "checksum"):
                SoilMoistureModel.load(artifact)

    def test_category_boundaries(self) -> None:
        self.assertEqual(category_and_recommendation(29.9)[0], "dry")
        self.assertEqual(category_and_recommendation(30.0)[0], "moderate")
        self.assertEqual(category_and_recommendation(50.0)[0], "good")
        self.assertEqual(category_and_recommendation(70.0)[0], "wet")


if __name__ == "__main__":
    unittest.main()
