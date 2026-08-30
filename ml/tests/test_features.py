from __future__ import annotations

import unittest

from krishinetra_ml.features import (
    FEATURE_NAMES,
    FeatureValidationError,
    SoilMoistureFeatures,
    validate_target,
)


class SoilMoistureFeaturesTests(unittest.TestCase):
    def valid_values(self) -> dict[str, float]:
        return {
            "s1_vv_db": -12.5,
            "s1_vh_db": -19.0,
            "ndvi": 0.61,
            "evi": 0.38,
            "ndbi": -0.25,
            "temperature_c": 31.0,
            "rainfall_mm_7d": 18.0,
            "humidity_percent": 64.0,
        }

    def test_derives_decibel_ratio_when_omitted(self) -> None:
        features = SoilMoistureFeatures.from_mapping(self.valid_values())
        self.assertAlmostEqual(features.vv_vh_ratio_db, 6.5)
        self.assertEqual(len(features.to_vector()), len(FEATURE_NAMES))

    def test_accepts_collection_aliases(self) -> None:
        values = self.valid_values()
        values["vv"] = values.pop("s1_vv_db")
        values["vh"] = values.pop("s1_vh_db")
        values["humidity"] = values.pop("humidity_percent")
        features = SoilMoistureFeatures.from_mapping(values)
        self.assertEqual(features.s1_vv_db, -12.5)

    def test_rejects_missing_or_out_of_range_values(self) -> None:
        values = self.valid_values()
        del values["ndvi"]
        with self.assertRaisesRegex(FeatureValidationError, "missing.*ndvi"):
            SoilMoistureFeatures.from_mapping(values)

        values = self.valid_values()
        values["humidity_percent"] = 101
        with self.assertRaisesRegex(FeatureValidationError, "outside"):
            SoilMoistureFeatures.from_mapping(values)

    def test_validates_target_percentage(self) -> None:
        self.assertEqual(validate_target("42.5"), 42.5)
        with self.assertRaises(FeatureValidationError):
            validate_target(-1)


if __name__ == "__main__":
    unittest.main()
