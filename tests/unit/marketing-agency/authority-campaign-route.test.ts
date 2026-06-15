/**
 * Integration test — POST /api/marketing-agency/campaigns/authority.
 *
 * Proves child spec #2 (spec-authority-campaign-002.md): the real route wires
 * the pure generator into a persisted, org-scoped MarketingAgencyCampaign and
 * returns the DB id (NOT the mock fixture). Asserts the full ordering ladder:
 *   401 (no session) → 403 (no org) → 400 (bad body) → 201 (persisted, 'live').
 *
 * The generator is NOT mocked — it is a pure function, so exercising it for real
 * proves the wiring end-to-end.
 */

const findUniqueUser = jest.fn();
const findUniqueOrg = jest.fn();
const createCampaign = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...a: unknown[]) => findUniqueUser(...a) },
    organization: { findUnique: (...a: unknown[]) => findUniqueOrg(...a) },
    marketingAgencyCampaign: {
      create: (...a: unknown[]) => createCampaign(...a),
    },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
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
  findUniqueOrg.mockResolvedValue({
    name: 'Acme Co',
    slug: 'acme-co',
    website: null,
    description: 'We do useful things',
    brandDna: null,
  });
  createCampaign.mockResolvedValue({ id: 'mac-1' });
});

import { POST } from '@/app/api/marketing-agency/campaigns/authority/route';

function makeRequest(body: unknown) {
  return {
    nextUrl: {
      pathname: '/api/marketing-agency/campaigns/authority',
      searchParams: new URLSearchParams(),
    },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

const validBody = {
  name: 'Authority Q3',
  objective: 'Build trust with verifiable information',
  operatingMandate: 'Publish owned media first; gate external channels',
  sources: [
    { label: 'Consent policy', sourceType: 'internal_policy', path: 'docs/x.md' },
  ],
  horizonDays: 7,
};

describe('POST /api/marketing-agency/campaigns/authority', () => {
  test('no session → 401, no campaign created', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('authenticated but no org → 403, no campaign created', async () => {
    findUniqueUser.mockResolvedValue({
      organizationId: null,
      teamMemberships: [],
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('invalid body → 400 with consistent { error, details }', async () => {
    const res = await POST(makeRequest({ name: 'x' })); // missing objective/mandate/sources
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
    expect(json.details).toHaveProperty('objective');
    expect(createCampaign).not.toHaveBeenCalled();
  });

  test('valid body → 201, persists a real DB-backed campaign (not the mock)', async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);

    const json = await res.json();
    // Real DB id, not a mock fixture.
    expect(json.id).toBe('mac-1');
    // A real generated pack with a non-empty calendar (7 days requested).
    expect(Array.isArray(json.pack.calendar)).toBe(true);
    expect(json.pack.calendar).toHaveLength(7);
    expect(json.pack.drafts.length).toBeGreaterThan(0);

    const data = createCampaign.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: 'org-1',
      createdById: 'user-1',
      name: 'Authority Q3',
      providerMode: 'live', // NOT 'mock'
      productName: 'Acme Co', // derived from the org
    });
    expect(typeof data.slug).toBe('string');
    expect(data.metadata).toBeDefined(); // the pack is persisted on metadata
    // One source ref row per input source, org-scoped.
    expect(data.sourceRefs.create).toHaveLength(1);
    expect(data.sourceRefs.create[0]).toMatchObject({
      organizationId: 'org-1',
      createdById: 'user-1',
      label: 'Consent policy',
      sourceType: 'internal_policy',
    });
  });

  test('request body can override the business block', async () => {
    await POST(
      makeRequest({
        ...validBody,
        business: { offers: ['source-first intake'], audience: ['operators'] },
      })
    );
    const data = createCampaign.mock.calls[0][0].data;
    // primaryOffer falls back to the first business offer when not supplied.
    expect(data.primaryOffer).toBe('source-first intake');
  });

  test('DB failure → centralized 500 with the route message', async () => {
    createCampaign.mockRejectedValue(new Error('db down'));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to generate authority campaign');
  });
});
