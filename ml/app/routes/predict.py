"""
Routes for prediction endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
import logging

from app.schemas import (
    CropClassificationRequest,
    CropClassificationResponse,
    SoilMoistureRequest,
    SoilMoistureResponse,
    GrowthStageRequest,
    GrowthStageResponse,
    SuccessResponse,
)
from app.services import gee_service, inference

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/crop", response_model=SuccessResponse)
async def classify_crop(request: CropClassificationRequest):
    """
    Classify crop from Sentinel-1/2 satellite imagery
    
    Returns: Predicted crop type + confidence
    """
    try:
        logger.info(f"Classifying crop for farm {request.farm_id}")

        # Fetch Sentinel-1 and Sentinel-2 data
        s1_data = await gee_service.fetch_sentinel1(
            request.boundary, request.date_range.start, request.date_range.end
        )
        s2_data = await gee_service.fetch_sentinel2(
            request.boundary, request.date_range.start, request.date_range.end
        )

        # Extract features
        features = await inference.extract_crop_features(s1_data, s2_data)

        # Run classification
        prediction = inference.classify_crop(features)

        response = CropClassificationResponse(
            crop_type=prediction["crop"],
            confidence=prediction["confidence"],
            alternatives=prediction["alternatives"],
            model_version=prediction["model_version"],
            images_used=s2_data.get("image_count", 0),
            date_range={
                "start": request.date_range.start.isoformat(),
                "end": request.date_range.end.isoformat(),
            },
        )

        return SuccessResponse(data=response)

    except Exception as e:
        logger.error(f"Crop classification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/soil-moisture", response_model=SuccessResponse)
async def predict_soil_moisture(request: SoilMoistureRequest):
    """
    Predict soil moisture from Sentinel-1 SAR backscatter + weather
    
    Returns: Soil moisture (%), category, irrigation recommendation
    """
    try:
        logger.info(f"Predicting soil moisture for farm {request.farm_id}")

        # Fetch Sentinel-1 data (current, last 30 days)
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=30)

        s1_data = await gee_service.fetch_sentinel1(request.boundary, start_date, end_date)

        # Extract SAR indices
        features = await inference.extract_soil_moisture_features(s1_data, request.crop)

        # Run regression
        prediction = inference.predict_soil_moisture(features)

        response = SoilMoistureResponse(
            soil_moisture_percent=prediction["moisture_percent"],
            category=prediction["category"],
            irrigation_recommendation=prediction["recommendation"],
            confidence=prediction["confidence"],
            model_version=prediction["model_version"],
            last_observation=end_date.isoformat(),
        )

        return SuccessResponse(data=response)

    except Exception as e:
        logger.error(f"Soil moisture prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/growth-stage", response_model=SuccessResponse)
async def predict_growth_stage(request: GrowthStageRequest):
    """
    Predict crop growth stage from Sentinel-2 NDVI time series
    
    Returns: Current stage, days in stage, milestones to harvest
    """
    try:
        logger.info(f"Predicting growth stage for farm {request.farm_id}")

        # Fetch Sentinel-2 time series from sowing date to now
        end_date = datetime.now().date()
        s2_timeseries = await gee_service.fetch_sentinel2_timeseries(
            request.boundary, request.sown_on, end_date
        )

        # Extract NDVI time series
        ndvi_series = await inference.extract_ndvi_timeseries(s2_timeseries)

        # Run phenology model
        prediction = inference.predict_growth_stage(
            ndvi_series, request.crop, request.sown_on
        )

        response = GrowthStageResponse(
            growth_stage=prediction["stage"],
            days_in_stage=prediction["days_in_stage"],
            ndvi_current=prediction["ndvi_current"],
            estimated_days_to_harvest=prediction["days_to_harvest"],
            milestones=prediction["milestones"],
            model_version=prediction["model_version"],
            last_observation=end_date.isoformat(),
        )

        return SuccessResponse(data=response)

    except Exception as e:
        logger.error(f"Growth stage prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
