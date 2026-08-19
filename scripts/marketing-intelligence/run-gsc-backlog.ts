/**
 * Live entry point — wires the existing GSC integration into the
 * agentic-marketing-intelligence scoring pipeline (SYN-989 / INFRA-2).
 *
 * Fetches current + previous 28-day page analytics from Google Search Console,
 * maps them to PageMetrics, runs the scoring models, and prints a prioritised,
 * risk-gated backlog.
 *
 * Run:
 *   npx tsx scripts/marketing-intelligence/run-gsc-backlog.ts <siteUrl> [project]
 *
 * Without GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON the GSC lib returns DEMO data — the
 * script still runs end-to-end (proving the wiring) and clearly labels the output as demo.
 * It never publishes anything; it only prepares a backlog for human review.
 */

import {
  getSearchAnalytics,
  type SearchAnalyticsOptions,
} from '../../lib/google/search-console';
import {
  gscRowsToPageRows,
  gscToPageMetrics,
} from '../../lib/marketing-intelligence/gsc-adapter';
import { buildBacklog } from '../../lib/marketing-intelligence/pipeline';

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

async function main() {
  const siteUrl = process.argv[2] ?? 'https://synthex.social/';
  const project = process.argv[3] ?? 'Synthex';
  const isDemo = !process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON;

  const pageOpts = (start: string, end: string): SearchAnalyticsOptions => ({
    dimensions: ['page'],
    rowLimit: 1000,
    startDate: start,
    endDate: end,
  });

  // Current 28-day window and the 28 days before it (for decay/freshness).
  const [current, previous] = await Promise.all([
    getSearchAnalytics(siteUrl, pageOpts(dateDaysAgo(28), dateDaysAgo(0))),
    getSearchAnalytics(siteUrl, pageOpts(dateDaysAgo(56), dateDaysAgo(29))),
  ]);

  const metrics = gscToPageMetrics({
    project,
    current: gscRowsToPageRows(current.rows),
    previous: gscRowsToPageRows(previous.rows),
  });

  const { prioritised, summary } = buildBacklog(metrics, {
    // GSC CTR/decay work leans on the NavBoost (CTR) + freshness claims.
    claimConfidence: 'INFERRED',
    riskScore: 0.2,
    effort: 'S',
  });

  const report = {
    siteUrl,
    project,
    data_source: isDemo
      ? 'DEMO (no GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON set)'
      : 'LIVE GSC',
    pages_scored: metrics.length,
    summary,
    top_backlog: prioritised.slice(0, 10),
    note: 'Prepared for human review. Nothing is published. Pages without enrichment (intent/funnel) score PARTIAL by design.',
  };

  console.log(JSON.stringify(report, null, 2));
  if (isDemo) {
    console.error(
      '\n[!] DEMO DATA — set GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON for live GSC metrics.'
    );
  }
}

main().catch(err => {
  console.error('run-gsc-backlog failed:', err);
  process.exit(1);
});
