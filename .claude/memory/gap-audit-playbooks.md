# Synthex Gap Audit Playbooks — Gaps 3–8 — v0.1 (2026-04-27)

> **Authority:** Phill McGurk, CEO. **Foundation source:** `ceo-foundation.md` (canonical) + `verification-gates.md` (gate state)
> **Consumed by:** `performance-attribution-lead` skill (executes audits) + `senior-strategist` skill (orchestrates) + `marketing-operations-director` skill (operates infrastructure findings)
> **Operating rule:** Gap audits convert hypothesised verification-gate state to verified evidence. Every audit = checklist + verification method + report format + remediation pattern.

---

## Gap dependency map

```
Gap 3 (RestoreAssist) — P0 ──┐
                              ├─→ Gap 5 (GBP build) — P0 (gates on Gap 4)
Gap 4 (DR/NRPG/CARSI) — P0 ──┘
                              ├─→ Gap 6 (insurer co-marketing) — P1
                              └─→ Gap 7 (Property Manager + Strata surfaces) — P1
                              
Gap 8 (CCW client engagement) — P0 (independent · gates VG-71 commercial conversation)
```

---

## Gap 3 — RestoreAssist asset + attribution audit (P0)

> **Foundation reference:** Q3.1.3 Amendment 1 (verification gate) + Q3.1.5 P-rules
> **Owner skill:** performance-attribution-lead (executes) + marketing-operations-director (privacy + integration audit)
> **Verification gates this Gap unblocks:** VG-40, VG-41, VG-42, VG-43, VG-44, VG-45, VG-46

### Audit checklist

| Item | Verification method | Source needed | Expected verified state |
|------|--------------------|--------------|--------------------------|
| RA iOS App Store URL (VG-40) | App Store live link | URL + indexed status | `[verified-DD/MM/YYYY · source: <URL>]` |
| ATT compliance (VG-41) | App Store Connect ATT framework status | Screenshot + ATT permission flow reference | `[verified-DD/MM/YYYY · ATT integrated]` |
| Privacy Nutrition Labels (VG-42) | App Store Connect Privacy Details review | Screenshot of declared data types + uses | `[verified-DD/MM/YYYY · matches Q3.1.5 P-rules]` |
| Aggregate rating provenance (VG-43) | Review provenance audit | Source attribution per review · genuine + attributable + compliant | `[verified-DD/MM/YYYY]` OR suppress in copy |
| GA4 + Search Console wired (VG-44) | Property-confirmation audit | GA4 measurement ID + GSC verified property reference | `[verified-DD/MM/YYYY]` |
| Trial signup conversion tracking (VG-45) | Event-tracking audit | A1 event firing on /signup | `[verified-DD/MM/YYYY]` |
| A3 measurement integrity (VG-46) | Product-side review-flag confirmation | Screenshot/spec confirming A3 fires only after explicit review-and-sign-off step | `[verified-DD/MM/YYYY]` |
| Schema markup audit | Structured data validator pass | Per page schema scan | Schema matches visible content per Q3.2.3 Amendment 4 |
| LinkedIn DR + NRPG company page status | Manual check | Company page URLs + admin access | Page exists + linked + brand-voice compliant |
| YouTube channel status | Manual check | Channel URL + admin access | Exists OR creation work surfaces |

### Report format

Per item: status, source documentation reference, verification gate flip recommendation, remediation pattern (if not verified).

### Remediation pattern

For each `[verification needed]` item:
1. Identify owner (CEO action vs agent action vs engineering)
2. Estimate effort + timeline
3. Surface to senior-strategist for sequencing
4. Route to relevant production skill once unblocked

---

## Gap 4 — DR + NRPG + CARSI asset + coverage + permission audit (P0)

> **Foundation reference:** Q3.2.3 Amendment 1, 2, 3, 7, 9 + Q3.3.1 Verification Gates
> **Owner skill:** performance-attribution-lead + local-seo-geo-veteran + marketing-operations-director
> **Verification gates this Gap unblocks:** VG-02, VG-10–VG-26 (insurer panels), VG-27, VG-28, VG-29, VG-30, VG-31, VG-32, VG-33

### Audit checklist — DR + NRPG

| Category | Specific items |
|----------|---------------|
| **GBP audit (VG-31)** | Profile ownership · verification status · business name accuracy · address/service-area setup · primary+secondary categories · hours+after-hours · phone routing · website URL+UTM · services listed · photos+videos (P10 EXIF stripping audit) · review count+provenance · Q&A coverage · location/service-area accuracy · claim-form/call-tracking linkage |
| **Service-area coverage (VG-14)** | Sydney · Melbourne · Brisbane · Perth · Auckland — each verified for real operating presence · safer fallback to ANZ generic if not |
| **Damage category coverage (VG-13)** | Water · fire · mould · storm · biohazard · sewage · laser-cleaning — service-delivery audit per category |
| **Insurer relationship permission (VG-15–VG-26)** | NRMA · Suncorp · AAMI · Allianz · QBE · RACV · CGU · GIO · RACQ · Vero · CommInsure · Youi — current relationship + per-page permission scope |
| **NRPG entry requirements (VG-27)** | IICRC cert · $1M+ liability · 2yr+ experience · clean safety record — confirm current NRPG entry standards |
| **NRPG payment SLA (VG-28)** | Average payment terms + process documentation · "fast payment" eligibility |
| **NRPG margin per contractor (VG-29)** | Commercial structure · network fee · revenue retained · CAC ceiling derivation possible |
| **DR contribution margin per claim (VG-30)** | Commercial structure · contractor split · insurer billing · paid-search CAC ceiling |
| **Schema markup (VG-33)** | LocalBusiness · EmergencyService · Service · Org · FAQ · per-page audit · matches visible content |
| **Claim system funnel-tracking (VG-32)** | GA4 + Search Console + form/call tracking · Amendment 7 paid-pilot prerequisites |

### Audit checklist — CARSI

| Category | Specific items |
|----------|---------------|
| **IICRC CEC Provider Status (VG-02)** | IICRC AU email OR approved-school registry listing OR contract acknowledgement |
| **Mandatory Sync (VG-61)** | Technical link · CARSI completion → NRPG status unlock |
| **"Intro to Drying" sufficiency (VG-62)** | Module content audit · Entry Gate suitability for new NRPG applicants |
| **Catalogue depth (VG-63)** | Course inventory · last refresh · IICRC alignment per course |
| **Subscriber base (VG-64)** | Current paid subscribers · trial converters · churn rate |
| **Cross-sell mechanics (VG-65)** | T10 trigger product-side wiring |

### Remediation pattern

Same as Gap 3. Insurer permission audit may surface "no current relationship" — that's the verified state · copy stays at generic *"major Australian insurer panels"* per Q3.2.1 fallback.

---

## Gap 5 — Per-eligible-profile GBP build/clean-up plan

> **Gates on Gap 4 completion** — must NOT begin until Gap 4 confirms which GBPs and service areas are legitimate
> **Foundation reference:** Q3.2.3 Amendment 1 (GBP compliance rule) + Hard rule 9
> **Owner skill:** local-seo-geo-veteran

### Audit checklist (post-Gap-4)

| Item | Action |
|------|--------|
| Eligible profile inventory | List each profile that passed Gap 4 audit |
| Build sequence | Priority by service-area volume + claim throughput |
| Per-profile photo curation | Permissioned source · EXIF-stripped server-side per P10 |
| Per-profile services | VG-13 verified categories only |
| Per-profile hours | Match real operational hours · after-hours emergency state accurate |
| Per-profile UTM tagging | Source-attribution wired to GA4 |
| Per-profile call tracking | Phone routing verified · paid-pilot prerequisite |
| Review velocity plan | Genuine review acquisition · no incentivised reviews · no review gating |
| Q&A seeding | Common emergency-intent Q&A populated per profile |

### Hard constraint

**No artificial city/service-area profiles created.** GBP compliance rule Q3.2.3 Amendment 1 binding. Eligible profiles only.

---

## Gap 6 — Insurer co-marketing pilot framework (P1)

> **Foundation reference:** Q3.2.1 framing rule 5 (insurer + partner permission portfolio-wide)
> **Owner skill:** senior-strategist + brand-strategist + senior-cmo
> **Gates on:** Gap 4 + IICRC clearance (per Q3.2.3 sequencing)

### Audit checklist

| Item | Action |
|------|--------|
| Existing relationship inventory | Of 12 named insurers (VG-15–VG-26) · which have current relationships |
| Permission scope per relationship | What can be cited where · in what context · with what wording |
| Co-marketing partner selection | 1–2 highest-leverage partners for first pilot |
| Co-branded asset templates | Insurer logo usage agreement · CCW-style brand-coherence rules |
| Content templates | Permission-tagged · brand-voice-enforce gate-checked |
| Compliance language | AU Privacy Act · APP · Spam Act 2003 · General Insurance Code |

### Remediation pattern

Pilot launches with 1–2 verified partners only. No broadcast adjuster outreach (Q3.2.2 hard rule 2 portfolio-wide).

---

## Gap 7 — Property Manager + Strata acquisition surfaces (P1)

> **Foundation reference:** Q3.2.3 P0 channel ranking + Q3.4.3 (mirror approach for RA)
> **Owner skill:** senior-copywriter + senior-strategist + cro-specialist

### Audit checklist

| Item | Action |
|------|--------|
| Existing PM/Strata-specific landing pages | Inventory per brand (DR + RA) |
| Audience-specific intake paths | DF8 friction (Q3.2.4) — generic claim form is single-audience friction |
| Strata Community Australia partnership | Outreach scope · co-marketing potential |
| REIA / REINSW / REIQ partnerships | Outreach scope · association content path |
| Software-directory listings (PropTech) | Eligible directories · listing completeness |
| Per-audience landing-page production | DR · RA — separate surfaces for PM vs Strata vs Business Owner |

### Remediation pattern

Build per-audience landing pages with audience-specific JTBD copy (Customer Insights Lead consumes Q3.2.2 + Q3.1.2 audience profiles · Senior Copywriter drafts).

---

## Gap 8 — CCW client engagement audit (P0 · independent)

> **Foundation reference:** Q3.4.4 verification gates + Phase 3.4 architectural carve-out
> **Owner skill:** marketing-operations-director + senior-strategist
> **Verification gates this Gap unblocks:** VG-70, VG-71, VG-72, VG-73, VG-74, VG-75, VG-76, VG-77, VG-78, VG-79, VG-80, VG-81, VG-82

### Audit checklist

| Item | Verification |
|------|--------------|
| **CCW current ESP (VG-70)** | Klaviyo via Shopify default OR Mailchimp · screenshot of ESP account state |
| **CCW client agreement on T4 + T9 cross-promotion (VG-71)** | Signed agreement · scope · processor/controller framing |
| **CCW Retainer Primary Success Metric (VG-72)** | CEO direct confirmation of monthly Win definition |
| **CCW current customer mix (VG-73)** | Shopify backend revenue analysis · % chemicals/consumables vs capital |
| **CCW current site traffic mix (VG-74)** | GA4 + Search Console audit · audience-traffic breakdown |
| **CCW email list segmentation (VG-75)** | ESP segmentation audit · buyer-profile tagging |
| **CCW existing technical-content depth (VG-76)** | Site audit · blog · buying guides · comparisons |
| **CCW trade-expert byline framework (VG-77)** | CEO confirmation of named-not-Phill author identity |
| **CCW cart-add + abandonment trigger event wiring (VG-78)** | Shopify webhook audit · event firing |
| **CCW source attribution + UTM tagging (VG-79)** | Hub-to-cart conversion path tagging |
| **CCW Spam Act + AU Privacy Act consent state (VG-80)** | Privacy + consent UX audit at cart-add |
| **CCW Privacy Policy update (VG-81)** | Cross-promotion to Unite-Group entities — policy revision · publication |
| **GDPR-style processor/controller documentation (VG-82)** | Written processor agreement |

### Remediation pattern

CCW commercial conversation (CEO-track) drives VG-71 · VG-72 · VG-77 · VG-81 · VG-82 verification. Technical audit (agent-track) drives VG-70 · VG-73–VG-76 · VG-78 · VG-79 · VG-80 verification.

---

## Cross-Gap operating rules

1. **Gap 3 + Gap 4 + Gap 8 are P0** — block downstream work
2. **Gap 5 gates on Gap 4** — no GBP build before profile eligibility verified
3. **Gap 6 gates on Gap 4 + IICRC clearance** — no insurer co-marketing without permission map
4. **Gap 7 is P1** — independent · proceeds in parallel with P0 Gaps
5. **Source documentation logged in verification-gates.md** for every gate flip
6. **No gate flips without source documentation** — operating rule 1 of verification-gates.md binding
7. **Foundation-keeper agent updates verification-gates.md** when source documentation reaches the registry

---

## brand-voice-enforce gate-check

Internal documentation · Phase 1.5 auto-publish.
- ✓ All Gap definitions match Q3.1.3 + Q3.2.3 + Q3.4.4 lock
- ✓ Verification gate IDs match registry
- ✓ Dependency map matches foundation sequencing rules
- ✓ Honest verification state · no declared completion

**Gate decision: PASS · live as canonical Gap audit playbooks.**
