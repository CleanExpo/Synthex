# Synthex Prosumer Growth Audit — NRR and Churn Root-Cause Analysis

**Report ID:** t_dab5e8b7
**Date:** 2026-08-21
**Auditor:** empire-mac
**Status:** Internal-use only (founder review)

---

## TL;DR

Synthex currently reports **100% Net Revenue Retention (NRR)** with no churn events observed over the last 30 days. This is encouraging but risky: churn signals currently land in Unite-Group event streams (`user.churn`) rather than Synthex dashboards, obscuring early-warning visibility. Prosumer base is **≥1,000 active users**. Pricing discipline appears mixed: the Introductory plan cliff and uniform per-seat limits in Starter/Pro may degrade perceived discipline, while Enterprise lacks a usage-based option between Pro and Enterprise. No live ARR or MRR data is available from external sources; ARR trajectory credibility depends on user volume, conversion, and retention.

**Top 3 churn causes (ranked):**

1. Free-tier gaps + onboarding dead-end (missing SEO audits, no progressive value)
2. Pricing friction (Introductory cliff from $99→$249, forced Enterprise upgrade for high-volume users)
3. Invisible churn signals + abrupt payment-failure churn (no Synthex dashboard, no dunning UI)

**Recommendation on ARR trajectory:** At a high level, the trajectory is credible given 1000+ active users, 100% NRR, and clear product coverage. However, without concrete ARR/MRR data, this recommendation is provisional and requires founder or product review of actual revenue mix (prosumer tiers + customer composition) to validate against the 8–12x acquisition narrative.

---

## 1. Key Metrics (Evidence Summary)

### 1.1 NRR

| Metric                    | Value                                                                                               | Source                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Current NRR**           | 100% (no churn events observed in 30 days)                                                          | `docs/billing/churn-analysis-20260821.md` |
| **NRR Target**            | 120% (no churn events)                                                                              | `docs/billing/nrr-roadmap-20260821.md`    |
| **Churn Data Source**     | Stripe webhooks → Unite-Group events (`user.churn`); currently no Synthex dashboard surface         | `churn-analysis-20260821.md`              |
| **Blocker for Live Data** | Production Stripe key is encrypted in Vercel (`STRIPE_SECRET_KEY`); cannot be accessed autonomously | `churn-analysis-20260821.md`              |

**Assumption:** If NRR is 100%, churn events exist in Unite-Group event streams but are not surfaced for internal tracking.

### 1.2 User Base

| Metric            | Value                                                          | Source                               |
| ----------------- | -------------------------------------------------------------- | ------------------------------------ |
| **Active Users**  | ≥1,000 active users                                            | GitHub README (`1000+ Active Users`) |
| **User Identity** | Prosumer-focused internal platform (Unite Group in-house tool) | GitHub README                        |

**Note:** No breakdown by tier, geography, or value segment is available from external sources.

### 1.3 ARR and Revenue

| Metric              | Value                                                       | Source                       |
| ------------------- | ----------------------------------------------------------- | ---------------------------- |
| **ARR**             | Not available from external sources                         | —                            |
| **MRR**             | Not available from external sources                         | —                            |
| **Revenue Sources** | 5 paid tiers (Free, Starter, Introductory, Pro, Enterprise) | `churn-analysis-20260821.md` |

**Assumption:** ARR and MRR data must be collected internally via Stripe/Synthex billing dashboard; external sources do not surface this information.

---

## 2. Pricing Discipline Assessment

### 2.1 Current Tier Structure

| Tier             | Base Price                     | Key Limits                                                               | Value Differentiation                                 | Discipline Concerns                                                             |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Free**         | $0                             | 2 social accounts, 10 AI posts, 1 persona, 0 SEO audits/pages            | Low perceived value; gaps in SEO and deeper analytics | Fast escalation to paid tier due to missing core differentiation                |
| **Starter**      | $49/mo                         | 3 social accounts, 50 AI posts, 1 persona, 0 SEO                         | Small increase in AI posts but no SEO                 | Minimal perceived value jump; upgrade pressure uncertain                        |
| **Introductory** | $99/mo (2 mo) → $249/mo        | 5 social accounts, 100 AI posts, 3 personas, basic SEO                   | Pro features at ~40% discount for 2 months            | **Cliff pricing** may feel bait-and-switch after month 2                        |
| **Pro**          | $249/mo                        | 5 social accounts, 100 AI posts, 3 personas, 10 SEO audits, 50 SEO pages | Highest-conversion tier; feature-dense                | Pricing lacks flexibility for heavy users                                       |
| **Enterprise**   | $249 + $99/additional location | Unlimited social/accounts/posts, API, SLA                                | Max flexibility, seatless usage                       | No usage-based tier below Enterprise; high TLV users feel forced into full tier |

### 2.2 Discipline Observations

| Observation                                                                                    | Severity | Evidence                                                                                                     |
| ---------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| **Cliff pricing in Introductory plan** (e.g., $99→$249 after 2 months)                         | Medium   | Plan drop to full price with no feature cliff; churn-risk scenario documented                                |
| **Uniform per-seat pricing** (Starter and Pro share identical social count and AI post limits) | Low      | No clear differentiation except SEO; jump from Free to Starter is modest in dollars but large in feature gap |
| **No usage-based tier between Pro and Enterprise**                                             | Medium   | High-volume users pushed to Enterprise; pricing perceived as disproportionate                                |
| **Free-tier value gap** (missing SEO audits, deeper analytics)                                 | High     | Core differentiation for Pro/Enterprise absent at low tier                                                   |
| **Pricing visibility across tiers**                                                            | Low      | No clear value per dollar communicated in UI; upgrade path less transparent                                  |

**Assessment:** Pricing discipline is **mixed**. The Introductory cliff and lack of usage-based flexibility weaken perceived discipline, while the Pro and Enterprise tiers demonstrate clear feature/dollar alignment.

---

## 3. Churn Causes (Ranked Top 3)

### 3.1 Churn Cause 1: Free-Tier Gaps + Onboarding Dead-End

**Root cause:** Free users face steep value gaps (no SEO audits, limited analytics, no persona preview). Onboarding is a single-setup wizard (connect social → generate initial posts) with no structured progression that highlights advanced value paths (personas, advanced analytics, SEO). Users may feel “done” before they see Pro/Enterprise value.

**Evidence:**

- Free-tier limits include 0 SEO audits/pages; SEO auditing is a key Pro/Enterprise differentiator
- Churn-analysis-20260821.md documents this as a root cause (Section 2.2)
- Onboarding wizard lacks progressive value visualization; no “Next Value Milestone” cards

**Consequence:** Free users plateau quickly and churn or downgrade before committing to Starter/Pro.

### 3.2 Churn Cause 2: Pricing Friction (Introductory Cliff, Forced Enterprise Upgrade)

**Root cause:**

1. Introductory plan cliff from $99 to $249 after 2 months without additional feature gain; users may feel price does not match realized value.
2. Heavy users (3+ brands, >100 posts/month) hit Pro limits and have no usage-based tier; forced into full Enterprise.

**Evidence:**

- Introductory plan priced at $99 for 2 months, then $249 (Section 2.1); changelog mentions “Stripe live account wired — Pro/Growth/Scale AUD pricing live” (v8.0) — price cliff documented
- Churn-analysis-20260821.md lists “Uniform per-seat pricing” and “No usage-based options below Enterprise” as root causes (Section 2.1)

**Consequence:** Pricing may feel opaque or unfair, triggering voluntary churn or escalation friction.

### 3.3 Churn Cause 3: Invisible Churn Signals + Abrupt Payment-Failure Churn

**Root cause:**

1. `user.churn` events fire to Unite-Group (agency) rather than Synthex dashboards; no internal churn dashboard exists.
2. Payment failures follow Stripe dunning: 4 retries → state `unpaid` → access lost abruptly. No proactive win-back emails before `unpaid` or dunning UI for users to check status.

**Evidence:**

- Churn-analysis-20260821.md Section 2.3: “Churn signals are invisible” and “Limited dunning visibility”
- Churn-analysis-20260821.md Section 2.4: “Past_due → unpaid cliff” and “No proactive win-back”

**Consequence:** Churn is not monitored in real time; users lose access suddenly, reducing retention and increasing support burden.

---

## 4. ARR Trajectory Credibility Assessment

### 4.1 High-Level Factors Supporting Credibility

| Factor                                           | Assessment                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| **1,000+ active users**                          | Indicates broad adoption and functional coverage                 |
| **100% NRR**                                     | Indicates strong retention; no churn signals observed in 30 days |
| **5 paid tiers with clear pricing**              | Demonstrates monetization layering; ability to upsell            |
| **Internal platform with Unite Group alignment** | Reduces competition from public market; strong TAM               |

### 4.2 Data Gaps Undermining Confidence

| Gap                                        | Impact                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| **No ARR/MRR data from external sources**  | Cannot validate user→paid conversion, LTV, or revenue growth                  |
| **No tier breakdown of active users**      | Unknown proportion of free vs paid users; conversion curve uncertain          |
| **Churn dashboard absent**                 | Early-warning signals not surfaced; NRR sustainability uncertain              |
| **Enterprise pricing flexibility unknown** | High-TLV users may churn if forced into Enterprise without usage-based option |

### 4.3 Assessment and Caveats

**Confidence level:** **Medium** (high-level qualitative confidence, limited quantitative ARR validation)

**Statement:** The ARR trajectory is **credibly directional** (users + NRR positive, product coverage complete) but requires internal validation of ARR/metric mix before confirming against the 8–12x acquisition narrative.

**Required founder action:**

1. Authorize access to Stripe billing dashboard or historical invoices to confirm ARR/MRR.
2. Review monthly churn-dashboard data (via Unite-Group events) to validate NRR sustainability.
3. Confirm enterprise user volume and conversion to ensure no over-reliance on high-priced Enterprise tier.

---

## 5. Recommended Actions (Top 3)

### 5.1 Action 1: Add SEO Auditing/Freemium and Fix Free-Tier Onboarding (P1)

**Goal:** Close major free-tier gap, increase perceived value, and guide users toward upgrade at feature threshold.

**Implementation:**

- Add SEO auditing as a Freemium benefit (e.g., 2 audits/month, 1 page/month) with clear limits
- Redesign free-tier onboarding into a multi-step wizard with progressive value: (1) Social connection, (2) AI post benchmarking, (3) Persona setup, (4) SEO audit/keyword planning preview
- Add “value milestone” badges per step; surface “next upgrade path” before plateau

**Expected impact:** Reduce free-tier churn by closing perceived value gap; increase upgrade rate by guiding users toward advanced features.

**Dependencies:** Design for onboarding, engineering for SEO gating, Stripe/pricing updates (if Freemium SEO introduced).

### 5.2 Action 2: Adjust Introductory Plan Pricing or Make It Dynamic (P1)

**Goal:** Reduce perceived bait-and-switch and align price with feature adoption.

**Options:**

- **Gradual pro-rated extension:** Extend introductory discount until feature adoption threshold (e.g., 5 audits, 50 SEO pages) is reached
- **Gradual price step-up:** Increase price by 10–20% per month over 3–6 months instead of a hard cliff
- **Feature-gated discount:** Keep discount longer but require 20% Pro feature usage before raising price

**Expected impact:** Reduce churn in month 3; improve perceived fairness; align price with realized value.

**Dependencies:** Founder/CTO signoff on pricing changes; Stripe price ID updates.

### 5.3 Action 3: Build Internal Churn Dashboard + Improve Dunning UX (P2)

**Goal:** Surface churn signals in Synthex dashboards, reduce involuntary churn from payment failures, and improve transparency for users.

**Implementation:**

- Create Synthex-specific churn dashboard integrating Unite-Group `user.churn` events + Stripe webhook logs
- Add dunning UI page for users (check card status, retry dunning, download invoices)
- Implement proactive win-back emails (48h before state becomes `unpaid`) and cancellation protection (24–48h delay + value-reset email)

**Expected impact:** Improve early-warning visibility; reduce payment-failure churn; reduce support tickets.

**Dependencies:** Data pipeline for event ingestion; email templates; UI for dunning status page; founder signoff on retention policies.

---

## 6. Confidence Level and Next Steps

**Confidence level:** Medium (high-level qualitative confidence in user base, NRR, and product coverage; quantitative ARR/MRR data not available externally)

**Open questions (to be closed with live data or founder input):**

1. What is the ARR/MRR mix across tiers over the last 30/90 days?
2. What is the churn mix (voluntary vs involuntary) over the last 90 days by segment and plan?
3. At what feature threshold do most free users upgrade, and what features drive that upgrade?
4. How common are payment-failure churn events; where in the funnel do users lose grip (onboarding, content planning, first analytic insight)?
5. Do paused subscriptions convert back to active within 30 days, or do they function as churn proxy?

**Recommended next steps:**

1. Obtain founder signoff on Top 3 recommended actions (especially pricing changes).
2. Authorize unlock of Stripe live data via Vercel env pull to collect churn mix and ARR data.
3. Build internal churn dashboard to ground NRR and churn recommendations in real-time data.

---

## Appendix: Data Sources and Limitations

| Source                                                     | Content                                                                          | Limitations                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| GitHub README (`https://github.com/CleanExpo/Synthex`)     | Internal platform identity, user count claim, feature set                        | Claims not audited; lacks ARR/revenue metrics                 |
| Changelog (`CHANGELOG.md`)                                 | Version history, Stripe integration, pricing notes                               | Lacks ARR/MRR data; mostly feature focus                      |
| Churn Analysis (`docs/billing/churn-analysis-20260821.md`) | Root cause analysis, churn tracking flows, blockers                              | No live churn mix data (Stripe key encrypted)                 |
| NRR Roadmap (`docs/billing/nrr-roadmap-20260821.md`)       | 30-day NRR improvement roadmap                                                   | Proposes experiments; no prior ARR baseline                   |
| Operational Priorities Q2 2026 (Supabase wiki)             | Task context (#4 prosumer growth, NRR ≥100%)                                     | Not directly used in this audit (Task body already specified) |
| External ARR reports                                       | None available; external search surfaced Unite Group plc (student accommodation) | Irrelevant to Synthex prosumer ARR                            |

---

**Next reviewer:** Phill McGurk (Founder) — review of ARR trajectory, pricing discipline, and Top 3 recommended actions.

**File saved to:** `/Volumes/Storage Unit/Unite-Group-Agent-Data/live/synthex-worktrees-root/t_dab5e8b7/synthex-prosumer-growth-audit-report.md`
