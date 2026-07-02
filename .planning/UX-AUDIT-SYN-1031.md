# UX Audit — Reduce dashboard friction into AI-does-the-work task lanes (SYN-1031)

**Date:** 2026-06-17 · **Scope:** highest-value Marketing Agency surfaces ·
**Evidence tags:** `[VERIFIED]` = read in code this session.

Goal of the audit (from the ticket): the operator names a simple outcome,
Synthex expands it, does the work, and returns prepared work for review — with
**minimal manual operation** and **no internal concepts leaking** into the UI.

---

## F1 — Run-review page stranded the operator on a page of zeros — **FIXED this PR**

- **Friction:** The outcome-first flow (`OutcomeWorkbench` → "Review prepared
  work") links to the run page the instant a run is enqueued. The run endpoint
  is **async by default**: it returns a `status:'queued'` row and a worker fills
  it in later. `[VERIFIED]` `app/api/marketing-agency/agents/[id]/run/route.ts`
  (header doc + `status: 'queued'`), `lib/marketing-agency/agent/runner.ts`
  (`running` → `completed`).
- **Evidence:** `AgentRunDetail` fetched once via `useApi` with **no polling**,
  so the operator saw status `queued` + `0/0/0` stats + no claims, and had to
  manually refresh until the worker finished. `[VERIFIED]`
  `components/marketing-agency/agent/AgentRunDetail.tsx`.
- **Fix (implemented):** Poll every 3s while the run is `queued`/`running` (reuse
  the existing `pollingInterval` in `useApi` — no new infra), stop on a terminal
  state, and show a "Synthex is preparing this work — updates automatically"
  banner so the wait is legible. Pure helper `isRunPreparing` is unit-tested.
- **Files:** `components/marketing-agency/agent/AgentRunDetail.tsx`,
  `tests/unit/marketing-agency/agent-run-detail-polling.test.ts`.
- **Risk:** Low. Additive; polling halts at terminal state; no API/schema change.

---

## F2 — Outcome presets are hardcoded to two brands, not the active business

- **Friction:** The workbench only offers `Launch RestoreAssist` and
  `Build CARSI authority` as preset outcomes, regardless of which business is
  active. A different tenant sees two irrelevant suggestions — the opposite of
  "expand a simple idea for _my_ business". `[VERIFIED]`
  `components/marketing-agency/OutcomeWorkbench.tsx` (`PRESET_OUTCOMES`).
- **Recommended fix:** Derive presets from the active business / Business DNA
  (name + primary objective) so the suggestions match the operator's brand.
- **Risk:** Low-Med (reads existing active-business + DNA; no publish path).
- **Disposition:** Split to Linear (see below).

---

## F3 — Homepage hardcodes the whole portfolio's brand cards for every tenant

- **Friction:** The Marketing Agency landing page renders fixed cards for CCW,
  CARSI, RestoreAssist, Disaster Recovery, and NRPG for **every** viewer, with no
  gating by active org. This surfaces the internal portfolio structure to any
  tenant and buries the one outcome-first entry point under five brand-specific
  packages. `[VERIFIED]` `app/dashboard/marketing-agency/page.tsx` (static
  `<section>` cards).
- **Recommended fix:** Gate the brand-package cards by active org (show the
  operator's own packages), keeping `OutcomeWorkbench` as the single primary
  action above them.
- **Risk:** Med (touches org-scoping; needs a 403/empty-state test for tenants
  with no packages).
- **Disposition:** Split to Linear (see below).

---

## F4 — Run page still speaks internal vocabulary ("Agent Run", "queued")

- **Friction:** The review surface is titled "Agent Run" with a raw status badge
  (`queued`/`running`/`completed`) and "All runs for {agent}" back-link —
  internal agent/run concepts the ticket wants hidden. `[VERIFIED]`
  `components/marketing-agency/agent/AgentRunDetail.tsx`.
- **Recommended fix:** Outcome-frame the copy ("Prepared work", "Preparing… /
  Ready for review / Needs attention") while keeping the same data. Low-risk copy
  pass; deferred here to keep this PR surgical.
- **Risk:** Low (copy only).
- **Disposition:** Split to Linear (see below).

---

## Checked and dismissed (no action)

- `app/dashboard/marketing-agency/carsi-authority/page.tsx` is **not** dead code
  — it is an intentional `redirect()` to the dynamic `[client]/authority` route.
  `[VERIFIED]`. Left as-is.

---

## Follow-up tickets

- **F2** → reduce-friction preset outcomes from active Business DNA.
- **F3** → org-gate the homepage brand-package cards.
- **F4** → outcome-frame the run-review copy (hide agent/run vocabulary).
