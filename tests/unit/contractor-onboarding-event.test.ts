/**
 * Unit tests for lib/contractor/
 *
 * Covers:
 *  - Address hash + normalisation (P10 binding)
 *  - Validation: source-of-truth job ID, brand, payment, consent, radius,
 *    coords, raw-address-XOR-hash
 *  - Emit happy path + idempotency (duplicate handling)
 *  - Multi-handler subscribe + per-handler error isolation
 *  - Unsubscribe
 *  - Default persist no-op when service-role creds missing
 *  - Logger never receives raw address
 *
 * @see SYN-836 (parent: SYN-834 epic)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  hashAddress,
  normaliseAddress,
  emitContractorOnboarded,
  subscribeContractorOnboarded,
  notifyContractorOnboarded,
  _resetContractorEventSubscribersForTests,
  _getContractorEventSubscriberCountForTests,
} from '@/lib/contractor';
import type {
  ContractorOnboardedInput,
  PersistFn,
} from '@/lib/contractor/types';

// Capture log calls so we can assert PII redaction
const logCalls: Array<{ level: string; msg: string; payload: unknown }> = [];
jest.mock('@/lib/logger', () => ({
  logger: {
    info: (msg: string, payload: unknown) =>
      logCalls.push({ level: 'info', msg, payload }),
    warn: (msg: string, payload: unknown) =>
      logCalls.push({ level: 'warn', msg, payload }),
    error: (msg: string, payload: unknown) =>
      logCalls.push({ level: 'error', msg, payload }),
    debug: (msg: string, payload: unknown) =>
      logCalls.push({ level: 'debug', msg, payload }),
  },
}));

const RAW_ADDRESS = '123 Smith St, Brisbane QLD 4000';

const VALID_INPUT: ContractorOnboardedInput = {
  sourceOfTruthJobId: 'nrpg_onboarding_job_test_0001',
  contractorId: 'contractor_test_001',
  brand: 'NRPG',
  baseLat: -27.4705,
  baseLng: 153.026,
  rawAddress: RAW_ADDRESS,
  radiusKm: 20,
  serviceCategories: ['water-damage', 'fire-restoration'],
  paymentConfirmedAt: '2026-04-29T06:00:00.000Z',
  consentForServiceAreaListing: true,
  expectedSuburbCount: 28,
  expectedMonthlyBudgetAud: 1540,
};

// Default persist mock that always inserts (returns inserted on first call,
// duplicate on second call with the same source-of-truth-job-id).
function makePersistMock(): jest.Mock<PersistFn> {
  const seen = new Set<string>();
  return jest.fn(async event => {
    if (seen.has(event.sourceOfTruthJobId)) return 'duplicate';
    seen.add(event.sourceOfTruthJobId);
    return 'inserted';
  });
}

beforeEach(() => {
  logCalls.length = 0;
  _resetContractorEventSubscribersForTests();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

// ═══════════════════════════════════════════════════════════════════════════
//  ADDRESS HASH
// ═══════════════════════════════════════════════════════════════════════════

describe('normaliseAddress', () => {
  it('lowercases + collapses whitespace + strips punctuation', () => {
    expect(normaliseAddress('  12   Smith St,  Brisbane  ')).toBe(
      '12 smith st brisbane'
    );
  });
  it('produces stable output for variants', () => {
    expect(normaliseAddress('12 Smith St, Brisbane')).toBe(
      normaliseAddress('12 smith st brisbane')
    );
  });
});

describe('hashAddress', () => {
  it('returns a 64-char hex sha256', () => {
    const h = hashAddress('123 Smith St, Brisbane');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it('same address → same hash', () => {
    expect(hashAddress(RAW_ADDRESS)).toBe(hashAddress(RAW_ADDRESS));
  });
  it('different addresses → different hashes', () => {
    expect(hashAddress('123 Smith St')).not.toBe(hashAddress('124 Smith St'));
  });
  it('throws on empty input', () => {
    expect(() => hashAddress('')).toThrow(/empty/);
    expect(() => hashAddress('   ')).toThrow(/empty/);
  });
  it('throws on non-string input', () => {
    // @ts-expect-error testing runtime guard
    expect(() => hashAddress(undefined)).toThrow(/must be a string/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('emitContractorOnboarded — validation', () => {
  it('throws on missing sourceOfTruthJobId (Q3.2.4 H8)', async () => {
    await expect(
      emitContractorOnboarded(
        { ...VALID_INPUT, sourceOfTruthJobId: '' },
        { persist: makePersistMock() }
      )
    ).rejects.toThrow(/sourceOfTruthJobId required/);
  });

  it('throws on non-NRPG brand (Phase 3.4)', async () => {
    await expect(
      // @ts-expect-error testing runtime guard
      emitContractorOnboarded(
        { ...VALID_INPUT, brand: 'DR' },
        { persist: makePersistMock() }
      )
    ).rejects.toThrow(/brand must be 'NRPG'/);
  });

  it('throws on missing paymentConfirmedAt (no payment = no event)', async () => {
    await expect(
      emitContractorOnboarded(
        { ...VALID_INPUT, paymentConfirmedAt: '' },
        { persist: makePersistMock() }
      )
    ).rejects.toThrow(/paymentConfirmedAt required/);
  });

  it('throws on unparseable paymentConfirmedAt', async () => {
    await expect(
      emitContractorOnboarded(
        { ...VALID_INPUT, paymentConfirmedAt: 'not-a-date' },
        { persist: makePersistMock() }
      )
    ).rejects.toThrow(/parseable ISO date/);
  });

  it('throws on missing consent (coverage cannot open without consent)', async () => {
    await expect(
      emitContractorOnboarded(
        { ...VALID_INPUT, consentForServiceAreaListing: false },
        { persist: makePersistMock() }
      )
    ).rejects.toThrow(/consentForServiceAreaListing must be true/);
  });

  it('throws on lat out of range', async () => {
    await expect(
      emitContractorOnboarded(
        { ...VALID_INPUT, baseLat: 91 },
        { persist: makePersistMock() }
      )
    ).rejects.toThrow(/baseLat/);
  });

  it('throws on radius < 1 km', async () => {
    await expect(
      emitContractorOnboarded(
        { ...VALID_INPUT, radiusKm: 0 },
        { persist: makePersistMock() }
      )
    ).rejects.toThrow(/radiusKm/);
  });

  it('throws on radius > 200 km', async () => {
    await expect(
      emitContractorOnboarded(
        { ...VALID_INPUT, radiusKm: 250 },
        { persist: makePersistMock() }
      )
    ).rejects.toThrow(/radiusKm/);
  });

  it('throws on empty serviceCategories', async () => {
    await expect(
      emitContractorOnboarded(
        { ...VALID_INPUT, serviceCategories: [] },
        { persist: makePersistMock() }
      )
    ).rejects.toThrow(/serviceCategories/);
  });

  it('throws when neither rawAddress nor addressHash provided (P10)', async () => {
    const { rawAddress: _, ...rest } = VALID_INPUT;
    await expect(
      emitContractorOnboarded(rest as ContractorOnboardedInput, {
        persist: makePersistMock(),
      })
    ).rejects.toThrow(/rawAddress or addressHash/);
  });

  it('throws when both rawAddress and addressHash provided (P10)', async () => {
    await expect(
      emitContractorOnboarded(
        {
          ...VALID_INPUT,
          addressHash: 'a'.repeat(64),
        },
        { persist: makePersistMock() }
      )
    ).rejects.toThrow(/either rawAddress OR addressHash, not both/);
  });

  it('throws when addressHash is too short', async () => {
    const { rawAddress: _, ...rest } = VALID_INPUT;
    await expect(
      emitContractorOnboarded(
        { ...(rest as ContractorOnboardedInput), addressHash: 'short' },
        { persist: makePersistMock() }
      )
    ).rejects.toThrow(/addressHash must be a hex string/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  EMIT — HAPPY PATH + IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════════════════

describe('emitContractorOnboarded — happy path', () => {
  it('hashes raw address + builds event', async () => {
    const persist = makePersistMock();
    const result = await emitContractorOnboarded(VALID_INPUT, { persist });
    expect(result.firstEmit).toBe(true);
    expect(result.event.baseLocation.addressHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.event.sourceOfTruthJobId).toBe(
      VALID_INPUT.sourceOfTruthJobId
    );
    expect(result.event.brand).toBe('NRPG');
    expect(result.event.serviceCategories).toEqual(
      VALID_INPUT.serviceCategories
    );
    expect(result.event.consentForServiceAreaListing).toBe(true);
    expect(result.event.emittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('accepts pre-computed addressHash (skips hashing)', async () => {
    const persist = makePersistMock();
    const { rawAddress: _, ...rest } = VALID_INPUT;
    const preComputed = 'a'.repeat(64);
    const result = await emitContractorOnboarded(
      { ...(rest as ContractorOnboardedInput), addressHash: preComputed },
      { persist }
    );
    expect(result.event.baseLocation.addressHash).toBe(preComputed);
  });

  it('idempotency: second emit with same job ID returns firstEmit=false', async () => {
    const persist = makePersistMock();
    const a = await emitContractorOnboarded(VALID_INPUT, { persist });
    const b = await emitContractorOnboarded(VALID_INPUT, { persist });
    expect(a.firstEmit).toBe(true);
    expect(b.firstEmit).toBe(false);
    expect(b.notifiedHandlers).toBe(0); // subscribers NOT notified on re-emit
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  PUB/SUB — handler isolation, unsubscribe, multi-handler
// ═══════════════════════════════════════════════════════════════════════════

describe('subscribeContractorOnboarded + emit', () => {
  it('notifies all subscribers', async () => {
    const persist = makePersistMock();
    const calls: number[] = [];
    subscribeContractorOnboarded(() => {
      calls.push(1);
    });
    subscribeContractorOnboarded(() => {
      calls.push(2);
    });
    subscribeContractorOnboarded(() => {
      calls.push(3);
    });
    const result = await emitContractorOnboarded(VALID_INPUT, { persist });
    expect(result.notifiedHandlers).toBe(3);
    expect(result.failedHandlers).toBe(0);
    expect(calls.sort()).toEqual([1, 2, 3]);
  });

  it('unsubscribe stops future notifications', async () => {
    const persist = makePersistMock();
    let called = 0;
    const unsub = subscribeContractorOnboarded(() => {
      called++;
    });
    await emitContractorOnboarded(VALID_INPUT, { persist });
    expect(called).toBe(1);
    unsub();
    await emitContractorOnboarded(
      { ...VALID_INPUT, sourceOfTruthJobId: 'nrpg_onboarding_job_test_0002' },
      { persist }
    );
    expect(called).toBe(1); // unchanged
  });

  it('handler error does NOT break sibling handlers', async () => {
    const persist = makePersistMock();
    const calls: string[] = [];
    subscribeContractorOnboarded(() => {
      calls.push('a');
      throw new Error('boom');
    });
    subscribeContractorOnboarded(() => {
      calls.push('b');
    });
    subscribeContractorOnboarded(async () => {
      calls.push('c');
    });

    const result = await emitContractorOnboarded(VALID_INPUT, { persist });
    expect(result.notifiedHandlers).toBe(3);
    expect(result.failedHandlers).toBe(1);
    expect(calls.sort()).toEqual(['a', 'b', 'c']);
  });

  it('handler counter helper returns current size', () => {
    expect(_getContractorEventSubscriberCountForTests()).toBe(0);
    const a = subscribeContractorOnboarded(() => {});
    const b = subscribeContractorOnboarded(() => {});
    expect(_getContractorEventSubscriberCountForTests()).toBe(2);
    a();
    b();
    expect(_getContractorEventSubscriberCountForTests()).toBe(0);
  });

  it('subscribing same handler twice is idempotent (Set behaviour)', async () => {
    const persist = makePersistMock();
    let called = 0;
    const fn = () => {
      called++;
    };
    subscribeContractorOnboarded(fn);
    subscribeContractorOnboarded(fn);
    expect(_getContractorEventSubscriberCountForTests()).toBe(1);
    await emitContractorOnboarded(VALID_INPUT, { persist });
    expect(called).toBe(1);
  });
});

describe('notifyContractorOnboarded with no subscribers', () => {
  it('returns notified=0 cleanly', async () => {
    const result = await notifyContractorOnboarded({
      ...VALID_INPUT,
      baseLocation: {
        lat: VALID_INPUT.baseLat,
        lng: VALID_INPUT.baseLng,
        addressHash: 'a'.repeat(64),
      },
      consentForServiceAreaListing: true,
      emittedAt: new Date().toISOString(),
      serviceCategories: VALID_INPUT.serviceCategories,
    });
    expect(result.notified).toBe(0);
    expect(result.failed).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  PII REDACTION (P10 binding — raw address never logged)
// ═══════════════════════════════════════════════════════════════════════════

describe('P10 — raw address never logged', () => {
  it('logs do NOT contain the raw address string after emit', async () => {
    const persist = makePersistMock();
    await emitContractorOnboarded(VALID_INPUT, { persist });
    const allLogged = JSON.stringify(logCalls);
    expect(allLogged).not.toContain(RAW_ADDRESS);
    expect(allLogged).not.toContain('Smith St');
  });

  it('logs include the addressHash prefix (acceptable per design)', async () => {
    const persist = makePersistMock();
    const result = await emitContractorOnboarded(VALID_INPUT, { persist });
    const allLogged = JSON.stringify(logCalls);
    expect(allLogged).toContain(
      result.event.baseLocation.addressHash.slice(0, 12)
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  DEFAULT PERSIST — no-op when service-role creds missing
// ═══════════════════════════════════════════════════════════════════════════

describe('default persist — service-role creds missing', () => {
  it('returns inserted as no-op + warns', async () => {
    // No persist override → uses default. No SUPABASE_SERVICE_ROLE_KEY in env
    // (we deleted them in beforeEach).
    const result = await emitContractorOnboarded(VALID_INPUT);
    expect(result.firstEmit).toBe(true);
    const warns = logCalls.filter(c => c.level === 'warn');
    expect(warns.some(w => w.msg.includes('persist skipped'))).toBe(true);
  });
});
