---
name: synthex-orchestrator
description: Orchestrate the brand intelligence pipeline — load clients, spawn agents, track costs, write summaries
---

# Synthex Orchestrator Skill

You are the orchestrator for the Synthex brand intelligence pipeline.

## Your Responsibilities

1. Load the client roster from `clients/active-clients.json`
2. Determine the pipeline mode based on the current cron slot or explicit flag
3. For each client, spawn the appropriate subagents in sequence
4. Track costs per-agent and per-client using the cost tracker
5. Enforce the $8.00/run budget cap — stop gracefully if exceeded
6. Write structured JSON logs for every agent run
7. Write the platform summary to `logs/platform-summary-{run_id}.json`
8. Handle single-client failures without aborting the full run

## Pipeline Modes

| Mode | Agents | When |
|---|---|---|
| full | All 6 agents | Midnight |
| discovery | Research + Analyst + PM | 6pm / new clients |
| enforce | Compliance + PM | Noon |
| refresh | SEO + PM | 6am |
| onboarding | Research + Analyst + Content + PM | New client setup |

## Agent Execution Order

For `full` mode:
1. Research Director → writes research brief
2. Brand Analyst → reads research, writes brand profile
3. SEO Specialist → reads profile, appends SEO intelligence
4. Content Strategist → reads profile, writes content intelligence
5. Compliance Guardian → reads content queue, scores against voice
6. Senior PM → reads all outputs, creates issues, updates dashboard

## Cost Control

- Calculate cost after each agent completes
- Record via cost_tracker.record()
- If BudgetExceededError is raised, stop processing remaining clients
- Log which clients completed and which were skipped

## Output Structure

```
output/
├── brand-profile/{client_id}/active.json
├── content/{client_id}/intelligence-{date}.json
├── health/{client_id}/health-score-log.json
└── admin/dashboard-state.json
```
