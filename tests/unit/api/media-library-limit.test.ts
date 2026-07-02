/**
 * Unit Tests for Media Library API Route — pagination bounds
 *
 * GET /api/media/library — verifies the `limit`/`offset` query params are
 * validated against the FilterSchema bounds (limit 1–100, offset >= 0) before
 * they reach the Supabase `.range()` query.
 *
 * Regression: the route previously declared FilterSchema with `.max(100)` but
 * never applied it — `parseInt(limit)` flowed straight into the service, so
 * `?limit=999999` produced an unbounded media query. These tests drive the real
 * GET handler with a mocked service + security checker.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ============================================================================
// MOCKS — must be declared before importing the route under test
// ============================================================================

// Mock the media-library service so we can assert what filterOptions reach it.
const mockGetAssets = jest.fn();
jest.mock('@/lib/services/media-library', () => ({
  mediaLibraryService: {
    getAssets: (...args: unknown[]) => mockGetAssets(...args),
  },
  // MediaFilterOptions is a type-only export; no runtime value needed.
}));

// Mock the audit logger (imported at module load).
jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: jest.fn().mockResolvedValue(undefined) },
}));

// Mock the logger.
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// Mock APISecurityChecker — allow by default, pass through the status.
const mockSecurityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (body: unknown, status = 200) => {
      const { NextResponse } = require('next/server');
      return NextResponse.json(body, { status });
    },
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true },
    AUTHENTICATED_WRITE: { requireAuth: true },
  },
}));

// Import the real handler AFTER mocks are registered.
import { GET } from '@/app/api/media/library/route';

const URL_BASE = 'http://localhost:3000/api/media/library';

function allowAuth(userId = 'user-123') {
  mockSecurityCheck.mockResolvedValue({
    allowed: true,
    context: { userId },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAssets.mockResolvedValue({ assets: [], total: 0 });
});

describe('GET /api/media/library — pagination bounds', () => {
  it('rejects an over-max limit with 400 and never hits the service', async () => {
    allowAuth();
    const req = createMockNextRequest({ url: `${URL_BASE}?limit=999999` });

    const res = await GET(req as never);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Validation error');
    expect(mockGetAssets).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric limit with 400', async () => {
    allowAuth();
    const req = createMockNextRequest({ url: `${URL_BASE}?limit=abc` });

    const res = await GET(req as never);

    expect(res.status).toBe(400);
    expect(mockGetAssets).not.toHaveBeenCalled();
  });

  it('rejects a zero limit with 400 (min is 1)', async () => {
    allowAuth();
    const req = createMockNextRequest({ url: `${URL_BASE}?limit=0` });

    const res = await GET(req as never);

    expect(res.status).toBe(400);
    expect(mockGetAssets).not.toHaveBeenCalled();
  });

  it('rejects a negative offset with 400', async () => {
    allowAuth();
    const req = createMockNextRequest({ url: `${URL_BASE}?offset=-5` });

    const res = await GET(req as never);

    expect(res.status).toBe(400);
    expect(mockGetAssets).not.toHaveBeenCalled();
  });

  it('accepts an in-range limit and offset and forwards them to the service', async () => {
    allowAuth('user-abc');
    const req = createMockNextRequest({
      url: `${URL_BASE}?limit=25&offset=50`,
    });

    const res = await GET(req as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetAssets).toHaveBeenCalledWith(
      'user-abc',
      expect.objectContaining({ limit: 25, offset: 50 })
    );
    expect(json.limit).toBe(25);
    expect(json.offset).toBe(50);
  });

  it('accepts the boundary limit of 100', async () => {
    allowAuth();
    const req = createMockNextRequest({ url: `${URL_BASE}?limit=100` });

    const res = await GET(req as never);

    expect(res.status).toBe(200);
    expect(mockGetAssets).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ limit: 100 })
    );
  });

  it('uses the service default (no limit forwarded) when limit is omitted', async () => {
    allowAuth();
    const req = createMockNextRequest({ url: URL_BASE });

    const res = await GET(req as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetAssets).toHaveBeenCalledWith(
      'user-123',
      expect.not.objectContaining({ limit: expect.anything() })
    );
    // Route reports the 50 default in the response envelope.
    expect(json.limit).toBe(50);
  });
});
