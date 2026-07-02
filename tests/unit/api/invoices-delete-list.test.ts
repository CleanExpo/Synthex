/**
 * Unit Tests — Invoice DELETE + list (UNI-173, backlog #5 close-out).
 *
 * The create/GET/PATCH handlers are covered by invoices.test.ts. These two
 * handlers shipped without coverage:
 *   DELETE /api/invoices/[id] — auth ladder + cross-org 404 + paid-guard 409
 *   GET    /api/invoices/list — auth ladder + org-scoped where + status filter
 *                               + keyset pagination cursor
 *
 * Uses createMockNextRequest to avoid the jest.setup.js polyfill conflict.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ============================================================================
// MOCKS — declared before any imports that consume them
// ============================================================================

const mockPrisma = {
  invoice: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockGetUserIdFromRequestOrCookies = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) =>
    mockGetUserIdFromRequestOrCookies(...args),
  unauthorizedResponse: () => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  },
}));

const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
  getEffectiveQueryFilter: jest.fn().mockResolvedValue({ orgId: 'org-123' }),
}));

const mockSecurityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (body: unknown, status: number) => {
      const { NextResponse } = require('next/server');
      return NextResponse.json(body, { status });
    },
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true },
    AUTHENTICATED_WRITE: { requireAuth: true },
  },
}));

jest.mock('@/lib/redis-client', () => ({
  getRedisClient: () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('@/lib/stripe/config', () => ({ stripe: null }));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Import route handlers AFTER mocks are wired
import { DELETE } from '@/app/api/invoices/[id]/route';
import { GET as LIST } from '@/app/api/invoices/list/route';

// ============================================================================
// HELPERS
// ============================================================================

const MOCK_INVOICE = {
  id: 'inv-1',
  organizationId: 'org-123',
  invoiceNumber: 'INV-0001',
  status: 'draft',
  clientName: 'Acme Corp',
  totalCents: 33000,
  lineItems: [],
};

function authedDefaults() {
  jest.clearAllMocks();
  mockSecurityCheck.mockResolvedValue({ allowed: true });
  mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
  mockGetEffectiveOrganizationId.mockResolvedValue('org-123');
}

// ============================================================================
// DELETE /api/invoices/[id]
// ============================================================================

describe('DELETE /api/invoices/[id]', () => {
  beforeEach(authedDefaults);

  function del(id: string) {
    const req = createMockNextRequest({
      method: 'DELETE',
      url: `http://localhost:3000/api/invoices/${id}`,
    });
    return DELETE(req, { params: Promise.resolve({ id }) });
  }

  it('returns 401 when not authenticated', async () => {
    mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);
    const res = await del('inv-1');
    expect(res.status).toBe(401);
    expect(mockPrisma.invoice.delete).not.toHaveBeenCalled();
  });

  it('returns 403 when no org context', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const res = await del('inv-1');
    expect(res.status).toBe(403);
    expect(mockPrisma.invoice.delete).not.toHaveBeenCalled();
  });

  it('returns 404 (cross-org / missing) — read is org-scoped', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    const res = await del('inv-other-org');
    expect(res.status).toBe(404);
    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-other-org', organizationId: 'org-123' },
      })
    );
    expect(mockPrisma.invoice.delete).not.toHaveBeenCalled();
  });

  it('returns 409 and does not delete a paid invoice', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({
      ...MOCK_INVOICE,
      status: 'paid',
    });
    const res = await del('inv-1');
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe('Cannot delete a paid invoice');
    expect(mockPrisma.invoice.delete).not.toHaveBeenCalled();
  });

  it('deletes a non-paid invoice → 200', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({
      ...MOCK_INVOICE,
      status: 'draft',
    });
    mockPrisma.invoice.delete.mockResolvedValue(MOCK_INVOICE);
    const res = await del('inv-1');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPrisma.invoice.delete).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
    });
  });
});

// ============================================================================
// GET /api/invoices/list
// ============================================================================

describe('GET /api/invoices/list', () => {
  beforeEach(authedDefaults);

  function list(query = '') {
    const req = createMockNextRequest({
      method: 'GET',
      url: `http://localhost:3000/api/invoices/list${query}`,
    });
    return LIST(req);
  }

  it('returns 401 when not authenticated', async () => {
    mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);
    const res = await list();
    expect(res.status).toBe(401);
    expect(mockPrisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it('returns 403 when no org context', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const res = await list();
    expect(res.status).toBe(403);
    expect(mockPrisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it('lists only the caller org rows (org-scoped where)', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([MOCK_INVOICE]);
    const res = await list();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.invoices).toHaveLength(1);
    expect(mockPrisma.invoice.findMany.mock.calls[0][0].where).toEqual({
      organizationId: 'org-123',
    });
  });

  it('applies the status filter when provided', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    await list('?status=paid');
    expect(mockPrisma.invoice.findMany.mock.calls[0][0].where).toEqual({
      organizationId: 'org-123',
      status: 'paid',
    });
  });

  it('returns a nextCursor only when a full page is returned', async () => {
    // limit defaults to 50; a short page → nextCursor null
    mockPrisma.invoice.findMany.mockResolvedValue([MOCK_INVOICE]);
    const res = await list();
    const body = await res.json();
    expect(body.nextCursor).toBeNull();
  });

  it('honours the keyset cursor + capped limit', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    await list('?cursor=inv-9&limit=500');
    const arg = mockPrisma.invoice.findMany.mock.calls[0][0];
    expect(arg.take).toBe(200); // limit capped at 200
    expect(arg.skip).toBe(1);
    expect(arg.cursor).toEqual({ id: 'inv-9' });
  });
});
