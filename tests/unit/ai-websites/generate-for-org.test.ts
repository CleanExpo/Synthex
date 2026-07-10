/**
 * Tests for the canonical generateSiteForOrg service + its exposure as the
 * generate_site_from_gbp MCP studio tool. All injected deps mocked (no live
 * GBP, no live LLM).
 */
const mockPrisma = { organization: { findUnique: jest.fn() } };
const mockFindOAuthConnection = jest.fn();
const mockGetLocationDetails = jest.fn();
const mockGetReviews = jest.fn();
const mockComplete = jest.fn();

jest.mock('@/lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
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
// Cut studio-tools' heavy transitive graph (redis via generation-context,
// image/video services) so importing the registry works under jest. None are
// exercised by the generate_site_from_gbp tool.
jest.mock('@/lib/redis-client', () => ({ getRedisClient: () => ({}) }));
jest.mock('@/lib/services/ai/image-generation', () => ({
  generateImage: jest.fn(),
}));
jest.mock('@/lib/services/ai/video/generation-service', () => ({
  submitGenerativeVideo: jest.fn(),
}));
jest.mock('@/lib/services/media-library', () => ({ mediaLibraryService: {} }));
jest.mock('@/lib/services/ai/video/quota', () => ({
  quotaSnapshot: jest.fn(),
}));

import {
  generateSiteForOrg,
  GbpConnectionMissingError,
} from '@/lib/ai-websites/generate-for-org';
import { executeStudioTool } from '@/lib/services/ai/studio-tools';

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
  mockFindOAuthConnection.mockResolvedValue('conn-1');
  mockPrisma.organization.findUnique.mockResolvedValue({
    name: 'Acme Plumbing',
    website: 'https://acmeplumbing.com.au',
  });
  mockGetLocationDetails.mockResolvedValue(GBP_LOCATION);
  mockGetReviews.mockResolvedValue({ reviews: [] });
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

describe('generateSiteForOrg', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    happyDefaults();
  });

  it('resolves the connection + brand and generates a validated site', async () => {
    const { profile, result } = await generateSiteForOrg('org-1', {
      locationId: 'accounts/1/locations/2',
    });

    expect(mockFindOAuthConnection).toHaveBeenCalledWith(
      'org-1',
      'googlebusiness'
    );
    expect(mockGetLocationDetails).toHaveBeenCalledWith(
      'conn-1',
      'accounts/1/locations/2'
    );
    expect(result.ok).toBe(true);
    expect(result.slug).toBe('plumber');
    expect(profile.name).toBe('Brisbane Blocked Drains');
  });

  it('throws GbpConnectionMissingError when the org has no connection', async () => {
    mockFindOAuthConnection.mockResolvedValue(null);
    await expect(
      generateSiteForOrg('org-1', { locationId: 'accounts/1/locations/2' })
    ).rejects.toBeInstanceOf(GbpConnectionMissingError);
  });

  it('throws when the organisation record is missing', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    await expect(
      generateSiteForOrg('org-1', { locationId: 'accounts/1/locations/2' })
    ).rejects.toThrow(/Organisation not found/);
  });
});

describe('generate_site_from_gbp MCP tool', () => {
  const ctx = {
    userId: 'user-1',
    organizationId: 'org-1',
    initiatedBy: 'mcp' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    happyDefaults();
  });

  it('is registered and returns the shaped site payload', async () => {
    const out = await executeStudioTool(
      'generate_site_from_gbp',
      { locationId: 'accounts/1/locations/2' },
      ctx
    );
    expect(out.ok).toBe(true);
    expect(out.slug).toBe('plumber');
    expect(out.canonicalUrl).toBe(
      'https://brisbaneblockeddrains.com.au/plumber/'
    );
    expect(out.html).toContain('<h1>');
    expect((out.profile as { name: string }).name).toBe(
      'Brisbane Blocked Drains'
    );
  });

  it('returns { ok:false, error } (not a throw) when no GBP connection', async () => {
    mockFindOAuthConnection.mockResolvedValue(null);
    const out = await executeStudioTool(
      'generate_site_from_gbp',
      { locationId: 'accounts/1/locations/2' },
      ctx
    );
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/No Google Business Profile connection/);
  });

  it('rejects an invalid args payload before any side effect', async () => {
    await expect(
      executeStudioTool('generate_site_from_gbp', { notLocationId: 'x' }, ctx)
    ).rejects.toThrow();
    expect(mockFindOAuthConnection).not.toHaveBeenCalled();
  });
});
