/**
 * Honest status for routes retired from lib/platform/noop-client (P2 u03).
 *
 * Every route here depended on a Supabase table with no Prisma model. They
 * must now say so (503 FEATURE_NOT_PROVISIONED, or an explicit persisted:false)
 * instead of a 2xx that did nothing.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    private _body: string;

    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
    }

    json() {
      return Promise.resolve(JSON.parse(this._body));
    }

    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: class extends Request {},
  };
});

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockSecurityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (data: unknown, status = 200) => ({
      status,
      json: () => Promise.resolve(data),
    }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: {},
    AUTHENTICATED_WRITE: {},
  },
}));

const mockLogData = jest.fn();
jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: (...args: unknown[]) => mockLogData(...args) },
}));

jest.mock('@/lib/services/competitive-intel', () => ({
  competitiveIntel: {},
}));

const mockSendNotification = jest.fn();
jest.mock('@/lib/email-service', () => ({
  emailService: {
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

jest.mock('@/lib/sanitize', () => ({ sanitizeHtml: (s: string) => s }));

import { createMockNextRequest } from '../../helpers/mock-request';

const CRON_SECRET = 'test-cron-secret-u03';

const CRON_ROUTES: Array<{ name: string; flag?: string; table: string }> = [
  {
    name: 'deliver-milestone-notifications',
    flag: 'MILESTONE_NOTIFICATIONS_ENABLED',
    table: 'milestone_events',
  },
  {
    name: 'deliver-monthly-geo-score-email',
    flag: 'MONTHLY_GEO_SCORE_EMAIL_ENABLED',
    table: 'client_geo_scores',
  },
  {
    name: 'deliver-quarterly-milestone',
    flag: 'QUARTERLY_REVIEW_ENABLED',
    table: 'client_journey_events',
  },
  {
    name: 'deliver-thirty-day-checkin',
    flag: 'THIRTY_DAY_CHECKIN_ENABLED',
    table: 'client_journey_events',
  },
  { name: 'deliver-win-notifications', table: 'client_journey_events' },
];

function cronRequest(name: string, secret?: string) {
  return createMockNextRequest({
    method: 'POST',
    url: `http://localhost/api/internal/${name}`,
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

beforeAll(() => {
  process.env.CRON_SECRET = CRON_SECRET;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe.each(CRON_ROUTES)(
  'POST /api/internal/$name',
  ({ name, flag, table }) => {
    beforeEach(() => {
      if (flag) process.env[flag] = 'true';
    });

    afterEach(() => {
      if (flag) delete process.env[flag];
    });

    it('rejects a request without the cron secret', async () => {
      const { POST } = await import(`@/app/api/internal/${name}/route`);
      const res = await POST(cronRequest(name) as never);
      expect(res.status).toBe(401);
    });

    it('returns 503 FEATURE_NOT_PROVISIONED after auth, naming the missing table', async () => {
      const { POST } = await import(`@/app/api/internal/${name}/route`);
      const res = await POST(cronRequest(name, CRON_SECRET) as never);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
      expect(body.message).toContain(table);
    });
  }
);

describe('DELETE /api/intelligence/competitors', () => {
  function deleteRequest(id?: string) {
    return createMockNextRequest({
      method: 'DELETE',
      url: `http://localhost/api/intelligence/competitors${id ? `?id=${id}` : ''}`,
    });
  }

  it('returns 403 when the caller is not authenticated', async () => {
    mockSecurityCheck.mockResolvedValue({ allowed: false, error: 'nope' });
    const { DELETE } = await import('@/app/api/intelligence/competitors/route');
    const res = await DELETE(deleteRequest('c1') as never);
    expect(res.status).toBe(403);
  });

  it('returns 503 FEATURE_NOT_PROVISIONED instead of a fake success', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-1' },
    });
    const { DELETE } = await import('@/app/api/intelligence/competitors/route');
    const res = await DELETE(deleteRequest('c1') as never);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(body.message).toContain('competitors table');
    expect(body.success).toBeUndefined();
    expect(mockLogData).toHaveBeenCalledWith(
      'delete',
      'intelligence',
      'c1',
      'user-1',
      'failure',
      expect.objectContaining({ reason: 'FEATURE_NOT_PROVISIONED' })
    );
  });
});

describe('POST /api/email/send', () => {
  function sendRequest() {
    return createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/email/send',
      body: {
        to: 'owner@example.com',
        type: 'notification',
        variables: { title: 'Hi', message: 'Hello' },
      },
    });
  }

  it('returns 401 without a user', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/email/send/route');
    const res = await POST(sendRequest() as never);
    expect(res.status).toBe(401);
  });

  it('reports the send log as not persisted (email_logs not provisioned)', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockSendNotification.mockResolvedValue(true);
    const { POST } = await import('@/app/api/email/send/route');
    const res = await POST(sendRequest() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.log.persisted).toBe(false);
    expect(body.log.reason).toContain('FEATURE_NOT_PROVISIONED');
    expect(body.log.reason).toContain('email_logs');
  });
});
