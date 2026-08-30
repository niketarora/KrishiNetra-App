from __future__ import annotations

import unittest

from krishinetra_ml.experimental import (
    EXPERIMENTAL_FEATURE_NAMES,
    EXPERIMENTAL_WARNING,
    ExperimentalFeatures,
    ExperimentalSoilMoistureModel,
)
from krishinetra_ml.features import FeatureValidationError


class FakeRegressor:
    def __init__(self, value: float) -> None:
        self.value = value
        self.last_features = None

    def predict(self, features):
        self.last_features = features
        return [self.value]


def valid_features() -> ExperimentalFeatures:
    return ExperimentalFeatures(
        ndvi=0.55,
        savi=0.40,
        temperature_c=28.0,
        humidity_percent=65.0,
        rainfall=18.0,
        wind_speed=3.0,
        soil_ph=6.5,
        organic_matter=2.0,
        leaf_area_index=1.8,
        water_flow=20.0,
        elevation=550.0,
        spatial_resolution=10.0,
        crop_growth_stage=2,
        crop_type="wheat",
    )


class ExperimentalModelTests(unittest.TestCase):
    def test_builds_expected_vector_and_marks_prediction_experimental(self) -> None:
        regressor = FakeRegressor(20.04)
        model = ExperimentalSoilMoistureModel(
            regressor,
            {
                "feature_names": list(EXPERIMENTAL_FEATURE_NAMES),
                "model_version": "test-experimental-v1",
                "production_ready": False,
            },
        )
        prediction = model.predict(valid_features())

        self.assertEqual(len(regressor.last_features[0]), 16)
        self.assertEqual(regressor.last_features[0][-3:], [0.0, 0.0, 1.0])
        self.assertEqual(prediction.soil_moisture_percent, 20.04)
        self.assertFalse(prediction.production_ready)
        self.assertTrue(prediction.experimental)
        self.assertIsNone(prediction.recommendation)
        self.assertEqual(prediction.warning, EXPERIMENTAL_WARNING)

    def test_rejects_unsupported_crop(self) -> None:
        values = {
            name: getattr(valid_features(), name)
            for name in valid_features().__dataclass_fields__
        }
        values["crop_type"] = "cotton"
        with self.assertRaises(FeatureValidationError):
            ExperimentalFeatures(**values)


if __name__ == "__main__":
    unittest.main()
