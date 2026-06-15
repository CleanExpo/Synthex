/**
 * Unit Tests for White-Label Configuration API Route
 *
 * GET /api/white-label/config — read the active brand's white-label config
 * PUT /api/white-label/config — update the active brand's white-label config
 *
 * Brand-scope regression guard (audit #2, wrong-brand-WRITE): a multi-business
 * owner who has switched brand must read AND write the white-label config of the
 * ACTIVE brand (resolved via getEffectiveOrganizationId), not their home org.
 *
 * Tests the actual route handlers with mocked Prisma, security, and scope deps.
 * Uses createMockNextRequest to avoid the jest.setup.js polyfill conflict.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ============================================================================
// MOCKS — must be declared before any imports that consume them
// ============================================================================

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

// Mock multi-business scope — the canonical effective-org resolver
const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

// Mock APISecurityChecker — allow by default, surface a userId in the context
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
    ADMIN_ONLY: { requireAuth: true },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import route handlers AFTER mocks are wired
import { GET, PUT } from '@/app/api/white-label/config/route';

// ============================================================================
// HELPERS / FIXTURES
// ============================================================================

const USER_ID = 'user-owner';
const HOME_ORG = 'org-home';
const ACTIVE_BRAND = 'org-active-brand';

function createRequest(
  method: string = 'GET',
  body?: object,
  url: string = 'http://localhost:3000/api/white-label/config'
) {
  return createMockNextRequest({ method, body, url });
}

function allowedContext() {
  return { allowed: true, context: { userId: USER_ID, requestId: 'req-1' } };
}

// ============================================================================
// GET /api/white-label/config
// ============================================================================

describe('GET /api/white-label/config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecurityCheck.mockResolvedValue(allowedContext());
  });

  it('returns 401 when the security check is not allowed', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Authentication required',
      context: { requestId: 'req-1' },
    });

    const res = await GET(createRequest('GET'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
    // Never reaches the org resolver when unauthenticated
    expect(mockGetEffectiveOrganizationId).not.toHaveBeenCalled();
  });

  it('reads the ACTIVE brand (not the home org) for a brand-switched owner', async () => {
    // Brand-switched owner: effective org is the active brand, != home org.
    mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);
    mockPrisma.organization.findUnique.mockResolvedValue({
      settings: { primaryColor: '#123456', companyName: 'Active Brand' },
      customDomain: 'active.example.com',
    });

    const res = await GET(createRequest('GET'));
    const body = await res.json();

    expect(res.status).toBe(200);
    // The Organization read targets the ACTIVE brand id, never the home org id.
    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: ACTIVE_BRAND },
      select: { settings: true, customDomain: true },
    });
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: HOME_ORG } })
    );
    // Returns the active brand's config
    expect(body.theme.primaryColor).toBe('#123456');
    expect(body.theme.companyName).toBe('Active Brand');
    expect(body.theme.customDomain).toBe('active.example.com');
  });

  it('preserves the no-org fallback (200 + empty theme) when there is no org context', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);

    const res = await GET(createRequest('GET'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ theme: {}, message: 'No organization found' });
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });
});

// ============================================================================
// PUT /api/white-label/config
// ============================================================================

describe('PUT /api/white-label/config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecurityCheck.mockResolvedValue(allowedContext());
    mockPrisma.organization.findUnique.mockResolvedValue({
      settings: { primaryColor: '#000000' },
    });
    mockPrisma.organization.update.mockResolvedValue({});
  });

  it('returns 401 when the security check is not allowed', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Admin access required',
      context: { requestId: 'req-1' },
    });

    const res = await PUT(createRequest('PUT', { companyName: 'X' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Admin access required');
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid payload (does not touch the database)', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);

    const res = await PUT(createRequest('PUT', { primaryColor: 'not-a-hex' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it('writes the ACTIVE brand (not the home org) for a brand-switched owner', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(ACTIVE_BRAND);

    const res = await PUT(
      createRequest('PUT', {
        companyName: 'Active Co',
        primaryColor: '#abcdef',
        customDomain: 'brand.example.com',
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Both the read and the update target the ACTIVE brand id.
    expect(mockGetEffectiveOrganizationId).toHaveBeenCalledWith(USER_ID);
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: ACTIVE_BRAND },
      select: { settings: true },
    });
    expect(mockPrisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ACTIVE_BRAND } })
    );
    // Never reads or writes the home org.
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: HOME_ORG } })
    );
    expect(mockPrisma.organization.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: HOME_ORG } })
    );

    // Payload behaviour unchanged: settings merged, customDomain split out.
    const updateArg = mockPrisma.organization.update.mock.calls[0][0];
    expect(updateArg.data.settings).toEqual(
      expect.objectContaining({
        primaryColor: '#abcdef',
        companyName: 'Active Co',
      })
    );
    expect(updateArg.data.customDomain).toBe('brand.example.com');
  });

  it('preserves the no-org fallback (400) when there is no org context', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);

    const res = await PUT(createRequest('PUT', { companyName: 'X' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('No organization found');
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });
});
