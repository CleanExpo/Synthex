/**
 * Tests for personalisation-notifier — SYN-637
 *
 * Coverage:
 *  - Qualifying org (postCount >= threshold AND confidenceLevel >= 0.3) gets an
 *    honest `feature_not_provisioned` result: client_notifications has no Prisma
 *    model, so nothing is stored and nothing is reported as fired
 *  - Skips when postCount < threshold
 *  - Skips when confidenceLevel < 0.3
 *  - Skips when no owner is found; unexpected errors never throw
 */

// ── Shared mock objects ───────────────────────────────────────────────────────

const mockTeamMemberFindFirst = jest.fn();
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    teamMember: {
      findFirst: mockTeamMemberFindFirst,
    },
  },
}));

jest.mock('@/lib/logger', () => ({ logger: mockLogger }));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { firePersonalisationNotification } from '@/lib/content-intelligence/personalisation-notifier';
import type { TopicScore } from '@/lib/content-intelligence/types';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const SAMPLE_TOPICS: TopicScore[] = [
  { topic: 'local-events', avgEngagementRate: 0.08, postCount: 5 },
  { topic: 'behind-the-scenes', avgEngagementRate: 0.06, postCount: 3 },
];

const SAMPLE_OPTIMAL_TIMES: Record<string, string[]> = {
  WED: ['09:00', '18:00'],
  FRI: ['12:00'],
};

const ORG_ID = 'org-test-001';
const USER_ID = 'user-owner-001';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('firePersonalisationNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PERSONALISATION_NOTIFICATION_THRESHOLD = '8';
  });

  afterEach(() => {
    delete process.env.PERSONALISATION_NOTIFICATION_THRESHOLD;
  });

  it('reports feature_not_provisioned (never fired) for a qualifying org', async () => {
    mockTeamMemberFindFirst.mockResolvedValue({ userId: USER_ID });

    const result = await firePersonalisationNotification(
      ORG_ID,
      10,
      0.4,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result).toEqual({
      fired: false,
      skipped: true,
      userId: USER_ID,
      reason: 'feature_not_provisioned',
    });
    expect(mockTeamMemberFindFirst).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID, role: 'owner' },
      select: { userId: true },
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('client_notifications is not provisioned'),
      expect.objectContaining({
        organizationId: ORG_ID,
        missingTable: 'client_notifications',
      })
    );
  });

  it('skips when postCount < threshold (default 8)', async () => {
    const result = await firePersonalisationNotification(
      ORG_ID,
      5, // below threshold of 8
      0.5,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result.fired).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('post_count_below_threshold');
    expect(mockTeamMemberFindFirst).not.toHaveBeenCalled();
  });

  it('skips when confidenceLevel < 0.3', async () => {
    const result = await firePersonalisationNotification(
      ORG_ID,
      12,
      0.2, // below 0.3
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result.fired).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('confidence_below_threshold');
    expect(mockTeamMemberFindFirst).not.toHaveBeenCalled();
  });

  it('postCount exactly at threshold (8) passes the gate and reaches the owner lookup', async () => {
    mockTeamMemberFindFirst.mockResolvedValue({ userId: USER_ID });

    const result = await firePersonalisationNotification(
      ORG_ID,
      8, // exactly at threshold
      0.3,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(mockTeamMemberFindFirst).toHaveBeenCalledTimes(1);
    expect(result.fired).toBe(false);
    expect(result.reason).toBe('feature_not_provisioned');
  });

  it('skips when no owner TeamMember found', async () => {
    mockTeamMemberFindFirst.mockResolvedValue(null);

    const result = await firePersonalisationNotification(
      ORG_ID,
      10,
      0.5,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result.fired).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no_owner_found');
  });

  it('uses PERSONALISATION_NOTIFICATION_THRESHOLD env var', async () => {
    process.env.PERSONALISATION_NOTIFICATION_THRESHOLD = '20';

    const result = await firePersonalisationNotification(
      ORG_ID,
      15, // below custom threshold of 20
      0.5,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result.fired).toBe(false);
    expect(result.reason).toBe('post_count_below_threshold');
  });

  it('returns unexpected_error (never throws) when the owner lookup fails', async () => {
    mockTeamMemberFindFirst.mockRejectedValue(new Error('DB down'));

    const result = await firePersonalisationNotification(
      ORG_ID,
      10,
      0.4,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result.fired).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('unexpected_error');
  });
});
