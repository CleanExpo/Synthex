"""
Health check endpoint — reports status of all 3 engines.
"""

from fastapi import APIRouter

from app.config import settings
from app.models.schemas import HealthResponse

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Check the health of all three engines."""
    engines = {}

    # Check BayesianOptimization
    if settings.ENABLE_BO:
        try:
            from bayes_opt import BayesianOptimization  # noqa: F401
            engines["bo"] = "healthy"
        except ImportError:
            engines["bo"] = "down"
    else:
        engines["bo"] = "disabled"

    # Check Prophet
    if settings.ENABLE_PROPHET:
        try:
            from prophet import Prophet  # noqa: F401
            engines["prophet"] = "healthy"
        except ImportError:
            engines["prophet"] = "down"
    else:
        engines["prophet"] = "disabled"

    # Check BayesNF
    if settings.ENABLE_BAYESNF:
        try:
            import bayesnf  # noqa: F401
            engines["bayesnf"] = "healthy"
        except ImportError:
            engines["bayesnf"] = "down"
    else:
        engines["bayesnf"] = "disabled"

    # Overall status
    healthy_count = sum(1 for s in engines.values() if s == "healthy")
    total_enabled = sum(1 for s in engines.values() if s != "disabled")

    if healthy_count == total_enabled:
        status = "healthy"
    elif healthy_count > 0:
        status = "degraded"
    else:
        status = "down"

    return HealthResponse(
        status=status,
        version="1.0.0",
        engines=engines,
        activeJobs=0,
    )
