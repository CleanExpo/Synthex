/**
 * Unit test — Marketing Agency Agents POST route after WS5 defineRoute()
 * conversion. Proves the helper preserves behaviour on a real route:
 * 400 (consistent shape) → 402 (tier gate) → 201 (created).
 */

const findManyAgent = jest.fn();
const createAgent = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    marketingAgent: {
      findMany: (...a: unknown[]) => findManyAgent(...a),
      create: (...a: unknown[]) => createAgent(...a),
    },
    user: { findUnique: (...a: unknown[]) => findUniqueUser(...a) },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));

const checkTierMock = jest.fn();
jest.mock('@/lib/marketing-agency/agent/tier-gate', () => ({
  checkMarketingAgentTier: (...a: unknown[]) => checkTierMock(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('user-1');
  findUniqueUser.mockResolvedValue({ organizationId: 'org-1', teamMemberships: [] });
  checkTierMock.mockResolvedValue({ allowed: true });
});

import { POST } from '@/app/api/marketing-agency/agents/route';

function makeRequest(body: unknown) {
  return {
    nextUrl: { pathname: '/api/marketing-agency/agents', searchParams: new URLSearchParams() },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/marketing-agency/agents (defineRoute)', () => {
  test('invalid body → 400 with consistent { error, details } shape', async () => {
    const res = await POST(makeRequest({ goal: 'too short missing name' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
    expect(json.details).toHaveProperty('name');
    expect(createAgent).not.toHaveBeenCalled();
  });

  test('tier gate blocks → 402', async () => {
    checkTierMock.mockResolvedValue({
      allowed: false,
      reason: 'Upgrade required',
      plan: 'free',
      limit: 1,
      current: 1,
    });
    const res = await POST(makeRequest({ name: 'Agent A', goal: 'Do the thing well' }));
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe('Upgrade required');
    expect(createAgent).not.toHaveBeenCalled();
  });

  test('valid body → 201 with created agent, defaults applied', async () => {
    createAgent.mockResolvedValue({ id: 'agent-1', name: 'Agent A' });
    const res = await POST(makeRequest({ name: 'Agent A', goal: 'Do the thing well' }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.agent).toMatchObject({ id: 'agent-1' });

    const data = createAgent.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: 'org-1',
      createdById: 'user-1',
      name: 'Agent A',
      goal: 'Do the thing well',
      maxClaimsPerRun: 5, // default
      cadence: 'manual', // default
    });
  });

  test('DB failure → centralized 500 with route message', async () => {
    createAgent.mockRejectedValue(new Error('db down'));
    const res = await POST(makeRequest({ name: 'Agent A', goal: 'Do the thing well' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to create agent');
  });
});
