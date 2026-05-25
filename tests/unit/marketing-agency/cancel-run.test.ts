/**
 * Unit test for the Marketing Agency Run cancel API (SYN-978).
 */

const findFirstRun = jest.fn();
const updateRun = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    marketingAgentRun: {
      findFirst: (...args: unknown[]) => findFirstRun(...args),
      update: (...args: unknown[]) => updateRun(...args),
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
    findFirstRun.mockResolvedValue({ id: 'run-1', status: 'queued', agentId: 'agent-1' });
    updateRun.mockResolvedValue({
      id: 'run-1',
      status: 'cancelled',
      completedAt: new Date(),
      agentId: 'agent-1',
    });

    const res = await POST(makeRequest('run-1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.run.status).toBe('cancelled');

    const call = updateRun.mock.calls[0][0];
    expect(call.data.status).toBe('cancelled');
    expect(call.data.completedAt).toBeInstanceOf(Date);
    expect(call.data.errorMessage).toMatch(/Cancelled by user user-1/);
  });

  test('running run → cancelled', async () => {
    findFirstRun.mockResolvedValue({ id: 'run-1', status: 'running', agentId: 'agent-1' });
    updateRun.mockResolvedValue({
      id: 'run-1',
      status: 'cancelled',
      completedAt: new Date(),
      agentId: 'agent-1',
    });

    const res = await POST(makeRequest('run-1'));
    expect(res.status).toBe(200);
  });

  test('completed run → 409 with currentStatus', async () => {
    findFirstRun.mockResolvedValue({ id: 'run-1', status: 'completed', agentId: 'agent-1' });
    const res = await POST(makeRequest('run-1'));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.currentStatus).toBe('completed');
    expect(updateRun).not.toHaveBeenCalled();
  });

  test('already-cancelled run → 409 (idempotency guard)', async () => {
    findFirstRun.mockResolvedValue({ id: 'run-1', status: 'cancelled', agentId: 'agent-1' });
    const res = await POST(makeRequest('run-1'));
    expect(res.status).toBe(409);
    expect(updateRun).not.toHaveBeenCalled();
  });

  test('run not owned by org → 404', async () => {
    findFirstRun.mockResolvedValue(null);
    const res = await POST(makeRequest('run-x'));
    expect(res.status).toBe(404);
    expect(updateRun).not.toHaveBeenCalled();
  });
});
