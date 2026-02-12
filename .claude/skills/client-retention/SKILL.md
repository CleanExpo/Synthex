---
name: client-retention
description: >-
  Customer success and retention specialist for SYNTHEX. Monitors user
  engagement, identifies churn risks, and optimises retention strategies
  through data-driven insights. Use when analysing engagement, identifying
  churn risks, optimising retention metrics, or reviewing customer success KPIs.
metadata:
  author: synthex
  version: "2.0"
  engine: synthex-ai-agency
  type: business-skill
  triggers:
    - retention
    - churn
    - engagement analysis
    - customer success
    - user engagement
---

# Client Retention Agent

## Purpose

Monitors SYNTHEX user engagement, identifies churn risks, and optimises
retention strategies through data-driven insights and AI-powered predictions.
Tracks engagement KPIs, predicts churn probability, and triggers intervention
campaigns.

## When to Use

Activate this skill when:
- Analysing user engagement patterns and metrics
- Identifying users at risk of churning
- Optimising retention campaigns and strategies
- Reviewing customer success KPIs (NPS, CSAT, MAU)
- Building cohort retention reports

## When NOT to Use This Skill

- When providing real-time customer support (use support workflows directly)
- When building new product features (use feature-development workflow)
- When designing UI for analytics dashboards (use design + ui-ux)
- When modifying database schema for analytics (use database-prisma)
- Instead use: `api-testing` for endpoint testing, `database-prisma` for schema work

## Tech Stack

- **Analytics**: Custom analytics system
- **Database**: Prisma + Supabase
- **AI**: OpenRouter API for predictions
- **Reporting**: Scheduled reports via Vercel Cron

## Instructions

1. **Collect engagement data** — Query analytics endpoints for user activity
2. **Calculate key metrics** — Compute DAU, WAU, MAU, session duration, feature adoption
3. **Run cohort analysis** — Group users by signup date, analyse retention curves
4. **Identify at-risk users** — Flag users matching disengagement signals
5. **Score churn probability** — Use AI prediction model on at-risk users
6. **Design interventions** — Select appropriate re-engagement strategy
7. **Trigger campaigns** — Execute personalised email/notification campaigns
8. **Measure intervention impact** — Track conversion from at-risk to re-engaged
9. **Update retention dashboards** — Refresh KPI displays with latest data
10. **Generate weekly report** — Output retention summary with trend analysis

## Input Specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| operation | string | yes | `analyse`, `predict`, `intervene`, `report` |
| cohort | string | no | Date range or cohort identifier |
| user_segment | string | no | `all`, `at-risk`, `new`, `power-users` |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| metric | string | KPI name |
| value | number | Current value |
| trend | up/down/stable | Direction vs previous period |
| at_risk_users | array | Users flagged for churn risk |
| recommendations | array | Suggested interventions |

## Error Handling

| Error | Action |
|-------|--------|
| Missing analytics data | Report data gap, use available period |
| Prediction model failure | Fall back to rule-based heuristics |
| Campaign send failure | Retry once, then queue for manual review |
| Insufficient data for cohort | Warn and expand date range |
| API rate limit on OpenRouter | Queue prediction batch, retry after cooldown |

## Key Metrics

### Engagement KPIs

```typescript
interface EngagementMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  avgSessionDuration: number;
  contentCreatedPerUser: number;
  featureAdoptionRate: number;
}
```

### Retention KPIs

```typescript
interface RetentionMetrics {
  day1Retention: number;   // % returning next day
  day7Retention: number;   // % returning week 1
  day30Retention: number;  // % returning month 1
  churnRate: number;       // Monthly churn %
  lifetimeValue: number;   // Average LTV in AUD
}
```

## Early Warning Signals

- No login in 7+ days
- Decreased feature usage (>30% drop)
- Support ticket patterns (frustration indicators)
- Failed scheduled posts (platform issues)

## Intervention Actions

- Re-engagement emails (personalised)
- Feature discovery prompts (in-app)
- Personalised recommendations (AI-driven)
- Success manager outreach (high-value accounts)

## Key Directories

- `app/api/analytics/` — Analytics endpoints
- `lib/analytics/` — Analytics utilities
- `hooks/useAnalytics.ts` — Client-side tracking
- `components/analytics/` — Dashboard components

## Commands

```bash
pnpm run report:retention        # Generate retention report
pnpm run analytics:cohort        # Analyse cohort
pnpm run analytics:engagement    # Check engagement metrics
```

## Integration Points

- Works with **Analytics APIs** for data collection
- Coordinates with **ui-ux** for engagement features
- Supports **database-prisma** for metrics storage
- Uses **AI** (OpenRouter) for churn prediction models
