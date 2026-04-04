/**
 * Unit tests for seasonalSignalsMatcher (SYN-549)
 *
 * Tests:
 *  1. Calendar generation for client with 0 matching signals → generates normally
 *  2. Signal window 2 days away → slot uses weekStart as fallback time (not T-3)
 *  3. Dismissed signal → not inserted into calendar
 */

import { getMarketOpportunitySlots } from '@/lib/calendar/seasonalSignalsMatcher';
import prisma from '@/lib/prisma';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    organization: { findUnique: jest.fn() },
    seasonalSignalDismissal: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const WEEK_START = new Date('2026-04-07T00:00:00.000Z'); // Monday

const MOCK_ORG = {
  industry: 'plumbing-hvac',
  aiGeneratedData: { locationState: 'VIC' },
};

function makeSignal(daysFromWeekStart: number, confidence = 80) {
  const windowStart = new Date(WEEK_START);
  windowStart.setUTCDate(windowStart.getUTCDate() + daysFromWeekStart);
  return {
    id: 'sig-1',
    opportunity_label: 'Winter Pipe Season',
    window_start: windowStart,
    window_end: new Date(windowStart.getTime() + 14 * 86400_000),
    signal_type: 'seasonal_peak',
    confidence_score: confidence,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue(MOCK_ORG);
  (mockPrisma.seasonalSignalDismissal.findMany as jest.Mock).mockResolvedValue(
    []
  );
});

// ── Test 1: No matching signals ────────────────────────────────────────────────

describe('getMarketOpportunitySlots — no matching signals', () => {
  it('returns empty array and does not throw', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

    const slots = await getMarketOpportunitySlots('org-1', WEEK_START);

    expect(slots).toEqual([]);
  });
});

// ── Test 2: Signal window 2 days away — urgency timing ────────────────────────

describe('getMarketOpportunitySlots — window_start 2 days away', () => {
  it('schedules slot at weekStart when T-10 is in the past', async () => {
    // window_start is WEEK_START + 2 days → T-10 = WEEK_START - 8 days (in the past)
    const signal = makeSignal(2);
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([signal]);

    const slots = await getMarketOpportunitySlots('org-1', WEEK_START);

    expect(slots).toHaveLength(1);
    const slotDate = new Date(slots[0].scheduledAt);
    // Slot must be >= weekStart (not in the past)
    expect(slotDate.getTime()).toBeGreaterThanOrEqual(WEEK_START.getTime());
    // And it should be the fallback: weekStart at DEFAULT_HOUR_UTC
    expect(slotDate.toISOString()).toBe('2026-04-07T10:00:00.000Z');
  });
});

// ── Test 3: Dismissed signal not inserted ─────────────────────────────────────

describe('getMarketOpportunitySlots — dismissed signal', () => {
  it('does not insert a slot for a dismissed signal', async () => {
    const signal = makeSignal(12); // 12 days away — T-10 = 2 days from now (valid)
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([signal]);
    // Mark this signal as dismissed for the org
    (
      mockPrisma.seasonalSignalDismissal.findMany as jest.Mock
    ).mockResolvedValue([{ signalId: 'sig-1' }]);

    const slots = await getMarketOpportunitySlots('org-1', WEEK_START);

    expect(slots).toHaveLength(0);
  });
});

// ── Test 4: Max 2 slots even with 3 signals ───────────────────────────────────

describe('getMarketOpportunitySlots — max 2 slots enforced', () => {
  it('returns at most 2 slots when 3 signals match', async () => {
    const signals = [
      { ...makeSignal(12), id: 'sig-1', opportunity_label: 'Opportunity A' },
      { ...makeSignal(13), id: 'sig-2', opportunity_label: 'Opportunity B' },
      { ...makeSignal(14), id: 'sig-3', opportunity_label: 'Opportunity C' },
    ];
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(signals);

    const slots = await getMarketOpportunitySlots('org-1', WEEK_START);

    expect(slots).toHaveLength(2);
    expect(slots[0].slotType).toBe('market_opportunity');
    expect(slots[1].slotType).toBe('market_opportunity');
  });
});

// ── Test 5: Graceful degradation on DB error ──────────────────────────────────

describe('getMarketOpportunitySlots — DB error', () => {
  it('returns empty array without throwing when $queryRaw fails', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockRejectedValue(
      new Error('connection refused')
    );

    const slots = await getMarketOpportunitySlots('org-1', WEEK_START);

    expect(slots).toEqual([]);
  });
});
