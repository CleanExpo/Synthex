"""Structured JSON logging for the brand intelligence pipeline.

Every agent run produces a JSON log entry per the SYN-491 quality standards.
Fields: agent_name, model, client_id, duration_ms, input_tokens, output_tokens,
cost_usd, error_state, error_message, timestamp.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

ErrorState = Literal["success", "partial_failure", "failure"]

LOGS_DIR = Path(__file__).parent / "logs"


def _ensure_logs_dir() -> None:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)


def log_agent_run(
    *,
    agent_name: str,
    model: str,
    client_id: str,
    duration_ms: int,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float,
    error_state: ErrorState = "success",
    error_message: str | None = None,
) -> dict:
    """Log a single agent run as structured JSON. Returns the log entry."""
    _ensure_logs_dir()

    entry = {
        "agent_name": agent_name,
        "model": model,
        "client_id": client_id,
        "duration_ms": duration_ms,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": round(cost_usd, 4),
        "error_state": error_state,
        "error_message": error_message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Append to the daily log file
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    log_file = LOGS_DIR / f"agent-runs-{today}.jsonl"
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

    # Also emit to Python logger for stdout visibility
    logger = logging.getLogger("synthex.pipeline")
    level = logging.INFO if error_state == "success" else logging.ERROR
    logger.log(level, json.dumps(entry))

    return entry


def setup_logging(verbose: bool = False) -> None:
    """Configure Python logging for the pipeline."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )
