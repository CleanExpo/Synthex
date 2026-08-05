/**
 * AT-014 — PR export gate on POST distribute.
 *
 * Fail closed: draft/archived block export. Cleared (approved|published) +
 * owner/admin permission allow distribution.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...a: unknown[]) =>
    mockGetEffectiveOrganizationId(...a),
}));

const mockEnforceAgencyPermission = jest.fn();
jest.mock('@/lib/agency/agency-api-auth', () => ({
  enforceAgencyPermission: (...a: unknown[]) =>
    mockEnforceAgencyPermission(...a),
}));

const mockPrisma = {
  pressRelease: { findFirst: jest.fn(), update: jest.fn() },
  pRDistribution: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

import { POST } from '@/app/api/pr/press-releases/[id]/distribute/route';
import { PR_EXPORT_APPROVE_PERMISSIONS } from '@/lib/pr/export-gate';

function req(body: object) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/pr/press-releases/rel-1/distribute',
    body,
  });
}
const params = Promise.resolve({ id: 'rel-1' });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-1');
  mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
  mockEnforceAgencyPermission.mockResolvedValue(null);
  mockPrisma.pRDistribution.findFirst.mockResolvedValue(null);
  mockPrisma.pRDistribution.upsert.mockResolvedValue({
    id: 'dist-1',
    channel: 'self-hosted',
    status: 'submitted',
  });
  mockPrisma.pressRelease.update.mockResolvedValue({});
  mockPrisma.pRDistribution.update.mockResolvedValue({});
});

describe('POST distribute — AT-014 export gate', () => {
  it('blocks export when release is still draft (fail closed)', async () => {
    mockPrisma.pressRelease.findFirst.mockResolvedValue({
      id: 'rel-1',
      slug: 'launch',
      orgId: 'org-1',
      status: 'draft',
    });

    const res = await POST(req({ channels: ['self-hosted'] }), { params });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json).toMatchObject({
      error: 'Export blocked',
      gate: 'pr-export',
      agencyTaskId: 'AT-014',
    });
    expect(mockPrisma.pRDistribution.upsert).not.toHaveBeenCalled();
    expect(mockEnforceAgencyPermission).not.toHaveBeenCalled();
  });

  it('blocks export when release is archived', async () => {
    mockPrisma.pressRelease.findFirst.mockResolvedValue({
      id: 'rel-1',
      slug: 'launch',
      orgId: 'org-1',
      status: 'archived',
    });

    const res = await POST(req({ channels: ['openpr'] }), { params });
    expect(res.status).toBe(403);
    expect(mockPrisma.pRDistribution.upsert).not.toHaveBeenCalled();
  });

  it('allows export when status is approved and permission clears', async () => {
    mockPrisma.pressRelease.findFirst.mockResolvedValue({
      id: 'rel-1',
      slug: 'launch',
      orgId: 'org-1',
      status: 'approved',
    });

    const res = await POST(req({ channels: ['self-hosted'] }), { params });

    expect(res.status).toBe(200);
    expect(mockEnforceAgencyPermission).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      PR_EXPORT_APPROVE_PERMISSIONS
    );
    expect(mockPrisma.pRDistribution.upsert).toHaveBeenCalled();
    expect(mockPrisma.pressRelease.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rel-1' },
        data: expect.objectContaining({ status: 'published' }),
      })
    );
  });

  it('allows re-export when already published', async () => {
    mockPrisma.pressRelease.findFirst.mockResolvedValue({
      id: 'rel-1',
      slug: 'launch',
      orgId: 'org-1',
      status: 'published',
    });

    const res = await POST(req({ channels: ['pr-com'] }), { params });
    expect(res.status).toBe(200);
    expect(mockPrisma.pRDistribution.upsert).toHaveBeenCalled();
  });

  it('returns permission denial when RBAC blocks export', async () => {
    mockPrisma.pressRelease.findFirst.mockResolvedValue({
      id: 'rel-1',
      slug: 'launch',
      orgId: 'org-1',
      status: 'approved',
    });
    const { NextResponse } = await import('next/server');
    mockEnforceAgencyPermission.mockResolvedValue(
      NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions' },
        { status: 403 }
      )
    );

    const res = await POST(req({ channels: ['self-hosted'] }), { params });
    expect(res.status).toBe(403);
    expect(mockPrisma.pRDistribution.upsert).not.toHaveBeenCalled();
  });

  it('401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(req({ channels: ['self-hosted'] }), { params });
    expect(res.status).toBe(401);
    expect(mockPrisma.pressRelease.findFirst).not.toHaveBeenCalled();
  });

  it('403 when there is no organisation context', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    const res = await POST(req({ channels: ['self-hosted'] }), { params });
    expect(res.status).toBe(403);
    expect(mockPrisma.pressRelease.findFirst).not.toHaveBeenCalled();
  });

  it('400 when Zod validation fails', async () => {
    mockPrisma.pressRelease.findFirst.mockResolvedValue({
      id: 'rel-1',
      slug: 'launch',
      orgId: 'org-1',
      status: 'approved',
    });

    const res = await POST(req({ channels: [] }), { params });
    expect(res.status).toBe(400);
    expect(mockPrisma.pRDistribution.upsert).not.toHaveBeenCalled();
  });
});
