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
    organization: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'org-1',
        slug: 'random-client',
        children: [],
      }),
    },
    lead: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    workflowExecution: {
      findMany: jest.fn(),
      // SYN-PM-107: the POST now aggregates gate counts by status.
      groupBy: jest.fn().mockResolvedValue([]),
    },
    report: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    aeoGateRun: {
      findMany: jest.fn().mockResolvedValue([]),
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
import {
  GET as getTier2,
  POST as postTier2,
} from '@/app/api/agency/tier2-report/route';
import {
  GET as getHyperCare,
  POST as postHyperCare,
} from '@/app/api/agency/hypercare-report/route';
import { createMockNextRequest } from '../../helpers/mock-request';

const mockWorkflowFindMany = prisma.workflowExecution.findMany as jest.Mock;
const mockReportFindFirst = prisma.report.findFirst as jest.Mock;
const mockReportCreate = prisma.report.create as jest.Mock;
const mockAeoGateRunFindMany = prisma.aeoGateRun.findMany as jest.Mock;

describe('GET /api/agency/ceo-review-queue', () => {
  beforeEach(() => {
    mockGetUserPermissions.mockResolvedValue(null);
    mockWorkflowFindMany.mockResolvedValue([
      {
        id: 'ex-1',
        title: 'Review me',
        status: 'waiting_approval',
        currentStepIndex: 6,
        totalSteps: 8,
        updatedAt: new Date('2026-08-01T00:00:00Z'),
        createdAt: new Date('2026-08-01T00:00:00Z'),
        triggerType: 'manual',
        stepExecutions: [
          {
            stepIndex: 5,
            stepName: 'Strategist final gate',
            outputData: {
              gate: 'senior-strategist',
              agencyTaskId: 'AT-004',
              pass: true,
              action: 'proceed',
            },
          },
        ],
      },
    ]);
  });

  it('returns queue items that cleared the strategist gate', async () => {
    const res = await getCeoQueue(
      createMockNextRequest({ method: 'GET' }) as never
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.count).toBe(1);
    expect(data.data.gate).toBe('senior-strategist');
    expect(data.data.queue[0]).toEqual(
      expect.objectContaining({
        id: 'ex-1',
        strategistCleared: true,
        agencyTaskId: 'AT-004',
      })
    );
    expect(mockWorkflowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          status: 'waiting_approval',
          stepExecutions: expect.objectContaining({
            some: expect.objectContaining({
              status: 'completed',
              outputData: {
                path: ['gate'],
                equals: 'senior-strategist',
              },
            }),
          }),
        }),
      })
    );
  });

  it('excludes waiting_approval rows without a pass stamp', async () => {
    mockWorkflowFindMany.mockResolvedValue([
      {
        id: 'ex-ungated',
        title: 'No strategist',
        status: 'waiting_approval',
        stepExecutions: [
          {
            stepIndex: 4,
            stepName: 'Brand voice gate',
            outputData: { gate: 'brand-voice-enforce', pass: true },
          },
        ],
      },
      {
        id: 'ex-held',
        title: 'Strategist hold',
        status: 'waiting_approval',
        stepExecutions: [
          {
            stepIndex: 5,
            stepName: 'Strategist final gate',
            outputData: {
              gate: 'senior-strategist',
              agencyTaskId: 'AT-004',
              pass: false,
              action: 'hold',
            },
          },
        ],
      },
    ]);

    const res = await getCeoQueue(
      createMockNextRequest({ method: 'GET' }) as never
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.count).toBe(0);
    expect(data.data.queue).toEqual([]);
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
    (prisma.workflowExecution.groupBy as jest.Mock).mockResolvedValue([]);
    mockAeoGateRunFindMany.mockResolvedValue([]);
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

describe('/api/agency/tier2-report', () => {
  beforeEach(() => {
    mockGetUserPermissions.mockResolvedValue(null);
    mockReportFindFirst.mockResolvedValue(null);
    mockReportCreate.mockResolvedValue({ id: 'rep-2' });
    mockAeoGateRunFindMany.mockResolvedValue([]);
  });

  it('GET returns the latest Tier-2 report', async () => {
    const res = await getTier2(
      createMockNextRequest({ method: 'GET' }) as never
    );

    expect(res.status).toBe(200);
    expect(mockReportFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          type: 'agency_tier2',
        }),
      })
    );
  });

  it('POST persists an org-scoped Tier-2 snapshot', async () => {
    const res = await postTier2(
      createMockNextRequest({ method: 'POST', body: {} }) as never
    );

    expect(res.status).toBe(201);
    expect(mockReportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          type: 'agency_tier2',
        }),
      })
    );
  });
});

describe('/api/agency/hypercare-report', () => {
  beforeEach(() => {
    mockGetUserPermissions.mockResolvedValue(null);
    mockReportFindFirst.mockResolvedValue(null);
    mockReportCreate.mockResolvedValue({ id: 'rep-hc' });
    mockAeoGateRunFindMany.mockResolvedValue([]);
  });

  it('GET returns the latest Hyper-Care report', async () => {
    const res = await getHyperCare(
      createMockNextRequest({ method: 'GET' }) as never
    );

    expect(res.status).toBe(200);
    expect(mockReportFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          type: 'agency_hypercare_daily',
        }),
      })
    );
  });

  it('POST persists an org-scoped Hyper-Care snapshot', async () => {
    const res = await postHyperCare(
      createMockNextRequest({ method: 'POST', body: {} }) as never
    );

    expect(res.status).toBe(201);
    expect(mockReportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          type: 'agency_hypercare_daily',
        }),
      })
    );
  });
});
