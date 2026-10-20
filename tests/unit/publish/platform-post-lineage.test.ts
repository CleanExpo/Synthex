/**
 * PlatformPost lineage (seam audit 06 §B5) — Post cron publisher.
 *
 * /api/cron/publish-scheduled writes a PlatformPost on success so
 * analytics-sync can attach PlatformMetrics to it. Without the Post id and the
 * Studio draft id on that row, a metric can only reach the draft through a
 * fragile join on Post.analytics.platformPostId. The row now carries
 * metadata = { postId, studioDraftId, cutAssetId } (no schema change).
 *
 * Harness copied from tests/unit/publish/linkedin-article-link.test.ts (same
 * route, same success path).
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';

const mockPrisma = {
  post: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  platformConnection: { findFirst: jest.fn(), update: jest.fn() },
  notification: { create: jest.fn() },
  platformPost: { create: jest.fn() },
  organization: { findUnique: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));

const mockCreatePlatformService = jest.fn();
jest.mock('@/lib/social', () => ({
  isPlatformSupported: () => true,
  createPlatformService: (...args: unknown[]) =>
    mockCreatePlatformService(...args),
}));

jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (v: string) => v,
  decryptField: () => null,
  encryptField: (v: string) => v,
}));
jest.mock('@/lib/unite-group-connector', () => ({
  pushUniteGroupEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// publishQueue's adapters — only LinkedIn is exercised; the rest are stubbed
// so importing the module never touches a provider SDK.
jest.mock('@/lib/publish/platformAdapters/linkedin', () => ({
  publishToLinkedIn: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/instagram', () => ({
  publishToInstagram: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/facebook', () => ({
  publishToFacebook: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/twitter', () => ({
  publishToTwitter: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/threads', () => ({
  publishToThreads: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/youtube', () => ({
  publishToYouTube: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/tiktok', () => ({
  publishToTikTok: jest.fn(),
}));
jest.mock('@/lib/publish/safetyChecks', () => ({
  runSafetyChecks: jest.fn(),
  resolveOrgAutoPublishGate: jest.fn(async () => ({ allowed: true })),
}));
jest.mock('@/components/marketing/PostAttributionFooter', () => ({
  buildAttribution: jest.fn(() => ({
    body: undefined,
    firstComment: undefined,
  })),
}));

import { GET } from '@/app/api/cron/publish-scheduled/route';
import { resolveOrgAutoPublishGate } from '@/lib/publish/safetyChecks';
import { buildAttribution } from '@/components/marketing/PostAttributionFooter';
import { UNKNOWN_SOCIAL_CUT_PATTERN } from '@/lib/publish/socialCutSource';

const LINK =
  'https://carsi.au/courses?utm_source=synthex&utm_medium=linkedin&utm_campaign=studio-carsi&utm_content=d1';

function linkedinManifest() {
  return buildApprovedCampaignAuthorityManifest({
    platformOutputs: [
      { platform: 'linkedin', status: 'approved', contentRef: 'post-li' },
    ],
  });
}

function duePost(metadata: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    content: 'CARSI post body',
    platform: 'linkedin',
    scheduledAt: new Date('2026-09-02T14:00:00.000Z'),
    metadata: { campaignAuthorityManifest: linkedinManifest(), ...metadata },
    campaign: {
      userId: 'u1',
      platform: 'linkedin',
      organizationId: 'org-carsi',
      settings: {},
      content: {},
    },
  };
}

function cronRequest() {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/publish-scheduled',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockPrisma.post.findMany.mockResolvedValue([]);
  mockPrisma.post.findUnique.mockResolvedValue({
    status: 'scheduled',
    publishedAt: null,
    metadata: {},
  });
  mockPrisma.post.update.mockResolvedValue({});
  mockPrisma.post.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.platformConnection.findFirst.mockResolvedValue({
    id: 'conn-li',
    accessToken: 'tok',
    refreshToken: null,
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    profileId: 'urn:li:organization:42',
    profileName: 'CARSI',
  });
  mockPrisma.platformConnection.update.mockResolvedValue({});
  mockPrisma.notification.create.mockResolvedValue({});
  mockPrisma.platformPost.create.mockResolvedValue({});
  mockPrisma.organization.findUnique.mockResolvedValue({ slug: 'carsi' });
  (buildAttribution as jest.Mock).mockReturnValue({
    body: undefined,
    firstComment: undefined,
  });
});

describe('Post cron → PlatformPost carries its Post and Studio draft ids', () => {
  it('records postId + studioDraftId on the PlatformPost of a published Studio post', async () => {
    const createPost = jest.fn().mockResolvedValue({
      success: true,
      postId: 'urn:li:share:77',
    });
    mockCreatePlatformService.mockReturnValue({ createPost });
    (resolveOrgAutoPublishGate as jest.Mock).mockResolvedValue({
      allowed: true,
      calendarMode: 'live',
      autoPublishPaused: false,
    });
    const studioPost = duePost({ source: 'studio', studioDraftId: 'draft-42' });
    // Inside the 48 h window — an older Studio post expires instead.
    studioPost.scheduledAt = new Date(Date.now() - 60 * 1000);
    mockPrisma.post.findMany.mockResolvedValue([studioPost]);

    const res = await GET(cronRequest());
    const body = await res.json();

    expect(body.published).toBe(1);
    expect(mockPrisma.platformPost.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.platformPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        connectionId: 'conn-li',
        platformId: 'urn:li:share:77',
        metadata: {
          postId: 'p1',
          studioDraftId: 'draft-42',
          cutAssetId: null,
          pattern: UNKNOWN_SOCIAL_CUT_PATTERN,
        },
      }),
    });
  });

  it('records studioDraftId: null for a non-Studio post (never invents a draft)', async () => {
    const createPost = jest.fn().mockResolvedValue({
      success: true,
      postId: 'urn:li:share:78',
    });
    mockCreatePlatformService.mockReturnValue({ createPost });
    (resolveOrgAutoPublishGate as jest.Mock).mockResolvedValue({
      allowed: true,
      calendarMode: 'live',
      autoPublishPaused: false,
    });
    mockPrisma.post.findMany.mockResolvedValue([duePost()]);

    await GET(cronRequest());

    expect(mockPrisma.platformPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: {
          postId: 'p1',
          studioDraftId: null,
          cutAssetId: null,
          pattern: UNKNOWN_SOCIAL_CUT_PATTERN,
        },
      }),
    });
  });

  it('copies a recorded pattern from the Post onto the PlatformPost', async () => {
    const createPost = jest.fn().mockResolvedValue({
      success: true,
      postId: 'urn:li:share:79',
    });
    mockCreatePlatformService.mockReturnValue({ createPost });
    (resolveOrgAutoPublishGate as jest.Mock).mockResolvedValue({
      allowed: true,
      calendarMode: 'live',
      autoPublishPaused: false,
    });
    const pattern = {
      source: 'method-card',
      methodCardId: 'retention-3beat',
      libraryPatternId: null,
      lengthBandSec: '15-30',
      aspect: '9:16',
      platform: 'linkedin',
      format: 'short',
    };
    mockPrisma.post.findMany.mockResolvedValue([duePost({ pattern })]);

    await GET(cronRequest());

    expect(mockPrisma.platformPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ pattern }),
      }),
    });
  });
});
