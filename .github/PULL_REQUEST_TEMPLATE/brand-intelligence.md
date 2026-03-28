---
name: Brand Intelligence PR
about: Pull request for the brand intelligence pipeline
labels: brand-intelligence
---

## What this PR does

<!-- One-paragraph summary of the change -->

## Type of change

- [ ] New agent or skill
- [ ] Agent behavior change
- [ ] Pipeline orchestration change
- [ ] Integration with platform dashboard
- [ ] Cost/performance optimization
- [ ] Bug fix
- [ ] Documentation

## Quality Checklist (REQUIRED for all brand intelligence PRs)

### Tests
- [ ] Unit tests added for new/changed logic
- [ ] Orchestrator entry point tested
- [ ] Subagent spawning logic tested (if changed)
- [ ] Cost cap enforcement tested (`max_budget_usd=8.0`)
- [ ] Graceful degradation tested (single-client failure doesn't abort run)
- [ ] All existing tests pass (`npm test`)

### Cost Tracking
- [ ] Per-client cost logged to `/logs/platform-summary-{run_id}.json`
- [ ] Fields present: `per_agent_cost`, `per_client_cost`, `total_run_cost`, `budget_remaining`
- [ ] Cost verified against expected range (see table below)

### Structured Logging
- [ ] Every agent run logs: `duration_ms`, `input_tokens`, `output_tokens`, `model`, `error_state`, `client_id`
- [ ] Logs are valid JSON (parseable by `JSON.parse()`)
- [ ] Error states include actionable error messages

### Integration Boundary
- [ ] All platform ↔ pipeline data exchange uses types from `shared/types/`
- [ ] No direct imports across the boundary (see `INTEGRATION.md`)
- [ ] If new data shapes are introduced, `shared/types/brand-intelligence.ts` is updated

## Expected Cost Per Run

| Component | Expected Cost |
|-----------|---------------|
| Orchestrator (Opus 4.6) | ~$1.50 |
| Research Directors × clients (Sonnet 4.6) | ~$0.30/client |
| Brand Analysts × clients (Sonnet 4.6) | ~$0.20/client |
| Content Strategists × clients (Sonnet 4.6) | ~$0.15/client |
| SEO Specialists × clients (Haiku 4.5) | ~$0.03/client |
| Compliance Guardians × clients (Haiku 4.5) | ~$0.02/client |
| Senior PM Agent (Sonnet 4.6) | ~$0.20 |
| **Total — 10 clients** | **~$5.50** |
| **Hard cap** | **$8.00** |

## How to test

<!-- Step-by-step instructions for reviewers -->

## Screenshots / Logs

<!-- Paste relevant log output showing cost tracking and structured logging -->
