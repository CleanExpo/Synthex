/**
 * Tests for personalisation-notifier — SYN-637
 *
 * Coverage:
 *  - Reports feature_not_provisioned (client_notifications has no Prisma model)
 *  - Skips when postCount < threshold
 *  - Skips when confidenceLevel < 0.3
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

  it('reports feature_not_provisioned for a qualifying org instead of claiming it fired', async () => {
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
      expect.stringContaining('not provisioned'),
      expect.objectContaining({
        missingTable: 'client_notifications',
        userId: USER_ID,
      })
    );
  });

  it('skips when postCount < threshold (default 8)', async () => {
    const result = await firePersonalisationNotification(
      ORG_ID,
      5,
      0.5,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result).toEqual({
      fired: false,
      skipped: true,
      reason: 'post_count_below_threshold',
    });
    expect(mockTeamMemberFindFirst).not.toHaveBeenCalled();
  });

  it('skips when confidenceLevel < 0.3', async () => {
    const result = await firePersonalisationNotification(
      ORG_ID,
      12,
      0.2,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result.reason).toBe('confidence_below_threshold');
    expect(mockTeamMemberFindFirst).not.toHaveBeenCalled();
  });

  it('uses PERSONALISATION_NOTIFICATION_THRESHOLD env var', async () => {
    process.env.PERSONALISATION_NOTIFICATION_THRESHOLD = '20';

    const result = await firePersonalisationNotification(
      ORG_ID,
      15,
      0.5,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result.reason).toBe('post_count_below_threshold');
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

    expect(result).toEqual({
      fired: false,
      skipped: true,
      reason: 'no_owner_found',
    });
  });

  it('returns unexpected_error when the owner lookup fails', async () => {
    mockTeamMemberFindFirst.mockRejectedValue(new Error('db down'));

    const result = await firePersonalisationNotification(
      ORG_ID,
      10,
      0.5,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result).toEqual({
      fired: false,
      skipped: true,
      reason: 'unexpected_error',
    });
  });
});
