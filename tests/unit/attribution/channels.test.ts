/**
 * Unit tests — #7 channel-agnostic attribution layer.
 *
 * Asserts that the additive channel layer over the SYN-795 engine returns
 * results keyed by channel class (organic/owned/paid) for ≥2 attribution models
 * from the SAME touch input, with the `paid` bucket structurally present (the
 * v2 paid seam) even though v1 produces no paid touchpoints on real data.
 */

import {
  attributeByChannel,
  bucketByChannel,
  classifyChannel,
  CHANNEL_CLASSES,
  type ChannelClass,
} from '@/lib/attribution/channels';
import {
  runAttribution,
  type EventRow,
  type LeadRow,
} from '@/lib/attribution/engine';
import type { Prisma } from '@prisma/client';

// ── Fixtures (mirror engine.test.ts conventions) ──────────────────────────────

function dec(n: number): Prisma.Decimal {
  return { toNumber: () => n } as unknown as Prisma.Decimal;
}

const ORG = 'org-1';
const WINDOW_START = new Date('2026-03-01T00:00:00Z');
const WINDOW_END = new Date('2026-04-01T00:00:00Z');
const day = (d: number) =>
  new Date(`2026-03-${String(d).padStart(2, '0')}T12:00:00Z`);

function makeEvent(
  partial: Partial<EventRow> & { id: string; createdAt: Date }
): EventRow {
  return {
    id: partial.id,
    clientId: partial.clientId ?? ORG,
    eventType: partial.eventType ?? 'dashboard_visit',
    eventData: partial.eventData ?? {},
    sessionId: partial.sessionId ?? 'sess-default',
    createdAt: partial.createdAt,
  };
}

function makeLead(
  partial: Partial<LeadRow> & { id: string; occurredAt: Date }
): LeadRow {
  return {
    id: partial.id,
    organizationId: partial.organizationId ?? ORG,
    source: partial.source ?? null,
    medium: partial.medium ?? null,
    campaign: partial.campaign ?? null,
    occurredAt: partial.occurredAt,
    attributionWindowDays: partial.attributionWindowDays ?? 30,
    verifiedRevenueAud: partial.verifiedRevenueAud ?? null,
    revenueEstimateAud: partial.revenueEstimateAud ?? null,
    rawPayload: partial.rawPayload ?? {},
  };
}

/**
 * One lead with three touchpoints — one organic (no medium), one owned (email),
 * one paid (cpc) — all UTM-matched on source so they're all credited.
 */
function buildMixedChannelFixture(): { leads: LeadRow[]; events: EventRow[] } {
  const events: EventRow[] = [
    makeEvent({
      id: 'organic-1',
      createdAt: day(2),
      eventData: { utm_source: 'acme' }, // no medium → organic
    }),
    makeEvent({
      id: 'owned-1',
      createdAt: day(4),
      eventData: { utm_source: 'acme', utm_medium: 'email' }, // owned
    }),
    makeEvent({
      id: 'paid-1',
      createdAt: day(6),
      eventData: { utm_source: 'acme', utm_medium: 'cpc' }, // paid
    }),
  ];
  const leads: LeadRow[] = [
    makeLead({
      id: 'lead-1',
      occurredAt: day(10),
      source: 'acme', // matches all three by source-only UTM rule
      verifiedRevenueAud: dec(900),
    }),
  ];
  return { leads, events };
}

// ── classifyChannel ───────────────────────────────────────────────────────────

describe('classifyChannel', () => {
  it('maps paid mediums to paid', () => {
    for (const m of ['cpc', 'ppc', 'paidsocial', 'display', 'CPC']) {
      expect(classifyChannel(m)).toBe('paid');
    }
  });

  it('maps owned mediums to owned', () => {
    for (const m of ['email', 'newsletter', 'sms', 'EMAIL']) {
      expect(classifyChannel(m)).toBe('owned');
    }
  });

  it('falls back to organic for unknown / null / empty medium', () => {
    expect(classifyChannel(null)).toBe('organic');
    expect(classifyChannel(undefined)).toBe('organic');
    expect(classifyChannel('')).toBe('organic');
    expect(classifyChannel('social')).toBe('organic');
    expect(classifyChannel('referral')).toBe('organic');
  });
});

// ── bucketByChannel / attributeByChannel ──────────────────────────────────────

describe('channel-agnostic attribution', () => {
  it('returns ≥2 models, each bucketed by channel class, from the same input', () => {
    const { leads, events } = buildMixedChannelFixture();
    const results = attributeByChannel(
      {
        organizationId: ORG,
        windowStart: WINDOW_START,
        windowEnd: WINDOW_END,
        leads,
        events,
      },
      ['last-touch', 'linear']
    );

    // ≥2 models returned.
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.map(r => r.model).sort()).toEqual(['last-touch', 'linear']);

    for (const result of results) {
      // Every model exposes exactly one bucket per channel class, in order.
      expect(result.buckets.map(b => b.channel)).toEqual([...CHANNEL_CLASSES]);
      // The paid bucket is structurally present (the v2 seam).
      const paid = result.buckets.find(b => b.channel === 'paid');
      expect(paid).toBeDefined();
    }
  });

  it('last-touch credits 100% to the paid touch (latest); linear splits across classes', () => {
    const { leads, events } = buildMixedChannelFixture();
    const [lastTouch, linear] = attributeByChannel(
      {
        organizationId: ORG,
        windowStart: WINDOW_START,
        windowEnd: WINDOW_END,
        leads,
        events,
      },
      ['last-touch', 'linear']
    );

    const byClass = (
      r: { buckets: { channel: ChannelClass; attributedRevenueAud: number }[] }
    ): Record<ChannelClass, number> => {
      const out: Record<ChannelClass, number> = {
        organic: 0,
        owned: 0,
        paid: 0,
      };
      for (const b of r.buckets) out[b.channel] = b.attributedRevenueAud;
      return out;
    };

    // Last touch is the cpc (paid) event → all 900 lands in paid.
    const lt = byClass(lastTouch);
    expect(lt.paid).toBeCloseTo(900, 6);
    expect(lt.organic).toBeCloseTo(0, 6);
    expect(lt.owned).toBeCloseTo(0, 6);

    // Linear splits 900 equally across 3 touches → 300 to each class.
    const ln = byClass(linear);
    expect(ln.organic).toBeCloseTo(300, 6);
    expect(ln.owned).toBeCloseTo(300, 6);
    expect(ln.paid).toBeCloseTo(300, 6);

    // Both models conserve total revenue regardless of channel split.
    expect(lastTouch.totalAttributedRevenueAud).toBeCloseTo(900, 6);
    expect(linear.totalAttributedRevenueAud).toBeCloseTo(900, 6);
  });

  it('paid bucket is zero when no paid touchpoints exist (the v1 reality)', () => {
    // Same fixture minus the paid touch.
    const events: EventRow[] = [
      makeEvent({
        id: 'organic-1',
        createdAt: day(2),
        eventData: { utm_source: 'acme' },
      }),
      makeEvent({
        id: 'owned-1',
        createdAt: day(4),
        eventData: { utm_source: 'acme', utm_medium: 'email' },
      }),
    ];
    const leads: LeadRow[] = [
      makeLead({
        id: 'lead-1',
        occurredAt: day(10),
        source: 'acme',
        verifiedRevenueAud: dec(500),
      }),
    ];

    const attributions = runAttribution({
      organizationId: ORG,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      model: 'linear',
      leads,
      events,
    });
    const result = bucketByChannel('linear', attributions, events);

    // Paid still present in the shape, but zero — proves it slots in additively.
    const paid = result.buckets.find(b => b.channel === 'paid');
    expect(paid?.attributedRevenueAud).toBe(0);
    expect(paid?.touchpointCount).toBe(0);
    expect(result.totalAttributedRevenueAud).toBeCloseTo(500, 6);
  });
});
