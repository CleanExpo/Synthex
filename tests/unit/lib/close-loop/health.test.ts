const mockEdgeFindMany = jest.fn();
const mockOutcomeFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    edgeFunctionLog: { findMany: (...a: unknown[]) => mockEdgeFindMany(...a) },
    marketingAgencyOutcomeEvent: {
      findMany: (...a: unknown[]) => mockOutcomeFindMany(...a),
    },
  },
}));

import {
  fetchCloseLoopHealth,
  CLOSE_LOOP_REQUIRED_PIPELINES,
} from '@/lib/close-loop/health';

// PORTED: edge_function_logs → prisma.edgeFunctionLog.
describe('fetchCloseLoopHealth (Prisma)', () => {
  beforeEach(() => {
    mockEdgeFindMany.mockReset();
    mockOutcomeFindMany.mockReset();
  });

  it('reads the required pipelines from the last 14 days and maps rows', async () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    mockEdgeFindMany.mockResolvedValue(
      CLOSE_LOOP_REQUIRED_PIPELINES.map(name => ({
        functionName: name,
        status: 'success',
        clientsProcessed: 4,
        clientsFailed: 0,
        durationMs: 120,
        createdAt: recent,
      }))
    );

    const report = await fetchCloseLoopHealth();

    const args = mockEdgeFindMany.mock.calls[0][0];
    expect(args.where.functionName).toEqual({
      in: [...CLOSE_LOOP_REQUIRED_PIPELINES],
    });
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
    const ageDays =
      (Date.now() - args.where.createdAt.gte.getTime()) / 86_400_000;
    expect(Math.round(ageDays)).toBe(14);
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(report.overall).toBe('green');
    expect(report.pipelines[0]).toMatchObject({
      status: 'success',
      clientsProcessed: 4,
      durationMs: 120,
      lastRunAt: recent.toISOString(),
      stale: false,
    });
    expect(mockOutcomeFindMany).not.toHaveBeenCalled();
  });

  it('scopes the learning signal to the caller organisation', async () => {
    mockEdgeFindMany.mockResolvedValue([]);
    mockOutcomeFindMany.mockResolvedValue([]);

    const report = await fetchCloseLoopHealth({ organizationId: 'org-1' });

    expect(mockOutcomeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } })
    );
    expect(report.overall).toBe('red');
    expect(report.learningSignals[0].status).toBe('no_data');
  });

  it('surfaces a database failure instead of reporting empty data', async () => {
    mockEdgeFindMany.mockRejectedValue(new Error('connection refused'));
    await expect(fetchCloseLoopHealth()).rejects.toThrow(
      'close-loop health query failed: connection refused'
    );
  });
});
