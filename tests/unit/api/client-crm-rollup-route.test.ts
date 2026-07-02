/**
 * Unit test — GET /api/clients/[clientId]/crm (backlog #3, CRM rollup).
 *
 * Read-only unified detail from the existing primitive tables. The security
 * surface is org-scoping: 401 (no session) → 403 (no org) → 200, and EVERY
 * underlying query must carry the caller's org in its where-clause so a foreign
 * client id returns empty rather than another org's CRM rows. The
 * ClientEngagementEvent scoping is the subtle one — its `clientId` IS the
 * Organization.id and the CRM link is `crmClientId`, so the where must be
 * { clientId: <org>, crmClientId: <param> }, asserted explicitly.
 */

const findManyContact = jest.fn();
const findManyLead = jest.fn();
const findFirstHealth = jest.fn();
const findManyEngagement = jest.fn();
const findManyDeliverable = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    contact: { findMany: (...a: unknown[]) => findManyContact(...a) },
    lead: { findMany: (...a: unknown[]) => findManyLead(...a) },
    clientHealthScore: {
      findFirst: (...a: unknown[]) => findFirstHealth(...a),
    },
    clientEngagementEvent: {
      findMany: (...a: unknown[]) => findManyEngagement(...a),
    },
    dealDeliverable: {
      findMany: (...a: unknown[]) => findManyDeliverable(...a),
    },
    user: { findUnique: (...a: unknown[]) => findUniqueUser(...a) },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { GET } from '@/app/api/clients/[clientId]/crm/route';

const CLIENT_ID = 'client-9';
const ORG_ID = 'org-1';

function makeRequest() {
  return {
    nextUrl: {
      pathname: `/api/clients/${CLIENT_ID}/crm`,
      searchParams: new URLSearchParams(),
    },
    json: async () => undefined,
  } as unknown as Parameters<typeof GET>[0];
}

function ctx(clientId = CLIENT_ID) {
  return { params: Promise.resolve({ clientId }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('user-1');
  findUniqueUser.mockResolvedValue({ organizationId: ORG_ID });
  findManyContact.mockResolvedValue([
    { id: 'contact-1', name: 'Jane Doe', email: null, role: null, phone: null },
  ]);
  findManyLead.mockResolvedValue([
    { id: 'lead-1', stage: 'enquiry', source: 'google' },
  ]);
  findFirstHealth.mockResolvedValue({
    id: 'health-1',
    weekStart: '2026-06-15',
    overallScore: 80,
    riskLevel: 'healthy',
  });
  findManyEngagement.mockResolvedValue([
    { id: 'evt-1', eventType: 'dashboard_visit' },
  ]);
  findManyDeliverable.mockResolvedValue([
    { id: 'deliv-1', title: 'Launch reel', type: 'reel', status: 'pending' },
  ]);
});

describe('GET /api/clients/[clientId]/crm', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(401);
    expect(findManyContact).not.toHaveBeenCalled();
  });

  test('no organisation → 403', async () => {
    findUniqueUser.mockResolvedValue({ organizationId: null });
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(403);
    expect(findManyContact).not.toHaveBeenCalled();
  });

  test('200 returns the unified rollup', async () => {
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clientId).toBe(CLIENT_ID);
    expect(json.contacts).toHaveLength(1);
    expect(json.leads).toHaveLength(1);
    expect(json.healthScore.overallScore).toBe(80);
    expect(json.recentEngagement).toHaveLength(1);
    expect(json.deliverables).toHaveLength(1);
  });

  test('contacts/leads/health are scoped by org AND client', async () => {
    await GET(makeRequest(), ctx());
    expect(findManyContact.mock.calls[0][0].where).toEqual({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
    });
    expect(findManyLead.mock.calls[0][0].where).toEqual({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
    });
    expect(findFirstHealth.mock.calls[0][0].where).toEqual({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
    });
  });

  test('engagement events scope clientId to the org and crmClientId to the param', async () => {
    await GET(makeRequest(), ctx());
    expect(findManyEngagement.mock.calls[0][0].where).toEqual({
      clientId: ORG_ID,
      crmClientId: CLIENT_ID,
    });
  });

  test('deliverables are org-safe via the deal→sponsor→user chain AND client', async () => {
    // DealDeliverable has no organizationId; org isolation must run through the
    // relation chain so another org's deal never leaks for this client id.
    await GET(makeRequest(), ctx());
    expect(findManyDeliverable.mock.calls[0][0].where).toEqual({
      clientId: CLIENT_ID,
      deal: { sponsor: { user: { organizationId: ORG_ID } } },
    });
  });

  test('a foreign client id yields empty aggregates (org-scope returns nothing)', async () => {
    // org-scoped queries return [] / null for a client outside the caller org
    findManyContact.mockResolvedValue([]);
    findManyLead.mockResolvedValue([]);
    findFirstHealth.mockResolvedValue(null);
    findManyEngagement.mockResolvedValue([]);
    findManyDeliverable.mockResolvedValue([]);

    const res = await GET(makeRequest(), ctx('other-org-client'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.contacts).toEqual([]);
    expect(json.leads).toEqual([]);
    expect(json.healthScore).toBeNull();
    expect(json.recentEngagement).toEqual([]);
    expect(json.deliverables).toEqual([]);
    // still org-scoped on the foreign id
    expect(findManyContact.mock.calls[0][0].where).toEqual({
      organizationId: ORG_ID,
      clientId: 'other-org-client',
    });
  });
});
