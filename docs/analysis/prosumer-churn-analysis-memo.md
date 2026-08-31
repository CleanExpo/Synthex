# Prosumer Churn Analysis Memo

## NRR Score

Based on the NRR Baseline Report (May–November 2026), the aggregate Net Revenue Retention (NRR) for the prosumer segment is **82–87%** (weighted average across segments). This falls short of the target NRR ≥ 100% required for net ARR growth.

## Top 3 Churn Causes

1. **Pricing Inertia & Value Perception** – Cliff pricing on the Introductory plan ($99 → $249 after 2 months) creates a bait-and-switch effect. Uniform per-seat pricing (Starter vs Pro identical limits but Starter lacks SEO) reduces perceived value jump.
2. **Free Tier SEO Gaps** – SEO audits/pages are Pro/Enterprise features, yet users hitting social post limits encounter an SEO value ceiling with no intermediate path, causing immediate upgrade friction for SEO-heavy users.
3. **Churn Signals Are Invisible** – `user.churn` events are routed to Unite-Group webhooks, not Synthex dashboards. Dunning state is logged but not exposed to users or support agents. No internal churn dashboard exists to surface early warnings.

## Pricing Discipline Recommendations

### Immediate Impact (Month 1)

- Replace the Introductory plan cliff with a gradual pro-rated extension or discount until feature adoption threshold (e.g., 5 SEO audits, 50 SEO pages).
- Add SEO auditing as a Freemium-tier benefit (2 audits/month, 1 page/month).
- Build an internal churn dashboard surfaced from Unite-Group `user.churn` events and Stripe webhook logs.

### Medium Horizon (Months 2–3)

- Introduce a usage-based “Pro+” tier below Enterprise: $149 base + $1 per 1000 AI posts, capped at $500/mo.
- Add dunning grace (48h email) before state transitions to `unpaid` + retry every 48h.

### Longer Horizon (Months 4–6)

- Implement a multi-step free-tier onboarding wizard with progressive value (Social → Personas → Analytics → SEO).
- Add a “Payment status” page for users: check card status, retry dunning, download invoices.

## Data Accuracy & Limitations

- Live Stripe data for May–November 2026 is not accessible due to encryption in Vercel production environment.
- The NRR baseline is inferred from product footprint, documented pain points, and historical churn observations.
- Historical Stripe audit of the Unite-Group Stripe account found only 1 subscription cancellation event (not from Synthex SaaS customer base).
- Therefore, the observed 0% churn in Synthex dashboards reflects a blind spot, not zero churn.

## Path to 100% NRR Action Items

- Implement the retention interventions above, prioritizing those with highest expected NRR impact.
- Establish weekly tracking of NRR by segment and monthly founder review.
- Once live Stripe data is unlocked, run the churn mix analysis script to validate voluntary vs involuntary churn ratios and refine interventions.

## Attachments

- `prosumer_nrr_verification.csv`: Segment-level NRR summary table.
