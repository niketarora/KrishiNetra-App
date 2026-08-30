from __future__ import annotations

import os
from unittest.mock import patch
import unittest

from fastapi.testclient import TestClient

import main
from krishinetra_ml.experimental import (
    EXPERIMENTAL_FEATURE_NAMES,
    ExperimentalSoilMoistureModel,
)


class FakeRegressor:
    def predict(self, _features):
        return [20.04]


def request_body() -> dict:
    return {
        "ndvi": 0.55,
        "savi": 0.40,
        "temperature_c": 28.0,
        "humidity_percent": 65.0,
        "rainfall": 18.0,
        "wind_speed": 3.0,
        "soil_ph": 6.5,
        "organic_matter": 2.0,
        "leaf_area_index": 1.8,
        "water_flow": 20.0,
        "elevation": 550.0,
        "spatial_resolution": 10.0,
        "crop_growth_stage": 2,
        "crop_type": "wheat",
    }


class MlApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.model = ExperimentalSoilMoistureModel(
            FakeRegressor(),
            {
                "feature_names": list(EXPERIMENTAL_FEATURE_NAMES),
                "model_version": "test-experimental-v1",
                "production_ready": False,
            },
        )
        main.app.dependency_overrides[main.require_model] = lambda: cls.model
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls) -> None:
        main.app.dependency_overrides.clear()

    def test_prediction_returns_warning_and_no_recommendation(self) -> None:
        response = self.client.post("/predict/soil-moisture", json=request_body())
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["soil_moisture_percent"], 20.04)
        self.assertFalse(data["production_ready"])
        self.assertTrue(data["experimental"])
        self.assertIsNone(data["recommendation"])

    def test_rejects_invalid_or_extra_features(self) -> None:
        invalid = request_body()
        invalid["ndvi"] = 4
        invalid["unexpected"] = True
        response = self.client.post("/predict/soil-moisture", json=invalid)
        self.assertEqual(response.status_code, 422)

    def test_enforces_internal_key_when_configured(self) -> None:
        with patch.dict(os.environ, {"ML_SERVICE_API_KEY": "test-secret"}):
            rejected = self.client.post("/predict/soil-moisture", json=request_body())
            accepted = self.client.post(
                "/predict/soil-moisture",
                json=request_body(),
                headers={"X-Internal-Key": "test-secret"},
            )
        self.assertEqual(rejected.status_code, 401)
        self.assertEqual(accepted.status_code, 200)


if __name__ == "__main__":
    unittest.main()
