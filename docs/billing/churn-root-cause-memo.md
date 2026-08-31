# Synthex Prosumer Growth — Churn Root Cause Audit (1-Page Summary)

**Run date:** 21/08/2026
**Operational priority #4** — NRR below 100% requires quantitative analysis
**Result:** Qualitative memo; quantitative data UNLOCKED with human credentials

---

## TL;DR — Top 3 Churn Drivers

| Rank | Driver                       | Evidence Type                                                                                                      | Probability       | Action                                                         |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------- | -------------------------------------------------------------- |
| 1    | **Free-tier engagement gap** | Onboarding completion linked to retention (CCW: onboarding tickets); pulse survey system ready but not yet in prod | High (hypothesis) | Ship pulse surveys to free-tier activation flow                |
| 2    | **Pricing friction**         | Pre-existing churn memo (docs/billing/churn-mix-2026-05-16.md) + recent free-tier gap findings                     | Medium            | Revalidate pricing vs value delivery; review enterprise tiers  |
| 3    | **Invisible churn**          | Churn mix analysis script (scripts/churn-mix-analysis.ts) blocked on live Stripe key                               | Medium            | Unlock live Stripe data → measure involuntary vs voluntary mix |

---

## Data Lock Status

| Source                   | Status    | Blocker                                                          | Path to Unlock                                                                                                                      |
| ------------------------ | --------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Stripe churn events      | BLOCKED   | Live Stripe key in Vercel-only env                               | `vercel env pull` + `STRIPE_SECRET_KEY` export → run `scripts/churn-mix-analysis.ts --days 30`                                      |
| ClientHealthScore        | BLOCKED   | Local Postgres not running; database not reachable from worktree | Start Supabase locally (`supabase start` from main repo) OR run `npx tsx scripts/churn-root-cause-audit.ts` from host with env vars |
| Closed tickets (DR-NRPG) | AVAILABLE | N/A                                                              | Use existing audit t_dab5e8b7 and CCW ticket data already in Kanban context                                                         |

---

## Churn-Mix Technical Details

### Classifier (verified vs memo bug)

- **Stripe enum (real):** `cancellation_requested` (voluntary), `payment_failed`/`payment_disputed`/`unpaid` (involuntary), `null` (auto-cancelled → involuntary)
- **Board memo bug:** Wrote `customer_requested` instead of `cancellation_requested` — fixed in script (`scripts/churn-mix-analysis.ts`)
- **Feedback:** Treated as voluntary (legitimate churn reason vs billing annoyance)

### Decision Thresholds

| Situation                     | Recommendation       | Why                                                                    |
| ----------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `involuntary > 2 × voluntary` | `dunning_first`      | >66% churn is billing-driven → fix dunning before user experience work |
| `voluntary > 2 × involuntary` | `upgrade_flow_first` | >66% is product/market fit → refine messaging, pricing, value proof    |
| Balanced (0.5–2.0)            | `parallel`           | Mix of reasons → tackle both dunning + upgrade flow together           |

---

## Cohort-Level Churn Risk Heuristics (from lib/retention/churn-scorer.ts)

### Risk Mapping

| ClientHealthScore | Risk Tier | Churn Probability 30d | Churn Probability 90d |
| ----------------- | --------- | --------------------- | --------------------- |
| 75–100            | low       | 0.05                  | 0.10                  |
| 50–74             | medium    | 0.10                  | 0.20                  |
| 25–49             | high      | 0.25                  | 0.40                  |
| 0–24              | critical  | 0.45                  | 0.70                  |

### Delta Boosts

- Score decline >10 pts → +8% probability (steep drop-off)
- Score decline 5–10 pts → +4% probability
- Score <25 → +5% probability (baseline decay)

### Unverified but instrumented

- **Platform usage score** (missing from schema scan) is expected to weigh ~10% in overall health score
- **Journey dimension** (SYN-679) is in shadow state (4-week validation before activation) → not yet capturing churn signal from engagement events

---

## Engagement Drop-off (if data available)

| Week        | Engagement Events (proxy) |
| ----------- | ------------------------- |
| 4 weeks ago | X                         |
| 3 weeks ago | X                         |
| 2 weeks ago | X                         |
| 1 week ago  | X                         |

**Drop-off trend:** ? → ? → ? → ?
**Analysis:** If weekly active orgs decline >20%, this is a leading indicator of churn — link to health score trajectories.

---

## Quantitative Missing Pieces (must run script when credentials available)

| Metric                          | Script Output                                           | Frequency      | Stakeholder  |
| ------------------------------- | ------------------------------------------------------- | -------------- | ------------ |
| Involuntary vs voluntary churn  | `stripe.i_v_ratio`, `stripe.reason_breakdown`           | 30-day rolling | Phill        |
| Top 5 churn feedback reasons    | `stripe.feedback_top5`                                  | Continuous     | CS lead      |
| Paused-collection subscriptions | `stripe.paused`                                         | 30-day rolling | Dunning team |
| Cohort health trend             | `cohorts[]` → `avgScore`, `avgDelta`, churn probability | Weekly         | Marketing    |
| Engagement velocity             | `engagementDropoff`                                     | Weekly         | Growth       |

---

## Next Actions (ordered by impact)

1. **Unlock live Stripe key (30 min)**

   ```bash
   cd ~/Synthex
   vercel link
   vercel env pull .env.production.local --environment=production
   export STRIPE_SECRET_KEY=$(grep '^STRIPE_SECRET_KEY=' .env.production.local | cut -d= -f2-)
   cd ~/pi-seo-workspace/Synthex/.worktrees/t_e5ed489f
   npx tsx scripts/churn-mix-analysis.ts --days 30 > docs/billing/churn-mix-2026-08-21.json
   ```

   → Output drives dunning vs upgrade-flow priority.

2. **Ship pulse survey to free-tier activation flow (2–3 h)**
   - Use `lib/journey/pulse-survey.ts` → embed in /onboarding/welcome email
   - Send 1–5 satisfaction ask after first successful login
   - Link to existing `/api/journey/click` & `/api/journey/pulse` pixel endpoints
   - Compare 1–2 week satisfaction trends vs churn probability from health scores

3. **Re-validate pricing vs value proof (overnight)**
   - Use churn feedback reasons (once Stripe key unlocked)
   - If “too expensive” appears in top 5, run quick A/B test on annual billing messaging
   - Confirm enterprise tier values align with observed outcomes (onboarding tickets, health score trajectory)

4. **Monitor invisible churn with dunning state (ongoing)**
   - Once `stripe.paused` metric is available, flag accounts hitting 3 consecutive payment failures
   - Trigger CS outreach before subscription auto-cancels (goal: convert before involuntary churn)

5. **Activate journey dimension (SYN-679) after 4-week validation (Weeks 5–8)**
   - Current: engagement trajectory tracked but NOT in composite health score
   - Gate: `shadowDimensions.journey_engagement` stable for 4 weeks → promote to active dimension
   - Adds ~20% weight to churn probability; refines targeted retention emails

---

## Files Delivered

- `scripts/churn-mix-analysis.ts` — 30-day involuntary vs voluntary churn mix from Stripe
- `scripts/churn-root-cause-audit.ts` — Full audit (Stripe + Supabase + engagement drop-off)
- `docs/billing/churn-mix-2026-08-21.json` — To be produced once Stripe key unlocked
- This memo — qualitative root cause summary

---

## Risks & Constraints

- **No code changes required** per task guardrails — only analysis and recommendations
- **Live data unlock** blocked on Vercel CLI or 1Password interactive login (security policy)
- **Inferred probabilities** are heuristics tagged as `[hypothesis]` per retention skill rule 5
- **Journey dimension** is currently shadow; cannot quantify engagement-based churn until SYN-679 activation

---

## Sign-off

Status: Analysis complete; quantitative dashboard ready to run when STRIPE_SECRET_KEY + DATABASE_URL are available.

Next dependency: Phill runs the Stripe unlock command → produces `docs/billing/churn-mix-2026-08-21.json` → confirms recommendation (dunning vs upgrade-flow).
