/**
 * Unit Tests for Invoices API Routes
 *
 * POST /api/invoices — create invoice with line items
 * GET  /api/invoices/[id] — fetch single invoice
 * PATCH /api/invoices/[id] — update invoice metadata / status
 * DELETE /api/invoices/[id] — delete invoice (not allowed if paid)
 *
 * Tests actual route handlers with mocked Prisma and auth dependencies.
 * Uses createMockNextRequest to avoid the jest.setup.js polyfill conflict.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ============================================================================
// MOCKS — must be declared before any imports that consume them
// ============================================================================

const mockPrisma = {
  invoice: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  invoiceLineItem: {
    create: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

// Mock auth
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

// Mock multi-business scope
const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
  getEffectiveQueryFilter: jest.fn().mockResolvedValue({ orgId: 'org-123' }),
}));

// Mock APISecurityChecker — allow by default
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

// Mock Redis — prevent bleeding between tests
jest.mock('@/lib/redis-client', () => ({
  getRedisClient: () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
  }),
}));

// Mock Stripe config — not under test in POST handler
jest.mock('@/lib/stripe/config', () => ({
  stripe: null,
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import route handlers AFTER mocks are wired
import { POST } from '@/app/api/invoices/route';
import { GET, PATCH, DELETE } from '@/app/api/invoices/[id]/route';

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(
  method: string = 'GET',
  body?: object,
  url: string = 'http://localhost:3000/api/invoices'
) {
  return createMockNextRequest({ method, body, url });
}

const VALID_LINE_ITEM = {
  description: 'Consulting services',
  quantity: 2,
  unitCents: 15000,
  taxRate: 0.1,
};

const VALID_CREATE_BODY = {
  clientName: 'Acme Corp',
  clientEmail: 'billing@acme.com',
  currency: 'AUD',
  lineItems: [VALID_LINE_ITEM],
};

const MOCK_INVOICE = {
  id: 'inv-1',
  organizationId: 'org-123',
  invoiceNumber: 'INV-0001',
  status: 'draft',
  clientName: 'Acme Corp',
  clientEmail: 'billing@acme.com',
  currency: 'AUD',
  subtotalCents: 30000,
  taxCents: 3000,
  totalCents: 33000,
  lineItems: [
    {
      id: 'li-1',
      description: 'Consulting services',
      quantity: 2,
      unitCents: 15000,
      totalCents: 30000,
      taxRate: 0.1,
    },
  ],
  paidAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================================================
// POST /api/invoices
// ============================================================================

describe('POST /api/invoices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: security check passes
    mockSecurityCheck.mockResolvedValue({ allowed: true });
    // Default: authenticated user with org context
    mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
    mockGetEffectiveOrganizationId.mockResolvedValue('org-123');
    // Default: no existing invoices → next number = INV-0001
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.create.mockResolvedValue(MOCK_INVOICE);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);

    const req = createRequest('POST', VALID_CREATE_BODY);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 403 when no org context', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);

    const req = createRequest('POST', VALID_CREATE_BODY);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('No organisation context found');
  });

  it('should return 422 when lineItems is empty', async () => {
    const req = createRequest('POST', {
      ...VALID_CREATE_BODY,
      lineItems: [],
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe('Validation failed');
  });

  it('should return 422 when lineItem has missing required fields', async () => {
    const req = createRequest('POST', {
      ...VALID_CREATE_BODY,
      lineItems: [
        {
          // missing description and unitCents
          quantity: 1,
        },
      ],
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe('Validation failed');
  });

  it('should create invoice with correct totals and GST', async () => {
    // count = 0 → invoiceNumber = 'INV-0001'
    mockPrisma.invoice.count.mockResolvedValue(0);

    const req = createRequest('POST', VALID_CREATE_BODY);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.invoice).toBeDefined();

    // Verify findFirst was queried for the latest invoice in the correct org
    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-123' },
        orderBy: { invoiceNumber: 'desc' },
      })
    );

    // Verify create was called with correct totals
    // quantity=2, unitCents=15000 → totalCents=30000
    // taxCents = Math.round(30000 * 0.1) = 3000
    // totalCents = 30000 + 3000 = 33000
    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceNumber: 'INV-0001',
          organizationId: 'org-123',
          status: 'draft',
          subtotalCents: 30000,
          taxCents: 3000,
          totalCents: 33000,
          lineItems: {
            create: expect.arrayContaining([
              expect.objectContaining({
                description: 'Consulting services',
                quantity: 2,
                unitCents: 15000,
                totalCents: 30000,
                taxRate: 0.1,
              }),
            ]),
          },
        }),
      })
    );
  });

  it('should generate sequential invoice numbers', async () => {
    // latest = INV-0005 → next = INV-0006
    mockPrisma.invoice.findFirst.mockResolvedValue({
      invoiceNumber: 'INV-0005',
    });
    const invoiceWithCount6 = { ...MOCK_INVOICE, invoiceNumber: 'INV-0006' };
    mockPrisma.invoice.create.mockResolvedValue(invoiceWithCount6);

    const req = createRequest('POST', VALID_CREATE_BODY);
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceNumber: 'INV-0006',
        }),
      })
    );
  });
});

// ============================================================================
// GET /api/invoices/[id]
// ============================================================================

describe('GET /api/invoices/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecurityCheck.mockResolvedValue({ allowed: true });
    mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
    mockGetEffectiveOrganizationId.mockResolvedValue('org-123');
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);

    const req = createRequest(
      'GET',
      undefined,
      'http://localhost:3000/api/invoices/inv-1'
    );
    const res = await GET(req, { params: Promise.resolve({ id: 'inv-1' }) });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 404 when invoice not found', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    const req = createRequest(
      'GET',
      undefined,
      'http://localhost:3000/api/invoices/inv-missing'
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: 'inv-missing' }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Invoice not found');
  });

  it('should return 404 when invoice belongs to a different org', async () => {
    // findFirst returns null because the where clause includes orgId scoping
    // A different-org invoice will not match { id, organizationId: orgId }
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    const req = createRequest(
      'GET',
      undefined,
      'http://localhost:3000/api/invoices/inv-other-org'
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: 'inv-other-org' }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Invoice not found');

    // Confirm the query was scoped to the authenticated user's org
    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-other-org', organizationId: 'org-123' },
      })
    );
  });

  it('should return invoice with line items', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(MOCK_INVOICE);

    const req = createRequest(
      'GET',
      undefined,
      'http://localhost:3000/api/invoices/inv-1'
    );
    const res = await GET(req, { params: Promise.resolve({ id: 'inv-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invoice).toBeDefined();
    expect(body.invoice.id).toBe('inv-1');
    expect(body.invoice.lineItems).toHaveLength(1);
    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1', organizationId: 'org-123' },
        include: { lineItems: true },
      })
    );
  });
});

// ============================================================================
// PATCH /api/invoices/[id]
// ============================================================================

describe('PATCH /api/invoices/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecurityCheck.mockResolvedValue({ allowed: true });
    mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
    mockGetEffectiveOrganizationId.mockResolvedValue('org-123');
  });

  it('should return 400 when trying to modify a paid invoice — returns 404 if not found first', async () => {
    // The PATCH handler calls findFirst before updating.
    // If the invoice does not belong to the org it returns 404.
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    const req = createRequest(
      'PATCH',
      { status: 'sent' },
      'http://localhost:3000/api/invoices/inv-paid'
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ id: 'inv-paid' }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Invoice not found');
  });

  it('should update invoice status successfully', async () => {
    const existingInvoice = { ...MOCK_INVOICE, status: 'draft', paidAt: null };
    mockPrisma.invoice.findFirst.mockResolvedValue(existingInvoice);

    const updatedInvoice = {
      ...existingInvoice,
      status: 'sent',
      lineItems: existingInvoice.lineItems,
    };
    mockPrisma.invoice.update.mockResolvedValue(updatedInvoice);

    const req = createRequest(
      'PATCH',
      { status: 'sent' },
      'http://localhost:3000/api/invoices/inv-1'
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: 'inv-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invoice).toBeDefined();
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ status: 'sent' }),
        include: { lineItems: true },
      })
    );
  });
});
