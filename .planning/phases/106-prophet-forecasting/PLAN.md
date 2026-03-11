# Phase 106 — Prophet Time-Series Forecasting Dashboard

**Phase**: 106
**Milestone**: v6.0 Adaptive Intelligence Engine
**Status**: PLANNED
**Created**: 11/03/2026

## Summary

Build the forecasting dashboard and API routes enabling users to train Prophet
models on their engagement/traffic data and view confidence-banded time-series
forecasts. All infrastructure (Python service, TypeScript client, Prisma models,
feature limits) is complete. This phase is UI + API routes only.

Plan limits: free=upgrade gate, pro=7d/3 models, growth=30d/15 models, scale=90d/unlimited.

## Files to Create

| File | Purpose |
|------|---------|
| `lib/forecasting/collect-training-data.ts` | Shared helper — collect PlatformMetrics + GEOAnalysis data |
| `app/api/forecast/models/route.ts` | GET list + POST create model |
| `app/api/forecast/predict/route.ts` | POST generate prediction |
| `app/api/forecast/[modelId]/route.ts` | GET model status |
| `app/api/cron/forecast-training/route.ts` | Weekly cron — retrain all models |
| `components/forecasting/ForecastFeatureGate.tsx` | Pro+ upgrade gate |
| `components/forecasting/MetricSelector.tsx` | Metric/platform/horizon picker |
| `components/forecasting/ForecastChart.tsx` | Recharts area chart + confidence band |
| `components/forecasting/ForecastCard.tsx` | Model summary card |
| `app/(dashboard)/forecasting/page.tsx` | Main dashboard page |

## Files to Modify

| File | Change |
|------|--------|
| `components/dashboard/sidebar.tsx` | Add Forecasting to analytics group |
| `components/command-palette.tsx` | Add 3 forecasting commands |
| `vercel.json` | Add weekly cron entry (0 3 * * 0) |

## Implementation Order

1. `lib/forecasting/collect-training-data.ts`
2. `app/api/forecast/models/route.ts`
3. `app/api/forecast/predict/route.ts`
4. `app/api/forecast/[modelId]/route.ts`
5. `app/api/cron/forecast-training/route.ts`
6. `components/forecasting/ForecastFeatureGate.tsx`
7. `components/forecasting/MetricSelector.tsx`
8. `components/forecasting/ForecastChart.tsx`
9. `components/forecasting/ForecastCard.tsx`
10. `app/(dashboard)/forecasting/page.tsx`
11. Sidebar nav item
12. Command palette commands
13. `vercel.json` cron entry

---

## Task 1 — lib/forecasting/collect-training-data.ts

Signature:
```typescript
export async function collectTrainingData(
  orgId: string,
  metric: string,
  platform?: string,
): Promise<ForecastDataPoint[]>
```

For geo_analysis dataSource (geo_score, authority_score):
- `prisma.gEOAnalysis.findMany({ where: { user: { organizationId: orgId } }, select: { overallScore, authorityScore, createdAt } })`
- Group by date (YYYY-MM-DD), average target field per day
- geo_score uses overallScore, authority_score uses authorityScore

For platform_metrics dataSource (all other metrics):
- Chain: `PlatformConnection` (organizationId=orgId, isActive=true, platform filter if provided)
  -> `PlatformPost` (connectionId in ids, status=published, publishedAt not null)
  -> `PlatformMetrics` (postId in ids)
- Field mapping: engagement_rate->engagementRate, impressions->impressions, reach->reach,
  clicks->clicks, conversions->saves (proxy — add comment), follower_growth->reach (proxy — add comment)
- Group by date (slice recordedAt to YYYY-MM-DD), average per day
- Return `ForecastDataPoint[]` = `[{ ds: 'YYYY-MM-DD', y: number }]`

---

## Task 2 — app/api/forecast/models/route.ts

Auth pattern: copy `app/api/bayesian/spaces/route.ts` exactly.
CRITICAL: use `organization: { select: { plan: true } }` nested select for plan — NOT `User.plan`.

GET handler:
- `prisma.forecastModel.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' } })`
- Return: `{ data: models }`

POST Zod schema:
```typescript
const createModelSchema = z.object({
  metric: z.enum(['engagement_rate','impressions','reach','clicks',
    'conversions','geo_score','authority_score','follower_growth']),
  platform: z.enum(['instagram','linkedin','twitter','facebook','tiktok',
    'youtube','pinterest','reddit','threads']).optional(),
});
```

POST logic (in order):
1. Auth + org + plan resolve (organization nested select)
2. `getForecastFeatureLimits(plan).forecastModels === 0` -> 403 upgrade error
3. `count = await prisma.forecastModel.count({ where: { orgId } })`
4. `!isWithinForecastLimit(plan, 'forecastModels', count)` -> 403 limit error
5. `dataPoints = await collectTrainingData(orgId, metric, platform)`
6. `dataPoints.length < FORECAST_METRICS[metric].minDataPoints` -> 422 with message
7. `client = getForecastingClient()` — if null, upsert with status 'pending', return 202
8. `result = await client.trainForecastModel({ orgId, metric, platform, data: dataPoints, holidays: 'AU' })`
9. `prisma.forecastModel.upsert({ where: { orgId_metric_platform: { orgId, metric, platform: platform ?? null } }, create: {...}, update: {...} })`
10. Return 201 with model

Export: `export const runtime = 'nodejs'`

---

## Task 3 — app/api/forecast/predict/route.ts

Zod schema:
```typescript
const predictSchema = z.object({
  modelId: z.string().min(1),
  horizonDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
});
```

POST logic:
1. Auth + org + plan (organization nested select)
2. `!isHorizonAllowed(plan, horizonDays)` -> 403 stating required plan
3. `startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)`
4. `monthlyCount = await prisma.forecast.count({ where: { orgId, generatedAt: { gte: startOfCurrentMonth } } })`
5. `!isWithinForecastLimit(plan, 'monthlyForecasts', monthlyCount)` -> 403
6. `model = await prisma.forecastModel.findFirst({ where: { id: modelId, orgId } })` -> 404 if null
7. `model.status !== 'ready'` -> 409 `Model is not ready (status: ${model.status})`
8. `result = await client.predictForecast(modelId, { horizonDays })`
9. `forecast = await prisma.forecast.create({ data: { modelId, orgId, horizonDays, predictions: result.predictions } })`
10. Return `{ data: { ...result, forecastId: forecast.id } }`

Export: `export const runtime = 'nodejs'`

---

## Task 4 — app/api/forecast/[modelId]/route.ts

GET with `params.modelId`. Auth + org resolve.

```typescript
const model = await prisma.forecastModel.findFirst({
  where: { id: params.modelId, orgId },
  include: {
    forecasts: { orderBy: { generatedAt: 'desc' }, take: 1 },
  },
});
if (!model) return 404;
return { data: { ...model, latestForecast: model.forecasts[0] ?? null } };
```

Export: `export const runtime = 'nodejs'`

---

## Task 5 — app/api/cron/forecast-training/route.ts

GET handler only. Copy CRON_SECRET auth check from an existing cron route.

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
```

Logic:
1. Check `Authorization: Bearer ${CRON_SECRET}` -> 401 if invalid
2. `client = getForecastingClient()` -> return `{ skipped: true, reason: 'Service not configured' }` if null
3. `models = await prisma.forecastModel.findMany({ where: { status: { in: ['ready', 'pending'] } } })`
4. For each model:
   a. `dataPoints = await collectTrainingData(model.orgId, model.metric, model.platform ?? undefined)`
   b. `dataPoints.length < FORECAST_METRICS[metric].minDataPoints` -> results.skipped++, continue
   c. `result = await client.retrainForecastModel(model.id, { data: dataPoints })`
   d. Update model in Prisma (status, trainingPoints, lastTrainedAt, accuracy, seasonality)
   e. results.retrained++
   f. On error: update status to 'failed', logger.error, results.failed++
5. Return `{ success: true, retrained, skipped, failed, totalModels: models.length }`

---

## Task 6 — components/forecasting/ForecastFeatureGate.tsx

Copy `components/bayesian/BOFeatureGate.tsx` pattern exactly. Changes:
- All `violet-` tailwind classes -> `emerald-`
- Icon: `Brain` -> `TrendingUp`
- Title: `'Time-Series Forecasting'`
- Description: `'Prophet AI forecasts your engagement, reach, and GEO score 7-90 days ahead with calibrated confidence intervals.'`
- Benefits:
  1. `'Prophet AI forecasts engagement, reach, and GEO score 7-90 days ahead'`
  2. `'Confidence bands reveal best-case and worst-case projections'`
  3. `'Weekly auto-retraining keeps models accurate as your audience grows'`
- Button gradient: `from-emerald-500 to-emerald-600`
- Plan check: `hasAccess('pro')` — same logic as BOFeatureGate

---

## Task 7 — components/forecasting/MetricSelector.tsx

'use client'. Props:
```typescript
interface MetricSelectorProps {
  metric: ForecastMetric;
  platform: ForecastPlatform | null;
  horizon: ForecastHorizon;
  onMetricChange: (m: ForecastMetric) => void;
  onPlatformChange: (p: ForecastPlatform | null) => void;
  onHorizonChange: (h: ForecastHorizon) => void;
  onTrain: () => void;
  isTraining: boolean;
}
```

Use `useSubscription` hook. Compute `limits = getForecastFeatureLimits(plan)`.

Layout in glassmorphic card (`bg-white/[0.02] border border-emerald-500/10 rounded-xl p-4`):
- Metric select: all 8 from `Object.values(FORECAST_METRICS)` — show `label` as display text
- Platform select: only render if `FORECAST_METRICS[metric].supportsPlatform === true`. Options: 9 platforms + "All platforms" (null value)
- Horizon buttons [7, 30, 90]: disable if `horizonDays > limits.maxHorizonDays`, title tooltip "Requires Growth plan" or "Requires Scale plan"
- Train button: `isTraining` -> spinner (RefreshCw from lucide-react), otherwise "Train Model"

---

## Task 8 — components/forecasting/ForecastChart.tsx

'use client'. Recharts AreaChart. No new packages.

Props:
```typescript
interface ForecastChartProps {
  predictions: ForecastPrediction[];
  metric: ForecastMetric;
  horizonDays: number;
  accuracy: ForecastAccuracy | null;
}
```

Transform:
```typescript
const chartData = predictions.map((p) => ({
  date: format(parseISO(p.ds), 'dd/MM'),
  yhat: parseFloat(p.yhat.toFixed(2)),
  yhat_upper: parseFloat(p.yhat_upper.toFixed(2)),
  yhat_lower: parseFloat(p.yhat_lower.toFixed(2)),
}));
```

Recharts structure:
- `ResponsiveContainer width="100%" height={320}`
- `CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"`
- XAxis: `dataKey="date"` tick `fill: '#6b7280', fontSize: 11`
- YAxis: tick same style
- Upper band: `Area dataKey="yhat_upper" fill="#10b981" fillOpacity={0.15} stroke="none"`
- Lower fill: `Area dataKey="yhat_lower" fill="#0f172a" fillOpacity={1} stroke="none"` (occludes band below lower bound)
- Main line: `Area dataKey="yhat" stroke="#10b981" strokeWidth={2} fill="none" dot={false}`
- Tooltip: `contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px' }}`

Below chart: accuracy row with MAPE + MAE in `text-emerald-400`.
Title: `{horizonDays}-Day Forecast — {FORECAST_METRICS[metric].label}`

Wrap in: `bg-white/[0.02] border border-emerald-500/10 rounded-xl p-4`

---

## Task 9 — components/forecasting/ForecastCard.tsx

'use client'. Props:
```typescript
interface ForecastCardProps {
  model: ForecastModelResponse;
  onPredict: (modelId: string) => void;
  isPredicting: boolean;
  horizon: ForecastHorizon;
}
```

Card (`bg-white/[0.02] border border-emerald-500/20 rounded-xl p-4`):
- Header: `FORECAST_METRICS[model.metric].label` + optional platform badge + status badge
- Status colours: pending/training=`bg-yellow-500/20 text-yellow-400`, ready=`bg-emerald-500/20 text-emerald-400`, failed=`bg-red-500/20 text-red-400`
- Body: `{model.trainingPoints} data points`, last trained date (if truthy), MAPE if accuracy exists
- Predict button: `Generate {horizon}d Forecast`, disabled if `model.status !== 'ready' || isPredicting`

---

## Task 10 — app/(dashboard)/forecasting/page.tsx

'use client'. Wrap everything in `<ForecastFeatureGate>`.

```typescript
const fetchJson = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());
```

SWR: `useSWR('/api/forecast/models', fetchJson, { refreshInterval: 15_000 })`

State: `selectedMetric` (default 'engagement_rate'), `selectedPlatform` (null), `selectedHorizon` (7), `isTraining`, `isPredicting`, `activeForecast`

handleTrain: POST `/api/forecast/models` with `{ metric: selectedMetric, platform: selectedPlatform ?? undefined }`, call `mutate()` on success
handlePredict(modelId): POST `/api/forecast/predict` with `{ modelId, horizonDays: selectedHorizon }`, setActiveForecast(json.data)

Layout:
1. Header with TrendingUp icon (text-emerald-400) + description
2. MetricSelector
3. If activeForecast: ForecastChart
4. "Trained Models" section: loading skeleton (2 items) OR empty state OR grid of ForecastCard

Empty state: TrendingUp icon (opacity-30 text-emerald-400), "No forecast models yet", instruction text.

---

## Task 11 — Sidebar Navigation

Read `components/dashboard/sidebar.tsx`. Find analytics group (where Optimisation was added in Phase 103).
Add: `{ icon: TrendingUp, label: 'Forecasting', href: '/dashboard/forecasting' }`
Ensure TrendingUp is imported from lucide-react.

---

## Task 12 — Command Palette

Read `components/command-palette.tsx`. Find BO commands section. Add after:
```typescript
{
  id: 'forecasting-dashboard',
  title: 'Forecasting Dashboard',
  description: 'Prophet time-series forecasting — predict engagement and reach trends',
  icon: TrendingUp,
  action: () => router.push('/dashboard/forecasting'),
  category: 'navigation',
  keywords: ['forecast', 'predict', 'prophet', 'time-series', 'trend'],
},
{
  id: 'forecasting-train',
  title: 'Train Forecast Model',
  description: 'Build a new Prophet model on your platform metrics',
  icon: TrendingUp,
  action: () => router.push('/dashboard/forecasting'),
  category: 'actions',
  keywords: ['forecast', 'train', 'prophet', 'model', 'build'],
},
{
  id: 'forecasting-predict',
  title: 'Generate Forecast',
  description: 'Generate a 7-90 day forecast from a trained model',
  icon: TrendingUp,
  action: () => router.push('/dashboard/forecasting'),
  category: 'actions',
  keywords: ['forecast', 'generate', '7 day', '30 day', '90 day'],
},
```
Import TrendingUp from lucide-react if not already imported.

---

## Task 13 — vercel.json Cron Entry

Read `vercel.json`. Add to crons array:
```json
{ "path": "/api/cron/forecast-training", "schedule": "0 3 * * 0" }
```

---

## Key Constraints Checklist

- Australian English: Optimisation, organise, licence, colour
- useSWR with `credentials: 'include'` in all client components
- Auth: `getUserIdFromRequest` -> 401, org resolve -> 403 in all API routes
- `export const runtime = 'nodejs'` in all API routes
- Recharts + date-fns only (already in package.json — no new npm installs)
- `getForecastingClient()` null check with graceful 202 fallback
- Free: 403 at API, upgrade gate at UI
- CRITICAL: plan from `organization.plan` (nested select) NOT `User.plan`
- Emerald accent (#10b981) — distinct from BO (violet) and GEO (cyan)
- Date format: DD/MM/YYYY in chart XAxis and ForecastCard

## Verification

```bash
npm run type-check  # zero errors
npm run lint        # zero warnings in new files
npm test            # 1514+ tests stable
```
