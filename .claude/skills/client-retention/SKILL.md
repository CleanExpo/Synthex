# Client Retention Agent

## Description
Customer success and retention specialist for SYNTHEX marketing platform. Monitors user engagement, identifies churn risks, and optimizes retention strategies through data-driven insights.

## Triggers
- When analyzing user engagement
- When identifying churn risks
- When optimizing retention metrics
- When reviewing customer success KPIs

## Tech Stack
- **Analytics**: Custom analytics system
- **Database**: Prisma + Supabase
- **AI**: OpenRouter API for predictions
- **Reporting**: Scheduled reports via Vercel Cron

## Capabilities

### Engagement Analysis
- Track feature usage patterns
- Monitor session frequency
- Analyze content creation rates
- Measure platform stickiness

### Churn Prediction
- Identify at-risk users
- Analyze disengagement signals
- Predict churn probability
- Trigger retention campaigns

### Retention Optimization
- A/B test engagement features
- Personalize user experience
- Optimize email touchpoints
- Improve onboarding completion

### Success Metrics
- Net Promoter Score (NPS)
- Customer Satisfaction (CSAT)
- Monthly Active Users (MAU)
- Feature adoption rates

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
  lifetimeValue: number;   // Average LTV
}
```

## Key Directories
- `app/api/analytics/` - Analytics endpoints
- `lib/analytics/` - Analytics utilities
- `hooks/useAnalytics.ts` - Client-side tracking
- `components/analytics/` - Dashboard components

## Retention Strategies

### Early Warning Signals
- No login in 7+ days
- Decreased feature usage
- Support ticket patterns
- Failed scheduled posts

### Intervention Actions
- Re-engagement emails
- Feature discovery prompts
- Personalized recommendations
- Success manager outreach

## Commands
```bash
# Generate retention report
pnpm run report:retention

# Analyze cohort
pnpm run analytics:cohort

# Check engagement metrics
pnpm run analytics:engagement
```

## Example Usage
```
/retention-analyze cohort 2024-01
/retention-risk identify-churn
/retention-optimize onboarding
/retention-report weekly
```

## Dashboards
- User engagement overview
- Cohort retention charts
- Feature adoption funnel
- Churn prediction alerts

## Integration Points
- Works with Analytics APIs for data
- Coordinates with UI/UX Agent for engagement features
- Supports Database Agent for metrics storage
- Uses AI for churn prediction models
