import type { DesignIssue, CoreWebVitals } from './types';
import { logger } from '@/lib/logger';

export async function checkPerformance(url: string): Promise<{ score: number; metrics: CoreWebVitals; issues: DesignIssue[] }> {
  const defaultResult = {
    score: 0,
    metrics: { lcp: 0, inp: 0, cls: 0, performanceScore: 0, accessibilityScore: 0 },
    issues: [] as DesignIssue[],
  };

  if (!url) return defaultResult;

  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('PageSpeed API returned non-OK status', { status: response.status, url });
      return { ...defaultResult, issues: [{ type: 'warning', category: 'performance', message: 'Could not fetch PageSpeed data', penalty: 0 }] };
    }

    const data = await response.json() as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number }>;
        audits?: Record<string, { numericValue?: number }>;
      };
    };
    const categories = data.lighthouseResult?.categories ?? {};
    const audits = data.lighthouseResult?.audits ?? {};

    const performanceScore = Math.round((categories['performance']?.score ?? 0) * 100);
    const accessibilityScore = Math.round((categories['accessibility']?.score ?? 0) * 100);
    const lcp = audits['largest-contentful-paint']?.numericValue
      ? (audits['largest-contentful-paint'].numericValue ?? 0) / 1000
      : 0;
    const inp = audits['experimental-interaction-to-next-paint']?.numericValue
      ?? audits['total-blocking-time']?.numericValue
      ?? 0;
    const cls = audits['cumulative-layout-shift']?.numericValue ?? 0;

    const metrics: CoreWebVitals = { lcp, inp, cls, performanceScore, accessibilityScore };

    // Normalise score 0-15
    let score = 0;
    if (performanceScore >= 90) score = 15;
    else if (performanceScore >= 50) score = 10;
    else if (performanceScore >= 25) score = 5;

    const issues: DesignIssue[] = [];
    if (lcp > 2.5) issues.push({ type: 'warning', category: 'performance', message: `LCP ${lcp.toFixed(1)}s exceeds 2.5s target`, penalty: 3 });
    if (cls > 0.1) issues.push({ type: 'warning', category: 'performance', message: `CLS ${cls.toFixed(3)} exceeds 0.1 target`, penalty: 3 });
    if (inp > 200) issues.push({ type: 'warning', category: 'performance', message: `INP ${inp}ms exceeds 200ms target`, penalty: 3 });

    return { score, metrics, issues };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.warn('PageSpeed API timeout', { url });
    } else {
      logger.warn('PageSpeed API error', { url, err: String(err) });
    }
    return { ...defaultResult, issues: [{ type: 'info', category: 'performance', message: 'PageSpeed data unavailable', penalty: 0 }] };
  }
}
