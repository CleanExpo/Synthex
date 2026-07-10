/**
 * SYN-MCP-002 — POST/GET /api/ai/calendar-jobs (async calendar generation).
 *
 * The route replaces the deprecated synchronous calendar path: POST
 * validates + enqueues onto lib/queue (mocked here), GET reads job status
 * from the queue's persistence. The REAL lib/ai/calendar-job-handler module
 * is exercised (queue + generator mocked underneath it).
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

// Import AFTER mocks are registered. This also runs the route's module-level
// registerCalendarGenerationHandler() call (against the mocked queue).
import { POST, GET } from '@/app/api/ai/calendar-jobs/route';

function makePostRequest(body: unknown): any {
  return {
    url: 'http://localhost/api/ai/calendar-jobs',
    cookies: { get: () => ({ value: 'valid-token' }) },
    headers: { get: () => 'Bearer valid-token' },
    json: async () => body,
  };
}

function makeGetRequest(query: string): any {
  return {
    url: `http://localhost/api/ai/calendar-jobs${query}`,
    cookies: { get: () => ({ value: 'valid-token' }) },
    headers: { get: () => 'Bearer valid-token' },
  };
}

const validBody = {
  days: 7,
  platforms: ['twitter', 'linkedin'],
  postsPerDay: 2,
};

describe('POST /api/ai/calendar-jobs — SYN-MCP-002', () => {
  beforeEach(() => {
    mockWithRateLimit.mockImplementation((_req: unknown, fn: () => unknown) =>
      fn()
    );
    mockGetUserId.mockResolvedValue('test-user-id');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-123' });
    mockEnqueue.mockImplementation(async (type: string, data: unknown) => ({
      id: 'job_test-123',
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

  it('registers the CALENDAR_GENERATION handler at module load (idempotent)', () => {
    // resetMocks wipes the import-time call, so re-load the route module in
    // an isolated registry to observe the registration happen.
    jest.isolateModules(() => {
      require('@/app/api/ai/calendar-jobs/route');
    });
    expect(mockRegisterHandler).toHaveBeenCalledWith(
      'calendar:generation',
      expect.any(Function)
    );
  });

  it('validates and enqueues a calendar generation job (202 + jobId)', async () => {
    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.jobId).toBe('job_test-123');
    expect(json.status).toBe('pending');

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const [type, data, options] = mockEnqueue.mock.calls[0];
    expect(type).toBe('calendar:generation');
    expect(data).toEqual({
      userId: 'test-user-id',
      organizationId: 'org-123',
      days: 7,
      platforms: ['twitter', 'linkedin'],
      postsPerDay: 2,
      idempotencyKey: undefined,
    });
    // Expensive LLM job — never auto-retried.
    expect(options).toMatchObject({ maxAttempts: 1 });
  });

  it('is wrapped in withRateLimit', async () => {
    await POST(makePostRequest(validBody));
    expect(mockWithRateLimit).toHaveBeenCalledTimes(1);
  });

  it('accepts an idempotencyKey and records it on the job', async () => {
    const res = await POST(
      makePostRequest({ ...validBody, idempotencyKey: 'idem-key-12345678' })
    );
    expect(res.status).toBe(202);
    expect(mockEnqueue.mock.calls[0][1]).toMatchObject({
      idempotencyKey: 'idem-key-12345678',
    });
  });

  it.each([
    ['days over cap', { ...validBody, days: 30 }],
    ['days zero', { ...validBody, days: 0 }],
    ['postsPerDay over cap', { ...validBody, postsPerDay: 5 }],
    [
      'more than 4 platforms',
      {
        ...validBody,
        platforms: ['twitter', 'instagram', 'linkedin', 'tiktok', 'facebook'],
      },
    ],
    ['unknown platform', { ...validBody, platforms: ['myspace'] }],
    ['empty platforms', { ...validBody, platforms: [] }],
    ['short idempotencyKey', { ...validBody, idempotencyKey: 'short' }],
  ])(
    'rejects invalid body (%s) with 400 and never enqueues',
    async (_label, body) => {
      const res = await POST(makePostRequest(body));
      expect(res.status).toBe(400);
      expect(mockEnqueue).not.toHaveBeenCalled();
    }
  );

  it('requires authentication', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(401);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

describe('GET /api/ai/calendar-jobs — job status', () => {
  const ownJob = {
    id: 'job_test-123',
    type: 'calendar:generation',
    data: { userId: 'test-user-id', days: 7 },
    status: 'completed',
    createdAt: new Date('2026-07-10T00:00:00Z'),
    updatedAt: new Date('2026-07-10T00:01:00Z'),
    completedAt: new Date('2026-07-10T00:01:00Z'),
    result: { totalPosts: 28, calendar: {} },
  };

  beforeEach(() => {
    mockGetUserId.mockResolvedValue('test-user-id');
    mockRecoverJobs.mockResolvedValue(0);
  });

  it('returns the job status + result for the owner', async () => {
    mockGetJob.mockReturnValue(ownJob);
    const res = await GET(makeGetRequest('?id=job_test-123'));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.job.id).toBe('job_test-123');
    expect(json.job.status).toBe('completed');
    expect(json.job.result).toEqual({ totalPosts: 28, calendar: {} });
  });

  it('attempts Redis recovery when the job is not in memory', async () => {
    mockGetJob.mockReturnValueOnce(undefined).mockReturnValueOnce(ownJob);
    const res = await GET(makeGetRequest('?id=job_test-123'));
    expect(res.status).toBe(200);
    expect(mockRecoverJobs).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for another user's job (no cross-tenant leakage)", async () => {
    mockGetJob.mockReturnValue({
      ...ownJob,
      data: { userId: 'someone-else', days: 7 },
    });
    const res = await GET(makeGetRequest('?id=job_test-123'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for an unknown job id', async () => {
    mockGetJob.mockReturnValue(undefined);
    const res = await GET(makeGetRequest('?id=job_nope'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when the id param is missing', async () => {
    const res = await GET(makeGetRequest(''));
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await GET(makeGetRequest('?id=job_test-123'));
    expect(res.status).toBe(401);
  });
});
