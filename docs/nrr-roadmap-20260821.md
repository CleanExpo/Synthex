# Synthex: 30-Day NRR Improvement Roadmap

**Version:** 1.0
**Date:** 21/08/2026
**Analyst:** empire-mac
**Task:** t_6d04fa79 – NRR roadmap
**Current NRR:** 100% (no churn events observed)
**Target NRR:** 120% (no churn events)
**Short-term horizon:** 30 days
**Founders:** Awaiting founder acknowledgment

---

## TL;DR

Synthex currently has 0 observed churn events. This is encouraging but risky: churn signals currently land in Unite-Group event streams rather than Synthex dashboards, obscuring early-warning visibility. The proposed roadmap focuses on three high-impact, low-risk experiments over the next 30 days:

1. **Free-tier onboarding optimization** (multi-step wizard + progressive value visualization).
2. **Usage-based pricing tier for enterprise** (Pro+ at per-usage pricing with caps).
3. **Dynamic retention offers** (dunning grace + cancellation protection).

These experiments are designed to harden churn resilience at the top, middle, and bottom of the funnel, respectively. All experiments will be logged in Linear (project: Synthex) before rollout and monitored for NRR impact.

---

## Experiment 1: Free-Tier Onboarding Optimization (P1)

### Goal

Increase activation-to-upgrade conversion at the free tier by guiding users through a structured, multi-step journey that surfaces Pro/Enterprise value before they churn or plateau.

### Theory

- Free users currently encounter a flat setup wizard (connect social → generate initial posts) and then are left with limited value guidance. They may feel “done” before they’ve seen advanced features (personas, analytics, SEO).
- Progressive disclosure of value reduces cognitive load, increases perceived feature breadth, and pushes users toward a natural upgrade trigger.

### Hypothesis

> Multi-step free-tier onboarding with explicit “Next Value Milestone” cards increases upgrade conversion by 15–20% in the first 14 days post-signup.

### Implementation Plan

| Week   | Milestone              | Action                                                                                                                                                                         |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **W1** | Design onboarding flow | Define 4 steps: (1) Social connection verification, (2) AI post benchmarking (3) Persona setup, (4) SEO audit/keyword planning preview. Add “value milestone” badges per step. |
| **W1** | Prototype UI           | Extend onboarding wizard into a React stepper component with summaries per step. Use existing WinAnchoredConversionCard as follow-up after step 4.                             |
| **W2** | Build MVP              | Implement onboarding stepper, integration with existing `getOrCreateSubscription` logic, and upgrade prompt injection.                                                         |
| **W2** | Internal testing       | Run A/B test: 50% control (current flat wizard), 50% new stepper. Measure completion rate, time-to-activation, and upgrade rate.                                               |
| **W3** | Founder signoff        | Present test results and recommended rollout plan.                                                                                                                             |
| **W4** | Full rollout           | Push to production; monitor upgrade and churn metrics for 7 days.                                                                                                              |

**Metrics to collect:**

- Completion rate per step (drop-off points).
- Time from signup to activation milestone.
- Upgrade rate from free to Starter/Introductory/Pro within 14 days.
- Net NRR impact (churn events) vs control group.

**Risks & mitigations:**

- **Risk:** Onboarding complexity may frustrate power users. **Mitigation:** Add “Skip” option and allow backtracking to previous steps.
- **Risk:** Increase in “free tier upgrade for low-value users.” **Mitigation:** Track unit economics and segment upgrade value (AI posts/period, social accounts). If ARPU drops below threshold, invert hypothesis (optimize for stickiness rather than conversion).

### Success criteria

- 15%+ increase in free-to-paid upgrade rate within 14 days.
- Step drop-off after step 2 is <10% (vs 30% baseline).
- Net NRR unchanged or improved (no increase in churn events).

---

## Experiment 2: Usage-Based Enterprise Tier (P2)

### Goal

Offer a usage-based pricing tier between Pro and Enterprise (Pro+), giving heavy but non-Enterprise users a “pay-per-use” path with soft caps that reduce overage pressure and price sensitivity.

### Theory

- Enterprise is a “max flex” tier with no caps beyond unlimited. Many high-volume users don’t need multi-business locations, API access, or white-label; they only hit AI post and social account limits.
- A usage-based tier reduces the “jump” from Pro to Enterprise, allowing a smoother price transition and higher conversion at the usage threshold.

### Hypothesis

> Introducing Pro+ (usage-based with soft caps at $500/mo) increases conversion from Pro to Pro+ by 20–30% and reduces churn among high-volume users by 10–15%.

### Implementation Plan

| Week   | Milestone                      | Action                                                                                                                                                                    |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **W1** | Design Pro+ pricing structure  | Define pricing rules: Base $149 + $1 per 1000 AI posts, $1 per 100 social accounts (capped). Monthly soft cap: $500; dynamic adjustments at renewal. Add to pricing page. |
| **W1** | Validate pricing with founders | Review price points against current LTV and churn; ensure Pro+ sits below Enterprise without cannibalizing it.                                                            |
| **W2** | Build checkout integration     | Extend `/api/stripe/checkout` to support Pro+ price ID; update `pricing-grid.tsx` to show Pro+ card.                                                                      |
| **W2** | Internal testing               | Run trial for 7 days (no public rollout) with internal accounts to validate booking and value calculations.                                                               |
| **W3** | Founder signoff                | Present pricing validation and booking logic.                                                                                                                             |
| **W4** | Full rollout                   | Activate Pro+ as public option; monitor adoption, LTV, churn.                                                                                                             |

**Key product changes:**

- Add `growth-plus` price ID in `lib/stripe/config.ts`.
- Update `WinAnchoredConversionCard` to promote Pro+ for heavy users.
- Add usage meter (e.g., “You’ve generated 250 AI posts this month; Pro+ would be $174 at current usage”). Integrate with `/api/user/usage`.

**Metrics to collect:**

- Pro-to-Pro+ conversion rate.
- Pro+ ARPU vs Pro.
- Churn rate among users previously near Pro limit but below Enterprise TLV.
- Net NRR impact.

**Risks & mitigations:**

- **Risk:** Complexity in calculating and displaying real-time usage price. **Mitigation:** Use monthly snapshot for display; calculate invoice at renewal to avoid day-level arbitrage.
- **Risk:** Pro+ undercuts Enterprise too aggressively. **Mitigation:** Add “Limit your Enterprise upgrade” footer text; maintain clear feature-differentiation.

### Success criteria

- 20%+ conversion rate from Pro to Pro+ within 30 days.
- Pro+ ARPU is between Pro and Enterprise (P50 range).
- No increase in overall churn rate; reduction in Pro churn near limits.

---

## Experiment 3: Dynamic Retention Offers (P2)

### Goal

Reduce involuntary churn by offering proactive win-back messages before payment failure escalates to `unpaid`, and reduce voluntary churn by giving cancellation attempts a grace period to reconsider value.

### Theory

- **Dunning grace:** Users facing payment failure may not notice the email or may delay response. Early win-back messages (48 hours before state becomes `unpaid`) can recover access before irreversible loss.
- **Cancellation protection:** Users who initiate cancellation may do so impulsively or based on incomplete understanding of value. Adding a 24–48h “Are you sure?” delay, optionally with a value reset (e.g., “Unlock advanced analytics” for free tier users), can reduce pull-through.

### Hypothesis

> Proactive dunning grace + cancellation protection reduces churn from involuntary (payment failure) by 20–25% and voluntary cancellations by 10–15% over 30 days.

### Implementation Plan

| Week   | Milestone                  | Action                                                                                                                                                                                                                           |
| ------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **W1** | Define grace period policy | Dunning grace: send email 48h before state becomes `unpaid`; allow update payment within 7 days after `unpaid`. Cancellation protection: defer webhook cancellation by 24h after user clicks cancel; send “are you sure?” email. |
| **W1** | Design email templates     | Draft win-back emails (dunning + cancellation) with clear CTA (update payment, resume service).                                                                                                                                  |
| **W2** | Build email scheduler      | Create `lib/email/dunning-grace-email.ts` and `lib/email/cancellation-protection-email.ts`; integrate with webhook scheduler (cron job).                                                                                         |
| **W2** | Internal testing           | Test dunning grace loop (mock dunning state transitions) and cancellation protection UI (click cancel → show popup → 24h delay).                                                                                                 |
| **W3** | Founder signoff            | Review templates and protection UX.                                                                                                                                                                                              |
| **W4** | Full rollout               | Activate both retention offers; monitor conversion rates and churn.                                                                                                                                                              |

**Key product changes:**

- Add `dunning_state.expires_at` column to `DunningState` (expires 7 days after `unpaid`).
- Add `cancellation_requested_at` to `Subscription` table; include 24h cooldown before actual downgrade.
- Send `dunning_grace_email` when `state='past_due'` AND `lastFailureAt + 48h < now`.
- Send `cancellation_confirmation_email` when `cancelAtPeriodEnd = true` AND `cancelledAt + 24h < now`.

**Metrics to collect:**

- Recovery rate from `past_due` → `recovered` via grace emails.
- Recovery rate from `cancelled` → `active` via protection emails.
- Churn rate for involuntary vs voluntary segments with retention offers vs baseline.
- Net NRR impact.

**Risks & mitigations:**

- **Risk:** Over-communication may feel spammy. **Mitigation:** Limit to one grace email and one cancellation email per event; offer unsubscribes.
- **Risk:** Cancellation delay confuses users about exact end date. **Mitigation:** Display clear countdown (“Your subscription will end on DD/MM/YYYY after 24h”) in dashboard.

### Success criteria

- 20%+ reduction in involuntary churn rate within 30 days.
- 10%+ reduction in voluntary churn rate within 30 days.
- No increase in negative sentiment in feedback channels.

---

## Coordination & Governance

### Task Assignment

- **Free-tier onboarding:** Assigned to product/design team (UX + engineering).
- **Pro+ usage-based tier:** Assigned to pricing strategy team + Stripe checkout engineering.
- **Retention offers:** Assigned to customer success and webhooks team (email + UI).

### Success Measurement

- All experiments will log metrics to a shared Notion board (Synthex NRR experiments).
- Each experiment will have a Linear ticket (prefix: `NRR-EXPT-XXX`).
- Results will be reviewed weekly by founders to decide scale or iteration.

### Risk Governance

- **Do NOT change pricing live** without founder/CTO signoff. Pro+ is a new offering, not a price increase; still requires signoff.
- **Do NOT expose PII or payment details** in customer-facing emails.
- **Do NOT modify Stripe price IDs or webhook logic** in production without a UAT pass.

---

## Timeline Summary

| Week   | Experiment                                    | Deliverable                              |
| ------ | --------------------------------------------- | ---------------------------------------- |
| **W1** | Free-tier onboarding + Pro+ pricing design    | Wireframes + pricing mockups             |
| **W2** | Pro+ build + retention offers email templates | Code + email templates                   |
| **W3** | Founder review + retention offers UI          | Signoff + design finalization            |
| **W4** | Full rollout                                  | Production deployment + metrics tracking |

---

## Founder Review Checklist

- [ ] Confirm Pro+ pricing structure aligns with current LTV and churn profile.
- [ ] Approve onboarding stepper UX (step count, content, upgrade prompts).
- [ ] Approve retention offer policies (grace periods, cancellation delay).
- [ ] Confirm NRR target (100% → 120%) is realistic for 30 days (baseline: 0 churn events).
- [ ] Record timestamp of signoff (for task closure).

---

**Next actions:**

1. Obtain founder signoff on this roadmap.
2. Create Linear tickets `NRR-EXPT-001` through `NRR-EXPT-003`.
3. Enqueue `churn-mix-live.json` collection once Stripe key is unlocked to ground experiments in real churn mix.
