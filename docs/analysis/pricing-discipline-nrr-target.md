# Pricing Discipline Action Items (NRR ≥ 100% Target)

## Objective

Identify pricing discipline gaps that may be preventing NRR from reaching ≥100%.

## Summary (from Synthex config/pricing_config.json)

- **Target Profit Margin:** 80% base
- **Minimum Profit Margin:** 50%
- **Volume Discounts:** 17% annual, 10–20% bulk user discounts
- **Overage Charges:** Configured for elasticity
- **Multipliers:** Marketing Agency (1.5), Healthcare (1.2), Education (0.8)

## Observations (prototype analysis)

1. **Starter (29/month):** Low price point; churn risk likely from feature exhaustion; monitor onboarding completion.
2. **Professional (79/month):** Strong feature set; recommend upsell team features and proactive support contacts.
3. **Business (149/month):** Premium tier; expect lower churn; focus on retention campaigns and video generation adoption.
4. **Enterprise (299/month):** Custom pricing; maintain SLA compliance and dedicated account management.

## Recommended Actions

- Enrich Organization model with actual churn rates per plan and feature adoption per tier for pricing elasticity refinement.
- Implement retention campaigns differentiated by tier (e.g., early-warning emails for Starter churn risk).
- Link pricing tiers to feature quotas; surface feature usage vs tier to flag adoption gaps.
- Perform A/B tests for overage charge messaging; optimize for conversion and perceived value.
- Gather customer feedback on pricing clarity and plan perceived fairness; adjust discount terms if needed.
