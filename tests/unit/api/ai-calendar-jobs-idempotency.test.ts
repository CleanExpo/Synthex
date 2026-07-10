/**
 * SYN-MCP-003 — idempotencyKey ENFORCEMENT for POST /api/ai/calendar-jobs.
 *
 * SYN-MCP-002 accepted + recorded the key; this wave enforces it: a
 * duplicate submission (same user + key) returns the ORIGINAL job envelope
 * instead of enqueuing a second days×platforms×postsPerDay LLM run.
 * Tenant-scoped: a different user with the same key enqueues normally.
 */

// --- Mocks ---------------------------------------------------------------
const mockEnqueue = jest.fn();
const mockGetJob = jest.fn();
const mockRecoverJobs = jest.fn();
const mockRegisterHandler = jest.fn();
const mockGetUserId = jest.fn();
const mockUserFindUnique = jest.fn();
const mockWithRateLimit = jest.fn();
const mockUsageTrack = jest.fn();

jest.mock('@/lib/queue', () => ({
  enqueue: (...a: unknown[]) => mockEnqueue(...a),
  getJob: (...a: unknown[]) => mockGetJob(...a),
  recoverJobsFromRedis: (...a: unknown[]) => mockRecoverJobs(...a),
  registerHandler: (...a: unknown[]) => mockRegisterHandler(...a),
  JobTypes: { CALENDAR_GENERATION: 'calendar:generation' },
}));

jest.mock('@/lib/ai/content-generator', () => ({
  aiContentGenerator: {
    generateContent: jest.fn(),
    batchGenerate: jest.fn(),
    generateContentCalendar: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/rate-limiter', () => ({
  withRateLimit: (req: unknown, fn: () => unknown) =>
    mockWithRateLimit(req, fn),
  UsageTracker: { track: (...a: unknown[]) => mockUsageTrack(...a) },
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// Import AFTER mocks are registered.
import { POST } from '@/app/api/ai/calendar-jobs/route';

function makePostRequest(body: unknown): any {
  return {
    url: 'http://localhost/api/ai/calendar-jobs',
    cookies: { get: () => ({ value: 'valid-token' }) },
    headers: { get: () => 'Bearer valid-token' },
    json: async () => body,
  };
}

const validBody = {
  days: 7,
  platforms: ['twitter', 'linkedin'],
  postsPerDay: 2,
};

describe('POST /api/ai/calendar-jobs — SYN-MCP-003 idempotency enforcement', () => {
  let jobCounter = 0;

  beforeEach(() => {
    mockWithRateLimit.mockImplementation((_req: unknown, fn: () => unknown) =>
      fn()
    );
    mockGetUserId.mockResolvedValue('test-user-id');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-123' });
    mockEnqueue.mockImplementation(async (type: string, data: unknown) => ({
      id: `job_${++jobCounter}`,
      type,
      data,
      status: 'pending',
      priority: 0,
      attempts: 0,
      maxAttempts: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  it('a duplicate submission (same user + key) replays the original jobId without enqueuing again', async () => {
    const body = { ...validBody, idempotencyKey: 'cal-key-00000001' };

    const first = await POST(makePostRequest(body));
    expect(first.status).toBe(202);
    const firstJson = await first.json();
    expect(mockEnqueue).toHaveBeenCalledTimes(1);

    const second = await POST(makePostRequest(body));
    expect(second.status).toBe(202);
    expect(second.headers.get('Idempotent-Replay')).toBe('true');
    const secondJson = await second.json();

    expect(secondJson.jobId).toBe(firstJson.jobId);
    // The expensive run was NOT enqueued a second time.
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
  });

  it('does NOT dedupe across users — a different user with the same key enqueues fresh', async () => {
    const body = { ...validBody, idempotencyKey: 'cal-key-00000002' };

    mockGetUserId.mockResolvedValue('user-alpha');
    const first = await POST(makePostRequest(body));
    expect(first.status).toBe(202);

    mockGetUserId.mockResolvedValue('user-beta');
    const second = await POST(makePostRequest(body));
    expect(second.status).toBe(202);
    // Header absent (test-env polyfill returns undefined; spec returns null).
    expect(second.headers.get('Idempotent-Replay')).not.toBe('true');
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
  });

  it('releases the key when the enqueue fails so a retry can succeed', async () => {
    const body = { ...validBody, idempotencyKey: 'cal-key-00000003' };

    mockEnqueue.mockRejectedValueOnce(new Error('queue down'));
    const failed = await POST(makePostRequest(body));
    expect(failed.status).toBe(500);

    const retry = await POST(makePostRequest(body));
    expect(retry.status).toBe(202);
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
  });

  it('requests without an idempotencyKey are unaffected (no dedupe)', async () => {
    const first = await POST(makePostRequest(validBody));
    const second = await POST(makePostRequest(validBody));
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
  });
});
