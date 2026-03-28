# Brand Intelligence Pipeline — Quality Standards

> **SYN-491** | Effective: Before UNI-1661 moves to In Progress | Owner: Phill McGurk

This document defines the non-negotiable quality standards for all code in the brand intelligence pipeline. These standards were mandated by CEO Board Session #1 (2026-03-29).

## Why This Exists

The brand intelligence pipeline is Synthex's first **variable-cost-per-client** system:
- $0.70/client/run at current estimates
- $5.50/run for 10 clients
- $4,800/month projected at 50 clients

Without instrumentation from day one, margin visibility is zero until the bill arrives.

## UNI-1661 Acceptance Criteria

UNI-1661 (Multi-agent orchestration system) CANNOT be marked complete unless:

### 1. Unit Tests

| What | Minimum Coverage |
|------|------------------|
| `synthex_orchestrator.py` entry point | All modes: full, discovery, enforce, refresh, onboarding |
| Subagent spawning (`subagents.py`) | Each of 7 agent definitions instantiates correctly |
| Cost cap enforcement | Verify run stops gracefully at `max_budget_usd=8.0` |
| Single-client failure isolation | One client error doesn't abort remaining clients |
| Drift detection thresholds | <10% auto-update, 10-25% notify, >25% board review |
| Cron mode selection | Correct mode for each 6-hour slot |

### 2. Per-Client Cost Tracking

Every pipeline run MUST write to `/logs/platform-summary-{run_id}.json` with this structure:

```json
{
  "run_id": "run_20260329_0000",
  "cost_summary": {
    "total_usd": 5.47,
    "per_client": {
      "cli_001": 0.68,
      "cli_002": 0.72
    },
    "per_agent": {
      "orchestrator": 1.50,
      "research_director": 3.00,
      "brand_analyst": 2.00,
      "content_strategist": 1.50,
      "seo_specialist": 0.30,
      "compliance_guardian": 0.20,
      "senior_pm": 0.20
    },
    "budget_remaining_usd": 2.53
  }
}
```

### 3. Structured JSON Logging

Every agent run MUST log a JSON object with these fields:

```json
{
  "agent_name": "research_director",
  "model": "claude-sonnet-4-6",
  "client_id": "cli_001",
  "duration_ms": 45200,
  "input_tokens": 12500,
  "output_tokens": 3200,
  "cost_usd": 0.31,
  "error_state": "success",
  "error_message": null,
  "timestamp": "2026-03-29T00:05:23.000+11:00"
}
```

Valid `error_state` values: `success`, `partial_failure`, `failure`

## Definition of Done for All Brand Intelligence PRs

1. ✅ All unit tests pass
2. ✅ Cost tracking verified (run produces valid `platform-summary-{run_id}.json`)
3. ✅ Structured logs verified (every agent run produces valid JSON log entry)
4. ✅ Integration boundary respected (all cross-boundary imports use `shared/types/`)
5. ✅ No hardcoded API keys, tokens, or secrets
6. ✅ PR uses the brand intelligence PR template
7. ✅ At least one reviewer has approved

## Cost Alert Thresholds

| Condition | Action |
|-----------|--------|
| Single run > $6.50 | Log warning |
| Single run > $7.50 | Send Slack alert to #synthex-brand-ops |
| Single run hits $8.00 cap | Stop gracefully, log which clients completed |
| 3+ consecutive runs > $8.00 | Trigger CEO Board review |
| Monthly cost > $3,000 | Trigger CEO Board review |

## Board Decision Reference

This standard was established by CEO Board Session #1 (Code Enhancement & Cleanup, 2026-03-29):

> "Mandate that the brand intelligence pipeline (UNI-1661) ships with built-in test coverage, per-client cost instrumentation in the orchestrator, and structured logging from day one. The existing codebase gets tested only when files are touched for pipeline integration."

Linear issues: SYN-488 (parent), SYN-491 (this standard)
