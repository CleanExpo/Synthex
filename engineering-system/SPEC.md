# Engineering System specification — reusable across Unite Group projects

**Specification ID:** UG-ENG-OS-v0.1 | **Date:** 27/10/2026 | **Status:** proposed, non-production.

## Components (reuse existing implementations first)

1. **Context and repository index:** repo topology, module ownership, auth/DB boundaries, canonical docs, drift indicators and source references.
2. **Intake and goal contract:** desired business outcome, hard constraints, related Linear ID, authorised scope and explicit non-goals.
3. **Orchestrator + SPM:** deterministic state machine over planning, worktree jobs, judges, approvals, test evidence and release receipts. Only these services schedule and advance jobs.
4. **Board challenge:** security/privacy, architecture/QA, customer/business value, finance/capacity; reasoned dissents must be recorded. Models advise; humans hold authority.
5. **Engineering pipeline:** discover → propose → challenge → approve scope → isolate worktree → red/green JEV test → code → static + integration + adversarial tests → independent code reviews → approval → merge → deploy → runtime verify → measure.
6. **Evidence ledger:** immutable per-run IDs and evidence links, no unsubstantiated Done flags.
7. **Model router:** available approved subscription tools, cost/capability tiers, failure fallback and independent-review separation. No secret in repo and no silent API billing.
8. **Freshness service:** public source with publish/retrieval dates, outdated-guidance markers, refreshed active files, protected archives.

## Typed handoff contract (logical, not a new DB)

```json
{
  "schemaVersion": "ug-engineering/0.1",
  "runId": "uuid",
  "linearId": "SYN-1316",
  "sourceRepo": "CleanExpo/Synthex",
  "sourceRevision": "git SHA",
  "targetEnvironment": "isolated worktree",
  "goal": "single verifiable sentence",
  "successCriteria": ["observable result"],
  "constraints": ["tenant isolation", "no production action"],
  "contextRefs": [
    { "path": "relative/path", "revision": "SHA", "purpose": "why needed" }
  ],
  "model": {
    "provider": "approved route",
    "model": "reported by runtime",
    "effort": "scoped"
  },
  "authority": {
    "scopeApproved": false,
    "externalActionsAllowed": false,
    "spendCapAUD": 0
  },
  "evidence": { "tests": [], "controls": [], "review": [], "release": null },
  "state": "PREPARED"
}
```

Validation must reject missing run ID, unapproved external action, inconsistent repo/SHA, and references outside the allowed working tree. Existing Linear/ledger schemas are system of record; this is an interoperability example.

## Pi Dev Ops consumption contract

Read `CONSUMPTION.md`: fetch a known commit; validate directory checksum/manifest; load only `README.md` + required skill. Never import unreviewed `main` at runtime and never download arbitrary scripts from a branch. Consumers record commit SHA on each job.

## JEV integration

**JEV means the repository's existing red/green + planted-failure evaluation harness**, not an external product. Source: `.claude/skills/tdd-jev/SKILL.md`, `scripts/jev/check-ratchet.mjs`, `tests/eval/jev`.

- Red test first at a public seam, green with minimal code, planted red control, integration rerun, floors ratchet only upwards; test statuses PASS/FAIL/INCONCLUSIVE/DISABLED.
- Keep JEV in its existing path. Reference it; do not duplicate the runner.
- Independent judges cannot overrule deterministic failures; control failures expose fake-green tests.

## Architecture protection

Supabase-only auth; org-scoped data; Zod writes; signed Twilio/ElevenLabs callbacks; approval before external writes; feature flags default off; no live claims without matching commit and runtime test; restore/backout plan for every risky migration.

## First complete acceptance scenario

Synthetic signed Unite Group order → idempotent Synthex tenant preview website/CRM/card → anonymous QR interest stays anonymous → opt-in enquiry becomes a scoped Lead → 0–3 owner questions update verified knowledge → one evidence-backed change recommendation, authorised or held → JEV planted controls + positive tests, independent reviews, documented spend → build receipt and correct Mission Control status. No claim of deployment without live runtime verification.

## Review triggers

Security/privacy/identity changes, new payment/data uses, cost increases, model changes, data schema migrations and publishing permissions all trigger board review and relevant human approvals. Mere file publication never grants authority.
