"""Per-client cost tracking for the brand intelligence pipeline.

Implements SYN-491 quality standards:
- Per-client cost tracking in /logs/platform-summary-{run_id}.json
- Cost alert thresholds: >$6.50 warn, >$7.50 Slack, $8.00 stop, 3x CEO Board
- Token-to-cost conversion using current model pricing
- Budget validation: total_usd = sum(per_client) = sum(per_agent)

See docs/pipeline/COST-TRACKING-SCHEMA.md for the full schema.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

logger = logging.getLogger("synthex.cost")

LOGS_DIR = Path(__file__).parent / "logs"

# Budget cap per SYN-491
BUDGET_CAP_USD = 8.00

# Alert thresholds per QUALITY-STANDARDS.md
WARN_THRESHOLD = 6.50
SLACK_ALERT_THRESHOLD = 7.50
STOP_THRESHOLD = 8.00

# Token-to-cost conversion rates (per 1M tokens) — COST-TRACKING-SCHEMA.md
MODEL_PRICING: dict[str, dict[str, float]] = {
    "claude-opus-4-6": {"input": 5.00, "output": 25.00},
    "claude-sonnet-4-6": {"input": 3.00, "output": 15.00},
    "claude-haiku-4-5": {"input": 1.00, "output": 5.00},
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost in USD for a given model and token counts."""
    pricing = MODEL_PRICING.get(model)
    if not pricing:
        logger.warning(f"Unknown model '{model}', using Sonnet pricing as fallback")
        pricing = MODEL_PRICING["claude-sonnet-4-6"]

    cost = (input_tokens / 1_000_000 * pricing["input"]) + (
        output_tokens / 1_000_000 * pricing["output"]
    )
    return round(cost, 4)


@dataclass
class RunCostTracker:
    """Tracks costs for a single pipeline run across all agents and clients."""

    run_id: str
    mode: Literal["full", "discovery", "enforce", "refresh", "onboarding"]
    budget_usd: float = BUDGET_CAP_USD
    _per_client: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    _per_agent: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    _total_usd: float = 0.0
    _budget_exceeded: bool = False
    _consecutive_overruns: int = 0

    @property
    def total_usd(self) -> float:
        return round(self._total_usd, 4)

    @property
    def budget_remaining(self) -> float:
        return round(max(0, self.budget_usd - self._total_usd), 4)

    @property
    def is_over_budget(self) -> bool:
        return self._total_usd >= self.budget_usd

    def record(self, *, agent_name: str, client_id: str, cost_usd: float) -> None:
        """Record a cost entry. Raises BudgetExceededError if cap is hit."""
        self._per_client[client_id] += cost_usd
        self._per_agent[agent_name] += cost_usd
        self._total_usd += cost_usd

        # Check alert thresholds
        if self._total_usd > SLACK_ALERT_THRESHOLD:
            logger.critical(
                f"COST ALERT: Run {self.run_id} at ${self._total_usd:.2f} "
                f"(threshold: ${SLACK_ALERT_THRESHOLD}). Slack alert required."
            )
        elif self._total_usd > WARN_THRESHOLD:
            logger.warning(
                f"COST WARNING: Run {self.run_id} at ${self._total_usd:.2f} "
                f"(threshold: ${WARN_THRESHOLD})"
            )

        if self._total_usd >= STOP_THRESHOLD:
            self._budget_exceeded = True
            raise BudgetExceededError(
                f"Budget cap ${STOP_THRESHOLD:.2f} reached. "
                f"Current total: ${self._total_usd:.2f}. "
                f"Stopping gracefully."
            )

    def validate(self) -> list[str]:
        """Validate cost consistency. Returns list of validation errors."""
        errors = []
        per_client_sum = round(sum(self._per_client.values()), 4)
        per_agent_sum = round(sum(self._per_agent.values()), 4)

        if abs(self.total_usd - per_client_sum) > 0.01:
            errors.append(
                f"total_usd ({self.total_usd}) != sum(per_client) ({per_client_sum})"
            )
        if abs(self.total_usd - per_agent_sum) > 0.01:
            errors.append(
                f"total_usd ({self.total_usd}) != sum(per_agent) ({per_agent_sum})"
            )

        # Anomaly detection: no single client should exceed $2.00
        for client_id, cost in self._per_client.items():
            if cost > 2.00:
                errors.append(
                    f"Client {client_id} cost ${cost:.2f} exceeds $2.00 anomaly threshold"
                )

        return errors

    def write_summary(
        self,
        *,
        started_at: str,
        completed_at: str,
        clients_processed: int,
        clients_failed: int,
        agent_runs: list[dict],
        drift_events: list[dict] | None = None,
    ) -> Path:
        """Write the platform summary JSON to logs/. Returns the file path."""
        LOGS_DIR.mkdir(parents=True, exist_ok=True)

        summary = {
            "run_id": self.run_id,
            "mode": self.mode,
            "started_at": started_at,
            "completed_at": completed_at,
            "total_duration_ms": _iso_diff_ms(started_at, completed_at),
            "clients_processed": clients_processed,
            "clients_failed": clients_failed,
            "agent_runs": agent_runs,
            "cost_summary": {
                "total_usd": self.total_usd,
                "per_client": {k: round(v, 4) for k, v in self._per_client.items()},
                "per_agent": {k: round(v, 4) for k, v in self._per_agent.items()},
                "budget_remaining_usd": self.budget_remaining,
            },
            "drift_events": drift_events or [],
        }

        # Validate before writing
        errors = self.validate()
        if errors:
            logger.error(f"Cost validation errors: {errors}")
            summary["validation_errors"] = errors

        file_path = LOGS_DIR / f"platform-summary-{self.run_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)

        logger.info(f"Pipeline summary written to {file_path}")
        return file_path


class BudgetExceededError(Exception):
    """Raised when a pipeline run hits the budget cap."""

    pass


def _iso_diff_ms(start: str, end: str) -> int:
    """Calculate millisecond difference between two ISO timestamps."""
    try:
        t_start = datetime.fromisoformat(start)
        t_end = datetime.fromisoformat(end)
        return int((t_end - t_start).total_seconds() * 1000)
    except (ValueError, TypeError):
        return 0
