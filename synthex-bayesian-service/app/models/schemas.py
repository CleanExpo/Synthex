"""
Pydantic v2 models for the Adaptive Intelligence Service.

Defines request/response schemas for all three engines:
- BayesianOptimization (optimise)
- Prophet (forecast)
- BayesNF (predict)
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


# ─── Shared ──────────────────────────────────────────────────────────────────────


class EngineStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"
    DISABLED = "disabled"


class HealthResponse(BaseModel):
    status: str
    version: str
    engines: dict[str, str]  # engine_name -> status
    activeJobs: int


class JobStatusResponse(BaseModel):
    jobId: str
    engine: str  # "bo", "prophet", "bayesnf"
    status: str  # pending, running, completed, failed, cancelled
    progress: Optional[float] = None  # 0.0-1.0
    error: Optional[str] = None


# ─── BayesianOptimization (Engine 1) ─────────────────────────────────────────────


class AcquisitionFunction(str, Enum):
    UCB = "ucb"
    EI = "ei"
    POI = "poi"


class ParameterBounds(BaseModel):
    min: float
    max: float


class CreateSpaceRequest(BaseModel):
    spaceId: str
    orgId: str
    surface: str
    parameters: dict[str, ParameterBounds]
    acquisitionFunction: AcquisitionFunction = AcquisitionFunction.EI
    constraints: Optional[dict] = None


class SpaceResponse(BaseModel):
    spaceId: str
    orgId: str
    surface: str
    parameters: dict[str, ParameterBounds]
    acquisitionFunction: str
    totalObservations: int
    bestParameters: Optional[dict[str, float]] = None
    bestTarget: Optional[float] = None


class ObserveRequest(BaseModel):
    parameters: dict[str, float]
    target: float
    metadata: Optional[dict] = None


class ObserveResponse(BaseModel):
    id: str
    spaceId: str
    totalObservations: int


class SuggestResponse(BaseModel):
    suggestedParameters: dict[str, float]
    expectedImprovement: float
    acquisitionValue: float
    iteration: int


class MaximiseRequest(BaseModel):
    initPoints: int = 5
    nIterations: int = 25
    callbackUrl: Optional[str] = None


class MaximiseResponse(BaseModel):
    jobId: str
    status: str


class BOJobStatusResponse(BaseModel):
    jobId: str
    spaceId: str
    status: str
    currentIteration: int
    bestParameters: Optional[dict[str, float]] = None
    bestTarget: Optional[float] = None
    error: Optional[str] = None


# ─── Prophet (Engine 2) ──────────────────────────────────────────────────────────


class TimeSeriesDataPoint(BaseModel):
    ds: str  # Date string YYYY-MM-DD
    y: float


class SeasonalityConfig(BaseModel):
    weekly: bool = True
    yearly: bool = True
    daily: bool = False


class TrainForecastRequest(BaseModel):
    orgId: str
    metric: str  # "engagement_rate", "impressions", etc.
    platform: Optional[str] = None  # null = aggregate
    data: list[TimeSeriesDataPoint]
    seasonality: SeasonalityConfig = SeasonalityConfig()
    holidays: Optional[str] = None  # Country code e.g. "AU"


class ForecastModelResponse(BaseModel):
    modelId: str
    orgId: str
    metric: str
    platform: Optional[str] = None
    status: str  # pending, training, ready, failed
    trainingPoints: int
    accuracy: Optional[dict] = None  # { mape, rmse, mae }
    seasonality: Optional[dict] = None
    lastTrainedAt: Optional[str] = None


class PredictionPoint(BaseModel):
    ds: str
    yhat: float
    yhat_lower: float
    yhat_upper: float


class ForecastPredictRequest(BaseModel):
    horizonDays: int = 30  # 7, 30, or 90


class ForecastPredictResponse(BaseModel):
    modelId: str
    metric: str
    platform: Optional[str] = None
    horizonDays: int
    predictions: list[PredictionPoint]
    accuracy: Optional[dict] = None
    seasonality: Optional[dict] = None


# ─── BayesNF (Engine 3) ──────────────────────────────────────────────────────────


class SpatiotemporalDataPoint(BaseModel):
    """A single data point with arbitrary spatial + temporal dimensions."""
    # Stored as flat dict — e.g. {"platform": "instagram", "date": "2025-06-01", "engagement_rate": 4.2}
    values: dict[str, float | str]


class DimensionConfig(BaseModel):
    spatial: list[str]  # e.g. ["platform"]
    temporal: list[str]  # e.g. ["date"]


class TrainSpatiotemporalRequest(BaseModel):
    orgId: str
    name: str  # "cross_platform_engagement"
    targetMetric: str  # "engagement_rate"
    dimensions: DimensionConfig
    data: list[dict]  # List of flat dicts with dimension + target values
    config: Optional[dict] = None  # BayesNF hyperparameters


class SpatiotemporalModelResponse(BaseModel):
    modelId: str
    orgId: str
    name: str
    targetMetric: str
    dimensions: DimensionConfig
    status: str
    trainingPoints: int
    accuracy: Optional[dict] = None
    lastTrainedAt: Optional[str] = None


class SpatiotemporalPredictRequest(BaseModel):
    """Predict at arbitrary space-time query points."""
    queryPoints: list[dict]  # e.g. [{"platform": "instagram", "date": "2026-07-01"}]
    quantiles: list[float] = [0.05, 0.5, 0.95]  # Uncertainty quantiles


class SpatiotemporalPrediction(BaseModel):
    queryPoint: dict
    predictions: dict[str, float]  # quantile -> predicted value


class SpatiotemporalPredictResponse(BaseModel):
    modelId: str
    predictions: list[SpatiotemporalPrediction]
