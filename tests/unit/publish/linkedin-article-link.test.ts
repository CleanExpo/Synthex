/**
 * @jest-environment node
 *
 * g3 — a LinkedIn post carries a link into the product's sales funnel as an
 * ARTICLE card with UTM tags.
 *
 * Node environment: the cron route reaches @upstash/redis through the cache
 * layer, and under jsdom jest resolves uncrypto's browser ESM build, which the
 * transformer cannot parse (the same reason the existing cron suites only load
 * under config/jest/jest.worktree.cjs).
 *
 * Two publish paths reach LinkedIn and neither forwarded a link:
 *
 *   1. The Post cron (/api/cron/publish-scheduled) — the path a Studio-approved
 *      draft takes (g2 writes metadata.linkUrl). It called
 *      LinkedInService.createPost({ text, mediaUrls }) and never passed linkUrl,
 *      which the service already turns into an ARTICLE card.
 *   2. The publish queue (lib/publish/publishQueue.ts) — the calendar path. Its
 *      LinkedIn adapter already accepts articleUrl; dispatchToPlatform never
 *      passed it.
 *
 * Known limit (recorded, not papered over): LinkedIn's UGC API cannot mix an
 * ARTICLE card with media, so a video post carries the link in its text (see
 * approve-and-schedule.ts) and only a media-free post gets the card.
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
import { dispatchToPlatform } from '@/lib/publish/publishQueue';
import { publishToLinkedIn } from '@/lib/publish/platformAdapters/linkedin';
import { buildAttribution } from '@/components/marketing/PostAttributionFooter';

const LINK =
  'https://carsi.au/courses?utm_source=linkedin&utm_medium=social&utm_campaign=studio-carsi&utm_content=d1';

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

describe('Post cron → LinkedInService.createPost carries the funnel link', () => {
  it('forwards metadata.linkUrl as linkUrl so the service posts an ARTICLE card', async () => {
    const createPost = jest.fn().mockResolvedValue({
      success: true,
      postId: 'urn:li:share:1',
      url: 'https://www.linkedin.com/feed/update/urn:li:share:1',
    });
    mockCreatePlatformService.mockReturnValue({ createPost });
    mockPrisma.post.findMany.mockResolvedValue([duePost({ linkUrl: LINK })]);

    const res = await GET(cronRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.published).toBe(1);
    expect(createPost).toHaveBeenCalledTimes(1);
    expect(createPost).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'CARSI post body', linkUrl: LINK })
    );
  });

  it('sends no linkUrl when the post has none — nothing is invented', async () => {
    const createPost = jest.fn().mockResolvedValue({
      success: true,
      postId: 'urn:li:share:2',
    });
    mockCreatePlatformService.mockReturnValue({ createPost });
    mockPrisma.post.findMany.mockResolvedValue([duePost()]);

    await GET(cronRequest());

    expect(createPost).toHaveBeenCalledTimes(1);
    expect(createPost.mock.calls[0][0]).not.toHaveProperty('linkUrl');
  });

  it('ignores a non-string linkUrl rather than sending garbage to LinkedIn', async () => {
    const createPost = jest.fn().mockResolvedValue({
      success: true,
      postId: 'urn:li:share:3',
    });
    mockCreatePlatformService.mockReturnValue({ createPost });
    mockPrisma.post.findMany.mockResolvedValue([
      duePost({ linkUrl: { nested: true } }),
    ]);

    await GET(cronRequest());

    expect(createPost.mock.calls[0][0]).not.toHaveProperty('linkUrl');
  });
});

describe("Post cron → a Studio post respects the organisation's publish-safety state like an autopilot post", () => {
  it('leaves a Studio post scheduled (deferred) when the org is in shadow mode or paused, so the kill switch reaches it', async () => {
    const createPost = jest.fn();
    mockCreatePlatformService.mockReturnValue({ createPost });
    (resolveOrgAutoPublishGate as jest.Mock).mockResolvedValueOnce({
      allowed: false,
      reason: "Organisation calendar mode is 'shadow'",
      calendarMode: 'shadow',
      autoPublishPaused: false,
    });
    mockPrisma.post.findMany.mockResolvedValue([
      duePost({ source: 'studio', studioDraftId: 'd1', linkUrl: LINK }),
    ]);

    const res = await GET(cronRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.published).toBe(0);
    expect(createPost).not.toHaveBeenCalled();
    // Not claimed either (the atomic scheduled → publishing flip never ran):
    // the post stays 'scheduled' for a later tick.
    expect(
      mockPrisma.post.updateMany.mock.calls.some(
        ([args]: [{ data?: { status?: string } }]) =>
          args?.data?.status === 'publishing'
      )
    ).toBe(false);
    expect(resolveOrgAutoPublishGate).toHaveBeenCalledWith('org-carsi');
  });

  it('expires, never publishes, a Studio post more than 48 h past its scheduledAt — pausing is a stop, not a queue', async () => {
    const createPost = jest.fn();
    mockCreatePlatformService.mockReturnValue({ createPost });
    (resolveOrgAutoPublishGate as jest.Mock).mockResolvedValue({
      allowed: true,
      calendarMode: 'live',
      autoPublishPaused: false,
    });
    const stale = duePost({ source: 'studio', studioDraftId: 'd1' });
    stale.scheduledAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    mockPrisma.post.findMany.mockResolvedValue([stale]);

    const res = await GET(cronRequest());
    const body = await res.json();

    expect(createPost).not.toHaveBeenCalled();
    expect(body.expired).toBe(1);
    expect(body.published).toBe(0);
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ status: 'expired' }),
      })
    );
  });

  it('a human-scheduled post (no source) still passes through unchanged', async () => {
    const createPost = jest.fn().mockResolvedValue({
      success: true,
      postId: 'urn:li:share:4',
    });
    mockCreatePlatformService.mockReturnValue({ createPost });
    (resolveOrgAutoPublishGate as jest.Mock).mockResolvedValue({
      allowed: false,
      calendarMode: 'shadow',
      autoPublishPaused: false,
    });
    mockPrisma.post.findMany.mockResolvedValue([duePost()]);

    await GET(cronRequest());

    expect(createPost).toHaveBeenCalledTimes(1);
  });
});

describe('publish queue → publishToLinkedIn carries the article link', () => {
  it('passes articleUrl (and title) to the LinkedIn adapter', async () => {
    (publishToLinkedIn as jest.Mock).mockResolvedValue({
      success: true,
      platformPostId: 'urn:li:share:9',
    });

    const result = await dispatchToPlatform(
      'linkedin',
      'tok',
      'urn:li:organization:42',
      'Queue caption',
      undefined,
      { articleUrl: LINK, articleTitle: 'CARSI courses' }
    );

    expect(result.success).toBe(true);
    expect(publishToLinkedIn).toHaveBeenCalledWith(
      expect.objectContaining({
        authorUrn: 'urn:li:organization:42',
        text: 'Queue caption',
        articleUrl: LINK,
        articleTitle: 'CARSI courses',
      })
    );
  });

  it('sends no articleUrl when the slot has none', async () => {
    (publishToLinkedIn as jest.Mock).mockResolvedValue({
      success: true,
      platformPostId: 'urn:li:share:10',
    });

    await dispatchToPlatform(
      'linkedin',
      'tok',
      'urn:li:organization:42',
      'Queue caption',
      undefined,
      {}
    );

    expect(
      (publishToLinkedIn as jest.Mock).mock.calls[0][0]
    ).not.toHaveProperty('articleUrl');
  });
});
