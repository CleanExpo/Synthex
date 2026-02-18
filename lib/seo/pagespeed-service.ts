/**
 * PageSpeed Insights Service
 *
 * Provides comprehensive PageSpeed analysis including:
 * - On-demand URL analysis with Lighthouse scores and CWV data
 * - Field (CrUX) and Lab data extraction
 * - Opportunities and diagnostics from Lighthouse audits
 * - Historical analysis tracking via SEOAudit records
 * - Performance trend aggregation
 *
 * ENVIRONMENT VARIABLES (OPTIONAL):
 * - GOOGLE_PAGESPEED_API_KEY: For higher rate limits (PUBLIC, optional)
 */

import { prisma } from '@/lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

export interface FieldMetrics {
  lcp: number | null; // seconds
  cls: number | null;
  inp: number | null; // ms
  fid: number | null; // ms
  source: 'field';
}

export interface LabMetrics {
  lcp: number | null; // seconds
  cls: number | null;
  tbt: number | null; // ms (Total Blocking Time)
  speedIndex: number | null; // ms
  fcp: number | null; // seconds (First Contentful Paint)
  source: 'lab';
}

export interface PageSpeedOpportunity {
  title: string;
  description: string;
  savings: string | null; // e.g., "0.5s", "120 KiB"
}

export interface PageSpeedDiagnostic {
  title: string;
  description: string;
  displayValue: string | null;
}

export interface PageSpeedAnalysisResult {
  url: string;
  strategy: 'mobile' | 'desktop';
  fetchedAt: string;
  isDemo: boolean;

  // Lighthouse category scores (0-100)
  scores: {
    performance: number;
    seo: number;
    accessibility: number;
    bestPractices: number;
  };

  // Core Web Vitals
  fieldMetrics: FieldMetrics | null;
  labMetrics: LabMetrics;

  // Improvement suggestions
  opportunities: PageSpeedOpportunity[];
  diagnostics: PageSpeedDiagnostic[];
}

export interface PageSpeedHistoryEntry {
  id: number;
  url: string;
  date: string;
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
}

export interface PerformanceTrendPoint {
  date: string;
  avgPerformance: number;
  avgLcp: number | null;
  avgCls: number | null;
  avgInp: number | null;
}

// ============================================================================
// DEMO DATA
// ============================================================================

function getDemoAnalysisResult(url: string, strategy: 'mobile' | 'desktop'): PageSpeedAnalysisResult {
  const isMobile = strategy === 'mobile';
  return {
    url,
    strategy,
    fetchedAt: new Date().toISOString(),
    isDemo: true,
    scores: {
      performance: isMobile ? 72 : 89,
      seo: isMobile ? 91 : 95,
      accessibility: isMobile ? 88 : 92,
      bestPractices: isMobile ? 83 : 87,
    },
    fieldMetrics: {
      lcp: isMobile ? 3.2 : 1.8,
      cls: isMobile ? 0.12 : 0.05,
      inp: isMobile ? 280 : 150,
      fid: isMobile ? 45 : 20,
      source: 'field',
    },
    labMetrics: {
      lcp: isMobile ? 3.5 : 2.0,
      cls: isMobile ? 0.15 : 0.08,
      tbt: isMobile ? 450 : 120,
      speedIndex: isMobile ? 4200 : 1800,
      fcp: isMobile ? 2.1 : 1.2,
      source: 'lab',
    },
    opportunities: [
      {
        title: 'Reduce unused JavaScript',
        description: 'Reduce unused JavaScript and defer loading scripts until they are required to decrease bytes consumed by network activity.',
        savings: '0.8s',
      },
      {
        title: 'Serve images in next-gen formats',
        description: 'Image formats like WebP and AVIF often provide better compression than PNG or JPEG.',
        savings: '120 KiB',
      },
      {
        title: 'Eliminate render-blocking resources',
        description: 'Resources are blocking the first paint of your page. Consider inlining critical CSS/JS.',
        savings: '0.4s',
      },
      {
        title: 'Properly size images',
        description: 'Serve images that are appropriately-sized to save cellular data and improve load time.',
        savings: '95 KiB',
      },
      {
        title: 'Reduce initial server response time',
        description: 'Keep the server response time for the main document short because all other requests depend on it.',
        savings: '0.3s',
      },
    ],
    diagnostics: [
      {
        title: 'Avoid enormous network payloads',
        description: 'Large network payloads cost users real money and are highly correlated with long load times.',
        displayValue: 'Total size was 2,450 KiB',
      },
      {
        title: 'Minimize main-thread work',
        description: 'Consider reducing the time spent parsing, compiling, and executing JS.',
        displayValue: '3.2s',
      },
      {
        title: 'Avoid excessive DOM size',
        description: 'A large DOM will increase memory usage, cause longer style calculations, and produce costly layout reflows.',
        displayValue: '1,250 elements',
      },
      {
        title: 'Largest Contentful Paint element',
        description: 'This is the largest contentful element painted within the viewport.',
        displayValue: 'img.hero-image',
      },
      {
        title: 'Avoid long main-thread tasks',
        description: 'Lists the longest tasks on the main thread, useful for identifying worst contributors to input delay.',
        displayValue: '5 long tasks found',
      },
    ],
  };
}

// ============================================================================
// PAGESPEED ANALYSIS
// ============================================================================

/**
 * Run a PageSpeed Insights analysis on a URL.
 * Calls the PSI v5 API with all four categories.
 * Falls back to demo data if API unavailable.
 */
export async function runPageSpeedAnalysis(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<PageSpeedAnalysisResult> {
  try {
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
    const psiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    psiUrl.searchParams.set('url', url);
    psiUrl.searchParams.set('strategy', strategy);
    // append multiple categories
    psiUrl.searchParams.append('category', 'PERFORMANCE');
    psiUrl.searchParams.append('category', 'ACCESSIBILITY');
    psiUrl.searchParams.append('category', 'SEO');
    psiUrl.searchParams.append('category', 'BEST_PRACTICES');
    if (apiKey) psiUrl.searchParams.set('key', apiKey);

    const response = await fetch(psiUrl.toString(), {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.warn(`PageSpeed API returned ${response.status} for ${url} (${strategy})`);
      return getDemoAnalysisResult(url, strategy);
    }

    const psi = await response.json();

    // Extract Lighthouse category scores
    const categories = psi.lighthouseResult?.categories;
    const scores = {
      performance: Math.round((categories?.performance?.score || 0) * 100),
      seo: Math.round((categories?.seo?.score || 0) * 100),
      accessibility: Math.round((categories?.accessibility?.score || 0) * 100),
      bestPractices: Math.round((categories?.['best-practices']?.score || 0) * 100),
    };

    // Extract field data (CrUX) if available
    const fieldData = psi.loadingExperience?.metrics;
    let fieldMetrics: FieldMetrics | null = null;

    if (fieldData) {
      const hasAnyField =
        fieldData.LARGEST_CONTENTFUL_PAINT_MS?.percentile ||
        fieldData.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ||
        fieldData.INTERACTION_TO_NEXT_PAINT?.percentile ||
        fieldData.FIRST_INPUT_DELAY_MS?.percentile;

      if (hasAnyField) {
        fieldMetrics = {
          lcp: fieldData.LARGEST_CONTENTFUL_PAINT_MS?.percentile
            ? fieldData.LARGEST_CONTENTFUL_PAINT_MS.percentile / 1000
            : null,
          cls: fieldData.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
            ? fieldData.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
            : null,
          inp: fieldData.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
          fid: fieldData.FIRST_INPUT_DELAY_MS?.percentile ?? null,
          source: 'field',
        };
      }
    }

    // Extract lab data from Lighthouse audits
    const audits = psi.lighthouseResult?.audits;
    const labMetrics: LabMetrics = {
      lcp: audits?.['largest-contentful-paint']?.numericValue
        ? audits['largest-contentful-paint'].numericValue / 1000
        : null,
      cls: audits?.['cumulative-layout-shift']?.numericValue ?? null,
      tbt: audits?.['total-blocking-time']?.numericValue ?? null,
      speedIndex: audits?.['speed-index']?.numericValue ?? null,
      fcp: audits?.['first-contentful-paint']?.numericValue
        ? audits['first-contentful-paint'].numericValue / 1000
        : null,
      source: 'lab',
    };

    // Extract top 5 opportunities
    const opportunities: PageSpeedOpportunity[] = [];
    if (audits) {
      const opportunityAudits = Object.values(audits).filter(
        (audit: Record<string, unknown>) =>
          audit?.details &&
          (audit.details as Record<string, unknown>)?.type === 'opportunity' &&
          typeof audit.score === 'number' &&
          (audit.score as number) < 1
      );

      // Sort by score (lower = more impactful)
      opportunityAudits.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        (a.score as number) - (b.score as number)
      );

      for (const audit of opportunityAudits.slice(0, 5)) {
        const details = (audit as Record<string, unknown>).details as Record<string, unknown> | undefined;
        const overallSavingsMs = details?.overallSavingsMs as number | undefined;
        const overallSavingsBytes = details?.overallSavingsBytes as number | undefined;

        let savings: string | null = null;
        if (overallSavingsMs && overallSavingsMs > 0) {
          savings = `${(overallSavingsMs / 1000).toFixed(1)}s`;
        } else if (overallSavingsBytes && overallSavingsBytes > 0) {
          savings = `${Math.round(overallSavingsBytes / 1024)} KiB`;
        }

        opportunities.push({
          title: (audit as Record<string, unknown>).title as string,
          description: (audit as Record<string, unknown>).description as string,
          savings,
        });
      }
    }

    // Extract top 5 diagnostics
    const diagnostics: PageSpeedDiagnostic[] = [];
    if (audits) {
      const diagnosticAudits = Object.values(audits).filter(
        (audit: Record<string, unknown>) =>
          audit?.details &&
          (audit.details as Record<string, unknown>)?.type !== 'opportunity' &&
          typeof audit.score === 'number' &&
          (audit.score as number) < 1 &&
          (audit.score as number) !== null
      );

      diagnosticAudits.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        (a.score as number) - (b.score as number)
      );

      for (const audit of diagnosticAudits.slice(0, 5)) {
        diagnostics.push({
          title: (audit as Record<string, unknown>).title as string,
          description: (audit as Record<string, unknown>).description as string,
          displayValue: ((audit as Record<string, unknown>).displayValue as string) || null,
        });
      }
    }

    return {
      url,
      strategy,
      fetchedAt: new Date().toISOString(),
      isDemo: false,
      scores,
      fieldMetrics,
      labMetrics,
      opportunities,
      diagnostics,
    };
  } catch (error) {
    console.warn('PageSpeed analysis failed, returning demo data:', error);
    return getDemoAnalysisResult(url, strategy);
  }
}

// ============================================================================
// HISTORY
// ============================================================================

/**
 * Get PageSpeed analysis history from stored SEOAudit records.
 * Queries audits of type 'pagespeed' for the given user.
 */
export async function getPageSpeedHistory(
  userId: string,
  limit: number = 20
): Promise<PageSpeedHistoryEntry[]> {
  const audits = await prisma.sEOAudit.findMany({
    where: {
      userId,
      auditType: 'pagespeed',
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      url: true,
      createdAt: true,
      overallScore: true,
      technicalScore: true,
      rawData: true,
    },
    take: limit,
  });

  return audits.map((audit) => {
    const technicalScore = audit.technicalScore as Record<string, number> | null;
    const rawData = audit.rawData as Record<string, unknown> | null;
    const cwv = rawData?.cwv as Record<string, number | null> | undefined;

    return {
      id: audit.id,
      url: audit.url,
      date: audit.createdAt.toISOString(),
      performanceScore: technicalScore?.performance ?? audit.overallScore,
      seoScore: technicalScore?.seo ?? 0,
      accessibilityScore: technicalScore?.accessibility ?? 0,
      bestPracticesScore: technicalScore?.bestPractices ?? 0,
      lcp: cwv?.lcp ?? null,
      cls: cwv?.cls ?? null,
      inp: cwv?.inp ?? null,
    };
  });
}

// ============================================================================
// TRENDS
// ============================================================================

/**
 * Get performance trend data aggregated by date.
 * Returns daily averages for performance score, LCP, CLS, INP.
 */
export async function getPerformanceTrends(
  userId: string,
  days: number = 30
): Promise<PerformanceTrendPoint[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const audits = await prisma.sEOAudit.findMany({
    where: {
      userId,
      auditType: 'pagespeed',
      createdAt: {
        gte: startDate,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      createdAt: true,
      overallScore: true,
      technicalScore: true,
      rawData: true,
    },
    take: 500,
  });

  // Group by date string (YYYY-MM-DD)
  const grouped: Record<
    string,
    {
      performances: number[];
      lcps: number[];
      clss: number[];
      inps: number[];
    }
  > = {};

  for (const audit of audits) {
    const dateKey = audit.createdAt.toISOString().split('T')[0];

    if (!grouped[dateKey]) {
      grouped[dateKey] = { performances: [], lcps: [], clss: [], inps: [] };
    }

    const technicalScore = audit.technicalScore as Record<string, number> | null;
    const rawData = audit.rawData as Record<string, unknown> | null;
    const cwv = rawData?.cwv as Record<string, number | null> | undefined;

    grouped[dateKey].performances.push(technicalScore?.performance ?? audit.overallScore);

    if (cwv?.lcp != null) grouped[dateKey].lcps.push(cwv.lcp);
    if (cwv?.cls != null) grouped[dateKey].clss.push(cwv.cls);
    if (cwv?.inp != null) grouped[dateKey].inps.push(cwv.inp);
  }

  // Calculate averages
  const trends: PerformanceTrendPoint[] = [];

  for (const [date, data] of Object.entries(grouped)) {
    const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    trends.push({
      date,
      avgPerformance: Math.round(avg(data.performances) ?? 0),
      avgLcp: avg(data.lcps) !== null ? Number((avg(data.lcps) as number).toFixed(2)) : null,
      avgCls: avg(data.clss) !== null ? Number((avg(data.clss) as number).toFixed(3)) : null,
      avgInp: avg(data.inps) !== null ? Math.round(avg(data.inps) as number) : null,
    });
  }

  return trends;
}
