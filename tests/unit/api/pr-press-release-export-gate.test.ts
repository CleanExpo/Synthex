/**
 * AT-014 — PATCH publish blocked until approved; approve requires permission.
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
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

import { PATCH } from '@/app/api/pr/press-releases/[id]/route';
import { PR_EXPORT_APPROVE_PERMISSIONS } from '@/lib/pr/export-gate';

function req(body: object) {
  return createMockNextRequest({
    method: 'PATCH',
    url: 'http://localhost/api/pr/press-releases/rel-1',
    body,
  });
}
const params = Promise.resolve({ id: 'rel-1' });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-1');
  mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
  mockEnforceAgencyPermission.mockResolvedValue(null);
});

describe('PATCH press-releases/[id] — AT-014 export gate', () => {
  it('blocks draft → published without prior approval', async () => {
    mockPrisma.pressRelease.findFirst.mockResolvedValue({
      id: 'rel-1',
      status: 'draft',
    });

    const res = await PATCH(req({ status: 'published' }), { params });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.gate).toBe('pr-export');
    expect(mockPrisma.pressRelease.update).not.toHaveBeenCalled();
  });

  it('allows approved → published when permission clears', async () => {
    mockPrisma.pressRelease.findFirst.mockResolvedValue({
      id: 'rel-1',
      status: 'approved',
    });
    mockPrisma.pressRelease.update.mockResolvedValue({
      id: 'rel-1',
      status: 'published',
    });

    const res = await PATCH(req({ status: 'published' }), { params });

    expect(res.status).toBe(200);
    expect(mockEnforceAgencyPermission).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      PR_EXPORT_APPROVE_PERMISSIONS
    );
    expect(mockPrisma.pressRelease.update).toHaveBeenCalled();
  });

  it('stamping approved requires owner/admin permission', async () => {
    mockPrisma.pressRelease.findFirst.mockResolvedValue({
      id: 'rel-1',
      status: 'draft',
    });
    mockPrisma.pressRelease.update.mockResolvedValue({
      id: 'rel-1',
      status: 'approved',
    });

    const res = await PATCH(req({ status: 'approved' }), { params });

    expect(res.status).toBe(200);
    expect(mockEnforceAgencyPermission).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      PR_EXPORT_APPROVE_PERMISSIONS
    );
  });

  it('rejects approve stamp when permission denied', async () => {
    mockPrisma.pressRelease.findFirst.mockResolvedValue({
      id: 'rel-1',
      status: 'draft',
    });
    const { NextResponse } = await import('next/server');
    mockEnforceAgencyPermission.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );

    const res = await PATCH(req({ status: 'approved' }), { params });
    expect(res.status).toBe(403);
    expect(mockPrisma.pressRelease.update).not.toHaveBeenCalled();
  });
});
