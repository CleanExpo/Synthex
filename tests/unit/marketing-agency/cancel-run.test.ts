/**
 * Unit test for the Marketing Agency Run cancel API (SYN-978).
 */

const findFirstRun = jest.fn();
const updateRun = jest.fn();
const updateManyRun = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    marketingAgentRun: {
      findFirst: (...args: unknown[]) => findFirstRun(...args),
      update: (...args: unknown[]) => updateRun(...args),
      updateMany: (...args: unknown[]) => updateManyRun(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => findUniqueUser(...args),
    },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => getUserIdMock(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('user-1');
  findUniqueUser.mockResolvedValue({
    organizationId: 'org-1',
    teamMemberships: [],
  });
});

import { POST } from '@/app/api/marketing-agency/runs/[id]/cancel/route';

function makeRequest(runId: string) {
  return {
    nextUrl: {
      pathname: `/api/marketing-agency/runs/${runId}/cancel`,
      searchParams: new URLSearchParams(),
    },
    json: async () => ({}),
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/marketing-agency/runs/[id]/cancel', () => {
  test('queued run → cancelled with completedAt + errorMessage', async () => {
    findFirstRun
      .mockResolvedValueOnce({
        id: 'run-1',
        status: 'queued',
        agentId: 'agent-1',
      }) // initial read
      .mockResolvedValueOnce({
        id: 'run-1',
        status: 'cancelled',
        completedAt: new Date(),
        agentId: 'agent-1',
      }); // re-read after updateMany
    updateManyRun.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest('run-1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.run.status).toBe('cancelled');

    const call = updateManyRun.mock.calls[0][0];
    expect(call.data.status).toBe('cancelled');
    expect(call.data.completedAt).toBeInstanceOf(Date);
    expect(call.data.errorMessage).toMatch(/Cancelled by user user-1/);
    // atomicity guard — filter must include the allowed source statuses
    expect(call.where.status.in).toEqual(['queued', 'running']);
  });

  test('running run → cancelled', async () => {
    findFirstRun
      .mockResolvedValueOnce({
        id: 'run-1',
        status: 'running',
        agentId: 'agent-1',
      })
      .mockResolvedValueOnce({
        id: 'run-1',
        status: 'cancelled',
        completedAt: new Date(),
        agentId: 'agent-1',
      });
    updateManyRun.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest('run-1'));
    expect(res.status).toBe(200);
  });

  test('atomicity: race-loss returns 409 with currentStatus', async () => {
    // Initial read sees 'queued'; updateMany returns count=0 because the
    // row transitioned to 'completed' between read and write. The route
    // re-reads and returns 409 with the fresh status.
    findFirstRun
      .mockResolvedValueOnce({
        id: 'run-1',
        status: 'queued',
        agentId: 'agent-1',
      })
      .mockResolvedValueOnce({ status: 'completed' });
    updateManyRun.mockResolvedValue({ count: 0 });

    const res = await POST(makeRequest('run-1'));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.currentStatus).toBe('completed');
  });

  test('completed run → 409 with currentStatus (gated before updateMany)', async () => {
    findFirstRun.mockResolvedValue({
      id: 'run-1',
      status: 'completed',
      agentId: 'agent-1',
    });
    const res = await POST(makeRequest('run-1'));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.currentStatus).toBe('completed');
    expect(updateManyRun).not.toHaveBeenCalled();
  });

  test('already-cancelled run → 409 (idempotency guard)', async () => {
    findFirstRun.mockResolvedValue({
      id: 'run-1',
      status: 'cancelled',
      agentId: 'agent-1',
    });
    const res = await POST(makeRequest('run-1'));
    expect(res.status).toBe(409);
    expect(updateManyRun).not.toHaveBeenCalled();
  });

  test('run not owned by org → 404', async () => {
    findFirstRun.mockResolvedValue(null);
    const res = await POST(makeRequest('run-x'));
    expect(res.status).toBe(404);
    expect(updateManyRun).not.toHaveBeenCalled();
  });
});
