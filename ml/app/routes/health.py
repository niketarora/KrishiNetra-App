"""
Health check routes
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "krishinetra-ml"}


@router.get("/health/ready")
async def readiness_check():
    """Readiness check (models loaded, GEE connected)"""
    # TODO: Check if models are loaded and GEE is connected
    return {"ready": True, "service": "krishinetra-ml"}
