"""
Inference service: Feature extraction and model predictions
"""

import logging
from typing import Dict, List, Any, Optional
import numpy as np
from datetime import date, datetime, timedelta

logger = logging.getLogger(__name__)


async def extract_crop_features(s1_data: Dict[str, Any], s2_data: Dict[str, Any]) -> Dict[str, float]:
    """
    Extract features for crop classification
    
    Combines SAR (Sentinel-1) and optical (Sentinel-2) indices
    """
    try:
        # SAR features
        vv = s1_data["vv"].get("VV", 0)
        vh = s1_data["vh"].get("VH", 0)
        
        # Optical features
        b2 = s2_data["bands"]["B2"].get("B2", 0)  # Blue
        b3 = s2_data["bands"]["B3"].get("B3", 0)  # Green
        b4 = s2_data["bands"]["B4"].get("B4", 0)  # Red
        b8 = s2_data["bands"]["B8"].get("B8", 0)  # NIR
        b11 = s2_data["bands"]["B11"].get("B11", 0)  # SWIR

        # Calculate indices
        features = {
            # SAR features
            "vv": vv,
            "vh": vh,
            "vv_vh_ratio": vv / (vh + 1e-6),
            "rvi": 4 * vh / (vv + vh + 1e-6),  # Radar Vegetation Index
            # Optical features
            "blue": b2,
            "green": b3,
            "red": b4,
            "nir": b8,
            "swir": b11,
            # Vegetation indices
            "ndvi": (b8 - b4) / (b8 + b4 + 1e-6),  # Normalized Difference Vegetation Index
            "ndbi": (b11 - b8) / (b11 + b8 + 1e-6),  # Normalized Difference Built-up Index
            "evi": 2.5 * (b8 - b4) / (b8 + 6*b4 - 7.5*b2 + 1),  # Enhanced Vegetation Index
        }

        logger.info(f"Extracted crop features: {list(features.keys())}")
        return features

    except Exception as e:
        logger.error(f"Feature extraction failed: {str(e)}")
        raise


async def extract_soil_moisture_features(
    s1_data: Dict[str, Any], crop: Optional[str] = None
) -> Dict[str, float]:
    """
    Extract features for soil moisture prediction
    
    Primary: SAR backscatter
    Secondary: Crop type (affects interpretation)
    """
    try:
        vv = s1_data["vv"].get("VV", 0)
        vh = s1_data["vh"].get("VH", 0)

        # Soil Moisture Index (SMI)
        # Normalize between dry (low backscatter) and wet (high backscatter) extremes
        vv_min, vv_max = -25, -5  # dB range for typical SAR
        smi = (vv - vv_min) / (vv_max - vv_min)
        smi = np.clip(smi, 0, 1)

        features = {
            "vv": vv,
            "vh": vh,
            "vv_vh_ratio": vv / (vh + 1e-6),
            "soil_moisture_index": smi,
            "crop": hash(crop) % 100 if crop else 0,  # Encode crop type
        }

        logger.info("Extracted soil moisture features")
        return features

    except Exception as e:
        logger.error(f"Soil moisture feature extraction failed: {str(e)}")
        raise


async def extract_ndvi_timeseries(
    s2_timeseries: List[Dict[str, Any]],
) -> List[Dict[str, float]]:
    """
    Extract NDVI from Sentinel-2 time series
    """
    try:
        ndvi_series = []
        
        # TODO: Download each image in timeseries and compute NDVI
        # For now, return placeholder
        
        logger.info(f"Extracted NDVI time series: {len(s2_timeseries)} observations")
        return ndvi_series

    except Exception as e:
        logger.error(f"NDVI extraction failed: {str(e)}")
        raise


def classify_crop(features: Dict[str, float]) -> Dict[str, Any]:
    """
    Classify crop using trained Random Forest model
    
    TODO: Load actual trained model
    """
    try:
        # Placeholder: return mock prediction
        crops_by_ndvi = {
            (0.6, 1.0): ("Rice", 0.85),
            (0.4, 0.6): ("Wheat", 0.80),
            (0.3, 0.4): ("Maize", 0.75),
            (0.0, 0.3): ("Unknown", 0.50),
        }

        ndvi = features.get("ndvi", 0)
        for (low, high), (crop, conf) in crops_by_ndvi.items():
            if low <= ndvi <= high:
                return {
                    "crop": crop,
                    "confidence": conf,
                    "alternatives": [
                        {"crop": "Wheat", "confidence": 0.10},
                        {"crop": "Rice", "confidence": 0.05},
                    ],
                    "model_version": "v1_placeholder",
                }

        return {
            "crop": "Unknown",
            "confidence": 0.4,
            "alternatives": [],
            "model_version": "v1_placeholder",
        }

    except Exception as e:
        logger.error(f"Crop classification failed: {str(e)}")
        raise


def predict_soil_moisture(features: Dict[str, float]) -> Dict[str, Any]:
    """
    Predict soil moisture using trained XGBoost model
    
    TODO: Load actual trained model
    """
    try:
        # Placeholder: use SMI as proxy
        smi = features.get("soil_moisture_index", 0.5)
        moisture_percent = smi * 100

        if moisture_percent < 30:
            category = "dry"
            recommendation = "irrigate_immediately"
        elif moisture_percent < 50:
            category = "moderate"
            recommendation = "irrigate_soon"
        elif moisture_percent < 70:
            category = "good"
            recommendation = "wait_3_5_days"
        else:
            category = "wet"
            recommendation = "wait_5_7_days"

        return {
            "moisture_percent": moisture_percent,
            "category": category,
            "recommendation": recommendation,
            "confidence": 0.65,
            "model_version": "v1_placeholder",
        }

    except Exception as e:
        logger.error(f"Soil moisture prediction failed: {str(e)}")
        raise


def predict_growth_stage(
    ndvi_timeseries: List[Dict[str, float]], crop: str, sown_on: date
) -> Dict[str, Any]:
    """
    Predict crop growth stage from NDVI time series
    
    Uses rule-based phenology model
    """
    try:
        # Placeholder: return mock prediction
        days_since_sowing = (datetime.now().date() - sown_on).days

        crop_durations = {
            "wheat": 150,
            "rice": 130,
            "maize": 140,
            "cotton": 180,
        }
        total_duration = crop_durations.get(crop.lower(), 150)

        if days_since_sowing < total_duration * 0.2:
            stage = "emergence"
            days_to_harvest = total_duration - days_since_sowing
        elif days_since_sowing < total_duration * 0.5:
            stage = "vegetative"
            days_to_harvest = total_duration - days_since_sowing
        elif days_since_sowing < total_duration * 0.75:
            stage = "flowering"
            days_to_harvest = total_duration - days_since_sowing
        else:
            stage = "maturity"
            days_to_harvest = max(0, total_duration - days_since_sowing)

        return {
            "stage": stage,
            "days_in_stage": int(days_since_sowing * 0.2),
            "ndvi_current": 0.65,
            "days_to_harvest": days_to_harvest,
            "milestones": [
                {"stage": "flowering", "expected_days": 25},
                {"stage": "grain_filling", "expected_days": 40},
                {"stage": "maturity", "expected_days": 5},
            ],
            "model_version": "v1_phenology_rule",
        }

    except Exception as e:
        logger.error(f"Growth stage prediction failed: {str(e)}")
        raise
