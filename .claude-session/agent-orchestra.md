# SYNTHEX Agent Orchestra System

> Governed by **agents-protocol v1.0** (`.claude/skills/agents-protocol/SKILL.md`)

## Agent Registry

All agents are registered with Agent Cards in their respective primers.

| Agent ID | Type | Primer | Model Tier | Status |
|----------|------|--------|------------|--------|
| `orchestrator` | orchestrator | `ORCHESTRATOR_PRIMER.md` | opus | ACTIVE |
| `backend-agent` | worker | `BACKEND_AGENT_PRIMER.md` | sonnet | STANDBY |
| `frontend-agent` | worker | `FRONTEND_AGENT_PRIMER.md` | sonnet | STANDBY |
| `database-agent` | worker | `DATABASE_AGENT_PRIMER.md` | sonnet | STANDBY |
| `verifier` | evaluator | `VERIFIER_PRIMER.md` | sonnet | STANDBY |

**Base template**: All workers inherit from `BASE_PRIMER.md` (Agent Card: `base-agent`)

## Delegation Map

```
human
  └→ orchestrator
       ├→ backend-agent   (apps/backend/**)
       ├→ frontend-agent  (apps/web/**)
       ├→ database-agent  (supabase/**)
       └→ verifier        (read-only verification)
```

## Escalation Chain

```
Worker Agent (any)
    ↓ escalates to
Orchestrator
    ↓ escalates to
Human Operator

Exception: ethical/safety boundary → direct to Human
```

## Coordination Rules

1. **Max 2 concurrent agents** (system stability — CLAUDE.md requirement)
2. **No self-attestation** — all verification routes through `verifier`
3. **Hub-and-spoke** — all communication through `orchestrator`, no peer-to-peer
4. **Minimum viable context** — agents receive scoped context, not full project
5. **5 delegation requirements** — every task must include objective, output format, tools guidance, boundaries, effort level

## Protocol Compliance

- All 6 primers include Agent Cards per protocol Section 1.1
- Pre-agent-dispatch hook enforces delegation requirements per Section 3.1
- Escalation format standardised per Section 4.2
- Handoff format standardised per Section 5.3
- Permission tiers assigned per Section 6.2
- Error handling aligned with Section 7.1 classification
