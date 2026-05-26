# Browser-harness UI Smoke Tests Gap — 2026-05-16

## Status: tests/ui-smoke/ DIRECTORY DOES NOT EXIST

```bash
$ ls tests/ui-smoke/
ls: tests/ui-smoke/: No such file or directory
```

The Phase 3 spec required `tests/ui-smoke/*.harness.py` scripts to validate the billing-portal page through a real browser. PR #247 (Phase 3 PR1 — billing portal) shipped the page but **did not ship the harness scripts**.

## What does exist

```
tests/
├── __mocks__/
├── agents/
├── api/
├── auth/
├── auto-publish/
├── contract/
├── deployment.spec.ts
├── e2e/
├── external-apis/
├── helpers/
├── integration/
├── jest.setup.js
├── k6/
├── load/
├── notifications.spec.ts
├── playwright/
├── setup.js
├── setup.ts
├── strategic-marketing/
└── team-invite.spec.ts
```

Playwright e2e suite is present. Whether it covers the billing-portal flow needs a separate audit.

## Verdict: DEFERRED

Per plan: "If absent: document — Phase 3 PR1 may have shipped the page without the harness script. Flag for follow-up. DO NOT block sign-off."

Follow-up: file a Linear ticket against Synthex to ship `tests/ui-smoke/billing-portal.harness.py` (or expand the Playwright e2e to cover the flow).
