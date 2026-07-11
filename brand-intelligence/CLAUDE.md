# Synthex Brand Intelligence Pipeline

## What This Is

Autonomous brand intelligence pipeline for the Synthex marketing platform.
Runs every 6 hours via cron to research, profile, and generate content intelligence
for active clients.

## Architecture

```
Orchestrator (Opus 4.6) — coordinates all agents
├── CEO Board (Opus 4.6) — strategic gate for high-stakes decisions
├── Research Director (Sonnet 4.6) — web research via Playwright MCP
├── Brand Analyst (Sonnet 4.6) — brand profile building
├── Senior PM (Sonnet 4.6) — Linear issues, Slack, health dashboard
├── Content Strategist (Sonnet 4.6) — content intelligence
├── SEO Specialist (Haiku 4.5) — fast keyword processing
└── Compliance Guardian (Haiku 4.5) — brand voice enforcement
```

## Key Files

| File | Purpose |
|---|---|
| `synthex_orchestrator.py` | Main entry point |
| `subagents.py` | All 7 agent definitions |
| `cost_tracker.py` | Per-client cost tracking + budget enforcement |
| `logger.py` | Structured JSON logging |
| `clients/active-clients.json` | Client roster |
| `output/` | Pipeline outputs (profiles, content, health) |
| `logs/` | Run summaries + agent logs |

## Budget

- Hard cap: $8.00/run
- Alert at $6.50, Slack at $7.50, stop at $8.00
- 3x consecutive overruns → CEO Board review

## Commands

```bash
python synthex_orchestrator.py --mode full         # Full pipeline
python synthex_orchestrator.py --mode discovery     # Research + profile only
python synthex_orchestrator.py --dry-run            # Validate without executing
python synthex_orchestrator.py --cron               # Auto-detect mode from time
```

## Integration Boundary

All data exchanged with the Synthex Next.js platform MUST use types from
`shared/types/brand-intelligence.ts`. See `INTEGRATION.md` at the repo root.

Pipeline writes → filesystem (`output/`)
Platform reads → at render time from filesystem
No direct imports across the boundary.
