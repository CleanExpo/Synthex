/**
 * Crawl → PageMetrics adapter (INFRA-1 contract).
 *
 * Defines the structural data a site crawl (Lighthouse + link/structure crawl) supplies,
 * and merges it non-destructively into PageMetrics produced by the GSC adapter.
 *
 * The crawl itself runs outside the skill (a crawler with live network egress). This module
 * is the *contract* + merge logic — real, type-checked, and unit-testable — so the moment a
 * crawl runs, its output drops straight into the scoring pipeline.
 */

import type { PageMetrics } from './types';

export interface CrawlPageData {
  url: string;
  /** Months since the page content last meaningfully changed (CMS/git). */
  monthsSinceUpdate?: number;
  /** Count of internal links pointing at this page. */
  inboundInternalLinks?: number;
  /** Clicks from the homepage to reach this page. */
  clickDepthFromHome?: number;
  /** 0..1 — does inbound anchor text contain the page's target topic? */
  anchorRelevance?: number;
  // Core Web Vitals (claim A2). Captured for reporting; not yet a PageMetrics input.
  lcpSeconds?: number;
  inpMs?: number;
  cls?: number;
}

/** CWV pass thresholds (claim A2 — CONFIRMED). */
export const CWV_THRESHOLDS = { lcpSeconds: 2.5, inpMs: 200, cls: 0.1 } as const;

export interface CwvVerdict {
  url: string;
  lcpPass: boolean | null;
  inpPass: boolean | null;
  clsPass: boolean | null;
  /** true only when all three measured metrics pass; null when none measured. */
  allPass: boolean | null;
}

export function cwvVerdict(c: CrawlPageData): CwvVerdict {
  const lcpPass = c.lcpSeconds === undefined ? null : c.lcpSeconds < CWV_THRESHOLDS.lcpSeconds;
  const inpPass = c.inpMs === undefined ? null : c.inpMs < CWV_THRESHOLDS.inpMs;
  const clsPass = c.cls === undefined ? null : c.cls < CWV_THRESHOLDS.cls;
  const measured = [lcpPass, inpPass, clsPass].filter(v => v !== null) as boolean[];
  return {
    url: c.url,
    lcpPass,
    inpPass,
    clsPass,
    allPass: measured.length === 0 ? null : measured.every(Boolean),
  };
}

/**
 * Merge crawl structural data into existing PageMetrics by URL.
 * Non-destructive: only fills fields the GSC adapter left undefined.
 */
export function mergeCrawlIntoMetrics(metrics: PageMetrics[], crawl: CrawlPageData[]): PageMetrics[] {
  const byUrl = new Map(crawl.map(c => [c.url, c]));
  return metrics.map(m => {
    const c = byUrl.get(m.url);
    if (!c) return m;
    return {
      ...m,
      monthsSinceUpdate: m.monthsSinceUpdate ?? c.monthsSinceUpdate,
      inboundInternalLinks: m.inboundInternalLinks ?? c.inboundInternalLinks,
      clickDepthFromHome: m.clickDepthFromHome ?? c.clickDepthFromHome,
      anchorRelevance: m.anchorRelevance ?? c.anchorRelevance,
    };
  });
}
