/**
 * Command-Centre Clients API Contract Tests — Track B v1 (criterion 4).
 *
 * The CRM caller does not exist yet (the MCP `provisioning` scope is CUT from
 * v1 — spec §5 out-of-scope). This fixture + test IS the stand-in: it pins the
 * request/response contract the future Unite-Group CRM integration codes
 * against, in-repo precedent style (hermes-handoff readiness contract).
 *
 * Fixture: tests/fixtures/command-centre-clients.contract.json
 *
 * @module tests/contract/command-centre-clients.contract.test
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// --- Mock setup (route policy runs real; identity + data layer mocked) -----
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGetUserId = jest.fn<() => Promise<string | null>>();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) =>
    (mockGetUserId as unknown as (...a: unknown[]) => unknown)(...a),
}));

const mockProvision = jest.fn<() => Promise<unknown>>();
jest.mock('@/lib/tenancy/provision-client-org', () => {
  const actual = jest.requireActual<
    typeof import('@/lib/tenancy/provision-client-org')
  >('@/lib/tenancy/provision-client-org');
  return {
    ...actual,
    provisionClientOrg: (...a: unknown[]) =>
      (mockProvision as unknown as (...a: unknown[]) => unknown)(...a),
  };
});

const mockUserFindUnique = jest.fn<() => Promise<unknown>>();
const mockOrgFindUnique = jest.fn<() => Promise<unknown>>();
const mockOrgFindMany = jest.fn<() => Promise<unknown[]>>();
const prismaMock = {
  user: { findUnique: (...a: unknown[]) => mockUserFindUnique() },
  organization: {
    findUnique: (...a: unknown[]) => mockOrgFindUnique(),
    findMany: (...a: unknown[]) => mockOrgFindMany(),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { POST, GET } from '@/app/api/command-centre/clients/route';

// --- The contract fixture ---------------------------------------------------
const FIXTURE_PATH = path.join(
  __dirname,
  '..',
  'fixtures',
  'command-centre-clients.contract.json'
);
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

// --- Response shape schemas (the contract the CRM codes against) ------------
const provisionRequestSchema = z.object({
  externalRef: z.string().min(1),
  clientName: z.string().min(1),
  ownerEmail: z.string().email(),
  plan: z.string().optional(),
});

const provisionedResponseSchema = z.object({
  success: z.literal(true),
  organization: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string().regex(/^c-[a-z0-9]{12}$/),
    plan: z.string(),
    status: z.string(),
    parentOrgId: z.string().nullable(),
    createdAt: z.union([z.string(), z.date()]),
  }),
  invitation: z
    .object({ id: z.string(), email: z.string(), status: z.string() })
    .nullable(),
  replayed: z.boolean(),
  advisory: z
    .object({
      duplicateBusinessName: z.literal(true),
      matches: z.array(
        z.object({ organizationId: z.string(), name: z.string() })
      ),
    })
    .nullable(),
  emailQueued: z.boolean(),
});

const errorResponseSchema = z.object({
  error: z.string(),
  reason: z.string().optional(),
  details: z.unknown().optional(),
});

const childrenResponseSchema = z.object({
  children: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      status: z.string(),
      plan: z.string(),
      createdAt: z.union([z.string(), z.date()]),
    })
  ),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-brand-admin');
  mockUserFindUnique.mockResolvedValue({
    organizationId: 'org-brand-1',
    teamMemberships: [],
  });
  mockOrgFindUnique.mockResolvedValue({
    id: 'org-brand-1',
    parentOrgId: null,
    status: 'active',
  });
  mockOrgFindMany.mockResolvedValue([]);
  mockProvision.mockResolvedValue({
    ...fixture.examples.provisioned.response,
    organization: {
      ...fixture.examples.provisioned.response.organization,
      createdAt: new Date(
        fixture.examples.provisioned.response.organization.createdAt
      ),
    },
  });
});

describe('contract fixture — CRM-facing examples are themselves valid', () => {
  it('example request conforms to the request contract', () => {
    expect(() =>
      provisionRequestSchema.parse(fixture.examples.provisioned.request)
    ).not.toThrow();
  });

  it('example 201 response conforms to the response contract', () => {
    expect(() =>
      provisionedResponseSchema.parse(fixture.examples.provisioned.response)
    ).not.toThrow();
  });

  it('example replay response conforms and is flagged replayed', () => {
    const replay = fixture.examples.replayed.response;
    expect(() => provisionedResponseSchema.parse(replay)).not.toThrow();
    expect(replay.replayed).toBe(true);
  });

  it('example conflict response conforms to the error contract', () => {
    expect(() =>
      errorResponseSchema.parse(fixture.examples.tombstoned.response)
    ).not.toThrow();
    expect(fixture.examples.tombstoned.status).toBe(409);
  });
});

describe('POST /api/command-centre/clients — live route honours the contract', () => {
  it('201 response body validates against the contract schema', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/command-centre/clients',
        body: fixture.examples.provisioned.request,
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(() => provisionedResponseSchema.parse(json)).not.toThrow();
  });

  it('400 validation-error body validates against the error contract', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/command-centre/clients',
        body: { clientName: 'No Ref' },
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(() => errorResponseSchema.parse(json)).not.toThrow();
  });

  it('401 unauthenticated body validates against the error contract', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/command-centre/clients',
        body: fixture.examples.provisioned.request,
      })
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(() => errorResponseSchema.parse(json)).not.toThrow();
  });
});

describe('GET /api/command-centre/clients — live route honours the contract', () => {
  it('children list validates against the contract schema', async () => {
    mockOrgFindMany.mockResolvedValue([
      {
        id: 'org-child-1',
        slug: 'c-abcdefghijkl',
        name: 'Acme Restorations',
        status: 'active',
        plan: 'free',
        createdAt: new Date('2026-07-11T00:00:00Z'),
      },
    ]);
    const res = await GET(
      createMockNextRequest({
        method: 'GET',
        url: 'http://localhost/api/command-centre/clients',
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(() => childrenResponseSchema.parse(json)).not.toThrow();
  });
});
