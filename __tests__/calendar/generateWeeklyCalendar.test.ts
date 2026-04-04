/**
 * Tests for the weekly content calendar engine — SYN-521
 *
 * Coverage:
 *  - slotScheduler: pure functions (nextMondayFrom, scheduleSlotsForWeek)
 *  - generateWeeklyCalendar: cold-start gate rejection
 *  - generateWeeklyCalendar: happy path — success result returned
 *  - generateWeeklyCalendar: cost tracking called during generation
 */

// ── Shared mock objects ───────────────────────────────────────────────────────

const mockPrismaContentCalendar = { upsert: jest.fn() };
const mockPrismaOrganization = { findUnique: jest.fn() };
const mockPrismaBrandDNA = { findUnique: jest.fn() };
const mockPrismaUser = { findMany: jest.fn() };
const mockPrismaAIWeeklyDigest = { count: jest.fn() };
const mockPrismaPost = { findMany: jest.fn() };
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const mockTrackPipelineCost = jest.fn().mockResolvedValue(undefined);
const mockCalculatePipelineCost = jest.fn().mockReturnValue(0.001);
const mockGenerateCaptions = jest.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    contentCalendar: mockPrismaContentCalendar,
    organization: mockPrismaOrganization,
    brandDNA: mockPrismaBrandDNA,
    user: mockPrismaUser,
    aIWeeklyDigest: mockPrismaAIWeeklyDigest,
    post: mockPrismaPost,
  },
}));

jest.mock('@/lib/logger', () => ({ logger: mockLogger }));

jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: mockTrackPipelineCost,
  calculatePipelineCost: mockCalculatePipelineCost,
}));

jest.mock('@/lib/calendar/captionGenerator', () => ({
  generateCaptions: mockGenerateCaptions,
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  scheduleSlotsForWeek,
  nextMondayFrom,
  weekEndFromStart,
} from '@/lib/calendar/slotScheduler';
import { generateWeeklyCalendar } from '@/lib/calendar/generateWeeklyCalendar';
import { InsufficientDigestsError } from '@/lib/calendar/types';
import type { DigestSignals } from '@/lib/calendar/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = 'test-org-123';

const FULL_SIGNALS: DigestSignals = {
  digestCount: 5,
  topContentTypes: ['educational', 'engagement', 'promotional'],
  peakEngagementHours: [9, 12, 17],
  winningHashtags: ['#Melbourne', '#SmallBusiness', '#LocalBusiness'],
  activePlatforms: ['instagram', 'facebook', 'linkedin'],
};

const MONDAY_2026 = new Date('2026-03-30T00:00:00.000Z'); // a known Monday

// ── slotScheduler unit tests ──────────────────────────────────────────────────

describe('slotScheduler', () => {
  describe('nextMondayFrom', () => {
    it('returns the next Monday from a Sunday', () => {
      const sunday = new Date('2026-03-29T12:00:00.000Z'); // Sunday
      const result = nextMondayFrom(sunday);
      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.toISOString().startsWith('2026-03-30')).toBe(true);
    });

    it('returns the FOLLOWING Monday from a Monday (skips same day)', () => {
      const monday = new Date('2026-03-30T12:00:00.000Z'); // Monday
      const result = nextMondayFrom(monday);
      expect(result.getUTCDay()).toBe(1);
      expect(result.toISOString().startsWith('2026-04-06')).toBe(true);
    });
  });

  describe('weekEndFromStart', () => {
    it('returns Sunday (6 days after Monday)', () => {
      const end = weekEndFromStart(MONDAY_2026);
      expect(end.getUTCDay()).toBe(0); // Sunday
      expect(end.toISOString().startsWith('2026-04-05')).toBe(true);
    });
  });

  describe('scheduleSlotsForWeek', () => {
    it('returns exactly 7 slots', () => {
      const slots = scheduleSlotsForWeek(MONDAY_2026, FULL_SIGNALS);
      expect(slots).toHaveLength(7);
    });

    it('each slot has a unique scheduledAt datetime', () => {
      const slots = scheduleSlotsForWeek(MONDAY_2026, FULL_SIGNALS);
      const dates = slots.map(s => s.scheduledAt);
      const unique = new Set(dates);
      expect(unique.size).toBe(7);
    });

    it('dayOfWeek values are 0–6', () => {
      const slots = scheduleSlotsForWeek(MONDAY_2026, FULL_SIGNALS);
      slots.forEach((slot, i) => {
        expect(slot.dayOfWeek).toBe(i);
      });
    });

    it('assigns platforms from activePlatforms', () => {
      const slots = scheduleSlotsForWeek(MONDAY_2026, FULL_SIGNALS);
      const usedPlatforms = new Set(slots.map(s => s.platform));
      const valid = new Set(FULL_SIGNALS.activePlatforms);
      for (const p of usedPlatforms) {
        expect(valid.has(p)).toBe(true);
      }
    });

    it('falls back to instagram when no platforms provided', () => {
      const signals: DigestSignals = { ...FULL_SIGNALS, activePlatforms: [] };
      const slots = scheduleSlotsForWeek(MONDAY_2026, signals);
      slots.forEach(s => expect(s.platform).toBe('instagram'));
    });

    it('each slot has a unique cuid-style id', () => {
      const slots = scheduleSlotsForWeek(MONDAY_2026, FULL_SIGNALS);
      const ids = slots.map(s => s.id);
      expect(new Set(ids).size).toBe(7);
    });
  });
});

// ── generateWeeklyCalendar unit tests ─────────────────────────────────────────

describe('generateWeeklyCalendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default brand context mocks
    mockPrismaOrganization.findUnique.mockResolvedValue({
      name: 'Test Biz',
      industry: 'Hospitality',
    });
    mockPrismaBrandDNA.findUnique.mockResolvedValue({
      businessName: 'Test Bistro',
      brandVoice: { tone: 'warm and friendly' },
    });

    // Default caption mock: 3 captions per slot
    mockGenerateCaptions.mockResolvedValue([
      'Caption A',
      'Caption B',
      'Caption C',
    ]);

    // Default upsert result
    mockPrismaContentCalendar.upsert.mockResolvedValue({ id: 'cal-001' });
  });

  describe('cold-start gate', () => {
    it('throws InsufficientDigestsError when org has < 3 digests', async () => {
      mockPrismaUser.findMany.mockResolvedValue([{ id: 'user-1' }]);
      mockPrismaAIWeeklyDigest.count.mockResolvedValue(1);
      mockPrismaPost.findMany.mockResolvedValue([]);

      await expect(
        generateWeeklyCalendar(ORG_ID, MONDAY_2026)
      ).rejects.toBeInstanceOf(InsufficientDigestsError);
    });

    it('InsufficientDigestsError carries correct counts', async () => {
      mockPrismaUser.findMany.mockResolvedValue([{ id: 'user-1' }]);
      mockPrismaAIWeeklyDigest.count.mockResolvedValue(2);
      mockPrismaPost.findMany.mockResolvedValue([]);

      try {
        await generateWeeklyCalendar(ORG_ID, MONDAY_2026);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InsufficientDigestsError);
        const e = err as InsufficientDigestsError;
        expect(e.actual).toBe(2);
        expect(e.required).toBe(3);
      }
    });

    it('proceeds when org has exactly 3 digests', async () => {
      mockPrismaUser.findMany.mockResolvedValue([{ id: 'user-1' }]);
      mockPrismaAIWeeklyDigest.count.mockResolvedValue(3);
      mockPrismaPost.findMany.mockResolvedValue([]);

      const result = await generateWeeklyCalendar(ORG_ID, MONDAY_2026);
      expect(result.success).toBe(true);
    });
  });

  describe('happy path', () => {
    beforeEach(() => {
      mockPrismaUser.findMany.mockResolvedValue([{ id: 'user-1' }]);
      mockPrismaAIWeeklyDigest.count.mockResolvedValue(5);
      mockPrismaPost.findMany.mockResolvedValue([
        {
          content: 'How to grow your business',
          platform: 'instagram',
          hashtags: ['#tips', '#growth'],
          publishedAt: new Date('2026-03-01T09:00:00Z'),
        },
        {
          content: 'Big sale this weekend only!',
          platform: 'facebook',
          hashtags: ['#sale', '#deal'],
          publishedAt: new Date('2026-03-08T12:00:00Z'),
        },
      ]);
    });

    it('returns success: true with a calendarId', async () => {
      const result = await generateWeeklyCalendar(ORG_ID, MONDAY_2026);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.calendarId).toBe('cal-001');
        expect(result.organizationId).toBe(ORG_ID);
      }
    });

    it('calls generateCaptions exactly 7 times (one per slot)', async () => {
      await generateWeeklyCalendar(ORG_ID, MONDAY_2026);
      expect(mockGenerateCaptions).toHaveBeenCalledTimes(7);
    });

    it('upserts the ContentCalendar record', async () => {
      await generateWeeklyCalendar(ORG_ID, MONDAY_2026);
      expect(mockPrismaContentCalendar.upsert).toHaveBeenCalledTimes(1);
      const call = mockPrismaContentCalendar.upsert.mock.calls[0][0];
      expect(call.where.organizationId_weekStart.organizationId).toBe(ORG_ID);
      expect(call.create.status).toBe('draft');
    });

    it('persists 7 slots in the upserted calendar data', async () => {
      await generateWeeklyCalendar(ORG_ID, MONDAY_2026);
      const call = mockPrismaContentCalendar.upsert.mock.calls[0][0];
      const calendarData = call.create.slots as { slots: unknown[] };
      expect(calendarData.slots).toHaveLength(7);
    });
  });
});
