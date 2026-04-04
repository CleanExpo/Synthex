"""
Prophet forecasting engine wrapper.

Manages per-org/metric Prophet models: train, predict, serialise, cross-validate.
Models are stored in-memory with JSON serialisation for persistence.
"""

import json
import logging
import uuid
from datetime import datetime
from threading import Thread
from typing import Optional

import pandas as pd

logger = logging.getLogger("synthex-ai.prophet")

# In-memory storage
_models: dict[str, dict] = {}  # modelId -> model state
_jobs: dict[str, dict] = {}  # jobId -> job state


def _import_prophet():
    """Lazy import Prophet to avoid startup cost if engine is disabled."""
    from prophet import Prophet
    return Prophet


def train_model(
    org_id: str,
    metric: str,
    data: list[dict],
    platform: Optional[str] = None,
    seasonality: Optional[dict] = None,
    holidays: Optional[str] = None,
) -> dict:
    """Train a new Prophet model on time-series data."""
    Prophet = _import_prophet()

    model_id = f"fm_{uuid.uuid4().hex[:12]}"
    model_state = {
        "modelId": model_id,
        "orgId": org_id,
        "metric": metric,
        "platform": platform,
        "status": "training",
        "trainingPoints": len(data),
        "accuracy": None,
        "seasonality": None,
        "lastTrainedAt": None,
        "_prophet": None,  # Will hold fitted model
        "_model_json": None,  # Serialised model
    }
    _models[model_id] = model_state

    # Train in background
    def _run():
        try:
            # Prepare data
            df = pd.DataFrame(data)
            df["ds"] = pd.to_datetime(df["ds"])
            df = df.sort_values("ds").reset_index(drop=True)

            # Configure model
            seas = seasonality or {}
            m = Prophet(
                weekly_seasonality=seas.get("weekly", True),
                yearly_seasonality=seas.get("yearly", True),
                daily_seasonality=seas.get("daily", False),
            )

            # Add country holidays
            if holidays:
                m.add_country_holidays(country_name=holidays)

            # Fit
            m.fit(df)

            # Cross-validate for accuracy (if enough data)
            accuracy = None
            if len(df) >= 30:
                try:
                    from prophet.diagnostics import cross_validation, performance_metrics
                    cv_results = cross_validation(
                        m,
                        initial="14 days",
                        period="7 days",
                        horizon="7 days",
                    )
                    perf = performance_metrics(cv_results)
                    accuracy = {
                        "mape": round(float(perf["mape"].iloc[-1]), 4),
                        "rmse": round(float(perf["rmse"].iloc[-1]), 4),
                        "mae": round(float(perf["mae"].iloc[-1]), 4),
                    }
                except Exception as cv_err:
                    logger.warning("Cross-validation failed for model %s: %s", model_id, cv_err)

            # Detect seasonality info
            seas_info = {}
            if hasattr(m, "seasonalities"):
                for name, config in m.seasonalities.items():
                    seas_info[name] = {
                        "period": config["period"],
                        "fourier_order": config["fourier_order"],
                    }

            # Serialise model to JSON
            model_json = m.to_json()

            # Update state
            model_state["_prophet"] = m
            model_state["_model_json"] = model_json
            model_state["status"] = "ready"
            model_state["accuracy"] = accuracy
            model_state["seasonality"] = seas_info if seas_info else None
            model_state["lastTrainedAt"] = datetime.utcnow().isoformat()

            logger.info("Prophet model %s trained: %d points, accuracy=%s",
                        model_id, len(df), accuracy)

        except Exception as e:
            model_state["status"] = "failed"
            logger.error("Prophet model %s training failed: %s", model_id, e)

    thread = Thread(target=_run, daemon=True)
    thread.start()

    return _get_model_response(model_state)


def predict(model_id: str, horizon_days: int = 30) -> dict:
    """Generate a forecast from a trained model."""
    if model_id not in _models:
        raise KeyError(f"Model {model_id} not found")

    model_state = _models[model_id]
    if model_state["status"] != "ready":
        raise ValueError(f"Model {model_id} is not ready (status: {model_state['status']})")

    m = model_state["_prophet"]
    if m is None:
        # Try to restore from JSON
        if model_state["_model_json"]:
            from prophet.serialize import model_from_json
            m = model_from_json(model_state["_model_json"])
            model_state["_prophet"] = m
        else:
            raise ValueError(f"Model {model_id} has no fitted model")

    # Generate future dataframe
    future = m.make_future_dataframe(periods=horizon_days)
    forecast = m.predict(future)

    # Extract only the future predictions
    last_training_date = pd.to_datetime(model_state.get("_last_ds", forecast["ds"].iloc[-horizon_days - 1]))
    future_forecast = forecast.tail(horizon_days)

    predictions = []
    for _, row in future_forecast.iterrows():
        predictions.append({
            "ds": row["ds"].strftime("%Y-%m-%d"),
            "yhat": round(float(row["yhat"]), 4),
            "yhat_lower": round(float(row["yhat_lower"]), 4),
            "yhat_upper": round(float(row["yhat_upper"]), 4),
        })

    return {
        "modelId": model_id,
        "metric": model_state["metric"],
        "platform": model_state["platform"],
        "horizonDays": horizon_days,
        "predictions": predictions,
        "accuracy": model_state["accuracy"],
        "seasonality": model_state["seasonality"],
    }


def get_model(model_id: str) -> dict:
    """Get model status and metadata."""
    if model_id not in _models:
        raise KeyError(f"Model {model_id} not found")
    return _get_model_response(_models[model_id])


def list_models(org_id: str) -> list[dict]:
    """List all models for an organisation."""
    return [
        _get_model_response(m)
        for m in _models.values()
        if m["orgId"] == org_id
    ]


def retrain_model(model_id: str, data: list[dict]) -> dict:
    """Retrain an existing model with new data."""
    if model_id not in _models:
        raise KeyError(f"Model {model_id} not found")

    model_state = _models[model_id]
    model_state["status"] = "training"

    # Re-train in background using existing config
    def _run():
        try:
            Prophet = _import_prophet()
            df = pd.DataFrame(data)
            df["ds"] = pd.to_datetime(df["ds"])
            df = df.sort_values("ds").reset_index(drop=True)

            m = Prophet()
            m.fit(df)

            model_state["_prophet"] = m
            model_state["_model_json"] = m.to_json()
            model_state["status"] = "ready"
            model_state["trainingPoints"] = len(df)
            model_state["lastTrainedAt"] = datetime.utcnow().isoformat()
            logger.info("Prophet model %s retrained with %d points", model_id, len(df))
        except Exception as e:
            model_state["status"] = "failed"
            logger.error("Prophet model %s retrain failed: %s", model_id, e)

    thread = Thread(target=_run, daemon=True)
    thread.start()

    return _get_model_response(model_state)


def _get_model_response(state: dict) -> dict:
    """Build a safe response dict (excludes internal objects)."""
    return {
        "modelId": state["modelId"],
        "orgId": state["orgId"],
        "metric": state["metric"],
        "platform": state["platform"],
        "status": state["status"],
        "trainingPoints": state["trainingPoints"],
        "accuracy": state["accuracy"],
        "seasonality": state["seasonality"],
        "lastTrainedAt": state["lastTrainedAt"],
    }
