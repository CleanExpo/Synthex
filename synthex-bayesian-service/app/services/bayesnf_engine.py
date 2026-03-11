"""
BayesNF spatiotemporal prediction engine wrapper.

Manages per-org spatiotemporal models for cross-platform/cross-region
performance prediction with calibrated uncertainty.

Note: BayesNF repo is archived (Nov 2025) but code is stable
(Nature Communications 2024 paper). Version pinned.
"""

import logging
import uuid
from datetime import datetime
from threading import Thread
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("synthex-ai.bayesnf")

# In-memory storage
_models: dict[str, dict] = {}  # modelId -> model state


def _import_bayesnf():
    """Lazy import BayesNF to avoid startup cost if engine is disabled."""
    try:
        import bayesnf
        return bayesnf
    except ImportError:
        logger.warning("BayesNF not available — spatiotemporal predictions disabled")
        return None


def train_model(
    org_id: str,
    name: str,
    target_metric: str,
    dimensions: dict,
    data: list[dict],
    config: Optional[dict] = None,
) -> dict:
    """Train a new BayesNF spatiotemporal model."""
    model_id = f"stm_{uuid.uuid4().hex[:12]}"
    model_state = {
        "modelId": model_id,
        "orgId": org_id,
        "name": name,
        "targetMetric": target_metric,
        "dimensions": dimensions,
        "status": "training",
        "trainingPoints": len(data),
        "accuracy": None,
        "config": config,
        "lastTrainedAt": None,
        "_model": None,
    }
    _models[model_id] = model_state

    def _run():
        try:
            bayesnf_mod = _import_bayesnf()
            if bayesnf_mod is None:
                model_state["status"] = "failed"
                model_state["_error"] = "BayesNF not installed"
                return

            from bayesnf.spatiotemporal import BayesianNeuralFieldVI
            import jax.random

            df = pd.DataFrame(data)

            # Convert date columns to numeric (days since epoch)
            temporal_cols = dimensions.get("temporal", [])
            for col in temporal_cols:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col])
                    df[f"{col}_numeric"] = (df[col] - pd.Timestamp("2020-01-01")).dt.days

            # Encode spatial columns as numeric
            spatial_cols = dimensions.get("spatial", [])
            label_maps = {}
            for col in spatial_cols:
                if col in df.columns and df[col].dtype == object:
                    unique_vals = df[col].unique()
                    label_maps[col] = {v: i for i, v in enumerate(unique_vals)}
                    df[f"{col}_numeric"] = df[col].map(label_maps[col])

            # Build feature columns
            feature_cols = [f"{c}_numeric" for c in temporal_cols if f"{c}_numeric" in df.columns]
            feature_cols += [f"{c}_numeric" for c in spatial_cols if f"{c}_numeric" in df.columns]

            if not feature_cols:
                raise ValueError("No valid feature columns after processing")

            # Extract arrays
            X = df[feature_cols].values.astype(np.float32)
            y = df[target_metric].values.astype(np.float32)

            # Configure BayesNF model
            hyper = config or {}
            model = BayesianNeuralFieldVI(
                width=hyper.get("width", 64),
                depth=hyper.get("depth", 2),
                freq=hyper.get("freq", 1),
                seasonality_periods=hyper.get("seasonality_periods", []),
            )

            # Fit model
            key = jax.random.PRNGKey(hyper.get("seed", 42))
            model.fit(X, y, key, num_epochs=hyper.get("epochs", 500))

            model_state["_model"] = model
            model_state["_label_maps"] = label_maps
            model_state["_feature_cols"] = feature_cols
            model_state["status"] = "ready"
            model_state["lastTrainedAt"] = datetime.utcnow().isoformat()

            logger.info("BayesNF model %s trained: %d points", model_id, len(data))

        except Exception as e:
            model_state["status"] = "failed"
            model_state["_error"] = str(e)
            logger.error("BayesNF model %s training failed: %s", model_id, e)

    thread = Thread(target=_run, daemon=True)
    thread.start()

    return _get_model_response(model_state)


def predict_points(
    model_id: str,
    query_points: list[dict],
    quantiles: list[float] = [0.05, 0.5, 0.95],
) -> dict:
    """Predict at arbitrary space-time query points."""
    if model_id not in _models:
        raise KeyError(f"Model {model_id} not found")

    model_state = _models[model_id]
    if model_state["status"] != "ready":
        raise ValueError(f"Model {model_id} is not ready (status: {model_state['status']})")

    model = model_state["_model"]
    if model is None:
        raise ValueError(f"Model {model_id} has no fitted model")

    label_maps = model_state.get("_label_maps", {})
    dimensions = model_state["dimensions"]

    # Convert query points to numeric
    df = pd.DataFrame(query_points)
    temporal_cols = dimensions.get("temporal", [])
    spatial_cols = dimensions.get("spatial", [])

    for col in temporal_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col])
            df[f"{col}_numeric"] = (df[col] - pd.Timestamp("2020-01-01")).dt.days

    for col in spatial_cols:
        if col in df.columns and col in label_maps:
            df[f"{col}_numeric"] = df[col].map(label_maps[col])

    feature_cols = model_state.get("_feature_cols", [])
    X_query = df[feature_cols].values.astype(np.float32)

    # Get predictions with uncertainty
    predictions_raw = model.predict(X_query)

    # Build response
    predictions = []
    for i, qp in enumerate(query_points):
        pred_values = {}
        if isinstance(predictions_raw, np.ndarray):
            if predictions_raw.ndim == 2:
                # Multiple samples — compute quantiles
                samples = predictions_raw[:, i] if predictions_raw.shape[1] > i else predictions_raw[i]
                for q in quantiles:
                    pred_values[str(q)] = round(float(np.quantile(samples, q)), 4)
            else:
                pred_values["0.5"] = round(float(predictions_raw[i]), 4)
        else:
            pred_values["0.5"] = round(float(predictions_raw), 4)

        predictions.append({
            "queryPoint": qp,
            "predictions": pred_values,
        })

    return {
        "modelId": model_id,
        "predictions": predictions,
    }


def get_model(model_id: str) -> dict:
    """Get model status and metadata."""
    if model_id not in _models:
        raise KeyError(f"Model {model_id} not found")
    return _get_model_response(_models[model_id])


def list_models(org_id: str) -> list[dict]:
    """List all spatiotemporal models for an organisation."""
    return [
        _get_model_response(m)
        for m in _models.values()
        if m["orgId"] == org_id
    ]


def _get_model_response(state: dict) -> dict:
    """Build a safe response dict (excludes internal objects)."""
    return {
        "modelId": state["modelId"],
        "orgId": state["orgId"],
        "name": state["name"],
        "targetMetric": state["targetMetric"],
        "dimensions": state["dimensions"],
        "status": state["status"],
        "trainingPoints": state["trainingPoints"],
        "accuracy": state["accuracy"],
        "lastTrainedAt": state["lastTrainedAt"],
    }
