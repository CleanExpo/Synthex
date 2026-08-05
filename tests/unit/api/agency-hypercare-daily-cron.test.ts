import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { NextResponse } from 'next/server';

const mockPrisma = {
  organization: { findUnique: jest.fn() },
  user: { findFirst: jest.fn() },
  aeoGateRun: { findMany: jest.fn() },
  report: { create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/agency-hypercare-daily/route';

function request() {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/agency-hypercare-daily',
  });
}

describe('GET /api/cron/agency-hypercare-daily', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
    mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    mockPrisma.aeoGateRun.findMany.mockResolvedValue([
      { pass: false, reasons: ['missing source'] },
    ]);
    mockPrisma.report.create.mockResolvedValue({ id: 'report-1' });
  });

  it('rejects unauthorised callers before querying the database', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it('persists a daily Hyper-Care snapshot for the Unite workspace', async () => {
    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      reportId: 'report-1',
      breachSurfaced: true,
    });
    expect(mockVerifyCron).toHaveBeenCalledWith(
      expect.anything(),
      'AGENCY_HYPERCARE_DAILY'
    );
    expect(mockPrisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
          type: 'agency_hypercare_daily',
          status: 'completed',
          data: expect.objectContaining({
            windowHours: 24,
            totalRuns: 1,
            failedRuns: 1,
            breachSurfaced: true,
            failureReasons: [{ reason: 'missing source', count: 1 }],
          }),
        }),
      })
    );
  });
});
