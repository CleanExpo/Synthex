/**
 * Unit tests for the Auto-Research trigger route — POST /api/auto-research.
 *
 * Drives the real route handler with mocked auth, BullMQ enqueue, and the
 * multi-business scope helpers. The load-bearing case is the cross-org guard:
 * when the client passes an explicit `orgId` it must be authorised via
 * `resolveCampaignOrganizationId` (→ 403 on no access), NOT trusted blindly —
 * otherwise org A could trigger a research run that persists TrendInsights and
 * incurs Apify/AI spend scoped to org B.
 *
 * Order: 401 → 403 → 400 → 503 (queue down) → 202 happy.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// --- Mock the BullMQ enqueue so no Redis is required ---
const mockEnqueueManualRun = jest.fn();
class ResearchQueueUnavailableError extends Error {
  constructor(message = 'Research queue unavailable (Redis/BullMQ down)') {
    super(message);
    this.name = 'ResearchQueueUnavailableError';
  }
}
jest.mock('@/lib/auto-research', () => ({
  enqueueManualRun: (...args: unknown[]) => mockEnqueueManualRun(...args),
  ResearchQueueUnavailableError,
}));

// --- Mock multi-business scope ---
const mockGetEffectiveOrganizationId = jest.fn();
const mockResolveCampaignOrganizationId = jest.fn();
// Real OrgAccessError so the route's `instanceof` check behaves correctly.
class OrgAccessError extends Error {
  constructor(message = 'Forbidden — no access to target organization') {
    super(message);
    this.name = 'OrgAccessError';
  }
}
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
  resolveCampaignOrganizationId: (...args: unknown[]) =>
    mockResolveCampaignOrganizationId(...args),
  OrgAccessError,
}));

// --- Mock auth ---
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

// Prisma is only used by the GET handler; provide a stub so the module imports.
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { autoResearchRun: { findMany: jest.fn() } },
  prisma: { autoResearchRun: { findMany: jest.fn() } },
}));

import { POST } from '@/app/api/auto-research/route';

function postRequest(body?: object) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost:3000/api/auto-research',
    body,
  });
}

describe('POST /api/auto-research — org-scope authorisation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
    mockGetEffectiveOrganizationId.mockResolvedValue('org-123');
    mockEnqueueManualRun.mockResolvedValue('job-1');
    // Default: delegate to the real-helper contract — explicit org authorised,
    // omitted org falls back to the effective org.
    mockResolveCampaignOrganizationId.mockImplementation(
      async (_userId: string, requested?: string | null) =>
        requested ?? 'org-123'
    );
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);

    const res = await POST(postRequest({ type: 'daily_trends' }));

    expect(res.status).toBe(401);
    expect(mockEnqueueManualRun).not.toHaveBeenCalled();
  });

  it('returns 403 and enqueues nothing when targeting an org the user cannot access', async () => {
    // The canonical helper throws OrgAccessError for an unauthorised target org.
    mockResolveCampaignOrganizationId.mockRejectedValue(new OrgAccessError());

    const res = await POST(
      postRequest({ type: 'daily_trends', orgId: 'victim-org' })
    );

    expect(res.status).toBe(403);
    // The cross-org run must NOT be enqueued — no TrendInsights / spend on org B.
    expect(mockEnqueueManualRun).not.toHaveBeenCalled();
    expect(mockResolveCampaignOrganizationId).toHaveBeenCalledWith(
      'user-123',
      'victim-org'
    );
  });

  it('returns 400 when the body fails Zod validation', async () => {
    const res = await POST(postRequest({ type: 'not_a_real_type' }));

    expect(res.status).toBe(400);
    expect(mockEnqueueManualRun).not.toHaveBeenCalled();
  });

  it('returns 503 fail-closed when Redis/BullMQ is unavailable (no fake job)', async () => {
    mockEnqueueManualRun.mockRejectedValue(
      new ResearchQueueUnavailableError('Redis enqueue timed out')
    );

    const res = await POST(postRequest({ type: 'daily_trends' }));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json).toMatchObject({
      error: 'Research queue unavailable',
      status: 'unavailable',
    });
    expect(json.jobId).toBeUndefined();
    expect(mockEnqueueManualRun).toHaveBeenCalledWith(
      'daily_trends',
      'org-123'
    );
  });

  it('enqueues against the verified org when the user has access to the requested org', async () => {
    const res = await POST(
      postRequest({ type: 'weekly_deep', orgId: 'org-123' })
    );

    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json).toMatchObject({ type: 'weekly_deep', status: 'queued' });
    expect(mockEnqueueManualRun).toHaveBeenCalledWith('weekly_deep', 'org-123');
  });

  it('falls back to the effective org when no orgId is supplied', async () => {
    const res = await POST(postRequest({ type: 'daily_trends' }));

    expect(res.status).toBe(202);
    expect(mockResolveCampaignOrganizationId).toHaveBeenCalledWith(
      'user-123',
      undefined
    );
    expect(mockEnqueueManualRun).toHaveBeenCalledWith(
      'daily_trends',
      'org-123'
    );
  });
});
