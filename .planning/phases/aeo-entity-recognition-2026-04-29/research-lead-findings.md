# research-lead — AEO / Entity-Recognition Findings (2026-04-29)

**Skill invoked:** `research-lead` v0.3 (SYN-806 senior calibration)
**Authority:** ceo-foundation.md + verification-gates.md
**Linear:** SYN-806 (parent), new epic to be created (proposed: **SYN-AEO-1**)

---

## M-1 Source citation

| Field                                   | Value                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source                                  | YouTube transcript (creator-led tutorial · agency-owner perspective)                                                                                                                                                                                                                                                                                                                                                                   |
| Retrieval                               | 2026-04-29 (pasted by CEO)                                                                                                                                                                                                                                                                                                                                                                                                             |
| Credibility tier                        | **Tier 3** (reputable industry creator · single-source · agency case study)                                                                                                                                                                                                                                                                                                                                                            |
| Verification state                      | **`[hypothesised · awaiting our own pilot data]`** for the lift claims (e.g. "AI overviews in 68 % of local searches", "schema = 3× citation rate", "84 % of question queries trigger AI overviews"). Any of these statistics that we use externally must be re-sourced from a Tier 1 or Tier 2 reference (Whitespark 2026 ranking factors report is named in transcript — that's a Tier 2 source we can cite directly once verified). |
| Direct primary docs cited in transcript | Google Maps "Ask Maps" feature · Google Business Profile attribute schema · Schema.org · Whitespark 2026 Local Search Ranking Factors                                                                                                                                                                                                                                                                                                  |

---

## M-2 Direct mappings to foundation

| Transcript signal                                                                     | Foundation reference                                                                               | Verification gate(s) affected                                             |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| GBP completeness (attributes · services · reviews)                                    | **Q3.2.3 Amendment 1** (no artificial profiles) · **L7 carve-out** (DR is the only full-GBP brand) | VG-31 (DR GBP eligibility)                                                |
| Structured service content (one-page-per-service)                                     | **Q3.2.3 Amendment 4** (schema must match visible content)                                         | VG-13 (page-level schema) · VG-14 (page content original)                 |
| Schema markup (LocalBusiness · Service · FAQ · Article · WebSite)                     | **Q3.2.3 Amendment 4**                                                                             | VG-33 (schema audit)                                                      |
| Structured citations (NAP across Yelp/Facebook/Angie/Foursquare + Bing Places)        | Foundation **Phase 3.X.3** distribution tables                                                     | New gate proposed: **VG-AEO-1** (citation-consistency baseline per brand) |
| Unstructured mentions (local news · community blogs · best-of lists · industry blogs) | **Q3.4.3** (Hub authority discipline · neutral framing)                                            | New gate proposed: **VG-AEO-2** (mention freshness baseline per brand)    |
| Ask Maps "attribute match" 4th ranking dimension (Gemini-powered conversational)      | **Q3.2.3 Amendment 2** (AI-search = directional snapshot, not hard KPI)                            | None — per amendment, AI-search visibility stays directional              |
| Sentiment-rich review language (technician names · response times · parts replaced)   | **Q3.2.4** source-of-truth job ID propagation (review CTAs link to specific completed jobs)        | VG-AEO-3 (review-language template per brand)                             |
| Bing Places sync (ChatGPT uses Bing index)                                            | New: cross-portfolio infrastructure layer                                                          | VG-AEO-4 (Bing Places parity per brand)                                   |

---

## M-3 New capabilities + risks + verification gates affected

### Capabilities

| #   | Capability                                                                                                                               | Foundation ref                          | Verification state                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| C1  | One-page-per-service taxonomy (e.g. `/water-damage/brisbane`, `/mould-remediation/brisbane`) for DR                                      | Q3.2.3 Amendment 4 + Q3.2.3 Amendment 1 | hypothesised (need GSC query data to confirm gaps)                   |
| C2  | FAQ schema injection on service pages (matches the "84 % AI-overview question trigger" claim)                                            | Q3.2.3 Amendment 4                      | hypothesised (Tier 3 source)                                         |
| C3  | Bing Places sync via GBP-direct linkage                                                                                                  | New                                     | hypothesised (transcript-claimed 5-min setup)                        |
| C4  | Review-language SMS template ("what we fixed and how it went") for DR                                                                    | Q3.2.4 + Aid Rule                       | hypothesised — needs CEO approval before customer-facing SMS rollout |
| C5  | Unstructured-mention earned-media programme via `pr-communications-lead`                                                                 | Q3.4.3                                  | already authored in PR #119 — apply existing skill                   |
| C6  | Per-service-area mini-pages for DR (Brisbane · Gold Coast · Sunshine Coast · etc.) within Q3.2.3 Amendment 1 binding (no fake addresses) | Q3.2.3 Amendment 1                      | hypothesised (must respect SAB policy — no service-area inflation)   |

### Risks

| #   | Risk                                                                                                                                                 | Severity | Foundation guard                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| R1  | Building per-service-area landing pages without verified service delivery in those areas → SAB policy violation → GBP suspension                     | **HIGH** | Q3.2.3 Amendment 1 binding · `local-seo-geo-veteran` NEVER list rule 1 |
| R2  | FAQ schema injection without visible Q&A on page → structured-data spam under Google guidelines                                                      | **HIGH** | Q3.2.3 Amendment 4 binding · `local-seo-geo-veteran` NEVER list rule 4 |
| R3  | Reviews with technician-name + parts-replaced specificity could leak PII (homeowner address · job ID · adjuster identity) if not template-controlled | **MED**  | Q3.2.5 P-rules + P10 EXIF binding                                      |
| R4  | "First / leading / only" category claims in new service-page copy → category-claim gate breach                                                       | **MED**  | VG-state gating + `pr-communications-lead` NEVER list rule 1           |
| R5  | Cross-portfolio: applying the same review-language template across CCW + Nexus brands → Phase 3.4 boundary breach if templates pool customer data    | **MED**  | Phase 3.4 mechanical · `marketing-operations-director` hard rule 1     |
| R6  | Bing Places sync exposes admin write surface to a second platform → another credential attack surface                                                | **LOW**  | Standard secret-handling per CONSTITUTION.md                           |

### Verification gates affected (proposed)

| New VG       | Purpose                                                                                           | Evidence required to flip `[verification-needed]` → `[verified]`                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VG-AEO-1** | Citation-consistency baseline per brand (NAP across Yelp / FB / Angie / Foursquare / Bing Places) | Whitespark / BrightLocal audit report screenshot showing ≥ 95 % NAP match per brand                                                                                        |
| **VG-AEO-2** | Unstructured mention freshness per brand                                                          | Quarterly count of non-directory brand mentions (local news + industry blog + community-list) — baseline pulled by `research-lead` from Google + Bing News + Reddit search |
| **VG-AEO-3** | Review-language template approval per brand                                                       | CEO sign-off on per-brand SMS template (Aid Rule + voice-tag check passed via `brand-voice-enforce`)                                                                       |
| **VG-AEO-4** | Bing Places parity per brand                                                                      | Screenshot of Bing Places dashboard showing GBP sync active + listing live for each L7-eligible brand                                                                      |

---

## M-4 NEVER-list audit (research-lead v0.3)

Run before forwarding (auto-reject if any fail):

| NEVER rule                                                   | Pass / fail                                                                                                                            |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Never fabricate URLs / quotes / specs                        | **PASS** — only sources are the transcript itself + Whitespark report (named in transcript, will need direct retrieval before quoting) |
| Never quote source without retrieval timestamp               | **PASS** — 2026-04-29 retrieval recorded                                                                                               |
| Never ship Tier 4 source as sole basis for VG flip           | **PASS** — proposed VGs require Tier 1/2 corroboration before `[verified]` flip                                                        |
| Never claim "verified" on vendor marketing                   | **PASS** — Tier 3 transcript flagged as hypothesised                                                                                   |
| Never propose autonomous integration                         | **PASS** — output ends at recommendation, senior-strategist sequences                                                                  |
| Never name partner/customer/competitor without permission    | **PASS** — no third parties named                                                                                                      |
| Never expose claim data / PII                                | **PASS** — review-template R3 risk surfaced explicitly                                                                                 |
| Never soften pricing-not-announced finding                   | N/A — no pricing in scope                                                                                                              |
| Never infer foundation mapping                               | **PASS** — every mapping cites Q-section                                                                                               |
| Never recommend integration contradicting sovereignty thesis | **PASS** — all five signals reinforce sovereignty (own the entity recognition, don't rent it)                                          |

---

## M-5 Recommendation + sequencing proposal

### Sequencing (per Q2.5.1 dual-flywheel + 30/30/30 local-SEO discipline)

**Phase A — Days 1-30 audit (no shipping, just baseline measurement):**

1. **DR (primary flywheel)** — `local-seo-geo-veteran` runs full GBP audit per [skill](.claude/skills/local-seo-geo-veteran/SKILL.md): VG-31 + VG-13 + VG-14 + VG-33 state, GBP attribute completeness checklist, Brisbane GBP weekly health-check (already in worked example), schema-vs-content match audit on existing service pages
2. **Cross-portfolio** — `seo-geo-master` pulls citation baseline from Whitespark / BrightLocal for all 4 Nexus brands + CCW (separately, per Phase 3.4)
3. **DR + NRPG + RA + CARSI + CCW** — `pr-communications-lead` pulls non-directory mention baseline (Tier 3 sources noted, baseline only — no Tier-1 claims yet)
4. **DR** — pull Google Search Console query data; identify "service queries we have impressions for but no dedicated page" (the transcript's #1 quick win)

**Phase B — Days 31-60 foundations (gated builds):**

5. **DR** — close GBP attribute gaps from audit (5-min wins per attribute); schema-vs-content fixes (Q3.2.3 Amendment 4); Bing Places sync
6. **DR + CARSI** — FAQ-schema injection on existing service pages where visible Q&A already present (Amendment 4 binding); add missing Q&A content via `senior-copywriter` first if not present
7. **All brands** — review-language SMS template authoring (per-brand voice via `brand-voice-enforce`); CEO approval gate; rollout once VG-AEO-3 flipped
8. **NRPG / RestoreAssist / CARSI / CCW** — Org schema parity check (no full GBP per L7 carve-out); LocalBusiness schema only on RA for Brisbane HQ if physical-presence requirements met

**Phase C — Days 61-90 publishing (the multiplier):**

9. **DR** — service-page expansion identified from GSC gap analysis (one page per service × per service-area, no fake areas — SAB policy binding per R1)
10. **All brands** — earned-media outreach for non-directory mentions (`pr-communications-lead` workflow, Aid Rule binding for AI-related framing)
11. **DR + RA** — review-language programme runs (post-job SMS automation via `marketing-operations-director` trigger orchestration with source-of-truth job ID propagation per Q3.2.4)
12. **Tier 2 monthly + Tier 3 quarterly** — `performance-attribution-lead` reads Whitespark / BrightLocal score deltas + GBP insights pulls + ChatGPT citation rate (directional per Q3.2.3 Amendment 2)

### Out of scope (explicit)

- Per-service-area pages for CCW / CARSI / RA / NRPG (L7 carve-out — DR only for full GBP scope)
- Buying review velocity (Google policy violation; reject per `local-seo-geo-veteran` NEVER list rule 9)
- Repackaging the transcript's stats as our own claims without Tier-1 source corroboration (Aid Rule + category-claim gating)
- Building the "30+ service pages" tool the transcript-creator promotes (we have `senior-copywriter` + `seo-schema` + `seo-sitemap` already in skill catalog — no third-party tool justified)

### Cross-portfolio scope

- **Both with carve-out** — Nexus (DR · NRPG · RA · CARSI) full programme per L7 + voice-tag matrix; CCW gets parallel programme with Phase 3.4 boundary mechanical at every layer (separate audits, separate review templates, separate Bing Places listings, no shared customer data)

### CEO attention required

**Yes — three decisions needed:**

1. **Approve VG-AEO-3 flip pathway** — review-language SMS template per brand. Customer-facing comms requires explicit CEO sign-off per CONSTITUTION.md before send. (Drafts go through `brand-voice-enforce` → `pr-communications-lead` → CEO batch queue.)
2. **Confirm scope of Phase A audit budget** — Whitespark / BrightLocal subscription needed for citation baseline. Cost ~$30-50/mo per tool. Internal SaaS = no client-billable, just ops cost.
3. **DR per-service-area expansion limits** — confirm DR's actual service-delivery footprint (which postcodes / suburbs we genuinely cover) before any landing-page build, to stay on the right side of Q3.2.3 Amendment 1. Without this answer, R1 is unmitigated.

### Forward to

`senior-strategist` — for sequencing into Tier B build pipeline + cross-portfolio coordination
**Audit-log entry to `foundation-keeper`** — propose 4 new VGs (AEO-1 through AEO-4)

### Prose summary (≤ 8 sentences for CEO)

The transcript is solid local-SEO craft repackaged as "AEO" — the substance is sound but the lift claims are Tier 3 and need our own data before we cite them externally. Five signals (GBP completeness, structured service pages, schema, citations, unstructured mentions) all map cleanly onto our existing Q3.2.3 amendments and the local-seo-geo-veteran skill. **DR captures most of the upside** because it's the only L7-permitted full-GBP brand; NRPG / RA / CARSI / CCW get a smaller scope (Org schema + Bing Places + earned mentions only, no GBP build). **Three decisions needed from you**: (1) approve review-language SMS template authoring (then per-brand drafts go through brand-voice-enforce + your sign-off); (2) confirm Whitespark/BrightLocal ops budget (~$30-50/mo); (3) confirm DR service-delivery footprint so we don't build SAB-violating landing pages. **Recommend Phase A (audit, no shipping) starts immediately** — local-seo-geo-veteran already has the playbook + worked example for DR Brisbane, just needs to fan out to the rest of the Nexus footprint and the CCW boundary check. **Phase B + C ship gated** behind VG-AEO-1 through VG-AEO-4 flips. **Total elapsed-time estimate: 90 days** to the first measurable lift in the directional AI-search snapshot per Q3.2.3 Amendment 2.

---

## Versioning

- v0.1 (2026-04-29): research-lead v0.3 first deliverable post-Phase 3 ship · YouTube creator transcript ingested + mapped + sequenced.
