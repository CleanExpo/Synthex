/**
 * Channel-agnostic attribution layer — #7 paid-ready architecture (extension point)
 *
 * The SYN-795 engine (`./engine.ts`) already attributes revenue across
 * touchpoints under four models (first-touch, last-touch, linear, time-decay),
 * but its output is keyed by *touchpoint* (eventType / matchMethod) — it has no
 * notion of a marketing **channel class**.
 *
 * This module is the additive seam that rolls the engine's per-touchpoint output
 * up by channel class — `organic | owned | paid` — without touching the engine.
 * It is deliberately channel-AGNOSTIC: the same roll-up handles every class, so
 * when native paid execution lands in v2 (see `./reserved-ad-shape.ts`) the only
 * change required is that paid touchpoints start arriving with a `paid` medium —
 * the bucketing, the per-model results, and the report slot all work unchanged.
 *
 * NOTE — extension point only (founder decision §14-1). No ad execution, no ad
 * API calls, no schema change. Today the `paid` bucket is structurally present
 * but resolves to zero on real data because no paid touchpoints exist yet.
 *
 * Additive guarantee: nothing here mutates the engine or its single-/multi-touch
 * path; this is a pure read-side projection over `LeadAttribution[]`.
 */

import {
  runAttribution,
  type AttributionModel,
  type EngineInput,
  type EventRow,
  type LeadAttribution,
} from './engine';

// ── Channel class ─────────────────────────────────────────────────────────────

/**
 * The channel CLASS a touchpoint belongs to. This is a different axis from
 * `MarketingChannel` (Instagram/Facebook/…) in `lib/industries/taxonomy.ts`:
 * that names the *platform*, this names *who paid for the reach*.
 *
 *   - organic  — earned reach (SEO, social reach, referral, direct)
 *   - owned    — channels the brand controls (email, owned blog, GBP posts)
 *   - paid     — bought reach (search ads, social ads) — RESERVED for v2
 */
export type ChannelClass = 'organic' | 'owned' | 'paid';

export const CHANNEL_CLASSES: readonly ChannelClass[] = [
  'organic',
  'owned',
  'paid',
] as const;

/**
 * UTM mediums that map to the `paid` class. Kept as a set so v2 paid execution
 * only has to ensure its touchpoints carry one of these mediums to slot in.
 */
const PAID_MEDIUMS = new Set([
  'cpc',
  'ppc',
  'paid',
  'paidsocial',
  'paid-social',
  'paid_social',
  'display',
  'cpm',
  'banner',
  'retargeting',
  'remarketing',
]);

/** UTM mediums that map to the `owned` class (brand-controlled distribution). */
const OWNED_MEDIUMS = new Set([
  'email',
  'newsletter',
  'sms',
  'push',
  'owned',
  'gbp',
  'google_business',
]);

/**
 * Classify a touchpoint into a channel class from its UTM medium.
 *
 * Channel-agnostic by construction: an unknown / null medium falls back to
 * `organic` (earned), so legacy touchpoints captured before any paid spend keep
 * working. This is the single place that decides "is this touch paid?", so the
 * v2 paid seam only has to feed mediums that land in `PAID_MEDIUMS`.
 */
export function classifyChannel(utmMedium: string | null | undefined): ChannelClass {
  if (!utmMedium) return 'organic';
  const normalised = utmMedium.trim().toLowerCase();
  if (PAID_MEDIUMS.has(normalised)) return 'paid';
  if (OWNED_MEDIUMS.has(normalised)) return 'owned';
  return 'organic';
}

// ── Channel-bucketed result ───────────────────────────────────────────────────

/** Attributed revenue + touch count for a single channel class under one model. */
export interface ChannelBucket {
  channel: ChannelClass;
  /** Revenue attributed to touchpoints in this channel class (AUD). */
  attributedRevenueAud: number;
  /** Number of credited touchpoints in this class. */
  touchpointCount: number;
}

/** One attribution model's results, rolled up by channel class. */
export interface ChannelAttributionResult {
  model: AttributionModel;
  /** Always one bucket per class (organic/owned/paid), in CHANNEL_CLASSES order. */
  buckets: ChannelBucket[];
  /** Total attributed revenue across all classes (AUD). */
  totalAttributedRevenueAud: number;
}

/**
 * Look up a touchpoint's UTM medium from the engine input events.
 *
 * The engine deliberately drops `eventData` from its `Touchpoint` output, so to
 * stay purely additive (no engine change) we resolve the medium here from the
 * same `events` array, keyed by eventId.
 */
function buildMediumIndex(events: EventRow[]): Map<string, string | null> {
  const index = new Map<string, string | null>();
  for (const event of events) {
    const data = event.eventData;
    let medium: string | null = null;
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
      const value = (data as { [k: string]: unknown }).utm_medium;
      medium = typeof value === 'string' ? value : null;
    }
    index.set(event.id, medium);
  }
  return index;
}

/**
 * Roll a single model's `LeadAttribution[]` up by channel class.
 *
 * Pure: takes the engine's already-computed attributions plus the events used to
 * produce them (for medium lookup). Always returns exactly one bucket per class
 * so downstream renderers can rely on a stable shape (paid present even at zero).
 */
export function bucketByChannel(
  model: AttributionModel,
  attributions: LeadAttribution[],
  events: EventRow[]
): ChannelAttributionResult {
  const mediumByEventId = buildMediumIndex(events);

  const revenueByClass: Record<ChannelClass, number> = {
    organic: 0,
    owned: 0,
    paid: 0,
  };
  const countByClass: Record<ChannelClass, number> = {
    organic: 0,
    owned: 0,
    paid: 0,
  };

  for (const lead of attributions) {
    for (const touch of lead.touchpoints) {
      const channel = classifyChannel(mediumByEventId.get(touch.eventId));
      revenueByClass[channel] += touch.attributedRevenueAud;
      countByClass[channel] += 1;
    }
  }

  const buckets: ChannelBucket[] = CHANNEL_CLASSES.map(channel => ({
    channel,
    attributedRevenueAud: revenueByClass[channel],
    touchpointCount: countByClass[channel],
  }));

  return {
    model,
    buckets,
    totalAttributedRevenueAud:
      revenueByClass.organic + revenueByClass.owned + revenueByClass.paid,
  };
}

/**
 * Run the existing engine across one or more models and return each model's
 * results rolled up by channel class.
 *
 * This is the channel-agnostic entry point: callers get ≥2 attribution models
 * (whatever they pass; defaults to last-touch + linear) over the SAME touch
 * input, each bucketed identically by organic/owned/paid. The existing
 * single-model `runAttribution` path is untouched and still callable directly.
 */
export function attributeByChannel(
  input: Omit<EngineInput, 'model'>,
  models: readonly AttributionModel[] = ['last-touch', 'linear']
): ChannelAttributionResult[] {
  return models.map(model => {
    const attributions = runAttribution({ ...input, model });
    return bucketByChannel(model, attributions, input.events);
  });
}
