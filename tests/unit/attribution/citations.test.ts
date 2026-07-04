/**
 * Unit tests — SYN-315 attribution citations.
 *
 * Asserts that the ROI Attribution report's per-row provenance trail is built
 * from the real stored `attribution_context` signals: a populated context
 * yields a non-empty, ordered citation trail naming its concrete sources, and
 * an empty/absent context yields no citations (no fabricated provenance).
 */

import { buildAttributionCitations } from '@/lib/attribution/citations';
import type { AttributionContext } from '@/lib/attribution/types';

describe('buildAttributionCitations', () => {
  it('builds a non-empty, ordered citation trail from a populated context', () => {
    const ctx: AttributionContext = {
      contentId: 'post-123',
      contentType: 'blog_article',
      predictedConversionProbability: 0.72,
      utmParams: {
        utm_source: 'google',
        utm_medium: 'organic',
        utm_campaign: 'spring-sale',
        utm_content: 'hero-cta',
      },
      attributionWindowDays: 30,
      ga4Connected: true,
      trackedRevenue: 1500,
      trackedEnquiries: 3,
    };

    const citations = buildAttributionCitations(ctx);

    // Non-empty trail (the core SYN-315 guarantee).
    expect(citations.length).toBeGreaterThan(0);

    // Ordered most load-bearing signal first.
    expect(citations[0].signal).toBe('revenue');
    expect(citations.map(c => c.signal)).toEqual([
      'revenue',
      'enquiries',
      'content',
      'utm',
      'window',
      'ga4',
      'confidence',
    ]);

    // Each citation names a concrete source drawn from the stored signals.
    const bySignal = Object.fromEntries(citations.map(c => [c.signal, c]));
    expect(bySignal.revenue.detail).toContain('$1,500');
    expect(bySignal.enquiries.detail).toContain('3 enquiries');
    expect(bySignal.content.detail).toContain('blog article');
    expect(bySignal.content.detail).toContain('post-123');
    expect(bySignal.utm.detail).toContain('utm_campaign=spring-sale');
    expect(bySignal.utm.detail).toContain('utm_content=hero-cta');
    expect(bySignal.window.detail).toContain('30-day');
    expect(bySignal.ga4.detail).toContain('GA4 connected');
    expect(bySignal.confidence.detail).toContain('72%');
  });

  it('uses the singular for a single enquiry and omits GA4 verification when disconnected', () => {
    const ctx: AttributionContext = {
      contentType: 'social_post',
      trackedEnquiries: 1,
      ga4Connected: false,
    };

    const citations = buildAttributionCitations(ctx);
    const bySignal = Object.fromEntries(citations.map(c => [c.signal, c]));

    expect(bySignal.enquiries.detail).toContain('1 enquiry recorded');
    expect(bySignal.ga4.detail).toContain('GA4 not connected');
    // Zero-value revenue signal is not fabricated.
    expect(bySignal.revenue).toBeUndefined();
  });

  it('returns no citations for an absent or empty context', () => {
    expect(buildAttributionCitations(null)).toEqual([]);
    expect(buildAttributionCitations(undefined)).toEqual([]);
    expect(buildAttributionCitations({})).toEqual([]);
    // A zero-revenue-only context carries no usable positive signal.
    expect(buildAttributionCitations({ trackedRevenue: 0 })).toEqual([]);
  });
});
