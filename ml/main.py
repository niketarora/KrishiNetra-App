"""HTTP service for KrishiNetra model inference.

The current endpoint exposes the supplied-dataset model as an experimental
baseline. Its response always carries the validation warning and never returns
an irrigation recommendation.
"""

from __future__ import annotations

from functools import lru_cache
import hmac
import os
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, status
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field

from krishinetra_ml import (
    ExperimentalFeatures,
    ExperimentalSoilMoistureModel,
    FeatureValidationError,
    ModelNotReadyError,
)


ML_ROOT = Path(__file__).resolve().parent
load_dotenv(ML_ROOT / ".env")
DEFAULT_MODEL_PATH = ML_ROOT / "models" / "agriculture_baseline_xgboost_v1.json"


class SoilMoistureRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ndvi: float = Field(ge=-1, le=1)
    savi: float = Field(ge=-1, le=1)
    temperature_c: float = Field(ge=-20, le=60)
    humidity_percent: float = Field(ge=0, le=100)
    rainfall: float = Field(ge=0, le=2000)
    wind_speed: float = Field(ge=0, le=250)
    soil_ph: float = Field(ge=0, le=14)
    organic_matter: float = Field(ge=0, le=100)
    leaf_area_index: float = Field(ge=0, le=20)
    water_flow: float = Field(ge=0, le=10000)
    elevation: float = Field(ge=-500, le=9000)
    spatial_resolution: float = Field(gt=0, le=10000)
    crop_growth_stage: int = Field(ge=0, le=20)
    crop_type: str = Field(min_length=1, max_length=30)


class SoilMoisturePredictionData(BaseModel):
    soil_moisture_percent: float = Field(ge=0, le=100)
    category: str
    model_version: str
    production_ready: bool
    experimental: bool
    recommendation: None = None
    warning: str


class SuccessResponse(BaseModel):
    success: bool = True
    data: SoilMoisturePredictionData


def configured_model_path() -> Path:
    configured = os.getenv("SOIL_MOISTURE_MODEL_PATH")
    if not configured:
        return DEFAULT_MODEL_PATH
    path = Path(configured)
    return path if path.is_absolute() else ML_ROOT / path


@lru_cache(maxsize=1)
def get_model() -> ExperimentalSoilMoistureModel:
    return ExperimentalSoilMoistureModel.load(configured_model_path())


def require_model() -> ExperimentalSoilMoistureModel:
    try:
        return get_model()
    except ModelNotReadyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The model artifact is unavailable.",
        ) from exc


def require_internal_key(
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
) -> None:
    expected = os.getenv("ML_SERVICE_API_KEY")
    if expected and not hmac.compare_digest(x_internal_key or "", expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid internal service key is required.",
        )


app = FastAPI(
    title="KrishiNetra ML Service",
    description="Versioned model inference behind the KrishiNetra backend",
    version="0.2.0",
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "krishinetra-ml"}


@app.get("/health/ready", dependencies=[Depends(require_internal_key)])
async def readiness(
    model: ExperimentalSoilMoistureModel = Depends(require_model),
) -> dict[str, object]:
    return {
        "ready": True,
        "modelVersion": model.metadata["model_version"],
        "productionReady": bool(model.metadata.get("production_ready", False)),
    }


@app.post(
    "/predict/soil-moisture",
    response_model=SuccessResponse,
    dependencies=[Depends(require_internal_key)],
)
async def predict_soil_moisture(
    request: SoilMoistureRequest,
    model: ExperimentalSoilMoistureModel = Depends(require_model),
) -> SuccessResponse:
    try:
        features = ExperimentalFeatures(**request.model_dump())
        prediction = model.predict(features)
    except FeatureValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail="The model is unavailable.") from exc

    return SuccessResponse(data=SoilMoisturePredictionData(**prediction.to_dict()))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
