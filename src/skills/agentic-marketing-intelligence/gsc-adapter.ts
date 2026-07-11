/**
 * GSC → PageMetrics adapter (INFRA-2).
 *
 * Bridges the existing Google Search Console integration (lib/google/search-console.ts,
 * which returns `SearchAnalyticsRow { keys, clicks, impressions, ctr, position }` for
 * dimensions: ['page']) into the scoring models' `PageMetrics` shape.
 *
 * Deliberately decoupled: it accepts a structural row shape, NOT an import from app
 * `lib/`. The thin app-side glue calls `getSearchAnalytics(siteUrl, {dimensions:['page']})`
 * and passes `result.rows` here. Keeps the skill pure and unit-testable without the app.
 */

import type { FunnelStage, PageMetrics, PageType, SearchIntent } from './types';

/** Structurally compatible with lib/google/search-console.ts `SearchAnalyticsRow`. */
export interface GscAnalyticsRow {
  keys: string[]; // for dimensions:['page'], keys[0] is the page URL
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number; // 1..N
}

export interface GscPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Optional per-page enrichment the GSC feed can't provide (intent, funnel, business value). */
export interface PageClassification {
  project?: string;
  pageType?: PageType;
  funnelStage?: FunnelStage;
  serpDominantIntent?: SearchIntent;
  intentMatch?: number;
  authorityGap?: number;
  aiSearchRelevance?: number;
  marginWeight?: number;
  conversionProximity?: number;
  businessImportance?: number;
}

/** Map raw GSC page-dimension rows → GscPageRow[] (drops rows with no page key). */
export function gscRowsToPageRows(rows: GscAnalyticsRow[]): GscPageRow[] {
  return rows
    .filter(r => Array.isArray(r.keys) && r.keys.length > 0)
    .map(r => ({
      page: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));
}

export interface GscToMetricsInput {
  project: string;
  /** Current-period page rows (e.g. last 28 days). */
  current: GscPageRow[];
  /** Previous-period page rows (e.g. the 28 days before that) — enables decay/freshness. */
  previous?: GscPageRow[];
  /** Optional enrichment looked up per page URL. */
  classify?: (page: string) => PageClassification | undefined;
}

/**
 * Merge current + previous GSC page rows into PageMetrics[], keyed by URL.
 * Pages present only in `previous` are ignored (no longer ranking ⇒ not in current set).
 */
export function gscToPageMetrics(input: GscToMetricsInput): PageMetrics[] {
  const prevByPage = new Map(input.previous?.map(r => [r.page, r]) ?? []);

  return input.current.map(cur => {
    const prev = prevByPage.get(cur.page);
    const cls = input.classify?.(cur.page);

    const metrics: PageMetrics = {
      url: cur.page,
      project: cls?.project ?? input.project,
      impressions: cur.impressions,
      clicks: cur.clicks,
      ctr: cur.ctr,
      avgPosition: cur.position,
      prevImpressions: prev?.impressions,
      prevClicks: prev?.clicks,
      prevCtr: prev?.ctr,
      prevAvgPosition: prev?.position,
      pageType: cls?.pageType,
      funnelStage: cls?.funnelStage,
      serpDominantIntent: cls?.serpDominantIntent,
      intentMatch: cls?.intentMatch,
      authorityGap: cls?.authorityGap,
      aiSearchRelevance: cls?.aiSearchRelevance,
      marginWeight: cls?.marginWeight,
      conversionProximity: cls?.conversionProximity,
      businessImportance: cls?.businessImportance,
    };
    return metrics;
  });
}
