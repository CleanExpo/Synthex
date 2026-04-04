# Phase 107 — BayesNF Spatiotemporal Predictions (Scale Tier)

**Phase**: 107 (FINAL)
**Milestone**: v6.0 Adaptive Intelligence Engine
**Status**: PLANNED
**Created**: 11/03/2026

## Summary

Add BayesNF cross-platform spatiotemporal predictions as a Scale-tier feature.
A new "Cross-Platform Intelligence" tab appears in the existing /dashboard/forecasting page.
The heatmap renders SpatiotemporalPredictionResult[] as a colour grid: platforms on Y axis,
dates on X axis, emerald colour intensity = predicted mean engagement value.

## Critical Type Facts (from lib/forecasting/types.ts)

```typescript
// SpatiotemporalPredictionResult actual shape:
{
  point: SpatiotemporalDataPoint;  // e.g. { platform: 'instagram', date: '2026-03-11' }
  mean: number;                    // predicted value
  std: number;                     // uncertainty
  quantiles: Record<string, number>; // e.g. { '0.1': ..., '0.9': ... }
}

// NOT { spatial, temporal, prediction, lower, upper }
// Access platform via: result.point.platform
// Access date via: result.point.date
// Access value via: result.mean
```

## Plan Gate

- UI gate: `getForecastFeatureLimits(plan).crossPlatformHeatmap` (true only for Scale)
- API gate: `isSpatiotemporalAvailable(plan)` (true for Growth+)
- Growth has spatiotemporalModels: 2 but crossPlatformHeatmap: false
- Scale: both true, unlimited

## Files to Create

| File | Purpose |
|------|---------|
| `app/api/predict/train/route.ts` | POST — collect cross-platform data + train BayesNF model |
| `app/api/predict/predict/route.ts` | POST — generate spatiotemporal predictions |
| `app/api/predict/models/route.ts` | GET — list spatiotemporal models for org |
| `app/api/admin/bayesian-health/route.ts` | GET — proxy to BayesNF Python service health |
| `components/forecasting/SpatiotemporalFeatureGate.tsx` | Scale-only upgrade gate |
| `components/forecasting/SpatiotemporalCard.tsx` | Model status card |
| `components/forecasting/PlatformHeatmap.tsx` | CSS-grid colour heatmap |
| `components/forecasting/CrossPlatformTab.tsx` | Tab content (SWR + state) |
| `app/(dashboard)/admin/bayesian-health/page.tsx` | Admin BayesNF health dashboard |

## Files to Modify

| File | Change |
|------|--------|
| `app/(dashboard)/forecasting/page.tsx` | Add Tabs wrapper; move existing content to "Time-Series" tab; add "Cross-Platform Intelligence" tab with CrossPlatformTab |

## Implementation Order

1. `app/api/predict/models/route.ts`
2. `app/api/predict/train/route.ts`
3. `app/api/predict/predict/route.ts`
4. `app/api/admin/bayesian-health/route.ts`
5. `components/forecasting/SpatiotemporalFeatureGate.tsx`
6. `components/forecasting/SpatiotemporalCard.tsx`
7. `components/forecasting/PlatformHeatmap.tsx`
8. `components/forecasting/CrossPlatformTab.tsx`
9. `app/(dashboard)/forecasting/page.tsx` — add Tabs
10. `app/(dashboard)/admin/bayesian-health/page.tsx`

---

## Task 1 — app/api/predict/models/route.ts

GET /api/predict/models — list all SpatiotemporalModel records for the auth'd org.

Auth pattern: copy `app/api/forecast/models/route.ts` exactly.
CRITICAL: plan from `organization: { select: { plan: true } }` nested select.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { isSpatiotemporalAvailable } from '@/lib/forecasting/feature-limits';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, organization: { select: { plan: true } } },
  });
  if (!user?.organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 });

  const orgId = user.organizationId;
  const plan = (user.organization?.plan ?? 'free').toLowerCase();

  if (!isSpatiotemporalAvailable(plan)) {
    return NextResponse.json({ error: 'Upgrade required', upgrade: true }, { status: 403 });
  }

  const models = await prisma.spatiotemporalModel.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: models });
}

export const runtime = 'nodejs';
```

---

## Task 2 — app/api/predict/train/route.ts

POST /api/predict/train — collect cross-platform engagement data, train BayesNF model.

Zod schema:
```typescript
const trainSchema = z.object({
  name: z.string().min(1).max(100).optional().default('cross_platform_engagement'),
  targetMetric: z.enum(['engagement_rate', 'impressions', 'reach', 'clicks', 'conversions']),
  config: z.object({
    numIterations: z.number().int().min(100).max(2000).optional(),
    learningRate: z.number().min(0.0001).max(0.1).optional(),
    numParticles: z.number().int().min(10).max(100).optional(),
  }).optional(),
});
```

Logic sequence:
1. Auth → 401
2. Org + plan resolve (organization nested select) → 403
3. `isSpatiotemporalAvailable(plan)` → 403 with { error, upgrade: true }
4. Count existing models: `prisma.spatiotemporalModel.count({ where: { orgId } })`
5. `isWithinForecastLimit(plan, 'spatiotemporalModels', count)` → 403 limit error
6. Collect training data via `collectSpatiotemporalData(orgId, targetMetric)` (inline helper below)
7. Minimum 14 rows check → 422 with message "Need at least 14 cross-platform data points"
8. `client = getForecastingClient()` → if null, upsert with status 'pending', return 202
9. Call `client.trainSpatiotemporalModel({ orgId, name, targetMetric, dimensions: { spatial: ['platform'], temporal: ['date'] }, data: dataPoints, config })`
10. Upsert `prisma.spatiotemporalModel`:
    - `where: { orgId_name: { orgId, name } }` (the @@unique([orgId, name]) key)
    - create: { orgId, userId, name, targetMetric, dimensions: {...}, status: result.status, trainingPoints: result.trainingPoints, lastTrainedAt: result.lastTrainedAt ? new Date(result.lastTrainedAt) : new Date(), accuracy: result.accuracy ?? {}, config: config ?? {} }
    - update: same fields except orgId/userId/name
11. Return { data: model } 201

collectSpatiotemporalData helper (inline in this file):
```typescript
async function collectSpatiotemporalData(
  orgId: string,
  targetMetric: string,
): Promise<Array<Record<string, string | number>>> {
  const connections = await prisma.platformConnection.findMany({
    where: { organizationId: orgId, isActive: true },
    select: { id: true, platform: true },
  });
  if (connections.length === 0) return [];

  const results: Array<Record<string, string | number>> = [];

  for (const conn of connections) {
    const posts = await prisma.platformPost.findMany({
      where: { connectionId: conn.id, status: 'published', publishedAt: { not: null } },
      select: { id: true },
    });
    if (posts.length === 0) continue;

    const metrics = await prisma.platformMetrics.findMany({
      where: { postId: { in: posts.map(p => p.id) } },
      select: { engagementRate: true, impressions: true, reach: true, clicks: true, saves: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    });

    const byDate: Record<string, { sum: number; count: number }> = {};
    for (const m of metrics) {
      const date = m.recordedAt.toISOString().slice(0, 10);
      const fieldMap: Record<string, number | null> = {
        engagement_rate: m.engagementRate,
        impressions: m.impressions,
        reach: m.reach,
        clicks: m.clicks,
        conversions: m.saves, // proxy
      };
      const value = fieldMap[targetMetric];
      if (value === null || value === undefined) continue;
      if (!byDate[date]) byDate[date] = { sum: 0, count: 0 };
      byDate[date].sum += value;
      byDate[date].count += 1;
    }

    for (const [date, { sum, count }] of Object.entries(byDate)) {
      results.push({ platform: conn.platform, date, [targetMetric]: sum / count });
    }
  }

  return results;
}
```

Export: `export const runtime = 'nodejs'`

---

## Task 3 — app/api/predict/predict/route.ts

POST /api/predict/predict — generate spatiotemporal predictions from a trained model.

Zod schema:
```typescript
const predictSchema = z.object({
  modelId: z.string().min(1),
  points: z.array(z.record(z.union([z.string(), z.number()]))).optional(),
  quantiles: z.array(z.number().min(0).max(1)).optional(),
});
```

Logic:
1. Auth + org + plan (organization nested select)
2. `isSpatiotemporalAvailable(plan)` → 403
3. `model = prisma.spatiotemporalModel.findFirst({ where: { id: modelId, orgId } })` → 404
4. `model.status !== 'ready'` → 409
5. `client = getForecastingClient()` → 503 if null
6. If no `points` provided, auto-build: get active platforms for org (distinct `platform` from PlatformConnection where organizationId=orgId, isActive=true), generate next 7 days from today, cartesian product → `{ platform, date }` array
7. `result = await client.predictSpatiotemporal(modelId, { points: points ?? autoPts, quantiles: quantiles ?? [0.1, 0.9] })`
8. Return `{ data: result }` — SpatiotemporalPredictResponse

Auto-build points:
```typescript
const today = new Date();
const next7Dates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(today);
  d.setDate(d.getDate() + i + 1);
  return d.toISOString().slice(0, 10);
});
const platforms = await prisma.platformConnection.findMany({
  where: { organizationId: orgId, isActive: true },
  select: { platform: true },
  distinct: ['platform'],
});
const autoPts = platforms.flatMap(({ platform }) =>
  next7Dates.map(date => ({ platform, date }))
);
```

Export: `export const runtime = 'nodejs'`

---

## Task 4 — app/api/admin/bayesian-health/route.ts

GET — proxy to Python BayesNF service health. Admin-only.

```typescript
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
// Check if isOwnerEmail is exported from jwt-utils or lib/admin/verify-admin.ts
// Read those files first to find the correct import path

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });
  // Check admin: role === 'admin' || isOwnerEmail(user.email)
  // Find correct admin check from existing routes (read lib/admin/verify-admin.ts)
  if (!user || (user.role !== 'admin' && !isOwnerEmail(user.email ?? ''))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const BASE_URL = process.env.BAYESIAN_SERVICE_URL;
  const API_KEY = process.env.BAYESIAN_SERVICE_API_KEY;

  if (!BASE_URL || !API_KEY) {
    return NextResponse.json({ status: 'unconfigured', message: 'BAYESIAN_SERVICE_URL not set' });
  }

  try {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: { 'X-Service-Key': API_KEY },
      signal: AbortSignal.timeout(5_000),
    });
    const data = await res.json() as unknown;
    return NextResponse.json({ status: res.ok ? 'reachable' : 'error', data });
  } catch (error) {
    logger.error('BayesNF health check failed:', error);
    return NextResponse.json({
      status: 'unreachable',
      error: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}

export const runtime = 'nodejs';
```

NOTE: Before implementing, read `lib/admin/verify-admin.ts` to find the correct admin check function.
Look at existing admin API routes for the exact pattern used.

---

## Task 5 — components/forecasting/SpatiotemporalFeatureGate.tsx

Clone ForecastFeatureGate.tsx exactly, change:
- Plan check: `hasAccess('scale')` instead of `hasAccess('pro')`
- Title: `'Cross-Platform Intelligence'`
- Description: `'BayesNF spatiotemporal models predict performance across every platform simultaneously.'`
- Benefits:
  1. `'BayesNF models cross-platform engagement with calibrated uncertainty bounds'`
  2. `'Spatiotemporal heatmap reveals which platforms perform best on each day'`
  3. `'Uncertainty bounds show confidence ranges — plan campaigns where the model is most certain'`
- Button gradient: keep `from-emerald-500 to-emerald-600`
- Icon: keep TrendingUp or use `Layers` from lucide-react (whichever fits better)

---

## Task 6 — components/forecasting/SpatiotemporalCard.tsx

Clone ForecastCard.tsx pattern. Props:
```typescript
interface SpatiotemporalCardProps {
  model: {
    id: string;
    name: string;
    targetMetric: string;
    status: string;
    trainingPoints: number;
    lastTrainedAt: string | null;
    accuracy: Record<string, number> | null;
  };
  onPredict: (modelId: string) => void;
  isPredicting: boolean;
}
```

Same STATUS_STYLES as ForecastCard. Show:
- model.name (capitalised)
- targetMetric badge
- status badge
- trainingPoints + " training points"
- lastTrainedAt formatted (DD/MM/YYYY)
- accuracy (if exists): show first numeric key + value
- "Generate Predictions" button — disabled if status !== 'ready' || isPredicting

---

## Task 7 — components/forecasting/PlatformHeatmap.tsx

CSS-grid colour heatmap. No new packages needed.

```typescript
'use client';

import { format, parseISO } from 'date-fns';
import type { SpatiotemporalPredictionResult } from '@/lib/forecasting/types';

interface PlatformHeatmapProps {
  predictions: SpatiotemporalPredictionResult[];
  metric: string;
}
```

Data transformation:
```typescript
// Extract unique platforms and dates
const platforms = [...new Set(predictions.map(p => String(p.point.platform)))].sort();
const dates = [...new Set(predictions.map(p => String(p.point.date)))].sort();

// Lookup map
const lookup = new Map<string, SpatiotemporalPredictionResult>();
for (const r of predictions) {
  lookup.set(`${String(r.point.platform)}__${String(r.point.date)}`, r);
}

// Normalise
const means = predictions.map(p => p.mean);
const minVal = Math.min(...means);
const maxVal = Math.max(...means);
const normalise = (v: number) =>
  maxVal === minVal ? 0.5 : (v - minVal) / (maxVal - minVal);

function toEmeraldColour(norm: number): string {
  const opacity = 0.1 + norm * 0.75;
  return `rgba(16, 185, 129, ${opacity.toFixed(2)})`;
}
```

CSS grid render:
```tsx
<div className="overflow-x-auto">
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `120px repeat(${dates.length}, minmax(44px, 1fr))`,
    }}
    className="gap-y-1"
  >
    {/* Header row */}
    <div />
    {dates.map(d => (
      <div key={d} className="text-xs text-gray-500 text-center pb-1">
        {format(parseISO(d), 'dd/MM')}
      </div>
    ))}

    {/* Data rows */}
    {platforms.map(platform => (
      <React.Fragment key={platform}>
        <div className="text-xs text-gray-400 capitalize flex items-center pr-2">
          {platform}
        </div>
        {dates.map(date => {
          const result = lookup.get(`${platform}__${date}`);
          const norm = result ? normalise(result.mean) : 0;
          const colour = result ? toEmeraldColour(norm) : 'rgba(255,255,255,0.03)';
          return (
            <div
              key={date}
              title={result
                ? `${platform} · ${format(parseISO(date), 'dd/MM')}\n${metric}: ${result.mean.toFixed(2)} ±${result.std.toFixed(2)}`
                : 'No data'}
              style={{ backgroundColor: colour }}
              className="h-10 rounded-sm border border-white/[0.04] mx-0.5"
            />
          );
        })}
      </React.Fragment>
    ))}
  </div>

  {/* Colour legend */}
  <div className="flex items-center gap-2 mt-3">
    <span className="text-xs text-gray-500">Low</span>
    <div className="flex-1 h-3 rounded-sm" style={{
      background: 'linear-gradient(to right, rgba(16,185,129,0.1), rgba(16,185,129,0.85))',
    }} />
    <span className="text-xs text-gray-500">High</span>
  </div>
</div>
```

---

## Task 8 — components/forecasting/CrossPlatformTab.tsx

Full tab content. Owns SWR data fetching for spatiotemporal models.

```typescript
'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';
import { SpatiotemporalFeatureGate } from './SpatiotemporalFeatureGate';
import { SpatiotemporalCard } from './SpatiotemporalCard';
import { PlatformHeatmap } from './PlatformHeatmap';
import { FORECAST_METRICS } from '@/lib/forecasting/metrics';
import type { SpatiotemporalPredictionResult } from '@/lib/forecasting/types';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

const SPATIAL_METRICS = ['engagement_rate', 'impressions', 'reach', 'clicks', 'conversions'] as const;
type SpatialMetric = typeof SPATIAL_METRICS[number];

export function CrossPlatformTab() {
  const [activeMetric, setActiveMetric] = useState<SpatialMetric>('engagement_rate');
  const [isTraining, setIsTraining] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [activePredictions, setActivePredictions] = useState<SpatiotemporalPredictionResult[] | null>(null);

  const { data: modelsData, isLoading, mutate } = useSWR(
    '/api/predict/models',
    fetchJson,
    { refreshInterval: 15_000 },
  );
  const models = modelsData?.data ?? [];

  const handleTrain = async () => {
    setIsTraining(true);
    try {
      await fetch('/api/predict/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetMetric: activeMetric }),
      });
      void mutate();
    } finally {
      setIsTraining(false);
    }
  };

  const handlePredict = async (modelId: string) => {
    setIsPredicting(true);
    try {
      const res = await fetch('/api/predict/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ modelId }),
      });
      if (res.ok) {
        const json = await res.json() as { data: { predictions: SpatiotemporalPredictionResult[] } };
        setActivePredictions(json.data.predictions);
      }
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <SpatiotemporalFeatureGate>
      <div className="space-y-6">
        {/* Train controls */}
        <div className="flex items-center gap-3">
          <select
            value={activeMetric}
            onChange={e => setActiveMetric(e.target.value as SpatialMetric)}
            className="bg-white/[0.05] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {SPATIAL_METRICS.map(m => (
              <option key={m} value={m}>{FORECAST_METRICS[m]?.label ?? m}</option>
            ))}
          </select>
          <button
            onClick={handleTrain}
            disabled={isTraining}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50 transition-colors"
          >
            {isTraining ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
            Train Cross-Platform Model
          </button>
        </div>

        {/* Heatmap (when predictions available) */}
        {activePredictions && activePredictions.length > 0 && (
          <div className="bg-white/[0.02] border border-emerald-500/10 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Cross-Platform Engagement Heatmap</h3>
            <p className="text-xs text-gray-500">
              Colour intensity = predicted {FORECAST_METRICS[activeMetric]?.label ?? activeMetric}. Hover for exact values.
            </p>
            <PlatformHeatmap predictions={activePredictions} metric={activeMetric} />
          </div>
        )}

        {/* Model cards */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Trained Models</h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <div key={i} className="h-40 animate-pulse bg-white/5 rounded-xl border border-white/[0.05]" />
              ))}
            </div>
          ) : models.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 bg-white/[0.02] rounded-xl border border-white/[0.05]">
              <p className="text-sm font-medium">No spatiotemporal models yet</p>
              <p className="text-xs mt-2 max-w-sm text-center">
                Select a metric and click Train to build your first cross-platform BayesNF model.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {models.map((model: Record<string, unknown>) => (
                <SpatiotemporalCard
                  key={model.id as string}
                  model={model as Parameters<typeof SpatiotemporalCard>[0]['model']}
                  onPredict={handlePredict}
                  isPredicting={isPredicting}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </SpatiotemporalFeatureGate>
  );
}
```

---

## Task 9 — Modify app/(dashboard)/forecasting/page.tsx

Add Tabs structure. The existing flat layout content moves into the "prophet" tab.

Read the current file first. Then restructure:

```typescript
// Add imports
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
// (or check if Tabs is in components/ui/tabs.tsx — read it first)
import { CrossPlatformTab } from '@/components/forecasting/CrossPlatformTab';
```

Wrap existing ForecastFeatureGate content with Tabs:
```tsx
<ForecastFeatureGate>
  <div className="space-y-6">
    {/* Header — unchanged */}
    <div>
      <h1 className="text-2xl font-bold text-white flex items-center gap-3">
        <TrendingUp className="h-7 w-7 text-emerald-400" />
        Forecasting
      </h1>
      <p className="text-gray-400 mt-1">
        Prophet time-series forecasting and BayesNF cross-platform predictions
      </p>
    </div>

    <Tabs defaultValue="prophet">
      <TabsList>
        <TabsTrigger value="prophet">Time-Series Forecasting</TabsTrigger>
        <TabsTrigger value="spatiotemporal">Cross-Platform Intelligence</TabsTrigger>
      </TabsList>

      <TabsContent value="prophet" className="space-y-6 mt-4">
        {/* MetricSelector, ForecastChart, Trained Models section — move here unchanged */}
      </TabsContent>

      <TabsContent value="spatiotemporal" className="mt-4">
        <CrossPlatformTab />
      </TabsContent>
    </Tabs>
  </div>
</ForecastFeatureGate>
```

NOTE: CrossPlatformTab internally renders SpatiotemporalFeatureGate, so non-Scale users
see the upgrade prompt when they click the tab. This is the correct UX — the tab is
visible as a teaser but the content is gated.

If Tabs component uses a different API (check components/ui/tabs.tsx), adapt accordingly.

---

## Task 10 — app/(dashboard)/admin/bayesian-health/page.tsx

Client page inside the admin section (already protected by admin layout isOwnerEmail guard).

```typescript
'use client';

import useSWR from 'swr';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

export default function BayesianHealthPage() {
  const { data, isLoading, mutate } = useSWR(
    '/api/admin/bayesian-health',
    fetchJson,
    { refreshInterval: 30_000 },
  );

  const { data: modelsData } = useSWR('/api/predict/models', fetchJson);
  const models = modelsData?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">BayesNF Service Health</h1>
        <p className="text-gray-400 mt-1">
          Real-time status of the Python AI service (Prophet + BayesNF engines).
        </p>
      </div>

      {/* Service status card */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Service Status</h2>
          <button onClick={() => void mutate()} className="text-xs text-gray-400 hover:text-white transition-colors">
            Refresh
          </button>
        </div>
        {isLoading ? (
          <div className="animate-pulse h-20 bg-white/5 rounded" />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                data?.status === 'reachable' ? 'bg-emerald-400' :
                data?.status === 'unconfigured' ? 'bg-yellow-400' : 'bg-red-400'
              }`} />
              <span className="text-sm text-white capitalize">{data?.status ?? 'unknown'}</span>
            </div>
            {data?.data && (
              <pre className="text-xs text-gray-400 bg-black/30 rounded p-3 overflow-auto">
                {JSON.stringify(data.data, null, 2)}
              </pre>
            )}
            {data?.error && (
              <p className="text-xs text-red-400">{data.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Spatiotemporal models overview */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Spatiotemporal Models</h2>
        <p className="text-sm text-gray-400">{models.length} model{models.length !== 1 ? 's' : ''} across all organisations</p>
        {models.length > 0 && (
          <div className="mt-3 space-y-2">
            {(models as Array<{ id: string; name: string; orgId: string; status: string; trainingPoints: number }>)
              .slice(0, 10)
              .map(m => (
                <div key={m.id} className="flex items-center justify-between text-xs text-gray-400">
                  <span>{m.name} ({m.orgId.slice(0, 8)}...)</span>
                  <span className={m.status === 'ready' ? 'text-emerald-400' : m.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}>
                    {m.status} · {m.trainingPoints} pts
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Key Constraints Checklist

- Australian English: Optimisation, organise, licence, colour
- `credentials: 'include'` in all useSWR fetchers
- Auth: `getUserIdFromRequest` → 401, org resolve → 403
- CRITICAL: plan from `organization.plan` (nested select) NOT `User.plan`
- `export const runtime = 'nodejs'` in all API routes
- Recharts NOT used for heatmap — pure CSS grid (no new packages)
- `getForecastingClient()` null check with graceful fallback
- Scale-tier only for heatmap UI; Growth+ for API access
- No new npm packages — all libraries already in package.json

## Verification

```bash
npm run type-check  # zero errors
npm run lint        # zero warnings in new files
npm test            # 1514+ tests stable
```
