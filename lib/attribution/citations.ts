/**
 * Attribution citations — SYN-315
 *
 * Builds a per-action "why this number" provenance trail for the ROI
 * Attribution report from the signals already stored on each recommended
 * action's `attribution_context` (SYN-623). Pure — no DB access, no new data:
 * every citation names a concrete source signal already flowing through the
 * report so an operator can see exactly what produced an attributed figure.
 *
 * NOTE on placement: the multi-touch engine (`./engine.ts`) carries its own
 * per-touchpoint provenance for the live lead → touchpoint path, but that path
 * never reaches this report. The ROI report reads
 * `recommended_actions.attribution_context`, so its provenance is derived here
 * from those stored signals — not from the engine's touchpoints.
 */

import type { AttributionCitation, AttributionContext } from './types';

const CONTENT_TYPE_LABELS: Record<string, string> = {
  social_post: 'social post',
  review_response: 'review response',
  blog_article: 'blog article',
  google_post: 'Google post',
  email_campaign: 'email campaign',
};

function formatAud(value: number): string {
  return `$${value.toLocaleString('en-AU')}`;
}

/**
 * Derive the provenance trail for one attributed action from its stored
 * attribution context. Ordered most load-bearing signal first
 * (revenue → enquiries → content → tracking → window → GA4 → confidence).
 * Empty only when the context carries no usable signal.
 *
 * Defensive `typeof` guards protect against malformed JSONB rows; the input is
 * the documented `AttributionContext` shape but arrives from an untyped column.
 */
export function buildAttributionCitations(
  ctx: AttributionContext | null | undefined
): AttributionCitation[] {
  if (!ctx || typeof ctx !== 'object') return [];
  const citations: AttributionCitation[] = [];

  if (typeof ctx.trackedRevenue === 'number' && ctx.trackedRevenue > 0) {
    citations.push({
      signal: 'revenue',
      label: 'Tracked revenue',
      detail: `${formatAud(ctx.trackedRevenue)} in conversions attributed to this action`,
    });
  }

  if (typeof ctx.trackedEnquiries === 'number' && ctx.trackedEnquiries > 0) {
    const plural = ctx.trackedEnquiries === 1 ? 'enquiry' : 'enquiries';
    citations.push({
      signal: 'enquiries',
      label: 'Tracked enquiries',
      detail: `${ctx.trackedEnquiries} ${plural} recorded`,
    });
  }

  if (ctx.contentType) {
    const label = CONTENT_TYPE_LABELS[ctx.contentType] ?? ctx.contentType;
    citations.push({
      signal: 'content',
      label: 'Source content',
      detail: ctx.contentId ? `${label} (#${ctx.contentId})` : label,
    });
  }

  if (ctx.utmParams && typeof ctx.utmParams === 'object') {
    const { utm_source, utm_medium, utm_campaign, utm_content } = ctx.utmParams;
    const parts = [
      `utm_source=${utm_source}`,
      `utm_medium=${utm_medium}`,
      `utm_campaign=${utm_campaign}`,
    ];
    if (utm_content) parts.push(`utm_content=${utm_content}`);
    citations.push({
      signal: 'utm',
      label: 'Tracking record',
      detail: parts.join(' · '),
    });
  }

  if (typeof ctx.attributionWindowDays === 'number') {
    citations.push({
      signal: 'window',
      label: 'Attribution window',
      detail: `${ctx.attributionWindowDays}-day conversion window`,
    });
  }

  if (typeof ctx.ga4Connected === 'boolean') {
    citations.push({
      signal: 'ga4',
      label: 'Analytics source',
      detail: ctx.ga4Connected
        ? 'GA4 connected — conversions verified'
        : 'GA4 not connected — awaiting verified data',
    });
  }

  if (typeof ctx.predictedConversionProbability === 'number') {
    const pct = Math.round(ctx.predictedConversionProbability * 100);
    citations.push({
      signal: 'confidence',
      label: 'Model confidence',
      detail: `${pct}% predicted conversion probability`,
    });
  }

  return citations;
}
