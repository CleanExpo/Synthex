"""
BayesNF spatiotemporal prediction router — /api/v1/predict/

Manages spatiotemporal models for cross-platform/cross-region prediction.
Scale tier only — compute-intensive (GPU recommended).
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth import verify_service_key
from app.models.schemas import (
    TrainSpatiotemporalRequest,
    SpatiotemporalModelResponse,
    SpatiotemporalPredictRequest,
    SpatiotemporalPredictResponse,
)
from app.services import bayesnf_engine

router = APIRouter(
    prefix="/api/v1/predict",
    tags=["predict"],
    dependencies=[Depends(verify_service_key)],
)


@router.post("/models", response_model=SpatiotemporalModelResponse)
async def train_model(request: TrainSpatiotemporalRequest):
    """Create and train a new BayesNF spatiotemporal model."""
    if len(request.data) < 20:
        raise HTTPException(
            status_code=400,
            detail="Need at least 20 data points to train a spatiotemporal model",
        )

    result = bayesnf_engine.train_model(
        org_id=request.orgId,
        name=request.name,
        target_metric=request.targetMetric,
        dimensions=request.dimensions.model_dump(),
        data=request.data,
        config=request.config,
    )
    return result


@router.get("/models/{model_id}", response_model=SpatiotemporalModelResponse)
async def get_model(model_id: str):
    """Get spatiotemporal model status."""
    try:
        return bayesnf_engine.get_model(model_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/models", response_model=list[SpatiotemporalModelResponse])
async def list_models(org_id: str = Query(..., alias="orgId")):
    """List all spatiotemporal models for an organisation."""
    return bayesnf_engine.list_models(org_id)


@router.post("/models/{model_id}/predict", response_model=SpatiotemporalPredictResponse)
async def predict(model_id: str, request: SpatiotemporalPredictRequest):
    """Predict values at arbitrary space-time points."""
    try:
        return bayesnf_engine.predict_points(
            model_id=model_id,
            query_points=request.queryPoints,
            quantiles=request.quantiles,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
