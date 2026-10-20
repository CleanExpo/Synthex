/**
 * PlatformPost lineage (seam audit 06 §B5) — publish-queue publisher.
 *
 * processPublishQueue used to log the platform post id and write nothing
 * analytics can read, so a queue publish (including a released nexus-viral
 * social cut) was invisible to analytics-sync. On success it now writes a
 * PlatformPost whose metadata = { postId, studioDraftId, cutAssetId }.
 *
 * Harness copied from tests/auto-publish/failure-modes.test.ts.
 */

const mockPrisma = {
  publishQueueItem: {
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  contentCalendar: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  platformConnection: {
    findFirst: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  notification: {
    createMany: jest.fn(),
  },
  platformPost: {
    create: jest.fn(),
  },
  organization: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/publish/safetyChecks', () => ({
  runSafetyChecks: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/instagram', () => ({
  publishToInstagram: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/facebook', () => ({
  publishToFacebook: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/linkedin', () => ({
  publishToLinkedIn: jest.fn(),
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
jest.mock('@/lib/security/field-encryption', () => ({
  decryptField: jest.fn(() => null),
}));
jest.mock('@/components/marketing/PostAttributionFooter', () => ({
  buildAttribution: jest.fn(() => ({
    body: undefined,
    firstComment: undefined,
  })),
}));
jest.mock('@/lib/marketing-agency/campaign-authority-manifest', () => ({
  extractCampaignAuthorityManifest: jest.fn(),
}));
jest.mock('@/lib/marketing-agency/publish-gate', () => ({
  assertCampaignPublishable: jest.fn(() => ({ allowed: true, blockers: [] })),
}));
jest.mock('@/lib/platform-connections/token-readiness', () => ({
  resolvePlatformAccessToken: jest.fn(),
}));
jest.mock('@/lib/publish/postPublishClaim', () => ({
  claimQueueItemForPublish: jest.fn(),
  reclaimStalePublishingQueueItems: jest.fn(),
}));
jest.mock('@/lib/publish/socialCutSource', () => ({
  UNKNOWN_SOCIAL_CUT_PATTERN: jest.requireActual(
    '@/lib/publish/socialCutSource'
  ).UNKNOWN_SOCIAL_CUT_PATTERN,
  isSocialCutSlot: jest.fn(() => false),
  resolveSocialCutSource: jest.fn(),
}));
jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: jest.fn().mockResolvedValue(undefined),
}));

import { processPublishQueue } from '@/lib/publish/publishQueue';
import { runSafetyChecks } from '@/lib/publish/safetyChecks';
import { publishToFacebook } from '@/lib/publish/platformAdapters/facebook';
import { resolvePlatformAccessToken } from '@/lib/platform-connections/token-readiness';
import {
  claimQueueItemForPublish,
  reclaimStalePublishingQueueItems,
} from '@/lib/publish/postPublishClaim';
import { trackPipelineCost } from '@/lib/pipelines/track-cost';
import { buildAttribution } from '@/components/marketing/PostAttributionFooter';
import {
  isSocialCutSlot,
  resolveSocialCutSource,
} from '@/lib/publish/socialCutSource';
import { decryptField } from '@/lib/security/field-encryption';

const dueItem = {
  id: 'qi1',
  organizationId: 'org1',
  calendarId: 'cal1',
  slotId: 'slot1',
  platform: 'facebook',
  scheduledAt: new Date('2026-07-01T00:00:00.000Z'),
  attempts: 0,
  status: 'pending',
};

/** Arrange the happy path up to the platform dispatch. */
function primeQueueRun() {
  // Re-arm implementation-carrying mocks (jest config resets implementations).
  (buildAttribution as jest.Mock).mockReturnValue({
    body: undefined,
    firstComment: undefined,
  });
  (isSocialCutSlot as jest.Mock).mockReturnValue(false);
  (decryptField as jest.Mock).mockReturnValue(null);
  (trackPipelineCost as jest.Mock).mockResolvedValue(undefined);
  (reclaimStalePublishingQueueItems as jest.Mock).mockResolvedValue(0);
  mockPrisma.publishQueueItem.findMany.mockResolvedValue([{ ...dueItem }]);
  (runSafetyChecks as jest.Mock).mockResolvedValue({ pass: true });
  (claimQueueItemForPublish as jest.Mock).mockResolvedValue(true);
  mockPrisma.platformConnection.findFirst.mockResolvedValue({
    accessToken: 'encrypted-token',
    refreshToken: null,
    encryptionKeyVersion: 1,
    profileId: 'page-1',
  });
  (resolvePlatformAccessToken as jest.Mock).mockReturnValue({
    ok: true,
    accessToken: 'decrypted-token',
  });
  mockPrisma.contentCalendar.findUnique.mockResolvedValue({
    slots: {
      slots: [{ id: 'slot1', platform: 'facebook', captions: ['Hello AU'] }],
    },
  });
  mockPrisma.contentCalendar.update.mockResolvedValue({});
  mockPrisma.publishQueueItem.update.mockResolvedValue({});
  mockPrisma.publishQueueItem.updateMany.mockResolvedValue({ count: 2 });
  mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
  mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });
  mockPrisma.organization.update.mockResolvedValue({});
  mockPrisma.organization.findUnique.mockResolvedValue({
    autoPublishPaused: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  primeQueueRun();
});

describe('publish queue success → PlatformPost with lineage metadata', () => {
  it('records the cut asset id and its pattern for a released social cut', async () => {
    const cutPattern = {
      source: 'method-card',
      methodCardId: 'viral-hero-short',
      libraryPatternId: null,
      lengthBandSec: '30-60',
      aspect: '9:16',
      platform: 'facebook',
      format: 'short',
    };
    (isSocialCutSlot as jest.Mock).mockReturnValue(true);
    (resolveSocialCutSource as jest.Mock).mockResolvedValue({
      caption: 'Cut caption',
      video: { url: 'https://cdn.example/cut-9.mp4' },
      pattern: cutPattern,
    });
    mockPrisma.publishQueueItem.findMany.mockResolvedValue([
      { ...dueItem, slotId: 'social-cut:cut-9' },
    ]);
    mockPrisma.platformConnection.findFirst.mockResolvedValue({
      id: 'conn-fb',
      accessToken: 'encrypted-token',
      refreshToken: null,
      encryptionKeyVersion: 1,
      profileId: 'page-1',
    });
    mockPrisma.platformPost.create.mockResolvedValue({});
    (publishToFacebook as jest.Mock).mockResolvedValue({
      success: true,
      platformPostId: 'fb-post-1',
    });

    const result = await processPublishQueue();

    expect(result.published).toBe(1);
    expect(mockPrisma.platformPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        connectionId: 'conn-fb',
        platformId: 'fb-post-1',
        content: 'Cut caption',
        mediaUrls: ['https://cdn.example/cut-9.mp4'],
        status: 'published',
        metadata: {
          postId: null,
          studioDraftId: null,
          cutAssetId: 'cut-9',
          publishQueueItemId: 'qi1',
          pattern: cutPattern,
        },
      }),
    });
  });

  it('a duplicate PlatformPost write never fails a confirmed publish', async () => {
    mockPrisma.platformConnection.findFirst.mockResolvedValue({
      id: 'conn-fb',
      accessToken: 'encrypted-token',
      refreshToken: null,
      encryptionKeyVersion: 1,
      profileId: 'page-1',
    });
    mockPrisma.platformPost.create.mockRejectedValue(
      new Error('Unique constraint failed')
    );
    (publishToFacebook as jest.Mock).mockResolvedValue({
      success: true,
      platformPostId: 'fb-post-2',
    });

    const result = await processPublishQueue();

    expect(result.published).toBe(1);
    expect(mockPrisma.platformPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        platformId: 'fb-post-2',
        // A calendar item records no pattern: unknown, never invented.
        metadata: expect.objectContaining({
          cutAssetId: null,
          pattern: expect.objectContaining({
            source: 'unknown',
            methodCardId: null,
          }),
        }),
      }),
    });
  });
});
