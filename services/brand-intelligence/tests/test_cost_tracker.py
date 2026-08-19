"""Tests for cost_tracker.py — SYN-491 mandatory coverage.

Tests:
- Cost calculation per model
- Budget cap enforcement
- Cost validation (per_client sum == per_agent sum == total)
- Alert thresholds
- Summary file generation
- Anomaly detection (single client >$2.00)
"""

import json
from pathlib import Path

import pytest

from cost_tracker import (
    BUDGET_CAP_USD,
    BudgetExceededError,
    RunCostTracker,
    calculate_cost,
)


class TestCalculateCost:
    def test_opus_pricing(self):
        # 100K input, 10K output on Opus 4.6
        # (100000/1M * $5.00) + (10000/1M * $25.00) = $0.50 + $0.25 = $0.75
        cost = calculate_cost("claude-opus-4-6", 100_000, 10_000)
        assert cost == pytest.approx(0.75, abs=0.01)

    def test_sonnet_pricing(self):
        # 100K input, 10K output on Sonnet 4.6
        # (100000/1M * $3.00) + (10000/1M * $15.00) = $0.30 + $0.15 = $0.45
        cost = calculate_cost("claude-sonnet-4-6", 100_000, 10_000)
        assert cost == pytest.approx(0.45, abs=0.01)

    def test_haiku_pricing(self):
        # 100K input, 10K output on Haiku 4.5
        # (100000/1M * $1.00) + (10000/1M * $5.00) = $0.10 + $0.05 = $0.15
        cost = calculate_cost("claude-haiku-4-5", 100_000, 10_000)
        assert cost == pytest.approx(0.15, abs=0.01)

    def test_zero_tokens(self):
        assert calculate_cost("claude-opus-4-6", 0, 0) == 0.0

    def test_unknown_model_uses_sonnet_fallback(self):
        cost = calculate_cost("unknown-model", 100_000, 10_000)
        expected_sonnet = calculate_cost("claude-sonnet-4-6", 100_000, 10_000)
        assert cost == expected_sonnet


class TestRunCostTracker:
    def test_initial_state(self):
        tracker = RunCostTracker(run_id="test_001", mode="full")
        assert tracker.total_usd == 0.0
        assert tracker.budget_remaining == BUDGET_CAP_USD
        assert not tracker.is_over_budget

    def test_record_accumulates(self):
        tracker = RunCostTracker(run_id="test_001", mode="full")
        tracker.record(agent_name="research", client_id="cli_001", cost_usd=1.50)
        tracker.record(agent_name="analyst", client_id="cli_001", cost_usd=0.80)
        assert tracker.total_usd == pytest.approx(2.30, abs=0.01)
        assert tracker.budget_remaining == pytest.approx(5.70, abs=0.01)

    def test_budget_cap_enforcement(self):
        tracker = RunCostTracker(run_id="test_001", mode="full")
        tracker.record(agent_name="research", client_id="cli_001", cost_usd=7.50)

        with pytest.raises(BudgetExceededError):
            tracker.record(agent_name="analyst", client_id="cli_002", cost_usd=1.00)

    def test_budget_cap_exact_threshold(self):
        tracker = RunCostTracker(run_id="test_001", mode="full")
        with pytest.raises(BudgetExceededError):
            tracker.record(agent_name="research", client_id="cli_001", cost_usd=8.00)

    def test_validation_passes_for_consistent_data(self):
        tracker = RunCostTracker(run_id="test_001", mode="full")
        tracker.record(agent_name="research", client_id="cli_001", cost_usd=1.00)
        tracker.record(agent_name="analyst", client_id="cli_001", cost_usd=0.50)
        errors = tracker.validate()
        assert errors == []

    def test_anomaly_detection_flags_expensive_client(self):
        tracker = RunCostTracker(run_id="test_001", mode="full")
        tracker.record(agent_name="research", client_id="cli_001", cost_usd=2.50)
        errors = tracker.validate()
        assert any("$2.00 anomaly" in e for e in errors)

    def test_write_summary(self, tmp_path, monkeypatch):
        # Redirect LOGS_DIR to tmp_path
        monkeypatch.setattr("cost_tracker.LOGS_DIR", tmp_path)

        tracker = RunCostTracker(run_id="run_20260329_0000", mode="full")
        tracker.record(agent_name="research", client_id="cli_001", cost_usd=0.30)
        tracker.record(agent_name="analyst", client_id="cli_001", cost_usd=0.20)

        path = tracker.write_summary(
            started_at="2026-03-29T00:00:00+00:00",
            completed_at="2026-03-29T00:05:00+00:00",
            clients_processed=1,
            clients_failed=0,
            agent_runs=[],
        )

        assert path.exists()
        data = json.loads(path.read_text())
        assert data["run_id"] == "run_20260329_0000"
        assert data["cost_summary"]["total_usd"] == pytest.approx(0.50, abs=0.01)
        assert data["cost_summary"]["budget_remaining_usd"] == pytest.approx(
            7.50, abs=0.01
        )
        assert "cli_001" in data["cost_summary"]["per_client"]
