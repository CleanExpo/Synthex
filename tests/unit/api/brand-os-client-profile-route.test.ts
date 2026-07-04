/**
 * Brand OS + Client Profile routes — auth + validation regression tests (SYN-515)
 *
 * Drives the real GET/POST/PATCH handlers for
 *   app/api/organizations/[orgId]/brand-os
 *   app/api/organizations/[orgId]/client-profile
 * covering 401 / 404 / 403 / 400 / 200 / 201 / 409.
 */

const mockPrisma = {
  user: { findFirst: jest.fn() },
  organization: { findUnique: jest.fn() },
  brandOperatingSystem: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  clientProfile: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

jest.mock('@/lib/cache/cache-manager', () => ({
  getCache: () => ({ invalidateByTag: async () => 0 }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
  },
  NextRequest: class {},
}));

// Plain functions (resetMocks:true would strip jest.fn implementations here).
jest.mock('@/lib/api/response-optimizer', () => ({
  ResponseOptimizer: {
    createResponse: (data: unknown, options?: { status?: number }) =>
      new Response(JSON.stringify(data), { status: options?.status ?? 200 }),
    createErrorResponse: (
      message: string,
      status: number,
      details?: Record<string, unknown>
    ) =>
      new Response(
        JSON.stringify({ error: message, ...(details && { details }) }),
        { status }
      ),
  },
}));

import {
  GET as brandOsGET,
  POST as brandOsPOST,
  PATCH as brandOsPATCH,
} from '@/app/api/organizations/[orgId]/brand-os/route';
import {
  GET as clientGET,
  POST as clientPOST,
} from '@/app/api/organizations/[orgId]/client-profile/route';
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const ORG = 'org-1';
const USER = 'u1';
const ctx = { params: Promise.resolve({ orgId: ORG }) };

function req(method: string, body?: object) {
  return createMockNextRequest({
    url: `http://localhost/api/organizations/${ORG}/brand-os`,
    method,
    body,
  }) as unknown as import('next/server').NextRequest;
}

function asMember() {
  mockPrisma.user.findFirst.mockResolvedValue({ id: USER, organizationId: ORG });
  mockPrisma.organization.findUnique.mockResolvedValue({ settings: { admins: [] } });
}
function asAdmin() {
  mockPrisma.user.findFirst.mockResolvedValue({ id: USER, organizationId: ORG });
  mockPrisma.organization.findUnique.mockResolvedValue({
    settings: { admins: [USER] },
  });
}

beforeEach(() => {
  mockGetUserId.mockResolvedValue(USER);
  mockPrisma.user.findFirst.mockResolvedValue(null);
  mockPrisma.organization.findUnique.mockResolvedValue(null);
  mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue(null);
  mockPrisma.clientProfile.findUnique.mockResolvedValue(null);
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
    cb(mockPrisma)
  );
});

describe('brand-os route', () => {
  it('GET → 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await brandOsGET(req('GET'), ctx);
    expect(res.status).toBe(401);
  });

  it('GET → 404 for a non-member', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await brandOsGET(req('GET'), ctx);
    expect(res.status).toBe(404);
  });

  it('GET → 200 with null when the member has no BrandOperatingSystem', async () => {
    asMember();
    const res = await brandOsGET(req('GET'), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.brandOperatingSystem).toBeNull();
  });

  it('POST → 403 for a member who is not an admin', async () => {
    asMember();
    const res = await brandOsPOST(req('POST', { method: 'STEPPS' }), ctx);
    expect(res.status).toBe(403);
  });

  it('POST → 400 on invalid body (qualityThreshold out of range)', async () => {
    asAdmin();
    const res = await brandOsPOST(req('POST', { qualityThreshold: 999 }), ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request data');
    expect(body.details).toBeDefined();
  });

  it('POST → 201 creating a new BrandOperatingSystem', async () => {
    asAdmin();
    mockPrisma.brandOperatingSystem.create.mockResolvedValue({
      id: 'bos-1',
      organizationId: ORG,
    });
    const res = await brandOsPOST(
      req('POST', { method: 'STEPPS', rules: ['no hype'] }),
      ctx
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.brandOperatingSystem.create).toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('POST → 409 when a BrandOperatingSystem already exists', async () => {
    asAdmin();
    mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue({ id: 'bos-1' });
    const res = await brandOsPOST(req('POST', { method: 'x' }), ctx);
    expect(res.status).toBe(409);
  });

  it('PATCH → 404 when there is nothing to update', async () => {
    asAdmin();
    mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue(null);
    const res = await brandOsPATCH(req('PATCH', { method: 'x' }), ctx);
    expect(res.status).toBe(404);
  });

  it('PATCH → 200 updating an existing BrandOperatingSystem', async () => {
    asAdmin();
    mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue({ id: 'bos-1' });
    mockPrisma.brandOperatingSystem.update.mockResolvedValue({
      id: 'bos-1',
      method: 'STEPPS',
    });
    const res = await brandOsPATCH(req('PATCH', { method: 'STEPPS' }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe('client-profile route', () => {
  it('GET → 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await clientGET(req('GET'), ctx);
    expect(res.status).toBe(401);
  });

  it('GET → 200 with null when the member has no ClientProfile', async () => {
    asMember();
    const res = await clientGET(req('GET'), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clientProfile).toBeNull();
  });

  it('POST → 400 on invalid intakeStatus enum', async () => {
    asAdmin();
    const res = await clientPOST(req('POST', { intakeStatus: 'bogus' }), ctx);
    expect(res.status).toBe(400);
  });

  it('POST → 201 creating a new ClientProfile', async () => {
    asAdmin();
    mockPrisma.clientProfile.create.mockResolvedValue({ id: 'cp-1', organizationId: ORG });
    const res = await clientPOST(
      req('POST', { offers: ['loyalty app'], toneKeywords: ['warm'] }),
      ctx
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.clientProfile.create).toHaveBeenCalled();
  });
});
