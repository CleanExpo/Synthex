/**
 * Track B — org PATCH provenance guards (spec §11, criteria 2, 15, 17).
 *
 * PATCH /api/organizations/[orgId] full-replaces `settings` with arbitrary
 * client keys. Two guards keep provisioning identity server-owned:
 *   1. `settings.provisioning` is a RESERVED key: stripped from client
 *      writes, the server value re-applied — a client admin can neither
 *      alter nor erase it (criteria 2 & 15).
 *   2. Slug changes are rejected for orgs carrying `settings.provisioning`
 *      so a provisioned child's slug can never drift from its derivation
 *      (criterion 17's rename guard).
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

jest.mock('@/lib/api/response-optimizer', () => {
  const { NextResponse } = require('next/server');
  return {
    ResponseOptimizer: {
      createResponse: (data: unknown, opts?: { status?: number }) =>
        NextResponse.json(data, { status: opts?.status ?? 200 }),
      createErrorResponse: (
        message: string,
        status: number,
        details?: unknown
      ) =>
        NextResponse.json(
          { error: message, ...(details ? { details } : {}) },
          { status }
        ),
    },
    cacheHeaders: { none: 'no-store' },
  };
});

jest.mock('@/lib/cache/cache-manager', () => ({
  getCache: () => ({ invalidateByTag: jest.fn() }),
}));

// --- Prisma mock ----------------------------------------------------------
const mockUserFindFirst = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockTxOrgUpdate = jest.fn();
const mockTxAuditCreate = jest.fn();
const mockTransaction = jest.fn();

const txMock = {
  organization: { update: (...a: unknown[]) => mockTxOrgUpdate(...a) },
  auditLog: { create: (...a: unknown[]) => mockTxAuditCreate(...a) },
};

const prismaMock = {
  user: { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) },
  organization: { findUnique: (...a: unknown[]) => mockOrgFindUnique(...a) },
  $transaction: (...a: unknown[]) => mockTransaction(...a),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { PATCH } from '@/app/api/organizations/[orgId]/route';

const ORG_ID = 'org-child-1';
const USER_ID = 'user-client-admin';

const SERVER_PROVISIONING = {
  externalRef: 'CRM-4711',
  parentOrgId: 'org-brand-1',
  provisionedBy: 'user-brand-admin',
  provisionedAt: '2026-07-11T00:00:00.000Z',
};

function makeExistingOrg(settings: Record<string, unknown>) {
  return {
    id: ORG_ID,
    name: 'Acme Restorations',
    slug: 'c-abcdefghijkl',
    plan: 'free',
    status: 'active',
    domain: 'c-abcdefghijkl.synthex.social',
    customDomain: null,
    settings,
    updatedAt: new Date('2026-07-11T00:00:00Z'),
  };
}

function patchRequest(body: object) {
  return createMockNextRequest({
    method: 'PATCH',
    url: `http://localhost/api/organizations/${ORG_ID}`,
    body,
  });
}

const paramsArg = { params: Promise.resolve({ orgId: ORG_ID }) };

function setupOrg(settings: Record<string, unknown>) {
  const existing = makeExistingOrg(settings);
  mockOrgFindUnique.mockImplementation(async (args: any) => {
    if (args?.where?.slug) return null; // slug uniqueness check — free
    if (args?.select?.settings) return { settings }; // isOrgAdmin lookup
    return existing; // full `existing` fetch
  });
  return existing;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue(USER_ID);
  mockUserFindFirst.mockResolvedValue({ id: USER_ID });
  mockTxOrgUpdate.mockImplementation(async ({ data }: any) =>
    makeExistingOrg((data.settings as Record<string, unknown>) ?? {})
  );
  mockTxAuditCreate.mockResolvedValue({});
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof txMock) => unknown) => fn(txMock)
  );
});

describe('PATCH /api/organizations/[orgId] — reserved settings.provisioning (criteria 2 & 15)', () => {
  it('a client PATCH cannot ALTER the provisioning key — server value re-applied', async () => {
    setupOrg({
      admins: [USER_ID],
      theme: 'light',
      provisioning: SERVER_PROVISIONING,
    });

    const res = await PATCH(
      patchRequest({
        settings: {
          theme: 'dark',
          provisioning: { externalRef: 'FORGED', parentOrgId: 'org-evil' },
        },
      }),
      paramsArg
    );

    expect(res.status).toBe(200);
    const written = mockTxOrgUpdate.mock.calls[0][0].data.settings;
    expect(written.provisioning).toEqual(SERVER_PROVISIONING);
    expect(written.theme).toBe('dark');
  });

  it('a client PATCH cannot ERASE the provisioning key by omitting it', async () => {
    setupOrg({ admins: [USER_ID], provisioning: SERVER_PROVISIONING });

    const res = await PATCH(
      patchRequest({ settings: { theme: 'dark' } }),
      paramsArg
    );

    expect(res.status).toBe(200);
    const written = mockTxOrgUpdate.mock.calls[0][0].data.settings;
    expect(written.provisioning).toEqual(SERVER_PROVISIONING);
  });

  it('a client cannot FORGE provisioning onto a non-provisioned org', async () => {
    setupOrg({ admins: [USER_ID], theme: 'light' });

    const res = await PATCH(
      patchRequest({
        settings: { provisioning: { externalRef: 'FORGED' } },
      }),
      paramsArg
    );

    expect(res.status).toBe(200);
    const written = mockTxOrgUpdate.mock.calls[0][0].data.settings;
    expect(written).not.toHaveProperty('provisioning');
  });
});

describe('PATCH /api/organizations/[orgId] — plan cannot be self-granted (SYN-1105 P1)', () => {
  it('ignores a client-supplied plan — org plan is never written from the body', async () => {
    setupOrg({ admins: [USER_ID], theme: 'light' });

    const res = await PATCH(
      patchRequest({ name: 'Renamed', plan: 'enterprise' }),
      paramsArg
    );

    expect(res.status).toBe(200);
    const written = mockTxOrgUpdate.mock.calls[0][0].data;
    // The self-granted plan must never reach the DB write.
    expect(written).not.toHaveProperty('plan');
    expect(written).not.toHaveProperty('maxUsers');
    expect(written.name).toBe('Renamed');
  });
});

describe('PATCH /api/organizations/[orgId] — client Auto Label policy', () => {
  it('accepts a bounded client-specific workflow taxonomy', async () => {
    setupOrg({ admins: [USER_ID] });

    const autoLabelPipeline = {
      name: 'Restoration intake v3',
      version: 3,
      autoApplyThreshold: 0.8,
      suggestThreshold: 0.55,
      labels: [
        {
          id: 'process-site-assessment',
          name: 'Site assessment',
          dimension: 'workflow',
          matchAny: ['moisture inspection'],
          sourceKinds: [],
          routeTo: 'assessment-queue',
          requiresReview: false,
        },
      ],
    };
    const res = await PATCH(
      patchRequest({ settings: { autoLabelPipeline } }),
      paramsArg
    );

    expect(res.status).toBe(200);
    expect(
      mockTxOrgUpdate.mock.calls[0][0].data.settings.autoLabelPipeline
    ).toEqual(autoLabelPipeline);
  });

  it('rejects a taxonomy whose review threshold exceeds auto-apply', async () => {
    setupOrg({ admins: [USER_ID] });

    const res = await PATCH(
      patchRequest({
        settings: {
          autoLabelPipeline: {
            name: 'Broken policy',
            version: 1,
            autoApplyThreshold: 0.6,
            suggestThreshold: 0.8,
            labels: [
              {
                id: 'broken',
                name: 'Broken',
                dimension: 'workflow',
                matchAny: ['broken'],
                sourceKinds: [],
                requiresReview: false,
              },
            ],
          },
        },
      }),
      paramsArg
    );

    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/organizations/[orgId] — slug guard for provisioned orgs (criterion 17)', () => {
  it('rejects (409) a slug change on an org carrying settings.provisioning', async () => {
    setupOrg({ admins: [USER_ID], provisioning: SERVER_PROVISIONING });

    const res = await PATCH(patchRequest({ slug: 'drifted-slug' }), paramsArg);

    expect(res.status).toBe(409);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('still allows a slug change on a NON-provisioned org', async () => {
    setupOrg({ admins: [USER_ID], theme: 'light' });

    const res = await PATCH(patchRequest({ slug: 'fresh-slug' }), paramsArg);

    expect(res.status).toBe(200);
    const data = mockTxOrgUpdate.mock.calls[0][0].data;
    expect(data.slug).toBe('fresh-slug');
  });
});
