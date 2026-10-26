import {
  fulfilmentIdempotencyKey,
  fulfilmentRequestSchema,
  customerInteractionSchema,
  businessIntentSchema,
  type BusinessIntent,
} from '@/lib/living-business-os/contracts';
import { rankImprovements } from '@/lib/living-business-os/decision-engine';
import { selectWeeklyQuestions } from '@/lib/living-business-os/weekly-questions';
import type { OpportunitySignal } from '@/lib/living-business-os/contracts';

const now = '2026-10-27T08:00:00+10:00';
const intent: BusinessIntent = {
  organizationId: 'tenant-a',
  businessName: 'Example Carpet Care',
  goals: ['profitable repeat business'],
  serviceIds: ['upholstery'],
  capacity: { availableJobsPerWeek: 10, bookedJobsPerWeek: 8, updatedAt: now },
  constraints: {
    preferredServices: [],
    excludedClaims: [],
    maximumMonthlyAutomationCostAud: 100,
    publishing: 'approval_required',
    customerDataReuse: 'tenant_only',
  },
};
const signal: OpportunitySignal = {
  id: 'signal-1',
  organizationId: 'tenant-a',
  serviceId: 'upholstery',
  title: 'Interest in upholstery cleaning',
  evidence: [{ id: 'crm-1', kind: 'crm', capturedAt: now, dataClass: 'owned' }],
  confidence: 0.8,
  risk: 0.2,
  expectedGrossProfitAud: 300,
  estimatedInterventionCostAud: 40,
  expectedAdditionalJobsPerWeek: 1,
  outcomeMetric: 'verified gross profit from upholstery enquiries',
  observedAt: now,
};
describe('Living Business OS contracts and first bounded engine', () => {
  it('rejects invalid/ambiguous orders and separates organisation idempotency', () => {
    const request = {
      sourceSystem: 'unite_group' as const,
      schemaVersion: 1 as const,
      externalOrderId: 'order-42',
      organizationId: 'tenant-a',
      approvedPackageId: 'basic',
      authorisationReceiptId: 'approval-7',
      requestedAssets: ['website' as const, 'crm' as const],
      issuedAt: now,
    };
    expect(fulfilmentRequestSchema.parse(request)).toEqual(request);
    expect(fulfilmentIdempotencyKey(request)).not.toBe(
      fulfilmentIdempotencyKey({ ...request, organizationId: 'tenant-b' })
    );
    expect(
      fulfilmentRequestSchema.safeParse({ ...request, unknown: true }).success
    ).toBe(false);
    expect(
      fulfilmentRequestSchema.safeParse({
        ...request,
        authorisationReceiptId: '',
      }).success
    ).toBe(false);
  });
  it('does not turn anonymous card attention into an identified lead', () => {
    const event = {
      organizationId: 'tenant-a',
      interactionId: 'evt-1',
      channel: 'living_card',
      eventType: 'service_interest',
      serviceId: 'upholstery',
      happenedAt: now,
      pseudonymousSessionId: 'random-session',
      source: {
        id: 'card-1',
        kind: 'card',
        capturedAt: now,
        dataClass: 'owned',
      },
    };
    expect(customerInteractionSchema.safeParse(event).success).toBe(true);
    expect(
      customerInteractionSchema.safeParse({ ...event, eventType: 'sale' })
        .success
    ).toBe(false);
    expect(
      customerInteractionSchema.safeParse({
        ...event,
        eventType: 'sale',
        crmContactId: 'contact-1',
      }).success
    ).toBe(true);
  });
  it('always requires human approval for a good change', () => {
    const result = rankImprovements(intent, [signal]);
    expect(result).toHaveLength(1);
    expect(result[0].decision).toBe('draft_for_review');
    expect(result[0].approvalStatus).toBe('required');
    expect(result[0].priorityIndex).toBeGreaterThan(0);
  });
  it('halts a cross-tenant signal even if it looks profitable', () => {
    expect(() =>
      rankImprovements(intent, [{ ...signal, organizationId: 'tenant-b' }])
    ).toThrow('TENANT_MISMATCH');
    expect(() =>
      selectWeeklyQuestions(intent, [{ ...signal, organizationId: 'tenant-b' }])
    ).toThrow('TENANT_MISMATCH');
  });
  it('does not boost demand beyond capacity', () => {
    const result = rankImprovements(
      { ...intent, capacity: { ...intent.capacity, bookedJobsPerWeek: 10 } },
      [signal]
    );
    expect(result[0].decision).toBe('defer_for_capacity');
    expect(result[0].reasons.join(' ')).toContain('capacity');
  });
  it('does not treat competitor estimates as verified sales', () => {
    const result = rankImprovements(intent, [
      {
        ...signal,
        evidence: [
          {
            ...signal.evidence[0],
            dataClass: 'estimated',
            kind: 'competitor_estimate',
          },
        ],
      },
    ]);
    expect(result[0].decision).toBe('research_more');
  });
  it('never assumes free capacity when unknown and respects spend allowance', () => {
    expect(
      rankImprovements(
        {
          ...intent,
          capacity: {
            availableJobsPerWeek: null,
            bookedJobsPerWeek: null,
            updatedAt: null,
          },
        },
        [signal]
      )[0].decision
    ).toBe('research_more');
    expect(
      rankImprovements(intent, [
        { ...signal, estimatedInterventionCostAud: 150 },
      ])[0].decision
    ).toBe('research_more');
  });
  it('generates at most 3 evidence-driven voice questions, avoids repeats, permits zero', () => {
    const incomplete = {
      ...intent,
      capacity: {
        availableJobsPerWeek: null,
        bookedJobsPerWeek: null,
        updatedAt: null,
      },
    };
    const weak = { ...signal, confidence: 0.3 };
    const q = selectWeeklyQuestions(incomplete, [weak]);
    expect(q.length).toBeLessThanOrEqual(3);
    expect(q[0].id).toBe('capacity_current');
    expect(
      selectWeeklyQuestions(incomplete, [weak], new Set(q.map(x => x.id)))
    ).toEqual([]);
    const complete = {
      ...intent,
      constraints: { ...intent.constraints, preferredServices: ['upholstery'] },
    };
    expect(selectWeeklyQuestions(complete, [signal])).toEqual([]);
  });
  it('rejects a malformed intent and conflicting signal ids', () => {
    expect(
      businessIntentSchema.safeParse({
        ...intent,
        constraints: { ...intent.constraints, publishing: 'automatic' },
      }).success
    ).toBe(false);
    expect(() =>
      rankImprovements(intent, [signal, { ...signal, title: 'different' }])
    ).toThrow('CONFLICTING_SIGNAL_ID');
  });
});

describe('Cursor-review regressions: consent, evidence and service boundaries', () => {
  it('does not accept marketing consent from an anonymous card scan', () => {
    const event = {
      organizationId: 'tenant-a',
      interactionId: 'evt-anon',
      channel: 'living_card',
      eventType: 'service_interest',
      serviceId: 'upholstery',
      happenedAt: now,
      pseudonymousSessionId: 'random-session',
      marketingConsent: true,
      source: {
        id: 'card-1',
        kind: 'card',
        capturedAt: now,
        dataClass: 'owned',
      },
    };
    expect(customerInteractionSchema.safeParse(event).success).toBe(false);
    expect(
      customerInteractionSchema.safeParse({ ...event, crmContactId: 'c-1' })
        .success
    ).toBe(false);
    expect(
      customerInteractionSchema.safeParse({
        ...event,
        crmContactId: 'c-1',
        marketingConsentReceiptId: 'separate-opt-in-proof',
      }).success
    ).toBe(true);
    expect(
      customerInteractionSchema.safeParse({
        ...event,
        marketingConsent: false,
        marketingConsentReceiptId: 'proof',
      }).success
    ).toBe(false);
  });
  it('does not promote estimated demand even when mixed with one owned record', () => {
    const mixed = {
      ...signal,
      evidence: [
        signal.evidence[0],
        {
          id: 'competitor-1',
          kind: 'competitor_estimate' as const,
          capturedAt: now,
          dataClass: 'estimated' as const,
        },
      ],
    };
    expect(rankImprovements(intent, [mixed])[0].decision).toBe('research_more');
    expect(
      selectWeeklyQuestions(intent, [mixed]).some(
        x => x.id === 'verify_signal:signal-1'
      )
    ).toBe(true);
  });
  it('does not recommend a title that contains an excluded owner claim', () => {
    const guarded = {
      ...intent,
      constraints: { ...intent.constraints, excludedClaims: ['guaranteed'] },
    };
    const risky = { ...signal, title: 'Guaranteed mould removal' };
    const result = rankImprovements(guarded, [risky]);
    expect(result[0].decision).toBe('research_more');
    expect(result[0].reasons.join(' ')).toContain('owner-excluded');
  });
  it('does not ask the owner questions about services outside the catalogue', () => {
    expect(() =>
      selectWeeklyQuestions(intent, [{ ...signal, serviceId: 'unlisted' }])
    ).toThrow('UNKNOWN_SERVICE');
  });
  it('requires research when all working capacity is zero', () => {
    const zero = {
      ...intent,
      capacity: {
        ...intent.capacity,
        availableJobsPerWeek: 0,
        bookedJobsPerWeek: 0,
      },
    };
    expect(rankImprovements(zero, [signal])[0].decision).toBe(
      'defer_for_capacity'
    );
  });
});
