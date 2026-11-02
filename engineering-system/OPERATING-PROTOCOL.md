# Orchestrator / Senior Project Manager / multi-member council

**As of:** 27/10/2026 | **Status:** execution protocol proposal; reuse Pi Dev Ops existing senior harness, advisory board and tests.

## Responsibility

- **Founder/Unite Group:** commercial intent and ultimate authorisation at existing gates.
- **SPM:** checks correct project, priorities, context size, dependencies, budget, board challenge and evidence; can block proposed work but not create approval by declaration.
- **Orchestrator (Pi Dev Ops):** deterministic work queue, worker leases, exclusive file ownership, state transitions, retries (max 2), cancellations, receipts, failure escalation and Mission Control read-only status feed.
- **Builder (Claude through approved subscription tooling):** bounded implementation in isolated worktree; no own review bypass.
- **Independent reviewers:** Codex per current approved fleet policy; Cursor is founder-requested but explicitly barred by current `scripts/fleet/policy.json` (`review.never`), so may only become a reviewer after a recorded policy amendment and validation. Assess the exact final diff, tests, architectural scope and security, with recorded conflicts. Missing/unavailable required reviewer = INCONCLUSIVE, never implicit approval.
- **Advisory council:** Architecture/maintainability, Threat/privacy, Customer/UX/psychology, Finance/ROI, Science/measurement. Minimum perspectives, not a ceremony for every tiny fix. Challenge the assumptions; dissent is logged with evidence.
- **Rana:** final human engineering review per established release process. Mission Control merely displays substantiated status.

## Bounded council decision packet

Problem statement (≤250 words), source references, current design, at least two meaningful alternatives, desired KPI, expected cost/complexity, risks and falsifiable success criteria. Each reviewer returns **support / challenge / block + evidence + missing test**. SPM reconciles without overwriting minority concern. Anything unresolved at a hard gate is BLOCKED.

## Anti-context-bloat rules

1. Every worker reads only `README.md`, the task spec, exact owned files and targeted tests. No entire repo or full-chat copy-paste.
2. Context manifest: path + SHA + reason + token estimate. Demand a narrower manifest when context grows without improving task outcome.
3. Reuse existing architecture and docs; avoid unbounded “agent brainstorm” or duplicate frameworks.
4. One owner per file region; concurrent work uses separate worktrees and non-overlapping slices.
5. Handoff across sessions contains only goal, state, changed files, verified commands/output paths, blockers and next authorised action.
6. Use deterministic checks before expensive model judges. Models never judge their own output as sole reviewer.
7. Budget ledger includes subscription allowance where observable; do not silently switch to metered APIs.

## Mandatory engineering gates

G0 triage/repo truth; G1 design+scope+authority; G2 JEV red/green + planted control; G3 static/security/tenant tests; G4 independent review; G5 human publish/spend approval; G6 verified runtime evidence; G7 business outcome read-back. Not all work needs G5–G7, but never invent their completion.

## Scientific/psychological discipline

Use experimental controls, predeclared hypotheses, meaningful business outcomes, uncertainty and harm metrics. UX psychology informs clarity and consent, never dark patterns or pressure tactics. No claimed psychological uplift without controlled evidence.
