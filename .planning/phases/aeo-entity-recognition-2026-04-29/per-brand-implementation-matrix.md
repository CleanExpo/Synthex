# AEO / Entity-Recognition — Per-Brand Implementation Matrix

**Generated:** 2026-04-29 by `senior-strategist` v0.3 (consuming `research-lead` findings + `local-seo-geo-veteran` L7 carve-out + `pr-communications-lead` workflow)
**Linear:** SYN-806 parent · proposed epic SYN-AEO-1
**Source:** [research-lead-findings.md](./research-lead-findings.md)

---

## Brand-by-brand applicability matrix

| Brand                            | L7 GBP scope                                           | Service-page expansion                                    | FAQ schema                         | Citation parity (Yelp/FB/Angie/Foursquare/Bing)           | Unstructured mentions                  | Review-language SMS                           | Bing Places sync                          |
| -------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------- | -------------------------------------- | --------------------------------------------- | ----------------------------------------- |
| **DR** (disasterrecovery.com.au) | ✅ Full GBP                                            | ✅ Per-service × per-suburb (gated by Q3.2.3 A1)          | ✅ All service pages               | ✅ All five directories                                   | ✅ Local news + insurance trade press  | ✅ Post-job SMS via job ID                    | ✅                                        |
| **NRPG**                         | ❌ Org schema only (L7 carve-out)                      | ❌ Single ICP per Phase 3.2.2 — no service-area expansion | ⚠ FAQ on existing pages only       | ⚠ Bing Places + 1-2 industry directories                  | ✅ Industry trade press                | ⚠ Post-job SMS only if NRPG ICP signs off     | ✅                                        |
| **RestoreAssist**                | ❌ Org schema only (App Store-led, not local-services) | ⚠ Use-case pages (not service-areas)                      | ✅ FAQ on documentation help pages | ⚠ Bing Places + App Store dir                             | ✅ Restoration trade press + IICRC AU  | ✅ In-app prompt (not SMS — channel mismatch) | ✅                                        |
| **CARSI**                        | ❌ Org schema only (Owner program, not local-services) | ⚠ Owner-program pages, no per-suburb                      | ✅ FAQ on Hub articles             | ⚠ Bing Places + insurance dir                             | ✅ Insurance + restoration trade press | ❌ No SMS (B2B Owner audience)                | ✅                                        |
| **CCW**                          | ❌ Org schema only + Phase 3.4 carve-out absolute      | ⚠ Hub article expansion (Q3.4.3)                          | ✅ FAQ on Hub articles             | ⚠ CCW-only directories — NO crossover with Nexus listings | ✅ Carpet/textile trade press          | ❌ Channel TBD                                | ⚠ Separate Bing Places, no shared listing |

**Legend:** ✅ in scope · ⚠ scoped/conditional · ❌ out of scope

---

## DR-specific build (the largest scope)

DR is the only brand with full L7 carve-out for GBP build. All five signals apply and DR captures most of the AEO upside per the research.

### Phase A — Days 1-30 audit (no shipping)

| Step | Owner                    | Output                                                                                                                           | Foundation gate            |
| ---- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| A1   | `local-seo-geo-veteran`  | Brisbane GBP weekly health pull (already in worked example) — extend to all DR service-area GBPs                                 | VG-31 state per location   |
| A2   | `local-seo-geo-veteran`  | GBP attribute completeness checklist per location (emergency · payment · accessibility · service area · specialties · languages) | none — pure inventory      |
| A3   | `seo-geo-master`         | GSC query export — all queries with impressions but no dedicated landing page                                                    | none — discovery only      |
| A4   | `seo-geo-master`         | Whitespark / BrightLocal NAP audit across Yelp / FB / Angie / Foursquare                                                         | new VG-AEO-1 baseline      |
| A5   | `pr-communications-lead` | Non-directory mention baseline (Google News + Bing News + Reddit + insurance trade press search)                                 | new VG-AEO-2 baseline      |
| A6   | `seo-schema`             | Schema-vs-content match audit on all `disasterrecovery.com.au/*` service pages                                                   | Q3.2.3 Amendment 4 binding |

### Phase B — Days 31-60 foundations (gated builds)

| Step | Owner                                                     | Pre-condition                                             | Acceptance                                                                                                 |
| ---- | --------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| B1   | `local-seo-geo-veteran` + `marketing-operations-director` | A1 + A2 complete                                          | All DR GBP attributes filled where applicable; weekly health-check cadence locked                          |
| B2   | `seo-schema`                                              | A6 complete + senior-copywriter Q&A drafted where missing | FAQ schema injected ONLY where visible Q&A exists; structured-data validator green                         |
| B3   | `marketing-operations-director`                           | A4 complete                                               | NAP corrections submitted to all 5 directories; Bing Places sync activated                                 |
| B4   | `senior-copywriter` + `brand-voice-enforce` + CEO         | none                                                      | Per-brand review-language SMS template (Aid Rule binding for any AI mention); CEO sign-off → VG-AEO-3 flip |

### Phase C — Days 61-90 publishing

| Step | Owner                                                | Pre-condition                                                                    | Notes                                                                                                                                         |
| ---- | ---------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| C1   | `senior-copywriter` + `seo-geo-master`               | A3 (GSC gap analysis) + CEO confirmation of DR service-delivery footprint per R1 | One service page per (service × verified-service-area). NEVER per (service × aspirational-area) — SAB policy binding                          |
| C2   | `pr-communications-lead`                             | A5 + brand-voice-enforce                                                         | Earned-media outreach: insurance trade press + IICRC AU newsletter + local Brisbane business journals; Aid Rule binding for any RA/AI framing |
| C3   | `marketing-operations-director` + `client-retention` | B4 (VG-AEO-3 flipped)                                                            | Post-job SMS automation wired with source-of-truth job ID propagation per Q3.2.4 H8; cap-window pooling per cross-brand frequency cap         |
| C4   | `performance-attribution-lead`                       | All Phase B + C live                                                             | Tier 1 weekly + Tier 2 monthly cadence locked: Whitespark score Δ + GBP insights + ChatGPT directional citation snapshot per Q3.2.3 A2        |

---

## CCW-specific build (Phase 3.4 boundary mechanical)

CCW gets a parallel-but-isolated programme. **Zero shared infrastructure with Nexus brands.**

| Step  | Owner                           | Notes                                                                                                                               |
| ----- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| CCW-1 | `local-seo-geo-veteran`         | Org schema + LocalBusiness inheritance only; NO full GBP build (L7 carve-out absolute)                                              |
| CCW-2 | `seo-geo-master`                | Citation baseline pulled separately (different account credentials); CCW-only Bing Places listing — never linked to a Nexus listing |
| CCW-3 | `seo-schema`                    | FAQ schema on Hub articles per Q3.4.3 Hub authority discipline; partner-permission verification mandatory before naming any insurer |
| CCW-4 | `pr-communications-lead`        | Carpet/textile trade press only; cross-portfolio boundary check FAIL = rework                                                       |
| CCW-5 | `marketing-operations-director` | Trigger orchestration uses CCW-only Mailchimp account; no shared customer data with Nexus L1 (Phase 3.4 mechanical)                 |

---

## Risk register (from research-lead R1-R6)

| Risk                                                         | Mitigation owner                                                   | Mitigation                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1: SAB-violating landing pages → GBP suspension             | `local-seo-geo-veteran` (NEVER list rule 1) + CEO confirmation     | C1 step blocked until CEO confirms verified service-delivery footprint per location                                                                |
| R2: FAQ schema injection without visible Q&A → spam          | `seo-schema` + Q3.2.3 A4 binding                                   | B2 step requires A6 audit first; Q&A content production via senior-copywriter MUST land before schema                                              |
| R3: Reviews leak PII (homeowner address · adjuster identity) | `marketing-operations-director` (P10/P16 binding)                  | Review-template R3 routed via `brand-voice-enforce` + privacy-redaction pass; SMS template never auto-fills technician's full name without consent |
| R4: Category claims in service pages → claim-gate breach     | `pr-communications-lead` (NEVER list rule 1) + `senior-copywriter` | All service-page copy passes through brand-voice-enforce; "first/only/leading" auto-rejects without VG-state `[verified]`                          |
| R5: Cross-portfolio template pooling → Phase 3.4 breach      | `marketing-operations-director` (hard rule 1)                      | CCW gets separate template authoring + separate trigger pipeline + separate Bing Places + separate earned-media list                               |
| R6: Bing Places admin write surface                          | `codex-security-auditor` review pre-launch                         | Credential stored in Vercel env (NEVER local); 2FA mandatory on Bing Places account                                                                |

---

## CEO decisions still needed

1. **Approve VG-AEO-3 pathway** — review-language SMS template authoring per brand, then per-brand drafts route through brand-voice-enforce → CEO batch queue for sign-off
2. **Confirm Whitespark / BrightLocal ops budget** — ~$30-50/mo per tool. Internal SaaS = ops cost only, no client-billable
3. **Confirm DR service-delivery footprint** — which postcodes / suburbs DR genuinely covers (R1 mitigation; without this, C1 stays blocked)

---

## Linear-ready tickets

### Epic

- **SYN-AEO-1** — `[EPIC] AEO / Entity-Recognition — local-SEO programme across Unite-Group portfolio (90-day phased build per Q2.5.1)`
- Children below

### Phase A audit tickets (Days 1-30 · no shipping)

```
Title: feat(local-seo): SYN-AEO-2 — DR GBP attribute + schema + GSC audit (Phase A audit baseline)
Body:
- Owner: local-seo-geo-veteran + seo-geo-master
- Scope: A1 + A2 + A3 + A6 from per-brand-implementation-matrix.md
- Deliverable: pulled inventory of GBP attribute completeness per location, GSC query-vs-page gap list, schema-vs-content audit JSON
- Acceptance: written to .claude/scratchpad/aeo-phase-a-dr-audit.md
- Foundation: Q3.2.3 A1 + A4, VG-31, VG-13, VG-14, VG-33

🤖 Generated by research-lead v0.3 from SEO/AEO/GEO transcript ingestion 2026-04-29
```

```
Title: feat(local-seo): SYN-AEO-3 — Cross-portfolio NAP audit + non-directory mention baseline (Phase A)
Body:
- Owner: seo-geo-master + pr-communications-lead
- Scope: A4 + A5 across DR/NRPG/RestoreAssist/CARSI (Nexus, separate audit) + CCW (separate, Phase 3.4 boundary)
- Deliverable: Whitespark/BrightLocal NAP report per brand; mention-baseline count per brand
- Acceptance: VG-AEO-1 baseline data + VG-AEO-2 baseline data both written to scratchpad

🤖 Generated by research-lead v0.3 from SEO/AEO/GEO transcript ingestion 2026-04-29
```

### Phase B foundation tickets (Days 31-60 · gated builds)

```
Title: feat(local-seo): SYN-AEO-4 — DR GBP attribute completion + Bing Places sync (Phase B)
Body:
- Owner: local-seo-geo-veteran + marketing-operations-director
- Pre-condition: SYN-AEO-2 complete
- Scope: B1 + B3 from matrix
- Acceptance: All DR GBP attributes filled where applicable; Bing Places listing live + verified per location; cron sync wired
- Foundation: Q3.2.3 A1, VG-31

🤖 Generated by research-lead v0.3 from SEO/AEO/GEO transcript ingestion 2026-04-29
```

```
Title: feat(seo-schema): SYN-AEO-5 — FAQ schema injection on DR + CARSI service/Hub pages (Phase B)
Body:
- Owner: seo-schema + senior-copywriter
- Pre-condition: SYN-AEO-2 (audit complete) + Q&A content production where visible Q&A missing
- Scope: B2 from matrix; FAQ schema only where visible Q&A on page
- Acceptance: Structured-data validator green on all changed pages; Q3.2.3 A4 audit re-run shows zero schema-vs-content mismatch
- NEVER: ship FAQ schema on a page without visible Q&A (auto-reject per local-seo-geo-veteran rule 4)

🤖 Generated by research-lead v0.3 from SEO/AEO/GEO transcript ingestion 2026-04-29
```

```
Title: feat(retention): SYN-AEO-6 — Per-brand review-language SMS template (CEO-gated, Phase B)
Body:
- Owner: senior-copywriter + brand-voice-enforce + pr-communications-lead + CEO
- Pre-condition: VG-AEO-3 flipped via CEO sign-off on per-brand draft
- Scope: B4 from matrix; one template per brand (DR primary, RA in-app variant, NRPG/CARSI conditional, CCW separate)
- Acceptance: Templates pass brand-voice-enforce + CEO batch-queue sign-off recorded; trigger payload includes source-of-truth job ID per Q3.2.4 H8

🤖 Generated by research-lead v0.3 from SEO/AEO/GEO transcript ingestion 2026-04-29
```

### Phase C publishing tickets (Days 61-90)

```
Title: feat(seo): SYN-AEO-7 — DR per-service × per-verified-area landing pages (Phase C, GATED on CEO footprint confirmation)
Body:
- Owner: senior-copywriter + seo-geo-master
- Pre-condition: SYN-AEO-2 (GSC gap analysis) + CEO-confirmed DR service-delivery footprint per R1 mitigation
- Scope: C1 from matrix; one page per (service × VERIFIED service-area). Aspirational areas BLOCKED.
- Acceptance: All new pages pass schema-vs-content match (Q3.2.3 A4); each page traces to a real GSC query + a verified service-area
- Foundation: Q3.2.3 A1 binding, R1 risk register

🤖 Generated by research-lead v0.3 from SEO/AEO/GEO transcript ingestion 2026-04-29
```

```
Title: feat(pr): SYN-AEO-8 — Earned-media unstructured-mention programme (Phase C)
Body:
- Owner: pr-communications-lead + brand-strategist
- Scope: C2 from matrix; per-brand outreach to non-directory publishers (insurance trade press, IICRC AU, Brisbane business journals for DR; carpet/textile trade press for CCW separately)
- Pre-condition: SYN-AEO-3 (mention baseline) + brand-voice-enforce gate
- Acceptance: 12-week target ≥ 3 confirmed placements per Nexus brand (per pr-communications-lead worked example pattern); CCW separate measurement

🤖 Generated by research-lead v0.3 from SEO/AEO/GEO transcript ingestion 2026-04-29
```

```
Title: feat(retention): SYN-AEO-9 — Post-job SMS automation rollout for DR + RA (Phase C)
Body:
- Owner: marketing-operations-director + client-retention
- Pre-condition: SYN-AEO-6 (template) approved + DR/RA job-ID propagation verified
- Scope: C3 from matrix; SMS for DR, in-app prompt for RA; cross-brand frequency cap pooled per identity per marketing-operations-director hard rule 3
- Acceptance: ≥ 30 % response rate on first 100 sends per brand; reviews logged with technician name + work-done specificity (PII-redacted per template); Q3.2.5 P10/P16 audit clean

🤖 Generated by research-lead v0.3 from SEO/AEO/GEO transcript ingestion 2026-04-29
```

```
Title: feat(analytics): SYN-AEO-10 — AEO directional snapshot dashboard (Tier 1/2/3 cadence per Q3.2.3 A2)
Body:
- Owner: performance-attribution-lead + analytics-lead
- Pre-condition: All Phase B+C live
- Scope: C4 from matrix; weekly Whitespark score Δ + GBP insights + monthly ChatGPT/Perplexity/Gemini directional citation pull (per-brand, NOT a hard KPI)
- Acceptance: Renders into existing reporting-templates.md cadence; per-brand verification-state tags on every metric

🤖 Generated by research-lead v0.3 from SEO/AEO/GEO transcript ingestion 2026-04-29
```

### Foundation amendment ticket (foundation-keeper)

```
Title: chore(foundation): SYN-AEO-11 — Add 4 new verification gates (VG-AEO-1 through VG-AEO-4) to verification-gates.md
Body:
- Owner: foundation-keeper
- Pre-condition: CEO direct confirmation per foundation-keeper hard rule 1 (verbal/conversational confirmation insufficient — needs source documentation reference)
- Scope: VG-AEO-1 (citation consistency baseline) · VG-AEO-2 (mention freshness baseline) · VG-AEO-3 (review-language template approval) · VG-AEO-4 (Bing Places parity)
- Acceptance: 4 new VG entries logged in audit trail with source-doc reference (this research-lead-findings.md file at git SHA)
- Atomic propagation: notify local-seo-geo-veteran + seo-geo-master + pr-communications-lead + marketing-operations-director skills of new gate definitions

🤖 Generated by research-lead v0.3 from SEO/AEO/GEO transcript ingestion 2026-04-29
```

---

## Total scope

- **1 epic** (SYN-AEO-1)
- **10 child tickets** (SYN-AEO-2 through SYN-AEO-11)
- **3 CEO decisions** to unblock Phase A → Phase B → Phase C
- **4 new verification gates** proposed
- **90-day elapsed-time** to first measurable directional lift

---

## Versioning

- v0.1 (2026-04-29): senior-strategist v0.3 first deliverable consuming research-lead findings · per-brand matrix + 30/30/30 sequencing + 10 Linear-ready ticket bodies + risk register + CEO decision points.
