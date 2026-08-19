/**
 * loadAgencyGateCounts — maps WorkflowExecution status groupBy into the
 * AgencyGateCounts shape used by Tier-1 snapshots.
 */
const mockGroupBy = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    workflowExecution: {
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
    },
  },
}));

import { loadAgencyGateCounts } from '@/lib/agency/load-agency-gate-counts';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loadAgencyGateCounts', () => {
  it('maps each Gate status into the counts block', async () => {
    mockGroupBy.mockResolvedValue([
      { status: 'completed', _count: { _all: 4 } },
      { status: 'revision_requested', _count: { _all: 1 } },
      { status: 'waiting_approval', _count: { _all: 2 } },
      { status: 'failed', _count: { _all: 1 } },
      { status: 'cancelled', _count: { _all: 0 } },
    ]);

    await expect(loadAgencyGateCounts('org-1')).resolves.toEqual({
      completed: 4,
      revisionRequested: 1,
      awaitingApproval: 2,
      failed: 1,
      cancelled: 0,
    });

    expect(mockGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: { organizationId: 'org-1' },
      })
    );
  });

  it('returns zeros when the org has no workflow executions', async () => {
    mockGroupBy.mockResolvedValue([]);

    await expect(loadAgencyGateCounts('org-empty')).resolves.toEqual({
      completed: 0,
      revisionRequested: 0,
      awaitingApproval: 0,
      failed: 0,
      cancelled: 0,
    });
  });
});
