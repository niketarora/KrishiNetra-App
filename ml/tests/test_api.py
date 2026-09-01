from __future__ import annotations

import os
from unittest.mock import patch
import unittest

from fastapi.testclient import TestClient

import main
from krishinetra_ml.oassm import (
    OASSMFeatures,
    OASSMPrediction,
    OASSMTransformerPredictor,
    OASSM_VERSION,
)


def sample_oassm_request() -> dict:
    return {
        "angle": 38.5,
        "vv": -11.2,
        "vh": -17.8,
        "sentinel2_b2": 0.045,
        "sentinel2_b8a": 0.280,
        "sentinel2_b11": 0.195,
        "sentinel2_b12": 0.110,
        "landsat_b2": 0.050,
        "landsat_b7": 0.120,
        "landsat_b10": 298.5,
        "ndvi": 0.55,
        "ndmi": 0.22,
        "savi": 0.40,
        "s2_lag": 2.0,
        "landsat_lag": 4.0,
        "dsm": 350.0,
        "slope": 2.5,
        "twi_proxy": 7.8,
        "temperature_c": 28.0,
        "humidity_percent": 65.0,
        "rainfall": 18.0,
        "wind_speed": 4.5,
        "soil_ph": 7.2,
        "organic_matter": 0.65,
        "leaf_area_index": 2.1,
        "crop_growth_stage": 2,
        "crop_type": "wheat",
        "soil_texture": "loam",
    }


class MlApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.predictor = OASSMTransformerPredictor()
        main.app.dependency_overrides[main.require_predictor] = lambda: cls.predictor
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls) -> None:
        main.app.dependency_overrides.clear()

    def test_health_endpoint(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["service"], "krishinetra-ml")

    def test_readiness_endpoint(self) -> None:
        response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["ready"])
        self.assertEqual(data["modelVersion"], OASSM_VERSION)
        self.assertTrue(data["productionReady"])

    def test_oassm_prediction_success(self) -> None:
        response = self.client.post("/predict/soil-moisture", json=sample_oassm_request())
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertGreater(data["soil_moisture_percent"], 0)
        self.assertLess(data["soil_moisture_percent"], 100)
        self.assertIn(data["category"], ["dry", "moderate", "good", "wet"])
        self.assertEqual(data["model_version"], OASSM_VERSION)
        self.assertEqual(data["sensor_resolution_m"], 10)
        self.assertIn("vv", data["sar_backscatter_db"])
        self.assertTrue(data["is_production_grade"])

    def test_rejects_invalid_backscatter(self) -> None:
        invalid = sample_oassm_request()
        invalid["vv"] = 100.0  # Invalid radar backscatter
        response = self.client.post("/predict/soil-moisture", json=invalid)
        self.assertEqual(response.status_code, 422)

    def test_enforces_internal_key_when_configured(self) -> None:
        with patch.dict(os.environ, {"ML_SERVICE_API_KEY": "test-secret"}):
            rejected = self.client.post("/predict/soil-moisture", json=sample_oassm_request())
            accepted = self.client.post(
                "/predict/soil-moisture",
                json=sample_oassm_request(),
                headers={"X-Internal-Key": "test-secret"},
            )
        self.assertEqual(rejected.status_code, 401)
        self.assertEqual(accepted.status_code, 200)


if __name__ == "__main__":
    unittest.main()
