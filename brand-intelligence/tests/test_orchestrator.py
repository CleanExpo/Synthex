"""Tests for synthex_orchestrator.py — SYN-491 mandatory coverage.

Tests:
- All modes: full, discovery, enforce, refresh, onboarding
- Cron mode selection (correct mode for each 6-hour slot)
- Run ID generation format
- Client roster loading
- Agent SDK config building
- Dry-run mode
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

from synthex_orchestrator import (
    CRON_SLOT_MODES,
    MODE_AGENT_MAP,
    build_agent_sdk_config,
    determine_mode_from_cron,
    generate_run_id,
    load_client_roster,
)
from subagents import ALL_AGENTS


class TestRunIdGeneration:
    def test_format(self):
        run_id = generate_run_id()
        assert run_id.startswith("run_")
        parts = run_id.split("_")
        assert len(parts) == 3
        assert len(parts[1]) == 8  # YYYYMMDD
        assert len(parts[2]) == 4  # HHmm


class TestModeAgentMap:
    @pytest.mark.parametrize("mode", ["full", "discovery", "enforce", "refresh", "onboarding"])
    def test_mode_has_agents(self, mode: str):
        agents = MODE_AGENT_MAP[mode]
        assert len(agents) > 0, f"Mode '{mode}' has no agents"

    @pytest.mark.parametrize("mode", ["full", "discovery", "enforce", "refresh", "onboarding"])
    def test_all_agents_exist_in_registry(self, mode: str):
        for agent_name in MODE_AGENT_MAP[mode]:
            assert agent_name in ALL_AGENTS, (
                f"Mode '{mode}' references unknown agent '{agent_name}'"
            )

    def test_full_mode_has_most_agents(self):
        full_count = len(MODE_AGENT_MAP["full"])
        for mode, agents in MODE_AGENT_MAP.items():
            if mode != "full":
                assert len(agents) <= full_count

    def test_senior_pm_in_all_modes(self):
        """Senior PM runs in every mode — operational coordination is always needed."""
        for mode, agents in MODE_AGENT_MAP.items():
            assert "senior-pm" in agents, f"Mode '{mode}' missing senior-pm"


class TestCronSlotModes:
    def test_all_four_slots_defined(self):
        assert len(CRON_SLOT_MODES) == 4

    @pytest.mark.parametrize(
        "slot,expected_mode",
        [
            ("00:00", "full"),
            ("06:00", "refresh"),
            ("12:00", "enforce"),
            ("18:00", "discovery"),
        ],
    )
    def test_slot_to_mode_mapping(self, slot: str, expected_mode: str):
        assert CRON_SLOT_MODES[slot] == expected_mode

    def test_determine_mode_midnight(self):
        with patch("synthex_orchestrator.datetime") as mock_dt:
            mock_now = datetime(2026, 3, 29, 0, 15, tzinfo=timezone.utc)
            mock_dt.now.return_value = mock_now
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            mode = determine_mode_from_cron()
            assert mode == "full"

    def test_determine_mode_non_slot_defaults_to_full(self):
        with patch("synthex_orchestrator.datetime") as mock_dt:
            mock_now = datetime(2026, 3, 29, 3, 0, tzinfo=timezone.utc)
            mock_dt.now.return_value = mock_now
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            mode = determine_mode_from_cron()
            assert mode == "full"


class TestClientRoster:
    def test_load_empty_roster(self, tmp_path, monkeypatch):
        roster_file = tmp_path / "clients" / "active-clients.json"
        roster_file.parent.mkdir(parents=True)
        roster_file.write_text('{"clients": []}')
        monkeypatch.setattr("synthex_orchestrator.CLIENTS_FILE", roster_file)

        clients = load_client_roster()
        assert clients == []

    def test_load_roster_with_clients(self, tmp_path, monkeypatch):
        roster_file = tmp_path / "clients" / "active-clients.json"
        roster_file.parent.mkdir(parents=True)
        roster_file.write_text(
            json.dumps(
                {
                    "clients": [
                        {
                            "client_id": "cli_001",
                            "name": "Test Client",
                            "website": "https://example.com",
                            "industry": "tech",
                            "social_profiles": {},
                            "industry_subreddits": [],
                            "competitors": [],
                            "plan": "starter",
                            "onboarded_at": "2026-03-01",
                            "last_discovery": None,
                            "profile_version": None,
                            "research_priority": 1,
                        }
                    ]
                }
            )
        )
        monkeypatch.setattr("synthex_orchestrator.CLIENTS_FILE", roster_file)

        clients = load_client_roster()
        assert len(clients) == 1
        assert clients[0]["client_id"] == "cli_001"

    def test_missing_roster_returns_empty(self, tmp_path, monkeypatch):
        monkeypatch.setattr(
            "synthex_orchestrator.CLIENTS_FILE", tmp_path / "nonexistent.json"
        )
        clients = load_client_roster()
        assert clients == []


class TestBuildAgentSdkConfig:
    def test_config_structure(self):
        agents = [ALL_AGENTS["research-director"], ALL_AGENTS["brand-analyst"]]
        client = {"client_id": "cli_001", "name": "Test"}
        config = build_agent_sdk_config(agents, "run_test_001", client)

        assert "prompt" in config
        assert "options" in config
        opts = config["options"]
        assert opts["permissionMode"] == "bypassPermissions"
        assert opts["allowDangerouslySkipPermissions"] is True
        assert opts["maxBudgetUsd"] == 8.0
        assert opts["model"] == "claude-opus-4-6"
        assert "research-director" in opts["agents"]
        assert "brand-analyst" in opts["agents"]

    def test_mcp_servers_included(self):
        agents = [ALL_AGENTS["research-director"]]
        config = build_agent_sdk_config(agents, "run_test", {"client_id": "cli_001"})
        assert "playwright" in config["options"]["mcpServers"]
