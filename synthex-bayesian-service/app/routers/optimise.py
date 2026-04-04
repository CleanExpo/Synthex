"""
BayesianOptimization router — /api/v1/optimise/

Manages optimisation spaces, observations, suggestions, and maximisation runs.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import verify_service_key
from app.models.schemas import (
    CreateSpaceRequest,
    SpaceResponse,
    ObserveRequest,
    ObserveResponse,
    SuggestResponse,
    MaximiseRequest,
    MaximiseResponse,
    BOJobStatusResponse,
)
from app.services import bo_engine

router = APIRouter(
    prefix="/api/v1/optimise",
    tags=["optimise"],
    dependencies=[Depends(verify_service_key)],
)


@router.post("/spaces", response_model=SpaceResponse)
async def create_space(request: CreateSpaceRequest):
    """Create a new optimisation space."""
    try:
        params = {
            k: {"min": v.min, "max": v.max}
            for k, v in request.parameters.items()
        }
        result = bo_engine.create_space(
            space_id=request.spaceId,
            org_id=request.orgId,
            surface=request.surface,
            parameters=params,
            acquisition_fn=request.acquisitionFunction.value,
            constraints=request.constraints,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/spaces/{space_id}", response_model=SpaceResponse)
async def get_space(space_id: str):
    """Get optimisation space configuration."""
    try:
        return bo_engine.get_space(space_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/spaces/{space_id}/observe", response_model=ObserveResponse)
async def observe(space_id: str, request: ObserveRequest):
    """Register an observation (known data point)."""
    try:
        return bo_engine.observe(
            space_id=space_id,
            parameters=request.parameters,
            target=request.target,
            metadata=request.metadata,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/spaces/{space_id}/suggest", response_model=SuggestResponse)
async def suggest(space_id: str):
    """Get the next parameter suggestion using acquisition function."""
    try:
        return bo_engine.suggest(space_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/spaces/{space_id}/maximise", response_model=MaximiseResponse)
async def maximise(space_id: str, request: MaximiseRequest):
    """Start an asynchronous maximisation run."""
    try:
        return bo_engine.maximise(
            space_id=space_id,
            init_points=request.initPoints,
            n_iterations=request.nIterations,
            callback_url=request.callbackUrl,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/jobs/{job_id}", response_model=BOJobStatusResponse)
async def get_job_status(job_id: str):
    """Get the status of a maximisation job."""
    try:
        return bo_engine.get_job_status(job_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
