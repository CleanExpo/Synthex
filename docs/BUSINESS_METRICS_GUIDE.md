# SYNTHEX Business Metrics Guide

> **Task:** UNI-425 - Implement Business Metrics Dashboard

This guide covers business KPIs, metrics tracking, and analytics for the SYNTHEX marketing platform.

## Table of Contents

1. [Overview](#overview)
2. [Metrics Categories](#metrics-categories)
3. [API Reference](#api-reference)
4. [Programmatic Usage](#programmatic-usage)
5. [Dashboard Integration](#dashboard-integration)
6. [Best Practices](#best-practices)

---

## Overview

The Business Metrics Dashboard aggregates key performance indicators (KPIs) specific to social media marketing:

- **User Metrics** - Growth, retention, engagement
- **Content Metrics** - Post volume, generation rate, AI usage
- **Campaign Metrics** - Active campaigns, completion rates
- **Engagement Metrics** - Likes, shares, comments, viral content
- **Platform Distribution** - Performance by social platform
- **AI Usage** - Adoption and feature utilization

---

## Metrics Categories

### User Metrics

| Metric | Description |
|--------|-------------|
| `totalUsers` | Total registered users |
| `activeUsers` | Users who created content in period |
| `newUsers` | Users who signed up in period |
| `userGrowthRate` | % change vs previous period |
| `retentionRate` | % of users still active |
| `churnRate` | % of users who stopped using |

### Content Metrics

| Metric | Description |
|--------|-------------|
| `totalPosts` | All-time post count |
| `postsCreated` | Posts created in period |
| `postsPublished` | Posts published in period |
| `postsScheduled` | Posts scheduled for future |
| `contentGenerationRate` | Posts per day average |
| `aiGeneratedContent` | AI-created posts |
| `manualContent` | Manually created posts |

### Campaign Metrics

| Metric | Description |
|--------|-------------|
| `totalCampaigns` | All-time campaigns |
| `activeCampaigns` | Currently running campaigns |
| `completedCampaigns` | Successfully finished campaigns |
| `campaignCompletionRate` | % of campaigns completed |
| `averageCampaignDuration` | Days from start to completion |

### Engagement Metrics

| Metric | Description |
|--------|-------------|
| `totalEngagement` | Sum of all interactions |
| `averageEngagementRate` | % engagement per post |
| `totalLikes` | Total likes received |
| `totalShares` | Total shares/retweets |
| `totalComments` | Total comments received |
| `totalImpressions` | Total content views |
| `viralContentCount` | Posts with >10% engagement |

---

## API Reference

### Full Business Metrics Report

```bash
GET /api/monitoring/business-metrics
GET /api/monitoring/business-metrics?period=last_30_days
```

**Query Parameters:**

| Parameter | Values | Default |
|-----------|--------|---------|
| `period` | `today`, `last_7_days`, `last_30_days`, `last_90_days`, `all_time` | `last_30_days` |
| `view` | `full`, `quick` | `full` |

**Response:**

```json
{
  "success": true,
  "report": {
    "period": "last_30_days",
    "periodLabel": "Last 30 Days",
    "generatedAt": "2026-02-02T10:30:00.000Z",
    "users": {
      "totalUsers": 1250,
      "activeUsers": 450,
      "newUsers": 120,
      "userGrowthRate": 15.5,
      "retentionRate": 68,
      "churnRate": 32
    },
    "content": {
      "totalPosts": 8500,
      "postsCreated": 1200,
      "postsPublished": 950,
      "postsScheduled": 180,
      "contentGenerationRate": 40.0,
      "aiGeneratedContent": 720,
      "manualContent": 480
    },
    "campaigns": {
      "totalCampaigns": 320,
      "activeCampaigns": 85,
      "completedCampaigns": 210,
      "campaignCompletionRate": 65.6,
      "averageCampaignDuration": 14.5
    },
    "engagement": {
      "totalEngagement": 125000,
      "averageEngagementRate": 4.2,
      "totalLikes": 85000,
      "totalShares": 22000,
      "totalComments": 18000,
      "totalImpressions": 2500000,
      "viralContentCount": 45
    },
    "platformDistribution": [
      {
        "platform": "twitter",
        "posts": 450,
        "percentage": 37.5,
        "engagement": 52000,
        "averageEngagementRate": 4.8
      },
      {
        "platform": "instagram",
        "posts": 380,
        "percentage": 31.7,
        "engagement": 48000,
        "averageEngagementRate": 5.2
      }
    ],
    "aiUsage": {
      "totalGenerations": 720,
      "averageGenerationsPerUser": 2.4,
      "aiAdoptionRate": 45,
      "topUsedFeatures": [
        { "feature": "Content Generation", "count": 720, "percentage": 100 },
        { "feature": "Hashtag Suggestions", "count": 576, "percentage": 80 }
      ]
    },
    "trends": [
      { "date": "2026-01-03", "users": 5, "posts": 42, "engagement": 4200, "campaigns": 3 }
    ],
    "highlights": [
      {
        "type": "positive",
        "metric": "User Growth",
        "value": "+15.5%",
        "description": "User base grew by 15.5% compared to previous period"
      }
    ]
  }
}
```

### Quick Summary Metrics

```bash
GET /api/monitoring/business-metrics?view=quick
```

**Response:**

```json
{
  "success": true,
  "metrics": {
    "totalUsers": 1250,
    "activeCampaigns": 85,
    "totalPosts": 8500,
    "avgEngagementRate": 4.2
  }
}
```

---

## Programmatic Usage

### Get Full Report

```typescript
import { getBusinessMetrics, BusinessMetricsPeriod } from '@/lib/metrics';

// Get last 30 days metrics
const report = await getBusinessMetrics(BusinessMetricsPeriod.LAST_30_DAYS);

console.log(`Total Users: ${report.users.totalUsers}`);
console.log(`Active Campaigns: ${report.campaigns.activeCampaigns}`);
console.log(`Avg Engagement: ${report.engagement.averageEngagementRate}%`);

// Check highlights
for (const highlight of report.highlights) {
  if (highlight.type === 'positive') {
    console.log(`✅ ${highlight.metric}: ${highlight.value}`);
  } else if (highlight.type === 'negative') {
    console.log(`⚠️ ${highlight.metric}: ${highlight.value}`);
  }
}
```

### Get Quick Summary

```typescript
import { getQuickMetrics } from '@/lib/metrics';

const summary = await getQuickMetrics();

// Display dashboard cards
console.log(`Users: ${summary.totalUsers}`);
console.log(`Campaigns: ${summary.activeCampaigns}`);
console.log(`Posts: ${summary.totalPosts}`);
console.log(`Engagement: ${summary.avgEngagementRate}%`);
```

### Different Time Periods

```typescript
import { getBusinessMetrics, BusinessMetricsPeriod } from '@/lib/metrics';

// Today's metrics
const today = await getBusinessMetrics(BusinessMetricsPeriod.TODAY);

// Weekly metrics
const weekly = await getBusinessMetrics(BusinessMetricsPeriod.LAST_7_DAYS);

// Monthly metrics
const monthly = await getBusinessMetrics(BusinessMetricsPeriod.LAST_30_DAYS);

// Quarterly metrics
const quarterly = await getBusinessMetrics(BusinessMetricsPeriod.LAST_90_DAYS);

// All-time metrics
const allTime = await getBusinessMetrics(BusinessMetricsPeriod.ALL_TIME);
```

---

## Dashboard Integration

### React Dashboard Card Example

```tsx
import { useEffect, useState } from 'react';

interface QuickMetrics {
  totalUsers: number;
  activeCampaigns: number;
  totalPosts: number;
  avgEngagementRate: number;
}

export function MetricsDashboard() {
  const [metrics, setMetrics] = useState<QuickMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/monitoring/business-metrics?view=quick')
      .then(res => res.json())
      .then(data => {
        setMetrics(data.metrics);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-4 gap-4">
      <MetricCard
        title="Total Users"
        value={metrics?.totalUsers}
        icon="users"
      />
      <MetricCard
        title="Active Campaigns"
        value={metrics?.activeCampaigns}
        icon="target"
      />
      <MetricCard
        title="Total Posts"
        value={metrics?.totalPosts}
        icon="file-text"
      />
      <MetricCard
        title="Avg Engagement"
        value={`${metrics?.avgEngagementRate}%`}
        icon="trending-up"
      />
    </div>
  );
}
```

### Trend Chart Integration

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

export function GrowthTrendChart({ trends }) {
  return (
    <LineChart width={600} height={300} data={trends}>
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="users" stroke="#8884d8" name="Users" />
      <Line type="monotone" dataKey="posts" stroke="#82ca9d" name="Posts" />
      <Line type="monotone" dataKey="engagement" stroke="#ffc658" name="Engagement" />
    </LineChart>
  );
}
```

---

## Best Practices

### 1. Caching Strategy

```typescript
// Cache metrics for 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

let cachedMetrics = null;
let cacheTime = 0;

async function getCachedMetrics() {
  if (cachedMetrics && Date.now() - cacheTime < CACHE_TTL) {
    return cachedMetrics;
  }

  cachedMetrics = await getBusinessMetrics();
  cacheTime = Date.now();
  return cachedMetrics;
}
```

### 2. Period Selection

| Use Case | Recommended Period |
|----------|-------------------|
| Real-time dashboard | `today` |
| Weekly reports | `last_7_days` |
| Monthly reviews | `last_30_days` |
| Quarterly planning | `last_90_days` |
| Year-end analysis | `all_time` |

### 3. Highlight Interpretation

```typescript
// Act on metrics highlights
for (const highlight of report.highlights) {
  switch (highlight.type) {
    case 'positive':
      // Celebrate wins, share with team
      break;
    case 'negative':
      // Investigate issues, create action items
      break;
    case 'neutral':
      // Monitor for changes
      break;
  }
}
```

### 4. Platform Comparison

```typescript
// Find best performing platform
const bestPlatform = report.platformDistribution
  .sort((a, b) => b.averageEngagementRate - a.averageEngagementRate)[0];

console.log(`Best platform: ${bestPlatform.platform} (${bestPlatform.averageEngagementRate}% engagement)`);
```

---

## Related Documentation

- [Observability Guide](./OBSERVABILITY_GUIDE.md)
- [Analytics Integration](./ANALYTICS_INTEGRATION.md)
- [API Reference](./API_REFERENCE.md)

---

*Last updated: 2026-02-02*
