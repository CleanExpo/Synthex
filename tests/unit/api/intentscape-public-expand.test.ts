import { createMockNextRequest } from '../../helpers/mock-request';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  extractClientIp: jest.fn(() => '1.2.3.4'),
}));

const mockCreateWorkspace = jest.fn();
const mockExpandVision = jest.fn();

jest.mock('@/lib/intentscape/runtime', () => ({
  createIntentScapeRuntime: jest.fn(() => ({
    createWorkspace: mockCreateWorkspace,
    expandVision: mockExpandVision,
  })),
}));

import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createIntentScapeRuntime } from '@/lib/intentscape/runtime';
import { logger } from '@/lib/logger';

const mockCheckRateLimit = checkRateLimit as jest.Mock;
const mockCreateRuntime = createIntentScapeRuntime as jest.Mock;

function request(origin = 'http://localhost:3000', body: unknown = {}) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost:3000/api/intentscape/public/expand',
    headers: {
      origin,
      'content-type': 'application/json',
    },
    body,
  });
}

describe('POST /api/intentscape/public/expand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MARKETING_LEADS_ORG_ID = 'org-marketing';
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockCreateRuntime.mockReturnValue({
      createWorkspace: mockCreateWorkspace,
      expandVision: mockExpandVision,
    });
    mockCreateWorkspace.mockResolvedValue({ id: 'workspace-1' });
    mockExpandVision.mockResolvedValue({
      visionMap: { contextVersion: 1, hypotheses: [] },
    });
  });

  afterEach(() => {
    delete process.env.MARKETING_LEADS_ORG_ID;
  });

  it('creates a prospect Markdown workspace and expands it under strict limits', async () => {
    const { POST } = await import('@/app/api/intentscape/public/expand/route');
    const signal =
      'Our product is useful but prospects do not understand its value quickly.';
    const response = await POST(
      request(undefined, { originSignal: signal }) as never
    );
    const payload = await response.json();

    expect((logger.error as jest.Mock).mock.calls).toEqual([]);
    expect(response.status).toBe(200);
    expect(payload.workspaceId).toBe('workspace-1');
    expect(mockCreateRuntime).toHaveBeenCalledWith({
      organizationId: 'org-marketing',
      userId: 'marketing-extender-public',
    });
    expect(mockCreateWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        originSignal: signal,
        retentionClass: 'prospect',
      })
    );
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        namespace: 'intentscape-public-expansion',
        limits: expect.objectContaining({
          ip: { limit: 3, windowSeconds: 3_600 },
        }),
      })
    );
  });

  it('rejects a cross-origin caller before spending model tokens', async () => {
    const { POST } = await import('@/app/api/intentscape/public/expand/route');
    const response = await POST(
      request('https://attacker.example', {
        originSignal: 'This is a valid but untrusted cross-origin signal.',
      }) as never
    );

    expect(response.status).toBe(403);
    expect(mockCreateWorkspace).not.toHaveBeenCalled();
    expect(mockExpandVision).not.toHaveBeenCalled();
  });

  it('returns 429 when the free hourly model budget is exhausted', async () => {
    mockCheckRateLimit.mockResolvedValue({
      ok: false,
      retryAfterSeconds: 900,
      breachedBucket: 'ip',
    });
    const { POST } = await import('@/app/api/intentscape/public/expand/route');
    const response = await POST(
      request(undefined, {
        originSignal:
          'This is a valid idea that cannot run over the rate limit.',
      }) as never
    );

    expect(response.status).toBe(429);
    expect(mockCreateWorkspace).not.toHaveBeenCalled();
  });
});
