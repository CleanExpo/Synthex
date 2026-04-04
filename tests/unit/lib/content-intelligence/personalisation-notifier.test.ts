/**
 * Tests for personalisation-notifier — SYN-637
 *
 * Coverage:
 *  - Fires notification when postCount >= threshold AND confidenceLevel >= 0.3
 *  - Skips when postCount < threshold
 *  - Skips when confidenceLevel < 0.3
 *  - Does not fire twice (idempotency check via existing record)
 */

// ── Shared mock objects ───────────────────────────────────────────────────────

const mockTeamMemberFindFirst = jest.fn();
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const mockSupabaseFrom = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseEq = jest.fn();
const mockSupabaseLimit = jest.fn();
const mockSupabaseInsert = jest.fn();

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

// Mock Supabase client
const mockSupabaseChain = {
  select: mockSupabaseSelect,
  eq: mockSupabaseEq,
  limit: mockSupabaseLimit,
  insert: mockSupabaseInsert,
};

// Simple stub — resetMocks: true wipes implementations, so createClient is re-set in setupEnv()
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.PERSONALISATION_NOTIFICATION_THRESHOLD = '8';
  // resetMocks: true clears all mock implementations between tests — re-set createClient here
  const { createClient } = jest.requireMock('@supabase/supabase-js') as { createClient: jest.Mock };
  createClient.mockReturnValue({ from: mockSupabaseFrom });
}

function setupSupabaseNoExisting() {
  // from() returns chain
  mockSupabaseFrom.mockReturnValue(mockSupabaseChain);
  mockSupabaseSelect.mockReturnValue(mockSupabaseChain);
  mockSupabaseEq.mockReturnValue(mockSupabaseChain);
  mockSupabaseLimit.mockResolvedValue({ data: [], error: null });
  mockSupabaseInsert.mockResolvedValue({ error: null });
}

function setupSupabaseExistingRecord() {
  mockSupabaseFrom.mockReturnValue(mockSupabaseChain);
  mockSupabaseSelect.mockReturnValue(mockSupabaseChain);
  mockSupabaseEq.mockReturnValue(mockSupabaseChain);
  mockSupabaseLimit.mockResolvedValue({ data: [{ id: 'existing-notif-id' }], error: null });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('firePersonalisationNotification', () => {
  beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.PERSONALISATION_NOTIFICATION_THRESHOLD;
  });

  it('fires notification for org with postCount >= 8 and confidenceLevel >= 0.3', async () => {
    mockTeamMemberFindFirst.mockResolvedValue({ userId: USER_ID });
    setupSupabaseNoExisting();

    const result = await firePersonalisationNotification(
      ORG_ID,
      10,
      0.4,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result.fired).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.userId).toBe(USER_ID);
    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        type: 'personalisation_activated',
        title: 'Your strategy just got personal',
        read: false,
      })
    );
  });

  it('includes correct body copy referencing the top topic and optimal day', async () => {
    mockTeamMemberFindFirst.mockResolvedValue({ userId: USER_ID });
    setupSupabaseNoExisting();

    await firePersonalisationNotification(
      ORG_ID,
      10,
      0.4,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    const insertCall = mockSupabaseInsert.mock.calls[0][0];
    expect(insertCall.body).toContain('local events'); // topic with hyphens replaced
    expect(insertCall.body).toContain('Wednesday');    // WED mapped to Wednesday
    expect(insertCall.body).toContain('10 posts');
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

  it('skips when postCount is exactly at threshold boundary (threshold=8, postCount=8 → fires)', async () => {
    mockTeamMemberFindFirst.mockResolvedValue({ userId: USER_ID });
    setupSupabaseNoExisting();

    const result = await firePersonalisationNotification(
      ORG_ID,
      8, // exactly at threshold
      0.3,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result.fired).toBe(true);
  });

  it('does not fire twice — skips when notification already exists (idempotency)', async () => {
    mockTeamMemberFindFirst.mockResolvedValue({ userId: USER_ID });
    setupSupabaseExistingRecord();

    const result = await firePersonalisationNotification(
      ORG_ID,
      15,
      0.6,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result.fired).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already_fired');
    expect(mockSupabaseInsert).not.toHaveBeenCalled();
  });

  it('skips when no owner TeamMember found', async () => {
    mockTeamMemberFindFirst.mockResolvedValue(null);
    // Don't call setupSupabase — we shouldn't reach it

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

  it('returns skipped when Supabase insert fails', async () => {
    mockTeamMemberFindFirst.mockResolvedValue({ userId: USER_ID });
    mockSupabaseFrom.mockReturnValue(mockSupabaseChain);
    mockSupabaseSelect.mockReturnValue(mockSupabaseChain);
    mockSupabaseEq.mockReturnValue(mockSupabaseChain);
    mockSupabaseLimit.mockResolvedValue({ data: [], error: null });
    mockSupabaseInsert.mockResolvedValue({ error: { message: 'DB write failed' } });

    const result = await firePersonalisationNotification(
      ORG_ID,
      10,
      0.4,
      SAMPLE_TOPICS,
      SAMPLE_OPTIMAL_TIMES
    );

    expect(result.fired).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('insert_failed');
  });
});
