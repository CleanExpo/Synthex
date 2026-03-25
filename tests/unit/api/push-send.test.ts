/**
 * Unit Tests for Push Send API Route
 * Tests POST /api/push/send
 *
 * SYN-446 — Add test coverage for recently added API routes
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ---------------------------------------------------------------------------
// Mocks — factories declare shape only; implementations set in beforeEach
// ---------------------------------------------------------------------------

jest.mock('@/lib/rate-limit', () => ({
  writeDefault: jest.fn(),
  readDefault: jest.fn(),
  authStrict: jest.fn(),
}));

const mockPrisma = {
  pushSubscription: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockSecurityCheck = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: { requireAuth: true, allowWrite: true },
  },
}));

const mockGetEffectiveOrganizationId = jest.fn();

jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

const mockSendNotification = jest.fn();
const mockSetVapidDetails = jest.fn();

jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    setVapidDetails: (...args: unknown[]) => mockSetVapidDetails(...args),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import rate-limit to configure pass-through
// ---------------------------------------------------------------------------

import * as rateLimitModule from '@/lib/rate-limit';

const mockWriteDefault = rateLimitModule.writeDefault as jest.MockedFunction<
  typeof rateLimitModule.writeDefault
>;

function passThrough() {
  mockWriteDefault.mockImplementation(
    async (_req: unknown, handler: () => Promise<unknown>) => handler()
  );
}

// ---------------------------------------------------------------------------
// Import handler AFTER all mocks are declared
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/push/send/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_BODY = {
  title: 'New post scheduled',
  body: 'Your campaign post has been queued.',
  url: 'https://app.synthex.social/dashboard',
};

function makeRequest(body?: object) {
  return createMockNextRequest({
    method: 'POST',
    body: body ?? VALID_BODY,
    url: 'http://localhost:3000/api/push/send',
  });
}

const MOCK_SUB_1 = {
  endpoint: 'https://push.example.com/sub/1',
  p256dh: 'key1',
  auth: 'auth1',
};
const MOCK_SUB_2 = {
  endpoint: 'https://push.example.com/sub/2',
  p256dh: 'key2',
  auth: 'auth2',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/push/send', () => {
  beforeEach(() => {
    passThrough();
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-123' },
    });
    mockGetEffectiveOrganizationId.mockResolvedValue('org-456');
    mockPrisma.pushSubscription.findMany.mockResolvedValue([]);
    mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 0 });
    mockSendNotification.mockResolvedValue(undefined);

    // Provide VAPID keys in env
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';
  });

  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  it('returns 401 when not authenticated', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Unauthorized',
      context: {},
    });

    const req = makeRequest();
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 503 when VAPID keys are not configured', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    const req = makeRequest();
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toContain('VAPID');
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/push/send',
    });
    (req as any).json = async () => {
      throw new SyntaxError('Unexpected token');
    };

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when title is missing', async () => {
    const req = makeRequest({ body: 'My message', url: 'https://example.com' });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 when body text is missing', async () => {
    const req = makeRequest({ title: 'Hello', url: 'https://example.com' });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 when title exceeds 128 characters', async () => {
    const req = makeRequest({ title: 'T'.repeat(129), body: 'Message' });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 when body text exceeds 256 characters', async () => {
    const req = makeRequest({ title: 'Title', body: 'B'.repeat(257) });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 when url is provided but not a valid URL', async () => {
    const req = makeRequest({ title: 'Title', body: 'Body', url: 'not-a-url' });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 200 with sent/failed/total when no subscribers exist', async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([]);

    const req = makeRequest();
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, sent: 0, failed: 0, total: 0 });
  });

  it('sends notifications to all org subscribers and returns counts', async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([
      MOCK_SUB_1,
      MOCK_SUB_2,
    ]);
    mockSendNotification.mockResolvedValue(undefined);

    const req = makeRequest();
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sent).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.total).toBe(2);
  });

  it('sets VAPID details before sending', async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([MOCK_SUB_1]);

    const req = makeRequest();
    await POST(req as any);

    expect(mockSetVapidDetails).toHaveBeenCalledWith(
      expect.stringMatching(/^mailto:/),
      'test-public-key',
      'test-private-key'
    );
  });

  it('filters subscriptions by organizationId', async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([]);

    const req = makeRequest();
    await POST(req as any);

    expect(mockPrisma.pushSubscription.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-456' },
    });
  });

  it('uses /dashboard as default url when url is omitted', async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([MOCK_SUB_1]);

    const req = makeRequest({ title: 'Hello', body: 'World' });
    await POST(req as any);

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('/dashboard')
    );
  });

  it('counts stale (404) subscriptions as failed and cleans them up', async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([
      MOCK_SUB_1,
      MOCK_SUB_2,
    ]);
    const staleError = Object.assign(new Error('Expired'), { statusCode: 410 });
    mockSendNotification
      .mockResolvedValueOnce(undefined) // SUB_1 succeeds
      .mockRejectedValueOnce(staleError); // SUB_2 is stale

    const req = makeRequest();
    const res = await POST(req as any);
    const body = await res.json();

    expect(body.sent).toBe(1);
    expect(body.failed).toBe(1);
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: { in: [MOCK_SUB_2.endpoint] } },
    });
  });

  it('counts non-stale delivery failures without deleting', async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([MOCK_SUB_1]);
    const networkError = Object.assign(new Error('Network error'), {
      statusCode: 500,
    });
    mockSendNotification.mockRejectedValue(networkError);

    const req = makeRequest();
    const res = await POST(req as any);
    const body = await res.json();

    expect(body.sent).toBe(0);
    expect(body.failed).toBe(1);
    // Non-stale endpoint should NOT be cleaned up
    expect(mockPrisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
});
