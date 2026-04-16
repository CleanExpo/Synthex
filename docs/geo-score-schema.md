# GEO Score Schema — SYN-656

## What is the GEO Score?

The GEO (Generative Engine Optimisation) score is a normalised 0–100 integer
representing how frequently a client organisation's content is cited by AI
search engines during a structured dark run.

A score of 0 means the client was never cited across all checked queries. A
score of 100 means the client appeared in every checked query across every
tested AI platform.

The score is **per client per month** and is stored in the `client_geo_scores`
table. It powers the monthly GEO score card in the Synthex dashboard and
provides the trend signal (up / down / stable) used in client retention flows.

---

## Table: `client_geo_scores`

| Column            | Type          | Notes                                      |
| ----------------- | ------------- | ------------------------------------------ |
| `id`              | `uuid`        | Primary key, auto-generated                |
| `client_id`       | `text`        | FK → `organizations.id` (cascade delete)   |
| `score`           | `integer`     | 0–100 normalised citation score            |
| `score_breakdown` | `jsonb`       | Detailed breakdown (see below)             |
| `trend`           | `text`        | `'up'` \| `'down'` \| `'stable'`           |
| `trend_delta`     | `integer`     | Absolute point change vs previous month    |
| `month`           | `date`        | First day of the month (e.g. `2026-04-01`) |
| `created_at`      | `timestamptz` | Row creation timestamp                     |

**Unique constraint:** `(client_id, month)` — one row per client per calendar month.

---

## score_breakdown JSONB Schema

```json
{
  "totalQueriesChecked": 50,
  "citationsFound": 23,
  "platformBreakdown": {
    "google_aio": 10,
    "chatgpt": 7,
    "perplexity": 4,
    "bing_copilot": 2
  }
}
```

| Field                 | Type                     | Description                                           |
| --------------------- | ------------------------ | ----------------------------------------------------- |
| `totalQueriesChecked` | `number`                 | Total PromptTracker prompts tested across all engines |
| `citationsFound`      | `number`                 | Count of responses that included a brand citation     |
| `platformBreakdown`   | `Record<string, number>` | Per-platform citation counts                          |

---

## How to Calculate the Score from Dark Run Data

The GEO dark run queries the `PromptTracker` and `PromptResult` models populated
by the SYN-584 dark run pipeline. The calculation process is:

### Step 1 — Collect monthly PromptResult rows

```sql
SELECT
  pt.target_model,
  pr.brand_mentioned,
  pr.tested_at
FROM prompt_results pr
JOIN prompt_trackers pt ON pt.id = pr.tracker_id
WHERE pt.org_id = '<client_id>'
  AND pr.tested_at >= '<month_start>'
  AND pr.tested_at < '<next_month_start>'
```

### Step 2 — Aggregate citation counts per platform

Group `PromptResult` rows by the `targetModel` field on `PromptTracker` and
count `brandMentioned = true` versus total rows. Map model names to the
`GEOPlatform` values:

| `targetModel` prefix        | Platform       |
| --------------------------- | -------------- |
| `gpt-` / `o1-` / `o3-`      | `chatgpt`      |
| `claude-` / `sonar-`        | `perplexity`   |
| `gemini-` / `models/gemini` | `google_aio`   |
| `mistral-` / `phi-`         | `bing_copilot` |

### Step 3 — Normalise to 0–100

```
score = round((citationsFound / totalQueriesChecked) * 100)
```

Clamp to [0, 100].

### Step 4 — Build scoreBreakdown

```typescript
const scoreBreakdown: GeoScoreBreakdown = {
  totalQueriesChecked,
  citationsFound,
  platformBreakdown, // keyed by GEOPlatform value
};
```

---

## How to Determine Trend

1. Fetch the previous month's row for the same `client_id`:

   ```sql
   SELECT score FROM client_geo_scores
   WHERE client_id = '<id>'
     AND month = date_trunc('month', current_date - interval '1 month')
   ```

2. Compute `trendDelta = currentScore - previousScore`

3. Apply threshold:

   ```
   if (trendDelta > 2)  → trend = 'up'
   if (trendDelta < -2) → trend = 'down'
   else                 → trend = 'stable'
   ```

   A ±2 point dead-band prevents noise from triggering trend changes.

---

## RLS Policy

Synthex uses a custom JWT (not Supabase Auth row-level policies based on
`auth.uid()`). All database access is performed server-side via the Supabase
service role. A single `service_role_all` policy grants full access to the
service role and blocks all other roles by default.

---

## Indexes

| Index name                        | Columns      | Purpose                             |
| --------------------------------- | ------------ | ----------------------------------- |
| `idx_client_geo_scores_client_id` | `client_id`  | Fetch all months for a given client |
| `idx_client_geo_scores_month`     | `month DESC` | Order by most recent month          |

---

## Prisma Model

The `ClientGeoScore` Prisma model in `prisma/schema.prisma` maps to this table.
Run `npx prisma generate` after any schema change to regenerate the client.

---

## Related Files

- `lib/geo-score/types.ts` — TypeScript interfaces for this schema
- `lib/geo/types.ts` — Core GEO engine types (GEOScore, GEOAnalysis, etc.)
- `lib/citation/aggregator.ts` — Aggregation over GEO & citation engine tables
- `prisma/schema.prisma` → `ClientGeoScore` model
- `supabase/migrations/20260404000001_client_geo_scores.sql` — Migration
