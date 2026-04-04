#!/usr/bin/env python3
"""Synthex Brand Intelligence Pipeline — Multi-Agent Orchestrator.

Main entry point for the brand intelligence pipeline (UNI-1661).
Uses the Claude Agent SDK to orchestrate 7 specialised subagents
for autonomous brand discovery, profiling, and content intelligence.

Usage:
    python synthex_orchestrator.py --mode full
    python synthex_orchestrator.py --mode discovery --client cli_001
    python synthex_orchestrator.py --dry-run

Modes:
    full        — Full pipeline: research + profile + content + SEO + compliance
    discovery   — Research + profile only (new clients or refresh)
    enforce     — Compliance check on queued content
    refresh     — SEO intelligence refresh only
    onboarding  — First-time client setup (research + profile + initial content)

Budget: $8.00/run (hard cap per SYN-491 quality standards).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from cost_tracker import (
    BUDGET_CAP_USD,
    BudgetExceededError,
    RunCostTracker,
    calculate_cost,
)
from logger import log_agent_run, setup_logging
from subagents import ALL_AGENTS, AgentDef

logger = logging.getLogger("synthex.orchestrator")

BASE_DIR = Path(__file__).parent
CLIENTS_FILE = BASE_DIR / "clients" / "active-clients.json"
OUTPUT_DIR = BASE_DIR / "output"

RunMode = Literal["full", "discovery", "enforce", "refresh", "onboarding"]

# Which agents run in each mode
MODE_AGENT_MAP: dict[RunMode, list[str]] = {
    "full": [
        "research-director",
        "brand-analyst",
        "seo-specialist",
        "content-strategist",
        "compliance-guardian",
        "senior-pm",
    ],
    "discovery": ["research-director", "brand-analyst", "senior-pm"],
    "enforce": ["compliance-guardian", "senior-pm"],
    "refresh": ["seo-specialist", "senior-pm"],
    "onboarding": [
        "research-director",
        "brand-analyst",
        "content-strategist",
        "senior-pm",
    ],
}

# 6-hour cron slot → mode mapping
CRON_SLOT_MODES: dict[str, RunMode] = {
    "00:00": "full",       # Midnight: full pipeline
    "06:00": "refresh",    # 6am: SEO refresh
    "12:00": "enforce",    # Noon: compliance check
    "18:00": "discovery",  # 6pm: discovery for new/stale clients
}


def generate_run_id() -> str:
    """Generate a run ID in the format run_YYYYMMDD_HHmm."""
    now = datetime.now(timezone.utc)
    return f"run_{now.strftime('%Y%m%d_%H%M')}"


def load_client_roster() -> list[dict]:
    """Load the active client roster from clients/active-clients.json."""
    if not CLIENTS_FILE.exists():
        logger.warning(f"Client roster not found at {CLIENTS_FILE}")
        return []

    with open(CLIENTS_FILE, encoding="utf-8") as f:
        data = json.load(f)

    clients = data.get("clients", [])
    logger.info(f"Loaded {len(clients)} client(s) from roster")
    return clients


def determine_mode_from_cron() -> RunMode:
    """Determine pipeline mode based on the current time slot."""
    now = datetime.now(timezone.utc)
    current_slot = f"{now.hour:02d}:00"

    # Find the closest slot
    mode = CRON_SLOT_MODES.get(current_slot, "full")
    logger.info(f"Cron slot {current_slot} → mode: {mode}")
    return mode


def build_agent_sdk_config(
    agents_to_run: list[AgentDef],
    run_id: str,
    client: dict,
) -> dict:
    """Build the Agent SDK query() options for a pipeline run.

    Returns a dict matching the Claude Agent SDK query() options interface.
    """
    # Build subagent definitions
    agent_defs = {}
    for agent in agents_to_run:
        agent_defs[agent.name] = {
            "description": agent.description,
            "prompt": agent.prompt,
            "tools": agent.tools,
            "model": agent.model,
        }
        if agent.max_budget_usd is not None:
            agent_defs[agent.name]["maxBudgetUsd"] = agent.max_budget_usd

    client_id = client.get("client_id", "unknown")
    client_name = client.get("name", "Unknown Client")

    return {
        "prompt": (
            f"Run the brand intelligence pipeline for client '{client_name}' "
            f"(ID: {client_id}). Run ID: {run_id}.\n\n"
            f"Client data:\n{json.dumps(client, indent=2)}\n\n"
            f"Output directory: {OUTPUT_DIR}\n\n"
            f"Execute agents in sequence. Write all outputs as JSON files."
        ),
        "options": {
            "cwd": str(BASE_DIR),
            "allowedTools": ["Read", "Write", "Glob", "Grep", "Agent",
                             "WebSearch", "WebFetch"],
            "permissionMode": "bypassPermissions",
            "allowDangerouslySkipPermissions": True,
            "maxBudgetUsd": BUDGET_CAP_USD,
            "model": "claude-opus-4-6",
            "agents": agent_defs,
            "settingSources": ["project"],
            "mcpServers": {
                "playwright": {
                    "command": "npx",
                    "args": ["@playwright/mcp@latest"],
                },
            },
        },
    }


async def run_pipeline_for_client(
    *,
    client: dict,
    mode: RunMode,
    run_id: str,
    cost_tracker: RunCostTracker,
    dry_run: bool = False,
) -> dict:
    """Run the pipeline for a single client. Returns agent run metrics."""
    client_id = client.get("client_id", "unknown")
    agent_names = MODE_AGENT_MAP[mode]
    agents_to_run = [ALL_AGENTS[name] for name in agent_names if name in ALL_AGENTS]

    logger.info(
        f"[{client_id}] Starting {mode} pipeline with agents: "
        f"{[a.name for a in agents_to_run]}"
    )

    agent_runs = []

    if dry_run:
        logger.info(f"[{client_id}] DRY RUN — skipping actual agent execution")
        for agent in agents_to_run:
            entry = log_agent_run(
                agent_name=agent.name,
                model=agent.model,
                client_id=client_id,
                duration_ms=0,
                input_tokens=0,
                output_tokens=0,
                cost_usd=0.0,
                error_state="success",
            )
            agent_runs.append(entry)
        return {"client_id": client_id, "status": "dry_run", "agent_runs": agent_runs}

    # Build SDK config
    config = build_agent_sdk_config(agents_to_run, run_id, client)

    # Execute via Agent SDK
    try:
        # Import here to allow dry-run without SDK installed
        from claude_agent_sdk import query  # type: ignore[import-untyped]

        start_time = time.monotonic()

        async for message in query(**config):
            # Capture session ID for resumption
            if (
                getattr(message, "type", None) == "system"
                and getattr(message, "subtype", None) == "init"
            ):
                session_id = getattr(message, "session_id", None)
                logger.info(f"[{client_id}] Session ID: {session_id}")

            # Capture result
            if hasattr(message, "result"):
                duration_ms = int((time.monotonic() - start_time) * 1000)
                usage = getattr(message, "usage", {})
                input_tokens = getattr(usage, "input_tokens", 0)
                output_tokens = getattr(usage, "output_tokens", 0)
                model = getattr(message, "model", "claude-opus-4-6")

                cost = calculate_cost(model, input_tokens, output_tokens)

                # Record cost
                cost_tracker.record(
                    agent_name="orchestrator",
                    client_id=client_id,
                    cost_usd=cost,
                )

                entry = log_agent_run(
                    agent_name="orchestrator",
                    model=model,
                    client_id=client_id,
                    duration_ms=duration_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost_usd=cost,
                )
                agent_runs.append(entry)

    except BudgetExceededError:
        logger.error(f"[{client_id}] Budget exceeded — stopping gracefully")
        raise
    except ImportError:
        logger.error(
            "claude-agent-sdk not installed. Run: pip install claude-agent-sdk"
        )
        raise
    except Exception as e:
        logger.error(f"[{client_id}] Pipeline error: {e}")
        entry = log_agent_run(
            agent_name="orchestrator",
            model="claude-opus-4-6",
            client_id=client_id,
            duration_ms=0,
            input_tokens=0,
            output_tokens=0,
            cost_usd=0.0,
            error_state="failure",
            error_message=str(e),
        )
        agent_runs.append(entry)
        return {"client_id": client_id, "status": "failed", "agent_runs": agent_runs}

    return {"client_id": client_id, "status": "success", "agent_runs": agent_runs}


async def run_pipeline(
    *,
    mode: RunMode,
    client_filter: str | None = None,
    dry_run: bool = False,
) -> None:
    """Main pipeline entry point. Processes all clients (or a filtered subset)."""
    run_id = generate_run_id()
    started_at = datetime.now(timezone.utc).isoformat()

    logger.info(f"Pipeline starting — run_id={run_id}, mode={mode}, dry_run={dry_run}")

    # Load clients
    clients = load_client_roster()
    if client_filter:
        clients = [c for c in clients if c.get("client_id") == client_filter]
        if not clients:
            logger.error(f"Client '{client_filter}' not found in roster")
            sys.exit(1)

    if not clients:
        logger.warning("No clients to process. Add clients to clients/active-clients.json")
        return

    # Initialise cost tracker
    cost_tracker = RunCostTracker(run_id=run_id, mode=mode)

    # Process each client (sequential to respect budget)
    all_agent_runs = []
    clients_processed = 0
    clients_failed = 0
    drift_events = []

    for client in sorted(clients, key=lambda c: c.get("research_priority", 99)):
        client_id = client.get("client_id", "unknown")
        try:
            result = await run_pipeline_for_client(
                client=client,
                mode=mode,
                run_id=run_id,
                cost_tracker=cost_tracker,
                dry_run=dry_run,
            )
            all_agent_runs.extend(result.get("agent_runs", []))
            if result["status"] == "failed":
                clients_failed += 1
            else:
                clients_processed += 1

        except BudgetExceededError:
            logger.error(
                f"Budget exceeded after {clients_processed} client(s). "
                f"Remaining clients skipped."
            )
            clients_failed += len(clients) - clients_processed - clients_failed
            break
        except Exception as e:
            logger.error(f"[{client_id}] Unexpected error: {e}")
            clients_failed += 1
            # Continue to next client — single-client failure isolation
            continue

    # Write platform summary
    completed_at = datetime.now(timezone.utc).isoformat()
    summary_path = cost_tracker.write_summary(
        started_at=started_at,
        completed_at=completed_at,
        clients_processed=clients_processed,
        clients_failed=clients_failed,
        agent_runs=all_agent_runs,
        drift_events=drift_events,
    )

    logger.info(
        f"Pipeline complete — {clients_processed} processed, "
        f"{clients_failed} failed, cost: ${cost_tracker.total_usd:.2f}, "
        f"summary: {summary_path}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Synthex Brand Intelligence Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  python synthex_orchestrator.py --mode full
  python synthex_orchestrator.py --mode discovery --client cli_001
  python synthex_orchestrator.py --dry-run
  python synthex_orchestrator.py --cron  # Auto-detect mode from time slot
        """,
    )
    parser.add_argument(
        "--mode",
        choices=["full", "discovery", "enforce", "refresh", "onboarding"],
        default=None,
        help="Pipeline mode (default: auto-detect from cron slot)",
    )
    parser.add_argument(
        "--client",
        type=str,
        default=None,
        help="Filter to a single client ID",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate config and roster without executing agents",
    )
    parser.add_argument(
        "--cron",
        action="store_true",
        help="Auto-detect mode from the current 6-hour time slot",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug-level logging",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    setup_logging(verbose=args.verbose)

    # Determine mode
    if args.cron:
        mode = determine_mode_from_cron()
    elif args.mode:
        mode = args.mode
    else:
        mode = "full"

    logger.info(f"Synthex Brand Intelligence Pipeline v0.1.0")
    logger.info(f"Mode: {mode} | Budget: ${BUDGET_CAP_USD:.2f}")

    asyncio.run(
        run_pipeline(
            mode=mode,
            client_filter=args.client,
            dry_run=args.dry_run,
        )
    )


if __name__ == "__main__":
    main()
