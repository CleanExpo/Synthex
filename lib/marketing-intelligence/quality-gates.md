# Quality Gates

> A run is **not complete** until all 6 gates pass. Mirrors the master prompt's gates and the Synthex
> verification discipline (banned phrases: "should work", "probably passes", "seems correct", "likely fixed").

## Gate 1 — Source Discovery

- [ ] Obsidian vault scanned with word-boundary grep; suspicious counts manually verified.
- [ ] `obsidian-source-map.md` + `obsidian-source-index.json` emitted and schema-valid.
- [ ] YouTube channels identified **or** explicitly `DATA_REQUIRED` (never invented).
- [ ] Neil Patel analysis path documented (`DATA_REQUIRED` until API/URLs supplied).

## Gate 2 — Verification

- [ ] Major claims cross-checked against ≥4 sources where possible.
- [ ] Unverified claims clearly labelled; opinion labelled `OPINION_SOURCE`.
- [ ] First-party data prioritised over generic advice.
- [ ] **Zero fabricated metrics** anywhere in the output.

## Gate 3 — Mathematical Model Integrity

- [ ] All 12 formulas documented (`search-math-models.md`) and implemented (`scoring-models.ts`).
- [ ] `npx tsc --noEmit --strict` passes on `types.ts` + `scoring-models.ts`.
- [ ] Every score returns `dataStatus` + `confidenceFactor`; placeholder inputs ⇒ `DATA_REQUIRED`.
- [ ] Required inputs per formula are enumerated.

## Gate 4 — Skill Creation

- [ ] Skill directory exists with all required files.
- [ ] All `*.schema.json` are valid JSON Schema; all JSON artifacts validate against them.
- [ ] TS compiles; markdown cross-links resolve.

## Gate 5 — Website Implementation Readiness

- [ ] Portfolio projects enumerated (real).
- [ ] Page inventory exists or is `DATA_REQUIRED` with a stated data gate.
- [ ] Backlog exists with action · claim_refs · validation · rollback per ticket.
- [ ] Human-approval gates documented before any live publish.

## Gate 6 — No Hallucinated Ranking Claims

- [ ] No ranking/revenue/CTR/traffic/volume number is invented.
- [ ] All metrics are sourced, computed from available data, or `DATA_REQUIRED`.
- [ ] `R-DATA-01` / `R-DATA-02` mitigations are in force (placeholder scores cannot auto-execute).

## Verification evidence required in the run report

- The actual `tsc` exit code.
- The actual JSON-validation results.
- A count of deliverables by `DataStatus` (`verified` / `partial` / `data_required`).
