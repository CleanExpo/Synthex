"""
Synthex Adaptive Intelligence Service

FastAPI microservice providing three AI engines:
1. BayesianOptimization — parameter optimisation (find best weights)
2. Prophet — time-series forecasting (predict engagement, traffic)
3. BayesNF — spatiotemporal prediction (cross-platform performance)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health, optimise, forecast, predict

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("synthex-ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    logger.info("Synthex Adaptive Intelligence Service starting up")
    logger.info("Port: %s", settings.PORT)
    logger.info(
        "Service API key configured: %s",
        "yes" if settings.SERVICE_API_KEY else "NO (authentication disabled)",
    )
    engines = []
    if settings.ENABLE_BO:
        engines.append("BayesianOptimization")
    if settings.ENABLE_PROPHET:
        engines.append("Prophet")
    if settings.ENABLE_BAYESNF:
        engines.append("BayesNF")
    logger.info("Active engines: %s", ", ".join(engines) or "NONE")
    logger.info("Service is ready to accept requests")
    yield
    logger.info("Synthex Adaptive Intelligence Service shutting down")


app = FastAPI(
    title="Synthex Adaptive Intelligence Service",
    description="AI microservice for Synthex: optimisation, forecasting, spatiotemporal prediction",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for Synthex domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://synthex.app",
        "https://*.synthex.app",
        "https://synthex.vercel.app",
        "https://*.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers — each engine gets its own prefix
app.include_router(health.router)
app.include_router(optimise.router)
app.include_router(forecast.router)
app.include_router(predict.router)
