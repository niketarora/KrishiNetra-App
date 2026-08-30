"""
Google Earth Engine service for fetching Sentinel-1 and Sentinel-2 data
"""

import ee
import logging
from datetime import date, datetime
from typing import Dict, List, Any, Optional
import asyncio

from app.config import settings

logger = logging.getLogger(__name__)


async def initialize_gee():
    """Initialize Earth Engine (call once at startup)"""
    try:
        # Initialize EE
        ee.Initialize(opt_user=f"projects/{settings.GEE_PROJECT_ID}/assets")
        logger.info("✓ Google Earth Engine initialized")
    except Exception as e:
        logger.error(f"✗ GEE initialization failed: {str(e)}")
        raise


async def fetch_sentinel1(
    boundary: Dict[str, Any], start_date: date, end_date: date
) -> Dict[str, Any]:
    """
    Fetch Sentinel-1 SAR data for a boundary
    
    Args:
        boundary: GeoJSON Polygon
        start_date: Start date
        end_date: End date
        
    Returns:
        VV and VH backscatter data
    """
    try:
        logger.info(f"Fetching Sentinel-1 data: {start_date} to {end_date}")

        # Convert boundary to EE geometry
        coords = boundary["coordinates"][0]
        ee_geometry = ee.Geometry.Polygon(coords)

        # Fetch Sentinel-1
        s1 = (
            ee.ImageCollection(settings.SENTINEL1_COLLECTION)
            .filterBounds(ee_geometry)
            .filterDate(start_date.isoformat(), end_date.isoformat())
            .filter(ee.Filter.eq("instrumentMode", "IW"))
        )

        # Get median composite (reduce speckle)
        median = s1.median()

        # Convert to NumPy array for feature extraction
        # This requires downloading from GEE (async operation)
        vv_data = await _download_image(median, "VV", ee_geometry)
        vh_data = await _download_image(median, "VH", ee_geometry)

        return {
            "vv": vv_data,
            "vh": vh_data,
            "image_count": s1.size().getInfo(),
            "date_range": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        }

    except Exception as e:
        logger.error(f"Sentinel-1 fetch failed: {str(e)}")
        raise


async def fetch_sentinel2(
    boundary: Dict[str, Any], start_date: date, end_date: date
) -> Dict[str, Any]:
    """
    Fetch Sentinel-2 optical data for a boundary
    
    Args:
        boundary: GeoJSON Polygon
        start_date: Start date
        end_date: End date
        
    Returns:
        MultiSpectral bands (B2, B3, B4, B8, B11)
    """
    try:
        logger.info(f"Fetching Sentinel-2 data: {start_date} to {end_date}")

        # Convert boundary to EE geometry
        coords = boundary["coordinates"][0]
        ee_geometry = ee.Geometry.Polygon(coords)

        # Fetch Sentinel-2 with cloud filtering
        s2 = (
            ee.ImageCollection(settings.SENTINEL2_COLLECTION)
            .filterBounds(ee_geometry)
            .filterDate(start_date.isoformat(), end_date.isoformat())
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", settings.SENTINEL2_CLOUD_THRESHOLD))
        )

        # Get median composite
        median = s2.median()

        # Download bands
        bands = ["B2", "B3", "B4", "B8", "B11"]  # Blue, Green, Red, NIR, SWIR
        data = {}
        for band in bands:
            data[band] = await _download_image(median, band, ee_geometry)

        return {
            "bands": data,
            "image_count": s2.size().getInfo(),
            "date_range": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        }

    except Exception as e:
        logger.error(f"Sentinel-2 fetch failed: {str(e)}")
        raise


async def fetch_sentinel2_timeseries(
    boundary: Dict[str, Any], start_date: date, end_date: date, interval_days: int = 10
) -> List[Dict[str, Any]]:
    """
    Fetch Sentinel-2 time series (one image every N days)
    Used for growth stage monitoring (NDVI trends)
    
    Args:
        boundary: GeoJSON Polygon
        start_date: Start date
        end_date: End date
        interval_days: Days between time steps (default 10 for 5-day revisit)
        
    Returns:
        List of images with timestamps
    """
    try:
        logger.info(f"Fetching Sentinel-2 time series: {start_date} to {end_date}")

        coords = boundary["coordinates"][0]
        ee_geometry = ee.Geometry.Polygon(coords)

        s2 = (
            ee.ImageCollection(settings.SENTINEL2_COLLECTION)
            .filterBounds(ee_geometry)
            .filterDate(start_date.isoformat(), end_date.isoformat())
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", settings.SENTINEL2_CLOUD_THRESHOLD))
        )

        # Convert to list (max 100 images)
        images = s2.toList(100).getInfo()

        timeseries = []
        for img_info in images:
            img_id = img_info["id"]
            img = ee.Image(img_id)
            properties = img.getInfo()["properties"]

            timeseries.append(
                {
                    "image_id": img_id,
                    "timestamp": datetime.fromtimestamp(properties["system:time_start"] / 1000),
                }
            )

        return timeseries

    except Exception as e:
        logger.error(f"Sentinel-2 time series fetch failed: {str(e)}")
        raise


async def _download_image(
    ee_image: ee.Image, band: str, ee_geometry: ee.Geometry, scale: int = 10
) -> Dict[str, Any]:
    """
    Download a single band from EE image
    
    Args:
        ee_image: Earth Engine image
        band: Band name
        ee_geometry: Geometry to download
        scale: Spatial resolution in meters
        
    Returns:
        Downloaded data (mean, std, min, max)
    """
    # Run in thread pool since EE operations are blocking
    loop = asyncio.get_event_loop()

    def download():
        img = ee_image.select(band)
        stats = img.reduceRegion(
            reducer=ee.Reducer.mean().combine(
                ee.Reducer.stdDev(), "std_dev", True
            ),
            geometry=ee_geometry,
            scale=scale,
        )
        return stats.getInfo()

    result = await loop.run_in_executor(None, download)
    return result


# Initialize GEE on module load
# This will run once when the service starts
try:
    asyncio.run(initialize_gee())
except:
    logger.warning("GEE will be initialized on first request")
