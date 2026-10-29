/**
 * SEAM: GET /api/google-business/nap-audit called as a route handler; the
 * outcome writer is faked at its module boundary with the writer's own
 * dedupe contract (one event per externalId). Catches: drift not recorded,
 * wrong location id, repeat drift double-counted, changed drift swallowed,
 * writer failure leaking into the response. Misses: real persistence
 * (covered by the J7 listing rows).
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  gBPLocation: { findFirst: jest.fn() },
  organization: { findUnique: jest.fn() },
  brandDNA: { findUnique: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: async () => 'user-1',
  unauthorizedResponse: jest.fn(),
}));
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: async () => 'org-session',
}));

const events = new Map<string, Record<string, unknown>>();
const fakeWriter = async (input: Record<string, unknown>) => {
  const key = `${input.organizationId}:${input.kind}:${input.dedupeKey}`;
  const duplicate = events.has(key);
  if (!duplicate) events.set(key, input);
  return { status: duplicate ? 'duplicate' : 'recorded' };
};
const mockRecord = jest.fn(fakeWriter);
jest.mock('@/lib/marketing-agency/outcomes/local-outcome-writer', () => ({
  recordLocalOutcome: (input: Record<string, unknown>) => mockRecord(input),
}));

import { GET } from '@/app/api/google-business/nap-audit/route';

const call = () =>
  GET(
    createMockNextRequest({
      url: 'http://localhost:3000/api/google-business/nap-audit?organizationId=org-attacker',
    }) as never
  );

function seed(orgName: string, gbpName = 'Acme Plumbing') {
  mockPrisma.gBPLocation.findFirst.mockResolvedValue({
    id: 'loc-1',
    locationName: gbpName,
    phone: null,
    website: null,
  });
  mockPrisma.organization.findUnique.mockResolvedValue({
    name: orgName,
    website: null,
  });
  mockPrisma.brandDNA.findUnique.mockResolvedValue(null);
}

beforeEach(() => {
  events.clear();
  mockRecord.mockReset();
  mockRecord.mockImplementation(fakeWriter);
});

describe('nap-audit → listing drift outcomes', () => {
  it('records one local_listing_drift outcome for the session org when drift exists', async () => {
    seed('Acme Plumbing Pty Ltd');
    const res = await call();
    expect(res.status).toBe(200);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0][0]).toMatchObject({
      organizationId: 'org-session',
      locationId: 'loc-1',
      kind: 'listing',
      source: 'nap-audit',
      outcomeMetric: 'nap_mismatch_fields',
      observedValue: 'name',
    });
    expect(events.size).toBe(1);
  });

  it('records nothing for a second identical audit', async () => {
    seed('Acme Plumbing Pty Ltd');
    await call();
    await call();
    expect(events.size).toBe(1);
  });

  it('records a new event when the drift changes', async () => {
    seed('Acme Plumbing Pty Ltd');
    await call();
    seed('Acme Plumbing Services');
    await call();
    expect(events.size).toBe(2);
  });

  it('does not write when everything matches', async () => {
    seed('Acme Plumbing');
    const res = await call();
    expect(res.status).toBe(200);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('keeps the audit response and status when the writer fails', async () => {
    seed('Acme Plumbing Pty Ltd');
    mockRecord.mockRejectedValueOnce(new Error('db down'));
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allMatch).toBe(false);
    expect(body.mismatches).toHaveLength(1);
  });
});
