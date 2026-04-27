/**
 * Unit tests — SYN-795 multi-touch attribution engine.
 *
 * The engine is pure — we build in-memory fixtures and assert on credit
 * shares, attributed revenue, and match methods for each of the four models.
 */

import {
  runAttribution,
  type EventRow,
  type LeadRow,
  type AttributionModel,
} from '@/lib/attribution/engine';
import type { Prisma } from '@prisma/client';

// ── Decimal shim ──────────────────────────────────────────────────────────────
// Prisma.Decimal in runtime is a Decimal.js instance. For fixtures we only
// need a .toNumber() method that the engine calls. Casting through unknown
// keeps us off `as any`.

function dec(n: number): Prisma.Decimal {
  return { toNumber: () => n } as unknown as Prisma.Decimal;
}

// ── Fixture builders ──────────────────────────────────────────────────────────

const ORG = 'org-1';
const WINDOW_START = new Date('2026-03-01T00:00:00Z');
const WINDOW_END = new Date('2026-04-01T00:00:00Z');

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

// Canonical fixture: 20 touchpoints, 5 leads spread over the window.
function buildFixture(): { leads: LeadRow[]; events: EventRow[] } {
  const day = (d: number) =>
    new Date(`2026-03-${String(d).padStart(2, '0')}T12:00:00Z`);

  const events: EventRow[] = [
    // Lead A — UTM match (google/cpc/autumn_sale), 4 touches
    makeEvent({
      id: 'e1',
      createdAt: day(2),
      eventData: {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'autumn_sale',
      },
    }),
    makeEvent({
      id: 'e2',
      createdAt: day(5),
      eventData: {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'autumn_sale',
      },
    }),
    makeEvent({
      id: 'e3',
      createdAt: day(8),
      eventData: {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'autumn_sale',
      },
    }),
    makeEvent({
      id: 'e4',
      createdAt: day(9),
      eventData: {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'autumn_sale',
      },
    }),

    // Lead B — session fingerprint match, 3 touches
    makeEvent({ id: 'e5', createdAt: day(11), sessionId: 'sess-B' }),
    makeEvent({ id: 'e6', createdAt: day(12), sessionId: 'sess-B' }),
    makeEvent({ id: 'e7', createdAt: day(13), sessionId: 'sess-B' }),

    // Lead C — time-fallback (no UTM, no session match), 5 touches
    makeEvent({ id: 'e8', createdAt: day(14) }),
    makeEvent({ id: 'e9', createdAt: day(15) }),
    makeEvent({ id: 'e10', createdAt: day(16) }),
    makeEvent({ id: 'e11', createdAt: day(17) }),
    makeEvent({ id: 'e12', createdAt: day(18) }),

    // Lead D — UTM match (facebook/social), 2 touches
    makeEvent({
      id: 'e13',
      createdAt: day(20),
      eventData: { utm_source: 'facebook', utm_medium: 'social' },
    }),
    makeEvent({
      id: 'e14',
      createdAt: day(21),
      eventData: { utm_source: 'facebook', utm_medium: 'social' },
    }),

    // Lead E — no matching events (outside window by attribution). 6 misc touches.
    makeEvent({
      id: 'e15',
      createdAt: day(25),
      eventData: { utm_source: 'other' },
    }),
    makeEvent({
      id: 'e16',
      createdAt: day(25),
      eventData: { utm_source: 'other' },
    }),
    makeEvent({
      id: 'e17',
      createdAt: day(26),
      eventData: { utm_source: 'other' },
    }),
    makeEvent({
      id: 'e18',
      createdAt: day(26),
      eventData: { utm_source: 'other' },
    }),
    makeEvent({
      id: 'e19',
      createdAt: day(27),
      eventData: { utm_source: 'other' },
    }),
    makeEvent({
      id: 'e20',
      createdAt: day(28),
      eventData: { utm_source: 'other' },
    }),
  ];

  const leads: LeadRow[] = [
    makeLead({
      id: 'lead-A',
      occurredAt: day(10),
      source: 'google',
      medium: 'cpc',
      campaign: 'autumn_sale',
      verifiedRevenueAud: dec(1000),
    }),
    makeLead({
      id: 'lead-B',
      occurredAt: day(14),
      rawPayload: { sessionId: 'sess-B' },
      verifiedRevenueAud: dec(500),
    }),
    makeLead({
      id: 'lead-C',
      occurredAt: day(19),
      verifiedRevenueAud: dec(2000),
    }),
    makeLead({
      id: 'lead-D',
      occurredAt: day(22),
      source: 'facebook',
      medium: 'social',
      verifiedRevenueAud: dec(300),
    }),
    makeLead({
      id: 'lead-E',
      occurredAt: day(1), // before any events — attribution window finds nothing
      source: 'newsletter',
      attributionWindowDays: 0, // force empty window
      verifiedRevenueAud: dec(999),
    }),
  ];

  return { leads, events };
}

function run(model: AttributionModel) {
  const { leads, events } = buildFixture();
  return runAttribution({
    organizationId: ORG,
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    model,
    leads,
    events,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('attribution engine — match cascade', () => {
  it('prefers UTM match over session and time fallback', () => {
    const results = run('linear');
    const leadA = results.find(r => r.leadId === 'lead-A');
    expect(leadA).toBeDefined();
    expect(leadA?.touchpoints.every(t => t.matchMethod === 'utm')).toBe(true);
    expect(leadA?.touchpoints.map(t => t.eventId).sort()).toEqual([
      'e1',
      'e2',
      'e3',
      'e4',
    ]);
  });

  it('falls back to session match when no UTM match exists', () => {
    const results = run('linear');
    const leadB = results.find(r => r.leadId === 'lead-B');
    expect(leadB?.touchpoints.every(t => t.matchMethod === 'session')).toBe(
      true
    );
    expect(leadB?.touchpoints.length).toBe(3);
  });

  it('falls back to time-bounded events when neither UTM nor session matches', () => {
    const results = run('linear');
    const leadC = results.find(r => r.leadId === 'lead-C');
    expect(leadC?.touchpoints.length).toBeGreaterThan(0);
    expect(
      leadC?.touchpoints.every(t => t.matchMethod === 'time-fallback')
    ).toBe(true);
  });

  it('returns zero touchpoints when the lead window covers no events', () => {
    const results = run('linear');
    const leadE = results.find(r => r.leadId === 'lead-E');
    expect(leadE?.touchpoints).toEqual([]);
    expect(leadE?.attributedRevenueAud).toBe(0);
  });
});

describe('attribution engine — first-touch', () => {
  it('gives 100% credit to the earliest matched touchpoint', () => {
    const results = run('first-touch');
    const leadA = results.find(r => r.leadId === 'lead-A');
    expect(leadA?.touchpoints[0]?.creditShare).toBe(1);
    expect(leadA?.touchpoints[0]?.eventId).toBe('e1');
    expect(leadA?.touchpoints.slice(1).every(t => t.creditShare === 0)).toBe(
      true
    );
    expect(leadA?.attributedRevenueAud).toBeCloseTo(1000, 6);
  });
});

describe('attribution engine — last-touch', () => {
  it('gives 100% credit to the latest matched touchpoint', () => {
    const results = run('last-touch');
    const leadA = results.find(r => r.leadId === 'lead-A');
    const tps = leadA?.touchpoints ?? [];
    expect(tps[tps.length - 1]?.creditShare).toBe(1);
    expect(tps[tps.length - 1]?.eventId).toBe('e4');
    expect(tps.slice(0, -1).every(t => t.creditShare === 0)).toBe(true);
    expect(leadA?.attributedRevenueAud).toBeCloseTo(1000, 6);
  });
});

describe('attribution engine — linear', () => {
  it('splits credit equally across touchpoints', () => {
    const results = run('linear');
    const leadA = results.find(r => r.leadId === 'lead-A');
    const n = leadA?.touchpoints.length ?? 0;
    expect(n).toBe(4);
    for (const t of leadA?.touchpoints ?? []) {
      expect(t.creditShare).toBeCloseTo(0.25, 6);
      expect(t.attributedRevenueAud).toBeCloseTo(250, 6);
    }
    expect(leadA?.attributedRevenueAud).toBeCloseTo(1000, 6);
  });
});

describe('attribution engine — time-decay', () => {
  it('weights later touches higher and sums to 1', () => {
    const results = run('time-decay');
    const leadA = results.find(r => r.leadId === 'lead-A');
    const tps = leadA?.touchpoints ?? [];
    expect(tps.length).toBe(4);

    // Shares sum to 1
    const totalShare = tps.reduce((s, t) => s + t.creditShare, 0);
    expect(totalShare).toBeCloseTo(1, 6);

    // Monotonic non-decreasing shares (recent events ≥ earlier events)
    for (let i = 1; i < tps.length; i++) {
      expect(tps[i].creditShare).toBeGreaterThanOrEqual(tps[i - 1].creditShare);
    }

    // Attributed revenue should equal the lead's revenue
    expect(leadA?.attributedRevenueAud).toBeCloseTo(1000, 6);
  });
});

describe('attribution engine — edge cases', () => {
  it('returns empty output when there are no events', () => {
    const leads = buildFixture().leads;
    const results = runAttribution({
      organizationId: ORG,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      model: 'time-decay',
      leads,
      events: [],
    });
    expect(results).toHaveLength(leads.length);
    expect(results.every(r => r.touchpoints.length === 0)).toBe(true);
    expect(results.every(r => r.attributedRevenueAud === 0)).toBe(true);
  });

  it('returns empty output when there are no leads', () => {
    const events = buildFixture().events;
    const results = runAttribution({
      organizationId: ORG,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      model: 'linear',
      leads: [],
      events,
    });
    expect(results).toEqual([]);
  });

  it('single touchpoint gets 100% credit under every model', () => {
    const lead = makeLead({
      id: 'solo',
      occurredAt: new Date('2026-03-10T12:00:00Z'),
      source: 'google',
      verifiedRevenueAud: dec(400),
    });
    const event = makeEvent({
      id: 'e-solo',
      createdAt: new Date('2026-03-09T12:00:00Z'),
      eventData: { utm_source: 'google' },
    });
    const models: AttributionModel[] = [
      'first-touch',
      'last-touch',
      'linear',
      'time-decay',
    ];
    for (const model of models) {
      const results = runAttribution({
        organizationId: ORG,
        windowStart: WINDOW_START,
        windowEnd: WINDOW_END,
        model,
        leads: [lead],
        events: [event],
      });
      expect(results[0].touchpoints).toHaveLength(1);
      expect(results[0].touchpoints[0].creditShare).toBeCloseTo(1, 6);
      expect(results[0].attributedRevenueAud).toBeCloseTo(400, 6);
    }
  });

  it('overlapping leads within the window each claim their matching events', () => {
    const day = (d: number) =>
      new Date(`2026-03-${String(d).padStart(2, '0')}T12:00:00Z`);
    const leads: LeadRow[] = [
      makeLead({
        id: 'L1',
        occurredAt: day(10),
        source: 'google',
        verifiedRevenueAud: dec(100),
      }),
      makeLead({
        id: 'L2',
        occurredAt: day(12),
        source: 'google',
        verifiedRevenueAud: dec(200),
      }),
    ];
    const events: EventRow[] = [
      makeEvent({
        id: 'x1',
        createdAt: day(5),
        eventData: { utm_source: 'google' },
      }),
      makeEvent({
        id: 'x2',
        createdAt: day(11),
        eventData: { utm_source: 'google' },
      }),
    ];

    const results = runAttribution({
      organizationId: ORG,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      model: 'linear',
      leads,
      events,
    });

    const l1 = results.find(r => r.leadId === 'L1');
    const l2 = results.find(r => r.leadId === 'L2');

    // L1 only sees the event before its occurredAt.
    expect(l1?.touchpoints.map(t => t.eventId)).toEqual(['x1']);
    // L2 sees both events.
    expect(l2?.touchpoints.map(t => t.eventId).sort()).toEqual(['x1', 'x2']);
  });

  it('uses revenueEstimate only when useEstimateFallback is enabled', () => {
    const lead = makeLead({
      id: 'est',
      occurredAt: new Date('2026-03-10T12:00:00Z'),
      source: 'google',
      verifiedRevenueAud: null,
      revenueEstimateAud: dec(750),
    });
    const event = makeEvent({
      id: 'e-est',
      createdAt: new Date('2026-03-09T12:00:00Z'),
      eventData: { utm_source: 'google' },
    });

    const without = runAttribution({
      organizationId: ORG,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      model: 'linear',
      leads: [lead],
      events: [event],
    });
    expect(without[0].attributedRevenueAud).toBe(0);

    const withFallback = runAttribution({
      organizationId: ORG,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      model: 'linear',
      leads: [lead],
      events: [event],
      useEstimateFallback: true,
    });
    expect(withFallback[0].attributedRevenueAud).toBeCloseTo(750, 6);
  });
});
