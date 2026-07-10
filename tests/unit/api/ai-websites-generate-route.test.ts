/**
 * Unit tests for POST /api/ai-websites/generate — the reachable composition
 * root over lib/site-generator. Covers the auth/resolution glue (401, missing
 * connection, missing org) and the success path, with every injected dep
 * mocked (no live GBP, no live LLM).
 */
import type { NextRequest } from 'next/server';

const mockSecurityChecker = {
  check: jest.fn(),
};
const mockPrisma = {
  organization: { findUnique: jest.fn() },
};
const mockGetEffectiveOrganizationId = jest.fn();
const mockFindOAuthConnection = jest.fn();
const mockGetLocationDetails = jest.fn();
const mockGetReviews = jest.fn();
const mockComplete = jest.fn();

jest.mock('@/lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: mockSecurityChecker,
  DEFAULT_POLICIES: { AUTHENTICATED_READ: {}, AUTHENTICATED_WRITE: {} },
}));
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: mockGetEffectiveOrganizationId,
}));
jest.mock('@/lib/google/google-auth', () => ({
  findOAuthConnection: mockFindOAuthConnection,
}));
jest.mock('@/lib/google/business-profile', () => ({
  getLocationDetails: mockGetLocationDetails,
  getReviews: mockGetReviews,
}));
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: () => ({ complete: mockComplete }),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { POST } from '@/app/api/ai-websites/generate/route';

function req(body: unknown): NextRequest {
  // Minimal fake — the route only calls request.json(); the request object is
  // otherwise handed to the (mocked) security checker.
  return { json: async () => body } as unknown as NextRequest;
}

const GBP_LOCATION = {
  name: 'accounts/1/locations/2',
  locationName: 'Brisbane Blocked Drains',
  address: {
    addressLines: ['10 Trade St'],
    locality: 'Brisbane',
    administrativeArea: 'QLD',
    postalCode: '4000',
    regionCode: 'AU',
  },
  primaryPhone: '+61730000000',
  websiteUri: 'https://brisbaneblockeddrains.com.au',
  primaryCategory: { displayName: 'Plumber' },
};

function happyDefaults() {
  mockSecurityChecker.check.mockResolvedValue({
    allowed: true,
    context: { userId: 'user-1' },
  });
  mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
  mockFindOAuthConnection.mockResolvedValue('conn-1');
  mockPrisma.organization.findUnique.mockResolvedValue({
    name: 'Acme Plumbing',
    website: 'https://acmeplumbing.com.au',
  });
  mockGetLocationDetails.mockResolvedValue(GBP_LOCATION);
  mockGetReviews.mockResolvedValue({ reviews: [] });
  // Valid LLM copy that names the hero service noun ('plumber').
  mockComplete.mockResolvedValue({
    choices: [{ message: { content: '' } }],
    parsed: {
      headline: 'Trusted plumber in Brisbane',
      intro: 'Our Brisbane team handles plumber call-outs the same day.',
      bodyParagraphs: [
        'Every plumber job starts with an on-site assessment and a written quote.',
      ],
      faqs: [],
    },
  });
}

describe('POST /api/ai-websites/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    happyDefaults();
  });

  it('returns 401 when unauthenticated', async () => {
    mockSecurityChecker.check.mockResolvedValue({
      allowed: false,
      error: 'Unauthorised',
    });
    const res = await POST(req({ locationId: 'accounts/1/locations/2' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when the body fails validation', async () => {
    const res = await POST(req({ notLocationId: 'x' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Validation failed/);
  });

  it('returns 400 when no GBP connection exists', async () => {
    mockFindOAuthConnection.mockResolvedValue(null);
    const res = await POST(req({ locationId: 'accounts/1/locations/2' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/No Google Business Profile connection/);
  });

  it('generates a validated site from a connected GBP location', async () => {
    const res = await POST(req({ locationId: 'accounts/1/locations/2' }));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.slug).toBe('plumber');
    expect(json.canonicalUrl).toBe(
      'https://brisbaneblockeddrains.com.au/plumber/'
    );
    expect(json.copy.headline).toBe('Trusted plumber in Brisbane');
    expect(json.html).toContain('<h1>');
    // The GBP client was called with the resolved connection id + location.
    expect(mockGetLocationDetails).toHaveBeenCalledWith(
      'conn-1',
      'accounts/1/locations/2'
    );
    expect(json.profile.name).toBe('Brisbane Blocked Drains');
  });

  it('falls back to deterministic copy when the LLM output is non-compliant', async () => {
    mockComplete.mockResolvedValue({
      choices: [{ message: { content: '' } }],
      parsed: {
        headline: 'AI repairs your plumber problems overnight',
        intro: 'AI does everything.',
        bodyParagraphs: ['AI handles the plumber work.'],
        faqs: [],
      },
    });
    const res = await POST(req({ locationId: 'accounts/1/locations/2' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    // The validator gate held end-to-end through the route: non-compliant LLM
    // copy never shipped; deterministic copy took over.
    expect(json.ok).toBe(true);
    expect(json.copy.headline.toLowerCase()).not.toContain('ai repairs');
    expect(json.copy.headline.toLowerCase()).toContain('plumber');
  });
});
