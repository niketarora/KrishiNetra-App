from __future__ import annotations

import unittest
from krishinetra_ml.oassm import (
    FeatureValidationError,
    OASSMFeatures,
    OASSMPrediction,
    OASSMTransformerPredictor,
    categorize_soil_moisture,
)


class OassmModelTests(unittest.TestCase):
    def setUp(self) -> None:
        self.predictor = OASSMTransformerPredictor()

    def test_default_features_prediction(self) -> None:
        features = OASSMFeatures()
        prediction = self.predictor.predict(features)
        self.assertIsInstance(prediction, OASSMPrediction)
        self.assertGreaterEqual(prediction.volumetric_moisture_m3_m3, 0.0)
        self.assertLessEqual(prediction.volumetric_moisture_m3_m3, 1.0)
        self.assertEqual(prediction.sensor_resolution_m, 10)
        self.assertEqual(prediction.model_version, "oassm-10-transformer-v4")
        self.assertTrue(prediction.is_production_grade)

    def test_dry_soil_radar_response(self) -> None:
        # Dry soil has low dielectric constant -> low SAR backscatter (-25 dB VV)
        features = OASSMFeatures(
            vv=-24.0,
            vh=-30.0,
            ndmi=-0.1,
            savi=0.15,
            rainfall=0.0,
            humidity_percent=20.0,
            soil_texture="sand",
        )
        prediction = self.predictor.predict(features)
        self.assertEqual(prediction.category, "dry")
        self.assertEqual(prediction.irrigation_recommendation, "irrigate_recommended")

    def test_wet_soil_radar_response(self) -> None:
        # Saturated / high moisture soil -> high radar reflection
        features = OASSMFeatures(
            vv=-6.0,
            vh=-12.0,
            ndmi=0.55,
            savi=0.75,
            rainfall=85.0,
            humidity_percent=90.0,
            twi_proxy=14.0,
            soil_texture="clay",
        )
        prediction = self.predictor.predict(features)
        self.assertIn(prediction.category, ["good", "wet"])

    def test_invalid_backscatter_raises_validation_error(self) -> None:
        with self.assertRaises(FeatureValidationError):
            OASSMFeatures(vv=-60.0)  # out of valid range

    def test_categorize_soil_moisture_thresholds(self) -> None:
        self.assertEqual(categorize_soil_moisture(0.10)[0], "dry")
        self.assertEqual(categorize_soil_moisture(0.20)[0], "moderate")
        self.assertEqual(categorize_soil_moisture(0.35)[0], "good")
        self.assertEqual(categorize_soil_moisture(0.48)[0], "wet")


if __name__ == "__main__":
    unittest.main()
