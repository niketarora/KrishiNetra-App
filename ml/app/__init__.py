"""
Application configuration
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings from environment variables"""

    # FastAPI
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # Google Earth Engine
    GEE_PROJECT_ID: str = "krishinetra-ml"
    GEE_SERVICE_ACCOUNT_EMAIL: Optional[str] = None
    GEE_SERVICE_ACCOUNT_KEY_PATH: Optional[str] = None

    # Backend API
    BACKEND_URL: str = "http://localhost:4000"
    BACKEND_API_KEY: Optional[str] = None

    # Model paths
    MODEL_PATH: str = "/app/models"
    CROP_CLASSIFIER_MODEL: str = "crop_classifier_v1.pkl"
    SOIL_MOISTURE_MODEL: str = "soil_moisture_v1.json"
    GROWTH_STAGE_MODEL: str = "growth_stage_v1.h5"

    # Sentinel data
    SENTINEL1_COLLECTION: str = "COPERNICUS/S1_GRD"
    SENTINEL2_COLLECTION: str = "COPERNICUS/S2_SR_HARMONIZED"
    SENTINEL2_CLOUD_THRESHOLD: int = 20

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
