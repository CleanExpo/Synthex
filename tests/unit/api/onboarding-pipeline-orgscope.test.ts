/**
 * SYN-1022 — org-scope isolation. The pipeline must persist a scraped profile
 * ONLY under the caller's own organisation; one tenant's intake can never write
 * into another tenant's OnboardingProgress.
 */
import { POST } from '@/app/api/onboarding/pipeline/route';
import { createMockNextRequest } from '../../helpers/mock-request';

const mockGetUserId = jest.fn();
const mockUnauthorizedResponse = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
  unauthorizedResponse: (...args: unknown[]) => mockUnauthorizedResponse(...args),
}));

jest.mock('@/lib/ai/discover-website', () => ({
  discoverWebsite: jest.fn(),
}));

const mockRunPipeline = jest.fn();
jest.mock('@/lib/ai/onboarding-pipeline', () => ({
  runOnboardingPipeline: (...args: unknown[]) => mockRunPipeline(...args),
}));

const mockOrgFindFirst = jest.fn();
const mockUpsert = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findFirst: (...a: unknown[]) => mockOrgFindFirst(...a) },
    onboardingProgress: { upsert: (...a: unknown[]) => mockUpsert(...a) },
  },
}));

describe('POST /api/onboarding/pipeline — org-scope isolation (SYN-1022)', () => {
  beforeEach(() => {
    mockUpsert.mockResolvedValue({});
    mockRunPipeline.mockResolvedValue({
      businessName: 'Acme',
      url: 'https://acme.com.au',
      dataRequired: [],
      confidence: 80,
    });
    // org resolution is itself scoped to the calling user
    mockOrgFindFirst.mockImplementation(
      (args: { where?: { users?: { some?: { id?: string } } } }) => {
        const uid = args?.where?.users?.some?.id;
        if (uid === 'user-A') return Promise.resolve({ id: 'org-A' });
        if (uid === 'user-B') return Promise.resolve({ id: 'org-B' });
        return Promise.resolve(null);
      }
    );
    const { NextResponse } = require('next/server');
    mockUnauthorizedResponse.mockReturnValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
  });

  it('persists each tenant under its own org and never another tenant', async () => {
    mockGetUserId.mockResolvedValue('user-A');
    await POST(
      createMockNextRequest({
        method: 'POST',
        body: { url: 'https://acme.com.au', businessName: 'Acme' },
      }) as any
    );

    mockGetUserId.mockResolvedValue('user-B');
    await POST(
      createMockNextRequest({
        method: 'POST',
        body: { url: 'https://acme.com.au', businessName: 'Acme' },
      }) as any
    );

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    const firstWrite = mockUpsert.mock.calls[0][0];
    const secondWrite = mockUpsert.mock.calls[1][0];

    // Each write is bound to the calling tenant's org — both in the unique key and the create row
    expect(firstWrite.where.userId_organizationId).toEqual({
      userId: 'user-A',
      organizationId: 'org-A',
    });
    expect(firstWrite.create.organizationId).toBe('org-A');

    expect(secondWrite.where.userId_organizationId).toEqual({
      userId: 'user-B',
      organizationId: 'org-B',
    });
    expect(secondWrite.create.organizationId).toBe('org-B');

    // Cross-tenant guarantee: tenant A's write never references org-B and vice versa
    expect(JSON.stringify(firstWrite)).not.toContain('org-B');
    expect(JSON.stringify(secondWrite)).not.toContain('org-A');
  });
});
