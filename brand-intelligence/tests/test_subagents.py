"""Tests for subagents.py — SYN-491 mandatory coverage.

Tests: each of 7 agent definitions instantiates correctly with required fields.
"""

import pytest

from subagents import (
    ALL_AGENTS,
    BRAND_ANALYST,
    CEO_BOARD,
    COMPLIANCE_GUARDIAN,
    CONTENT_STRATEGIST,
    RESEARCH_DIRECTOR,
    SEO_SPECIALIST,
    SENIOR_PM,
    AgentDef,
)

EXPECTED_AGENTS = [
    "ceo-board",
    "research-director",
    "brand-analyst",
    "senior-pm",
    "content-strategist",
    "seo-specialist",
    "compliance-guardian",
]


class TestAgentRegistry:
    def test_all_seven_agents_registered(self):
        assert len(ALL_AGENTS) == 7

    def test_all_expected_names_present(self):
        for name in EXPECTED_AGENTS:
            assert name in ALL_AGENTS, f"Missing agent: {name}"

    def test_all_agents_are_agent_def(self):
        for name, agent in ALL_AGENTS.items():
            assert isinstance(agent, AgentDef), f"{name} is not an AgentDef"


class TestAgentDefinitions:
    @pytest.mark.parametrize("name", EXPECTED_AGENTS)
    def test_has_required_fields(self, name: str):
        agent = ALL_AGENTS[name]
        assert agent.name, f"{name}: missing name"
        assert agent.description, f"{name}: missing description"
        assert agent.model, f"{name}: missing model"
        assert len(agent.tools) > 0, f"{name}: no tools assigned"
        assert agent.prompt, f"{name}: missing prompt"

    def test_opus_agents(self):
        """CEO Board and orchestrator use Opus for deep reasoning."""
        assert CEO_BOARD.model == "claude-opus-4-6"

    def test_sonnet_agents(self):
        """Core work agents use Sonnet for balanced quality/cost."""
        for agent in [RESEARCH_DIRECTOR, BRAND_ANALYST, SENIOR_PM, CONTENT_STRATEGIST]:
            assert agent.model == "claude-sonnet-4-6", f"{agent.name} should use Sonnet"

    def test_haiku_agents(self):
        """High-volume, deterministic agents use Haiku."""
        for agent in [SEO_SPECIALIST, COMPLIANCE_GUARDIAN]:
            assert agent.model == "claude-haiku-4-5", f"{agent.name} should use Haiku"

    def test_budget_caps_set(self):
        """All agents except CEO Board should have per-client budget caps."""
        for name, agent in ALL_AGENTS.items():
            assert agent.max_budget_usd is not None, f"{name}: missing max_budget_usd"
            assert agent.max_budget_usd > 0, f"{name}: budget must be positive"

    def test_ceo_board_has_highest_budget(self):
        """CEO Board gets the most budget (complex deliberation)."""
        non_board_budgets = [
            a.max_budget_usd
            for a in ALL_AGENTS.values()
            if a.name != "ceo-board" and a.max_budget_usd is not None
        ]
        assert CEO_BOARD.max_budget_usd >= max(non_board_budgets)
