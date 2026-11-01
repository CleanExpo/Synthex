# Engineering goals, budget and boundaries

**As of:** 27/10/2026. **Applies to:** reusable engineering method, demonstrated first in Living Business OS.

## Primary goal

Continuously generate **verified customer/business value** while reducing cost-to-deliver, AI context waste, security risk and human administrative burden. A faster agent that ships unverified work fails.

## Product goals

- Client receives website + tenant-owned CRM, living card, dashboard, and optional phone/voice integrations from an authorised Unite Group order through Synthex internal fulfilment.
- Improvement cycle uses qualified leads, services, customer value, consent, profitability and business capacity; never blindly maximises clicks or post volume.
- Owner check-in asks 0–3 **relevant** weekly questions and records confirmed facts, not hallucinated truth.
- Reusable platform works for multiple brands but never pools private data across tenants without separate authority.

## Engineering success measures (set baseline before optimisation)

- Correctness: contract tests pass and planted failures fail; JEV gates retain required floors.
- Reliability: ordered events deduplicated, retries bounded, failure and rollback receipts visible.
- Security: 0 cross-tenant leaks in adversarial fixtures; no silent authentication or spending bypass.
- Efficiency: measure context tokens/task, files read/task, changed lines/task, reviewer retries, wall time, build/test minutes and AI spending. Targets **must** be justified from a baseline; do not invent percentage improvements.
- Quality: qualified bookings/revenue and gross profit where attributable; accessibility, latency and reported user friction.
- Auditability: each decision links requirements, evidence, authorisation, code SHA, tests, release status and outcome.

## Explicit non-goals

No new CRM/event database where the current tenant-scoped records suffice. No weekly site rewrite just because a search update occurred. No autonomous model fine-tuning from customer transcripts. No duplicative billing stack inside Synthex. No API usage billed outside approved subscriptions/budgets. No merge, release or spend inferred from a Linear ticket.

## Quality bar

The smallest well-tested change that resolves the stated problem wins over the largest “agentic” architecture. Claim status is one of: PREPARED, TESTED, REVIEWED, MERGED, DEPLOYED, VERIFIED-LIVE, or BLOCKED, each backed by a receipt.
