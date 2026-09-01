"""HTTP service for KrishiNetra 10m Multi-Sensor Model inference.

Exposes the OASSM-10 (Global 10m Surface Soil Moisture) deep-learning
ensemble architecture based on Sentinel-1 SAR Radar, Sentinel-2 Multispectral,
Landsat Thermal, and Copernicus DEM topography.
"""

from __future__ import annotations

from functools import lru_cache
import hmac
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from krishinetra_ml import (
    FeatureValidationError,
    ModelNotReadyError,
    OASSMFeatures,
    OASSMTransformerPredictor,
    OASSM_VERSION,
)


ML_ROOT = Path(__file__).resolve().parent
load_dotenv(ML_ROOT / ".env")


class SoilMoistureRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Radar microwave parameters (dB)
    angle: float = Field(default=38.5, ge=10, le=60)
    vv: float = Field(default=-11.2, ge=-40, le=5)
    vh: float = Field(default=-17.8, ge=-45, le=5)
    vh_minus_vv: float | None = None

    # Multispectral & thermal reflectances
    sentinel2_b2: float = Field(default=0.045, ge=0, le=1)
    sentinel2_b8a: float = Field(default=0.280, ge=0, le=1)
    sentinel2_b11: float = Field(default=0.195, ge=0, le=1)
    sentinel2_b12: float = Field(default=0.110, ge=0, le=1)
    landsat_b2: float = Field(default=0.050, ge=0, le=1)
    landsat_b7: float = Field(default=0.120, ge=0, le=1)
    landsat_b10: float = Field(default=298.5, ge=200, le=360)

    # Optical & moisture indices
    ndvi: float = Field(default=0.45, ge=-1, le=1)
    ndmi: float = Field(default=0.18, ge=-1, le=1)
    savi: float = Field(default=0.38, ge=-1, le=1)
    s2_lag: float = Field(default=2.0, ge=0, le=60)
    landsat_lag: float = Field(default=4.0, ge=0, le=60)

    # Temporal cyclical features
    day_sin: float = Field(default=0.5, ge=-1, le=1)
    day_cos: float = Field(default=0.866, ge=-1, le=1)

    # Topography & terrain
    dsm: float = Field(default=350.0, ge=-500, le=9000)
    slope: float = Field(default=2.5, ge=0, le=90)
    twi_proxy: float = Field(default=7.8, ge=0, le=30)
    aspect_sin: float = Field(default=0.0, ge=-1, le=1)
    aspect_cos: float = Field(default=1.0, ge=-1, le=1)

    # Meteorological conditions
    temperature_c: float = Field(default=28.0, ge=-20, le=60)
    humidity_percent: float = Field(default=60.0, ge=0, le=100)
    rainfall: float = Field(default=12.0, ge=0, le=2000)
    wind_speed: float = Field(default=5.5, ge=0, le=250)

    # Soil characteristics
    soil_ph: float = Field(default=7.2, ge=0, le=14)
    organic_matter: float = Field(default=0.65, ge=0, le=100)
    leaf_area_index: float = Field(default=2.1, ge=0, le=20)
    spatial_resolution: float = Field(default=10.0, gt=0, le=10000)
    crop_growth_stage: int = Field(default=2, ge=0, le=20)
    crop_type: str = Field(default="wheat", min_length=1, max_length=30)

    # Categoricals
    climate_zone: str = Field(default="BSh")
    soil_texture: str = Field(default="loam")
    land_cover: str = Field(default="cropland")


class SarBackscatterData(BaseModel):
    vv: float
    vh: float
    vh_minus_vv: float
    incidence_angle_deg: float


class SoilMoisturePredictionData(BaseModel):
    volumetric_moisture_m3_m3: float = Field(ge=0, le=1)
    soil_moisture_percent: float = Field(ge=0, le=100)
    category: str
    irrigation_recommendation: str
    confidence: float
    model_version: str
    sensor_resolution_m: int
    sar_backscatter_db: SarBackscatterData
    topographic_wetness_index: float
    is_production_grade: bool
    experimental: bool = False
    warning: str | None = None


class SuccessResponse(BaseModel):
    success: bool = True
    data: SoilMoisturePredictionData


@lru_cache(maxsize=1)
def get_predictor() -> OASSMTransformerPredictor:
    return OASSMTransformerPredictor()


def require_predictor() -> OASSMTransformerPredictor:
    try:
        return get_predictor()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The OASSM-10 model service is unavailable.",
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
    title="KrishiNetra ML Service (OASSM-10)",
    description="10m Multi-Sensor Radar + Optical Soil Moisture Inference Engine",
    version="0.3.0",
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "krishinetra-ml", "model": OASSM_VERSION}


@app.get("/health/ready", dependencies=[Depends(require_internal_key)])
async def readiness(
    predictor: OASSMTransformerPredictor = Depends(require_predictor),
) -> dict[str, object]:
    return {
        "ready": True,
        "modelVersion": predictor.model_version,
        "productionReady": True,
        "sensorResolution": "10m",
        "modalities": ["Sentinel-1 SAR", "Sentinel-2 Multispectral", "Landsat Thermal", "Copernicus DEM"],
    }


@app.post(
    "/predict/soil-moisture",
    response_model=SuccessResponse,
    dependencies=[Depends(require_internal_key)],
)
async def predict_soil_moisture(
    request: SoilMoistureRequest,
    predictor: OASSMTransformerPredictor = Depends(require_predictor),
) -> SuccessResponse:
    try:
        # Calculate derived differences if not explicitly provided
        vh_minus_vv = request.vh_minus_vv if request.vh_minus_vv is not None else (request.vh - request.vv)

        features = OASSMFeatures(
            angle=request.angle,
            vv=request.vv,
            vh=request.vh,
            vh_minus_vv=vh_minus_vv,
            sentinel2_b2=request.sentinel2_b2,
            sentinel2_b8a=request.sentinel2_b8a,
            sentinel2_b11=request.sentinel2_b11,
            sentinel2_b12=request.sentinel2_b12,
            landsat_b2=request.landsat_b2,
            landsat_b7=request.landsat_b7,
            landsat_b10=request.landsat_b10,
            ndvi=request.ndvi,
            ndmi=request.ndmi,
            savi=request.savi,
            s2_lag=request.s2_lag,
            landsat_lag=request.landsat_lag,
            day_sin=request.day_sin,
            day_cos=request.day_cos,
            dsm=request.dsm,
            slope=request.slope,
            twi_proxy=request.twi_proxy,
            aspect_sin=request.aspect_sin,
            aspect_cos=request.aspect_cos,
            temperature_c=request.temperature_c,
            humidity_percent=request.humidity_percent,
            rainfall=request.rainfall,
            wind_speed=request.wind_speed,
            soil_ph=request.soil_ph,
            organic_matter=request.organic_matter,
            leaf_area_index=request.leaf_area_index,
            spatial_resolution=request.spatial_resolution,
            crop_growth_stage=request.crop_growth_stage,
            climate_zone=request.climate_zone,
            soil_texture=request.soil_texture,
            land_cover=request.land_cover,
        )
        prediction = predictor.predict(features)
    except FeatureValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail="The OASSM-10 model is unavailable.") from exc

    return SuccessResponse(data=SoilMoisturePredictionData(**prediction.to_dict()))
