# NRR Verification Research Plan — Prosumer Growth

**Task:** t_7d46702e
**Date:** 2026-08-23
**Workspace:** `/Users/phill-mac/pi-seo-workspace/Synthex/.worktrees/t_7d46702e`
**Scope:** Research plan only (no system changes, no production data)

---

## Executive Summary

**Goal:** Create a verified research plan to confirm Synthex NRR >= 100% and identify pricing discipline gaps for prosumer growth.

**Constraints:**

- No production data access (wiki/operational docs only)
- Timeline: 3 days
- Scope: Research plan definition, not execution
- Evidence sources: Synthex wiki signals, operational docs, external benchmarks

**Key Findings from Repo Scan:**

- Churn rate target: <5% (optimization-playbook)
- Retention rate target: 80% (kpi-dashboard)
- Reactive retention incomplete (churn-scorer archived, capability-matrix.csv marks retention incomplete)
- No NRR definition in repo — must infer from wiki + external standards

**Definition Used:**

- **NRR** = Net Revenue Retention >= 100% (GAAP/industry standard: includes expansions, discounts, churn)
  - NRR < 100% = revenue decline on existing business (discounts > expansions)
  - NRR >= 100% = revenue stable or growing on existing base

---

## Day 1 — NRR Definition & Wiki Signal Verification

### Objective

Establish the exact NRR definition used by Unite Group and verify wiki signals.

### Research Questions

1. What is the exact NRR definition used by Unite Group (if documented in wiki)?
2. Are there existing NRR targets, baselines, or signal records in Synthex wiki?
3. How is NRR tracked or reported operationally (if at all)?

### Wiki Signals to Verify (per task body)

- `wiki_pages` search for "NRR" or "Net Revenue Retention"
- `wiki_pages` search for "churn" AND "root-cause"
- `operational-priorities-q2-2026` (if accessible via non-wiki channel)
- Exit thesis (id: `exit-thesis`) — $2B exit filter

### External Benchmarks (Google/Search)

- Industry standard NRR definitions (SaaS, B2B marketing automation)
- Benchmark ranges by segment (prosumer vs SMB vs enterprise)
- How ARR growth, churn, and expansion map to NRR

### Success Criteria (Day 1)

- [ ] **1 evidence tag** per wiki signal source (NOTES: source-linked, not opinion)
- [ ] NRR definition captured (exact wording)
- [ ] If wiki signals exist, full content retrieved
- [ ] External benchmark ranges captured

### Deliverable

- `NRR-DEFINITION-VERIFICATION.md` (markdown, grouped by source)

---

## Day 2 — Churn → NRR Drivers & Pricing Discipline Mapping

### Objective

Map churn root-cause categories to NRR drivers and define pricing discipline indicators.

### Research Questions

1. Which churn root-cause categories drive NRR < 100%?
2. How do churn reasons map to NRR levers (expansion, discount frequency, discount value)?
3. What are the 2-3 key pricing discipline indicators for prosumer growth?

### Wiki Signals to Verify (per task body)

- Churn root-cause categories from wiki (if documented)
- Prosumer segment characteristics (if documented)
- Pricing tiers or discount policies (if documented)

### External Benchmarks (Google/Search)

- Churn → NRR relationship (what drives net revenue retention)
- Pricing discipline patterns (discount usage, adoption of upsells, expansion revenue)
- Prosumer vs SMB pricing behavior benchmarks

### Success Criteria (Day 2)

- [ ] **2 evidence tags** (one per churn category, one per pricing indicator)
- [ ] 3 churn → NRR driver maps (category → levers)
- [ ] 3 pricing discipline indicators defined (1 = primary expansion signal, 2 = discount discipline, 3 = feature expansion)

### Deliverable

- `CHURN-TO-NRR-DRIVERS.md` (markdown, grouped by source, with evidence tags)

---

## Day 3 — Data Extraction Targets & Verification Steps

### Objective

Define concrete extraction targets and verification methodology for NRR verification.

### Research Questions

1. What data points are needed to calculate NRR for Synthex?
2. How should 13 prosumer customers be analysed (tenure, churn, usage, pricing)?
3. What are the 3 verification steps to confirm NRR >= 100%?

### Extraction Targets (per task body)

1. Renewal data (contract start/end, expansions, discounts)
2. Churn reasons (why do customers leave, per segment)
3. Pricing tiers (which prosumer segment, discount frequency/value)

### Success Criteria (Day 3)

- [ ] **5 evidence tags** (3 data points + 2 verification steps, each source-linked)
- [ ] 3 verification steps defined (step 1 = calculate NRR, step 2 = validate expansion > discount, step 3 = segment stress-test)
- [ ] 13 prosumer customers defined as cohort: all with >=90-day tenure, active or churned

### Deliverable

- `NRR-VERIFICATION-EXTRACTION.md` (markdown, grouped by source)

---

## Evidence Tagging Standard (Fabel Evidence Standard)

Every claim in the research plan must carry ONE tag:

- `[VERIFIED]` — claim backed by source text
- `[INFERENCE]` — logical deduction from multiple sources
- `[UNCONFIRMED]` — missing source or unverifiable

**Tag placement:** At the end of the claim, before the period.

**Example:**

> "External benchmark shows SaaS companies typically achieve NRR >= 110% for prosumer segments, but this may not reflect the B2B marketing automation niche. [UNCONFIRMED]"

---

## Adjacent Work (Do Not Block On)

- Wiki brain connection issues (pursue alternative channels if Supabase unavailable)
- NRR verification execution (scope-limited to plan; implementation deferred)

---

## Next Actions

1. Continue Day 1 research (wiki signals + external benchmarks)
2. If wiki signals missing, flag as gap and escalate to Phill
3. After Day 2, validate churn → NRR mappings with Phill
4. After Day 3, finalize extraction targets and verification steps
5. Submit research plan for Phill approval

---

## Guardrails (Non-Negotiable)

1. **No production data access** — all evidence from wiki/operational docs only
2. **Keep work scoped** — research plan only, no system changes
3. **Avoid false precision** — label unverified claims with `[UNCONFIRMED]`
4. **Source-link everything** — every tag must reference a source document

---

## Success Criteria (Overall)

- Research plan defines **3 verification steps** (Day 3)
- Research plan lists **5 data points** (Day 3)
- Research plan identifies **3 pricing discipline indicators** (Day 2)
- Timeline scoped to **3 days** (per task body)

---

**Approval Required:** Phill to review and approve research plan before proceeding to execution.
