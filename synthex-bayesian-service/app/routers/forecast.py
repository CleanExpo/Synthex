"""
Prophet forecasting router — /api/v1/forecast/

Manages time-series forecast models: train, predict, retrain, list.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.middleware.auth import verify_service_key
from app.models.schemas import (
    TrainForecastRequest,
    ForecastModelResponse,
    ForecastPredictRequest,
    ForecastPredictResponse,
)
from app.services import prophet_engine

router = APIRouter(
    prefix="/api/v1/forecast",
    tags=["forecast"],
    dependencies=[Depends(verify_service_key)],
)


@router.post("/models", response_model=ForecastModelResponse)
async def train_model(request: TrainForecastRequest):
    """Create and train a new Prophet forecast model."""
    if len(request.data) < 10:
        raise HTTPException(
            status_code=400,
            detail="Need at least 10 data points to train a forecast model",
        )

    data_dicts = [{"ds": p.ds, "y": p.y} for p in request.data]
    result = prophet_engine.train_model(
        org_id=request.orgId,
        metric=request.metric,
        data=data_dicts,
        platform=request.platform,
        seasonality={
            "weekly": request.seasonality.weekly,
            "yearly": request.seasonality.yearly,
            "daily": request.seasonality.daily,
        },
        holidays=request.holidays,
    )
    return result


@router.get("/models/{model_id}", response_model=ForecastModelResponse)
async def get_model(model_id: str):
    """Get forecast model status and accuracy metrics."""
    try:
        return prophet_engine.get_model(model_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/models", response_model=list[ForecastModelResponse])
async def list_models(org_id: str = Query(..., alias="orgId")):
    """List all forecast models for an organisation."""
    return prophet_engine.list_models(org_id)


@router.post("/models/{model_id}/predict", response_model=ForecastPredictResponse)
async def predict(model_id: str, request: ForecastPredictRequest):
    """Generate a forecast with confidence intervals."""
    if request.horizonDays not in (7, 30, 90):
        raise HTTPException(
            status_code=400,
            detail="horizonDays must be 7, 30, or 90",
        )

    try:
        return prophet_engine.predict(model_id, request.horizonDays)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/models/{model_id}/retrain", response_model=ForecastModelResponse)
async def retrain_model(model_id: str, request: TrainForecastRequest):
    """Retrain an existing model with new data."""
    data_dicts = [{"ds": p.ds, "y": p.y} for p in request.data]
    try:
        return prophet_engine.retrain_model(model_id, data_dicts)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
