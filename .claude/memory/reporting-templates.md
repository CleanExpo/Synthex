# Synthex Reporting Templates — v0.1 (2026-04-27)

> **Authority:** Phill McGurk, CEO. **Foundation source:** `ceo-foundation.md` (canonical) + `verification-gates.md` (gate state)
> **Consumed by:** `performance-attribution-lead` skill (renders) + `analytics-lead` skill (narrates) + `senior-strategist` skill (final-gate before CEO queue)
> **Operating rule:** every metric carries `[placeholder]` or `[verified-DD/MM/YYYY]` tag. Templates lacking verification tags REJECT.

---

## Template 1 — Hyper-Care Daily Snapshot (DR pilot · first 30 days) + RA Launch Watch (RA · first 14 days)

> Single-page · 5-minute CEO read · 07:00 AEST delivery · failure-to-generate is itself a same-day incident

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [BRAND] [HYPER-CARE | LAUNCH WATCH] — DAY [n] OF [30 | 14]                │
│  [DD/MM/YYYY] · [HH:MM AEST] · author: performance-attribution-lead         │
└─────────────────────────────────────────────────────────────────────────────┘

▸ STATUS                    🟢 GREEN   /   🟡 AMBER   /   🔴 RED
   One-line plain-English call from analytics-lead.

▸ SAME-DAY INCIDENTS        (privacy · data · operational SLA · phone/form outage)
   [count] in last 24h · [count] open · [count] resolved
   - INC-NNNN  | [type]  | [severity 1/2/3]  | [status]  | [owner]  | [next action]
   (If empty: "No incidents in the last 24h." Never omit the section.)

▸ ACTIVATION FUNNEL — last 24h vs prior 7-day average
                                                                  Δ vs 7-d avg
   D1   Emergency-intent visitors (DR)        [n]   [tag]              +/- %
   D2a  Claim form started                     [n]   [tag]              +/- %
   D2b  Phone call initiated                   [n]   [tag]              +/- %
   D3a  Qualified form submitted               [n]   [tag]              +/- %
   D3b  Qualified phone call                   [n]   [tag]              +/- %
   ───────────────────────────────────────────────────────────────────────
   TOTAL D3 (primary target)                   [n]                       +/- %
   D2 → D3 qualification rate                  [%]                       +/- pp
   After-hours D3 capture                      [n]   ([%] of total)      +/- pp
   Intake Accuracy Score                       [%]                       +/- pp
                                              [tag · cohort low at launch]

   [RA Launch Watch variant replaces D-funnel with RA A1–A3 funnel]
   A1   Trial signups today + cumulative       [n] · [n]   [tag]
   A2   First active guided evidence-capture   [n]                       +/- %
   A3   First technician/company-reviewed
        complete report exported               [n] cumulative · floor ≥1 by D7

▸ CHANNEL BREAKDOWN — D3 by source                          CPL [tag]
   Organic search                              [n]   ($[n]/D3 [tag])
   Google Maps / GBP                           [n]   ($[n]/D3 [tag])
   Paid search (pilot)                         [n]   ($[n]/D3 [tag])
   Insurer pathway                             [n]   (cost: shared/co-mkt)
   Direct                                      [n]
   Referral / association                      [n]
   Other                                       [n]
   (CPL = Cost Per Lead. NOT CAC. CAC at D5/N5 only — Q3.2.4 rule 7.)

▸ FRICTION SIGNALS — last 24h
   - Phone routing test:      [PASS / FAIL · last tested HH:MM]
   - Claim form submission:   [PASS / FAIL · last tested HH:MM]
   - GBP listing live state:  [PASS / FAIL · per profile]
   - After-hours coverage:    [PASS / FAIL · last tested HH:MM]
   - Form source attribution: [PRESENT / MISSING]
   - Call source attribution: [PRESENT / MISSING]
   - Duplicate dedupe:        [n] duplicates filtered

▸ CEO ACTION QUEUE                          (max 3 items · ranked by impact)
   1. [decision · approval · override · investigation needed]
   2. [...]
   3. [...]
   (If empty: "No CEO actions required today." Don't manufacture.)

▸ VERIFICATION STATUS                       (Q3.2.1–3.2.4 gates)
   - Service-area claims:     [verified-DD/MM/YYYY] / [verification needed]
   - Response-time claim:     [verified-DD/MM/YYYY] / [verification needed]
   - GBP profile compliance:  [verified-DD/MM/YYYY] / [verification needed]
   - Insurer permission scope:[verified-DD/MM/YYYY] / [verification needed]
   - GA4 + Search Console:    [verified-DD/MM/YYYY] / [verification needed]
   - Call/form tracking:      [verified-DD/MM/YYYY] / [verification needed]
   - IICRC trademark scope:   [verified-DD/MM/YYYY] / [verification needed]

▸ NRPG TODAY (light — full Tier 1 stays Monday weekly)
   N2 applications today      [n]  · 7-day total [n]
   Credential Decay flags     [n] contractors with cert/insurance < 30d
   Activation gap watch       [n] contractors at N3 > [agreed] days w/o N4

▸ NOTES + CONTEXT             (max 5 lines · plain English · no dashboards)
   - [signal worth flagging that the numbers don't show]
   - [seasonal · weather · regional event affecting demand]
   - [partner / insurer / IICRC update]

────────────────────────────────────────────────────────────────────────────
Version: HC-2026.04 · Generated by performance-attribution-lead · Reviewed
by senior-strategist before send · Footer: Marketing breaches → next weekly
batch · Privacy/SLA → same-day path
```

---

## Template 2 — Monday Weekly Tier 1 (combined DR + NRPG + CARSI + CCW)

> Single weekly batch · Monday 07:00 AEST · combines all 4 brand canaries + portfolio claim-throughput headline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PORTFOLIO TIER 1 WEEKLY — WEEK ENDING [DD/MM/YYYY]                         │
│  Author: performance-attribution-lead · Narrative: analytics-lead           │
└─────────────────────────────────────────────────────────────────────────────┘

▸ HEADLINE (Q2.5.5 portfolio anchor)
   Insurance-approved claims processed this week:    [n]   Δ vs 4-wk avg [+/- %]
   Status: 🟢 / 🟡 / 🔴 · One-line call from analytics-lead

▸ DR WEEKLY                                   Δ vs prior 7-day average
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CANARY: D3 events / week (D3a + D3b)        [n]                  +/- %
       D3a Qualified claim form submitted       [n]                  +/- %
       D3b Qualified phone call answered        [n]                  +/- %
       D2 → D3 qualification rate               [%]                  +/- pp
       After-hours D3 capture rate              [%]                  +/- pp
       Intake Accuracy Score                    [%]                  +/- pp

   OUTCOME: D3 → D4 dispatch + acceptance rate  [%]                  +/- pp

   WATCH: Source-of-truth job ID match rate     [%]                  (no double-count)

▸ NRPG WEEKLY
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CANARY: N2 → N3 acceptance rate              [%]                  +/- pp
       N2 applications this week                [n]                  +/- %
       N3 acceptances                           [n]                  +/- %

   OUTCOME: N3 → N4 activation rate (90d roll)  [%]                  +/- pp
       Median days N3 → N4                      [days]
       P90 days N3 → N4                         [days]

   WATCH: Credential Decay flags                [n] contractors · [n] techs

▸ CARSI WEEKLY
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CANARY: Snapshot Completion Rate             [%]                  +/- pp
       Snapshot starts                          [n]
       Snapshot completions                     [n]
       Drop-off (top 3 stages)                  [list]

   OUTCOME: New Firm-Tier Activations           [n]                  +/- %
       Snapshot → activation lag rate           [%]                  +/- pp
       (Goodhart guard: if completion ↑ + activation ↓, content compromise)

   WATCH: Pre-IICRC-verification copy compliance (VG-02 state)

▸ CCW WEEKLY
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CANARY: Hub Article-to-Cart-Add Rate         [%]                  +/- pp
       Hub article views                        [n]
       Article → product CTA click              [n]
       Product → cart-add                       [n]
       Drop-off (top 3 stages)                  [list]
       Content-quality watch:
         · Avg time-on-page (Hub articles)      [m:ss]               +/- s
         · Avg scroll-depth                     [%]                  +/- pp

   OUTCOME: New Capital-Tier Checkouts ($1,500+) [n]                 +/- %
       From Hub-attributed path                 [n]
       Hub → checkout lag rate                  [%]                  +/- pp

   WATCH: T4 Trigger Volume                     [n]
       T4 fired this week                       [n]
       T4 → NRPG application click-through      [%]
       (Test-mode state until VG-71 verifies)

▸ ANALYTICS-LEAD NARRATIVE                     (1 page max)
   [Data picture]
   [Strategic framing]
   [Divergence call: where data + framing agree vs disagree]
   [Recommended action with foundation citation]

▸ CEO ACTION QUEUE                              (max 5 items this week)
   [list]

▸ VERIFICATION STATUS DELTA THIS WEEK
   Gates flipped to [verified]: [list with dates + sources]
   Gates still [verification needed]: [count] · top 3 by impact: [list]
```

---

## Template 3 — Monthly Tier 2 (1st of month)

> Per-brand 2-page format · revenue + handoff · cross-sell attribution · trigger threshold review

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PORTFOLIO TIER 2 MONTHLY — MONTH ENDING [MM/YYYY]                          │
│  Author: performance-attribution-lead · Strategic: senior-cmo + senior-strategist │
└─────────────────────────────────────────────────────────────────────────────┘

▸ PORTFOLIO HEADLINE
   Total claim revenue (DR/NRPG): [$ · tag]   Δ vs prior month [+/- %]
   Cross-sell-attributed revenue: [$ · tag]   ([%] of total)
   Active ecosystem identities (≥2 brand touch in 90d): [n]

▸ ATTRIBUTION MODEL OUTPUT (40/40/20 position-based · Q2.5.5 B3)
   First-touch revenue per brand: [breakdown]
   Last-touch revenue per brand:  [breakdown]
   Middle-touch revenue split:    [breakdown]

▸ PER-BRAND TIER 2 SECTIONS (DR · NRPG · CARSI · RestoreAssist · CCW)

   For each brand:
   - D3/N3/A3/Snapshot/Hub canary trend (4-week roll)
   - Outcome metric trend (won-claims · paid subs · firm-tier activations · capital checkouts)
   - Trigger threshold review (per Q2.5.5 B2 thresholds)
   - Watch metrics (Credential Decay · Activation Gap · etc.)
   - [placeholder] → [verified] flips logged this month
   - Source-of-truth job ID match rate (DR + NRPG)

▸ TRIGGER THRESHOLD REVIEW (per Q2.5.5 B2)
   T3 (90d roll):   [%]   pass ≥12% · kill <2%   Status: PASS / WATCH / KILL
   T5 (90d roll):   [%]   pass ≥25% · kill <10%  Status: ...
   T7 (90d roll):   [%]   pass ≥30% · kill <5%   Status: ...
   T4 (90d roll):   [%]   pass ≥20% · kill <5%   Status: ...
   T8 (90d roll):   [%]   pass ≥8%  · kill <2%   Status: ...
   T10 (90d roll):  [%]   pass ≥18% · kill <3%   Status: ...
   (Breaches surface for CEO override · do NOT auto-kill)

▸ CCW RETAINER REPORTING (separate per Phase 3.4 carve-out)
   Hub article cadence: [n] published this month (target per VG-72)
   Hub Article-to-Cart-Add canary trend
   Capital-tier checkout volume (Hub-attributed vs direct)
   T4 / T9 state (test mode if VG-71 not verified)

▸ ANALYTICS-LEAD NARRATIVE (2-page strategic interpretation)

▸ CEO STRATEGIC DECISIONS REQUIRED (max 3 items)
```

---

## Template 4 — Quarterly Tier 3 (with portfolio scoreboard)

> Ecosystem + AI-search + founder-content reach + verification-gate state migration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PORTFOLIO TIER 3 QUARTERLY — Q[n] [YYYY]                                   │
│  Author: performance-attribution-lead + analytics-lead · Strategic: senior-cmo │
└─────────────────────────────────────────────────────────────────────────────┘

▸ PORTFOLIO SCOREBOARD REFRESH

▸ ECOSYSTEM TOUCH METRICS
   % CARSI subscribers also using RestoreAssist
   % NRPG members also subscribing to CARSI
   % CCW Restoration Specialist customers also in NRPG
   % DR claimants who become repeat-touch ecosystem identities

▸ AI-SEARCH VISIBILITY AUDIT (DIRECTIONAL · NOT KPI per Q3.2.3 Amendment 2)
   Priority emergency-intent queries — DR visibility snapshot
   Capital-equipment research queries — CCW visibility snapshot
   IICRC standards content queries — CARSI/RA visibility snapshot
   Branded search growth (per brand)
   GSC impressions delta vs prior quarter
   Local pack / Maps presence (DR per eligible profile)
   AI-search citations directional snapshot

▸ FOUNDER-CONTENT REACH (Phill LinkedIn + podcast + YouTube)
   LinkedIn long-form posts published this quarter: [n]
   Reach + engagement
   Save rate / Share rate (movement-canary signals)
   Brand-tagging distribution (NRPG-primary vs CARSI-primary vs RA-primary)
   Podcast guest appearances
   YouTube companion-page views

▸ VERIFICATION-GATE STATE MIGRATION
   Gates flipped to [verified] this quarter: [list]
   Gates still [verification needed] · top 5 by downstream impact
   New gates added this quarter

▸ VOICE-TAG DRIFT CHECK (Brand Strategist audit)
   Per-brand voice register adherence rate
   Phase 4 amendment compliance
   brand-voice-enforce reject rate (lower = better adherence)

▸ FLYWHEEL HEALTH (Q2.5.1 anchor)
   Primary flywheel (DR/NRPG claim throughput) trajectory
   Secondary flywheel (RestoreAssist seats) trajectory
   Feeder brand contribution (CARSI · CCW)

▸ CEO STRATEGIC NARRATIVE (senior-cmo)
```

---

## Template 5 — Same-Day Incident Escalation

> Privacy / data / claim / SLA / customer-trust incidents · bypasses weekly batch · Severity 1 = immediate CEO escalation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SAME-DAY INCIDENT — INC-[YYYY-MM-DD-NNN]                                   │
│  Severity: [1 | 2 | 3]                                                       │
│  Detected: [HH:MM AEST] · Reported: [HH:MM AEST]                             │
└─────────────────────────────────────────────────────────────────────────────┘

▸ CLASSIFICATION
   Severity: [1 immediate CEO · 2 same-day ops + summary · 3 next weekly batch]
   Type: [privacy-breach | security | data-loss | operational-SLA | customer-trust]
   Brand affected: [restoreassist | dr | nrpg | carsi | ccw | portfolio]

▸ SUMMARY (one paragraph · plain English)
   What happened. What's exposed. Who is affected.

▸ CONTAINMENT
   Status: [in-progress · contained · resolved]
   Owner: [name + role]
   Containment actions taken:
   - [list]

▸ ASSESSMENT
   Severity 1 — NDB process triggered [yes/no]
   Severity 1 — Privacy Act 1988 + APP impact assessment
   Severity 2/3 — Internal impact assessment

▸ CUSTOMER COMMUNICATION
   Required: [yes/no]
   Plan: [draft for CEO approval if Severity 1]
   Sent: [timestamp + channel + audience scope]

▸ REGULATOR NOTIFICATION (where applicable)
   NDB process: [triggered / not applicable / under assessment]
   OAIC notification: [scheduled / sent / not applicable]
   Timeline: [per Privacy Act 1988 timeframes]

▸ POST-INCIDENT REVIEW
   Scheduled: [date]
   Owner: [name]
   Foundation rule(s) implicated: [list with foundation file references]
   Recommended foundation amendment (if any): [draft]
   brand-voice-enforce rule update (if any): [draft]

▸ CEO ESCALATION (Severity 1 only)
   Notified at: [HH:MM AEST · same-day mandatory]
   Channel: [email · phone · in-person]
   Decision required: [yes/no + decision needed]
```

---

## Operating rules (cross-template)

1. **Every metric carries `[placeholder]` or `[verified-DD/MM/YYYY]` tag.** Untagged metrics REJECT.
2. **Honest empty states.** Sections with no data state "no incidents" / "no actions" / etc. — never omit.
3. **Source-of-truth job ID enforced.** No D4/N4 double-counting in any template.
4. **Cross-funnel separation.** DR + NRPG never aggregated. CCW isolated from Nexus.
5. **AI-search visibility = directional, not hard KPI.** Q3.2.3 Amendment 2 binding.
6. **Same-day incidents bypass batch.** Q3.2.5 hard rule 5 binding.
7. **CEO action queue capped.** Daily ≤ 3 items · weekly ≤ 5 · monthly ≤ 3 strategic decisions.
8. **Foundation citations explicit.** Every recommendation references the rule.

---

## brand-voice-enforce gate-check

This file is internal documentation per Phase 1.5 (auto-publish internal context).
- ✓ U-1 (filler) PASS · ✓ U-2 (first-person) PASS · ✓ U-3 (verification tagging) PASS · ✓ U-4 (no hallucination) PASS
- ✓ All metric IDs match foundation file Q3.1.5 + Q3.2.5 + Q3.3.5 + Q3.4.5 lock
- ✓ All trigger threshold values match Q2.5.5 B2
- ✓ Honest empty-state discipline maintained throughout

**Gate decision: PASS · forward to live use as canonical reporting templates · consumed by performance-attribution-lead + analytics-lead.**
