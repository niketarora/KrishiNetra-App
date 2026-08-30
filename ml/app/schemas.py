"""
Pydantic schemas for API requests/responses
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date


class GeoJSONFeature(BaseModel):
    """GeoJSON polygon boundary"""

    type: str = Field(..., description="Must be 'Polygon'")
    coordinates: List[List[List[float]]] = Field(
        ..., description="Coordinates: [[[lng, lat], [lng, lat], ...]]"
    )


class DateRange(BaseModel):
    """Date range for satellite data"""

    start: date = Field(..., description="Start date (YYYY-MM-DD)")
    end: date = Field(..., description="End date (YYYY-MM-DD)")


class CropClassificationRequest(BaseModel):
    """Request for crop classification"""

    farm_id: str = Field(..., description="Farm UUID")
    boundary: GeoJSONFeature = Field(..., description="Farm boundary")
    date_range: DateRange = Field(
        ..., description="Date range for satellite imagery"
    )


class CropAlternative(BaseModel):
    """Alternative crop prediction"""

    crop: str
    confidence: float


class CropClassificationResponse(BaseModel):
    """Response for crop classification"""

    crop_type: str
    confidence: float
    alternatives: List[CropAlternative]
    model_version: str
    images_used: int
    date_range: Dict[str, str]


class SoilMoistureRequest(BaseModel):
    """Request for soil moisture prediction"""

    farm_id: str
    boundary: GeoJSONFeature
    crop: Optional[str] = None


class SoilMoistureResponse(BaseModel):
    """Response for soil moisture prediction"""

    soil_moisture_percent: float = Field(..., ge=0, le=100)
    category: str  # "dry", "moderate", "good", "wet"
    irrigation_recommendation: str
    confidence: float
    model_version: str
    last_observation: str  # Date


class GrowthMilestone(BaseModel):
    """Growth stage milestone"""

    stage: str
    expected_days: int


class GrowthStageRequest(BaseModel):
    """Request for growth stage prediction"""

    farm_id: str
    boundary: GeoJSONFeature
    crop: str
    sown_on: date


class GrowthStageResponse(BaseModel):
    """Response for growth stage prediction"""

    growth_stage: str
    days_in_stage: int
    ndvi_current: float
    estimated_days_to_harvest: int
    milestones: List[GrowthMilestone]
    model_version: str
    last_observation: str


class ErrorResponse(BaseModel):
    """Standard error response"""

    success: bool = False
    error: Dict[str, str]


class SuccessResponse(BaseModel):
    """Standard success response wrapper"""

    success: bool = True
    data: Any
