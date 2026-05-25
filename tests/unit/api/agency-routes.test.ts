/**
 * Agency OS API routes — SYN-972 / SYN-PM-107
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

jest.mock('@/lib/auth/with-auth', () => ({
  withAuth: (
    handler: (
      req: unknown,
      auth: { userId: string; clientId: string }
    ) => unknown
  ) => {
    return async (req: unknown) =>
      handler(req, { userId: 'user-1', clientId: 'org-1', role: 'owner' });
  },
}));

const mockGetUserPermissions = jest.fn();
const mockCheckAny = jest.fn();
jest.mock('@/lib/auth/rbac/permission-engine', () => ({
  PermissionEngine: {
    getUserPermissions: (...args: unknown[]) => mockGetUserPermissions(...args),
    checkAny: (...args: unknown[]) => mockCheckAny(...args),
  },
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'user@example.com' }),
    },
    workflowExecution: { findMany: jest.fn() },
    report: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_req: unknown, handler: () => Promise<unknown>) => handler(),
}));

import prisma from '@/lib/prisma';
import { GET as getCeoQueue } from '@/app/api/agency/ceo-review-queue/route';
import {
  GET as getTier1,
  POST as postTier1,
} from '@/app/api/agency/tier1-report/route';
import { createMockNextRequest } from '../../helpers/mock-request';

const mockWorkflowFindMany = prisma.workflowExecution.findMany as jest.Mock;
const mockReportFindFirst = prisma.report.findFirst as jest.Mock;
const mockReportCreate = prisma.report.create as jest.Mock;

describe('GET /api/agency/ceo-review-queue', () => {
  beforeEach(() => {
    mockGetUserPermissions.mockResolvedValue(null);
    mockWorkflowFindMany.mockResolvedValue([
      { id: 'ex-1', title: 'Review me', status: 'waiting_approval' },
    ]);
  });

  it('returns queue items', async () => {
    const res = await getCeoQueue(
      createMockNextRequest({ method: 'GET' }) as never
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.count).toBe(1);
  });

  it('returns 403 when RBAC roles exist without approve permission', async () => {
    mockGetUserPermissions.mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',
      permissions: ['posts:read'],
      roles: [],
      cachedAt: new Date(),
    });
    mockCheckAny.mockResolvedValue(false);

    const res = await getCeoQueue(
      createMockNextRequest({ method: 'GET' }) as never
    );
    expect(res.status).toBe(403);
  });
});

describe('/api/agency/tier1-report', () => {
  beforeEach(() => {
    mockGetUserPermissions.mockResolvedValue(null);
    mockReportFindFirst.mockResolvedValue(null);
    mockReportCreate.mockResolvedValue({ id: 'rep-1' });
  });

  it('GET returns latest report', async () => {
    const res = await getTier1(
      createMockNextRequest({ method: 'GET' }) as never
    );
    expect(res.status).toBe(200);
  });

  it('POST creates tier1 snapshot', async () => {
    const res = await postTier1(
      createMockNextRequest({ method: 'POST', body: {} }) as never
    );
    expect(res.status).toBe(201);
    expect(mockReportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'agency_tier1' }),
      })
    );
  });
});
