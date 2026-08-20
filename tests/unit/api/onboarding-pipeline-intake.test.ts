/**
 * SYN-1022 — onboarding pipeline intake routing.
 *  - name-only intake runs discovery and persists NOTHING (confirm-first)
 *  - URL intake runs the full pipeline and persists the profile
 *  - unauthenticated callers are rejected
 */
import { POST } from '@/app/api/onboarding/pipeline/route';
import { createMockNextRequest } from '../../helpers/mock-request';

const mockGetUserId = jest.fn();
const mockUnauthorizedResponse = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
  unauthorizedResponse: (...args: unknown[]) =>
    mockUnauthorizedResponse(...args),
}));

const mockDiscover = jest.fn();
jest.mock('@/lib/ai/discover-website', () => ({
  discoverWebsite: (...args: unknown[]) => mockDiscover(...args),
}));

const mockRunPipeline = jest.fn();
jest.mock('@/lib/ai/onboarding-pipeline', () => ({
  runOnboardingPipeline: (...args: unknown[]) => mockRunPipeline(...args),
}));

jest.mock('@/lib/onboarding/ensure-org', () => ({
  ensureOnboardingOrganization: () => Promise.resolve({ id: 'org-1' }),
}));

jest.mock('@/lib/onboarding/persist', () => ({
  attachUserToOrganization: () => Promise.resolve(undefined),
}));

const mockOrgFindFirst = jest.fn();
const mockUpsert = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findFirst: (...a: unknown[]) => mockOrgFindFirst(...a) },
    onboardingProgress: { upsert: (...a: unknown[]) => mockUpsert(...a) },
  },
}));

describe('POST /api/onboarding/pipeline — intake (SYN-1022)', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue('user-1');
    mockOrgFindFirst.mockResolvedValue({ id: 'org-1' });
    mockUpsert.mockResolvedValue({});
    mockDiscover.mockResolvedValue({
      status: 'resolved',
      url: 'https://acme.com.au',
      candidates: [],
      dataRequired: [],
    });
    mockRunPipeline.mockResolvedValue({
      businessName: 'Acme Co',
      url: 'https://acme.com.au',
      dataRequired: ['logo'],
      confidence: 70,
    });
    const { NextResponse } = require('next/server');
    mockUnauthorizedResponse.mockReturnValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
  });

  it('name-only intake runs discovery and persists nothing', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      body: { businessName: 'Acme Co' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe('discovery');
    expect(data.discovery.url).toBe('https://acme.com.au');
    expect(mockDiscover).toHaveBeenCalledWith('Acme Co');
    // Confirm-first: nothing scraped, nothing written
    expect(mockRunPipeline).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('URL intake runs the pipeline and persists the profile', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      body: { url: 'https://acme.com.au', businessName: 'Acme Co' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.dataRequired).toEqual(['logo']);
    expect(mockRunPipeline).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockDiscover).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated callers', async () => {
    mockGetUserId.mockResolvedValueOnce(null);
    const req = createMockNextRequest({
      method: 'POST',
      body: { businessName: 'Acme Co' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });
});
