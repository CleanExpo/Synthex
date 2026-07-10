/**
 * Social-cut → dispatch data-path reconciliation — SYN-1094 item 3.
 *
 * `deriveSocialCut` lands a nexus-viral cut on a `videoAsset` and anchors a
 * `publish_queue` row whose slotId is `social-cut:<assetId>` (NOT a CalendarSlot).
 * The dispatcher + safety gates historically read the caption / rendered video /
 * YouTube snippet from a CalendarSlot, so a human-RELEASED social-cut row had no
 * slot to source its media from and could never physically dispatch.
 *
 * These tests prove (MOCKED prisma + adapters, NO network):
 *  1. resolveSocialCutSource sources caption + video (+ optional youtube) from
 *     the stored videoAsset, org-scoped and fail-closed.
 *  2. runSafetyChecks approves a released social-cut row by provenance (no
 *     CalendarSlot required) and fails closed when the cut can't be resolved.
 *  3. processPublishQueue drives a released (pending) social-cut YouTube row to
 *     the YouTube adapter with the correct { videoUrl, title, ... } payload.
 *  4. A social-cut row whose video can't be resolved is held — adapter never
 *     called.
 *  5. A legit CalendarSlot-backed row is entirely unaffected.
 *  6. §15.9 invariant: the due-fetch only ever selects pending/failed rows, so a
 *     `queued_human_gated` social-cut row is inert until the human release route
 *     transitions it — this dispatch path never moves a row towards pending.
 */

// ── Shared mocks ──────────────────────────────────────────────────────────────

const mockPublishQueueItem = {
  findMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  create: jest.fn(),
  findFirst: jest.fn(),
};
const mockOrganization = { findUnique: jest.fn() };
const mockUser = { findMany: jest.fn() };
const mockSubscription = { findFirst: jest.fn() };
const mockAIWeeklyDigest = { count: jest.fn() };
const mockContentCalendar = {
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
};
const mockPlatformConnection = { findFirst: jest.fn() };
const mockNotification = { createMany: jest.fn() };
const mockVideoAsset = { findUnique: jest.fn() };

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const mockPublishToInstagram = jest.fn();
const mockPublishToFacebook = jest.fn();
const mockPublishToLinkedIn = jest.fn();
const mockPublishToTwitter = jest.fn();
const mockPublishToThreads = jest.fn();
const mockPublishToYouTube = jest.fn();
const mockPublishToTikTok = jest.fn();
const mockDecryptField = jest.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    publishQueueItem: mockPublishQueueItem,
    organization: mockOrganization,
    user: mockUser,
    subscription: mockSubscription,
    aIWeeklyDigest: mockAIWeeklyDigest,
    contentCalendar: mockContentCalendar,
    platformConnection: mockPlatformConnection,
    notification: mockNotification,
    videoAsset: mockVideoAsset,
  },
}));

jest.mock('@/lib/logger', () => ({ logger: mockLogger }));
jest.mock('@/lib/publish/platformAdapters/instagram', () => ({
  publishToInstagram: mockPublishToInstagram,
}));
jest.mock('@/lib/publish/platformAdapters/facebook', () => ({
  publishToFacebook: mockPublishToFacebook,
}));
jest.mock('@/lib/publish/platformAdapters/linkedin', () => ({
  publishToLinkedIn: mockPublishToLinkedIn,
}));
jest.mock('@/lib/publish/platformAdapters/twitter', () => ({
  publishToTwitter: mockPublishToTwitter,
}));
jest.mock('@/lib/publish/platformAdapters/threads', () => ({
  publishToThreads: mockPublishToThreads,
}));
jest.mock('@/lib/publish/platformAdapters/youtube', () => ({
  publishToYouTube: mockPublishToYouTube,
}));
jest.mock('@/lib/publish/platformAdapters/tiktok', () => ({
  publishToTikTok: mockPublishToTikTok,
}));
jest.mock('@/lib/security/field-encryption', () => ({
  __esModule: true,
  decryptField: (...args: unknown[]) => mockDecryptField(...args),
  encryptField: jest.fn((v: string) => `enc:${v}`),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { runSafetyChecks } from '@/lib/publish/safetyChecks';
import { processPublishQueue } from '@/lib/publish/publishQueue';
import { resolveSocialCutSource } from '@/lib/publish/socialCutSource';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';

// ── Test data ─────────────────────────────────────────────────────────────────

const ORG_ID = 'org-social-cut-1';
const CALENDAR_ID = 'cal-anchor-1';
const ASSET_ID = 'asset-cut-abc';
const SOCIAL_CUT_SLOT = `social-cut:${ASSET_ID}`;
const CUT_URL = 'https://cdn.example/hero.mp4#t=0,30&xywh=percent:20,0,60,100';
const CUT_CAPTION = 'Watch how fast we dried this out';

/** A videoAsset row exactly as `deriveSocialCut` writes it. */
function socialCutAsset(
  overrides: {
    metadata?: Record<string, unknown>;
    url?: string | null;
    thumbnail?: string | null;
  } = {}
) {
  return {
    url: overrides.url === undefined ? CUT_URL : overrides.url,
    thumbnail:
      overrides.thumbnail === undefined
        ? 'https://cdn.example/thumb.jpg'
        : overrides.thumbnail,
    metadata: overrides.metadata ?? {
      source: 'deriveSocialCut',
      organizationId: ORG_ID,
      derivedFrom: 'hero-1',
      heroKind: 'video_generation',
      aspectRatio: '9:16',
      derivation: {
        target: '9:16',
        caption: { text: CUT_CAPTION, placement: 'upper' },
      },
    },
  };
}

const BASE_QUEUE_ITEM = {
  id: 'qi-cut-1',
  organizationId: ORG_ID,
  calendarId: CALENDAR_ID,
  slotId: SOCIAL_CUT_SLOT,
  platform: 'youtube',
  scheduledAt: new Date(Date.now() - 1000), // released → due now
  status: 'pending',
  attempts: 0,
  nextRetryAt: null,
  lastError: null,
  publishedAt: null,
};

/** Healthy org-level defaults so only the approval branch is under test. */
function primeHealthyOrg() {
  mockUser.findMany.mockResolvedValue([{ id: 'user-1' }]);
  mockSubscription.findFirst.mockResolvedValue({ id: 'sub-1' });
  mockOrganization.findUnique.mockResolvedValue({ calendarMode: 'live' });
  mockAIWeeklyDigest.count.mockResolvedValue(5);
  mockPlatformConnection.findFirst.mockResolvedValue({
    id: 'conn-yt',
    accessToken: 'encrypted-token',
    refreshToken: 'enc-refresh',
    encryptionKeyVersion: 1,
    profileId: 'yt-channel-1',
    expiresAt: null,
    isActive: true,
  });
}

// ── resolveSocialCutSource ────────────────────────────────────────────────────

describe('resolveSocialCutSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sources caption + video from the stored videoAsset (org-scoped)', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(socialCutAsset());

    const source = await resolveSocialCutSource(SOCIAL_CUT_SLOT, ORG_ID);

    expect(mockVideoAsset.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ASSET_ID } })
    );
    expect(source).toEqual({
      caption: CUT_CAPTION,
      video: { url: CUT_URL, thumbnail: 'https://cdn.example/thumb.jpg' },
    });
  });

  it('forwards a stored youtube snippet when present', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(
      socialCutAsset({
        metadata: {
          source: 'deriveSocialCut',
          organizationId: ORG_ID,
          derivation: { caption: { text: CUT_CAPTION } },
          youtube: {
            title: 'Flooded office dried in 4 hours',
            description: 'The exact steps.',
            tags: ['water damage', 'restoration'],
          },
        },
      })
    );

    const source = await resolveSocialCutSource(SOCIAL_CUT_SLOT, ORG_ID);

    expect(source?.youtube).toEqual({
      title: 'Flooded office dried in 4 hours',
      description: 'The exact steps.',
      tags: ['water damage', 'restoration'],
    });
  });

  it('returns null for a non social-cut slotId (calendar slots fall through)', async () => {
    const source = await resolveSocialCutSource('slot-normal-1', ORG_ID);
    expect(source).toBeNull();
    expect(mockVideoAsset.findUnique).not.toHaveBeenCalled();
  });

  it('fails closed for a cross-org asset (no existence leak)', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(
      socialCutAsset({
        metadata: {
          source: 'deriveSocialCut',
          organizationId: 'org-someone-else',
          derivation: { caption: { text: CUT_CAPTION } },
        },
      })
    );

    const source = await resolveSocialCutSource(SOCIAL_CUT_SLOT, ORG_ID);
    expect(source).toBeNull();
  });

  it('fails closed for a non-deriveSocialCut asset', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(
      socialCutAsset({ metadata: { source: 'some-other-tool' } })
    );

    const source = await resolveSocialCutSource(SOCIAL_CUT_SLOT, ORG_ID);
    expect(source).toBeNull();
  });

  it('fails closed when the asset has no rendered video URL', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(socialCutAsset({ url: '' }));
    const source = await resolveSocialCutSource(SOCIAL_CUT_SLOT, ORG_ID);
    expect(source).toBeNull();
  });

  it('fails closed when the asset does not exist', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(null);
    const source = await resolveSocialCutSource(SOCIAL_CUT_SLOT, ORG_ID);
    expect(source).toBeNull();
  });
});

// ── runSafetyChecks (social-cut approval by provenance) ───────────────────────

describe('runSafetyChecks — social-cut approval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeHealthyOrg();
  });

  it('passes a released social-cut row without any CalendarSlot', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(socialCutAsset());

    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SOCIAL_CUT_SLOT,
      platform: 'youtube',
    });

    expect(result.pass).toBe(true);
    // The calendar-slot approval + campaign-authority gates must NOT run for a
    // social cut — its approval is provenance (broadcast grill + human release).
    expect(mockContentCalendar.findFirst).not.toHaveBeenCalled();
  });

  it('fails closed (slot_not_approved) when the cut cannot be resolved', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(null);

    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SOCIAL_CUT_SLOT,
      platform: 'youtube',
    });

    expect(result.pass).toBe(false);
    expect(result.failedGate).toBe('slot_not_approved');
  });

  it('still enforces the org-level token gate for a social cut', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(socialCutAsset());
    mockPlatformConnection.findFirst.mockResolvedValue(null); // no youtube conn

    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SOCIAL_CUT_SLOT,
      platform: 'youtube',
    });

    expect(result.pass).toBe(false);
    expect(result.failedGate).toBe('token_invalid');
  });

  it('still enforces the shadow-mode gate for a social cut', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(socialCutAsset());
    mockOrganization.findUnique.mockResolvedValue({ calendarMode: 'shadow' });

    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SOCIAL_CUT_SLOT,
      platform: 'youtube',
    });

    expect(result.pass).toBe(false);
    expect(result.failedGate).toBe('shadow_mode');
  });
});

// ── processPublishQueue (released social-cut dispatch) ────────────────────────

describe('processPublishQueue — released social-cut dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeHealthyOrg();
    mockDecryptField.mockImplementation((v: string) => `decrypted:${v}`);
    mockPublishQueueItem.update.mockResolvedValue({});
    mockPublishQueueItem.updateMany.mockImplementation(
      (args: { where?: { id?: string } }) =>
        Promise.resolve({ count: args?.where?.id ? 1 : 0 })
    );
    // markSlotPublished looks up the anchor calendar on success — harmless no-op
    // for a social cut (its sentinel slotId is not in the JSON).
    mockContentCalendar.findUnique.mockResolvedValue({ slots: { slots: [] } });
    mockContentCalendar.update.mockResolvedValue({});
    mockNotification.createMany.mockResolvedValue({ count: 1 });
    mockPublishToYouTube.mockResolvedValue({
      success: true,
      platformPostId: 'yt-video-1',
    });
  });

  it('resolves the video URL + youtube snippet from the videoAsset and reaches the YouTube adapter', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(
      socialCutAsset({
        metadata: {
          source: 'deriveSocialCut',
          organizationId: ORG_ID,
          derivation: { caption: { text: CUT_CAPTION } },
          youtube: {
            title: 'Flooded office dried in 4 hours',
            description: 'The exact steps.',
            tags: ['water damage', 'restoration'],
          },
        },
      })
    );
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);

    const result = await processPublishQueue();

    expect(result.published).toBe(1);
    expect(result.held).toBe(0);
    expect(mockPublishToYouTube).toHaveBeenCalledWith(
      expect.objectContaining({
        videoUrl: CUT_URL,
        title: 'Flooded office dried in 4 hours',
        description: 'The exact steps.',
        tags: ['water damage', 'restoration'],
        refreshToken: 'decrypted:enc-refresh',
      })
    );
    // Never touched the calendar-slot caption path.
    expect(mockPublishToInstagram).not.toHaveBeenCalled();
  });

  it('falls back to the stored caption for the title when no youtube snippet exists', async () => {
    // deriveSocialCut does not persist a youtube snippet today — the adapter
    // must still receive a title (the caption) and the rendered video URL.
    mockVideoAsset.findUnique.mockResolvedValue(socialCutAsset());
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);

    const result = await processPublishQueue();

    expect(result.published).toBe(1);
    expect(mockPublishToYouTube).toHaveBeenCalledWith(
      expect.objectContaining({ videoUrl: CUT_URL, title: CUT_CAPTION })
    );
  });

  it('holds a social-cut row whose video cannot be resolved — adapter never called', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(null);
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);

    // Safety-check resolution and the dispatch resolution both fail closed; the
    // safety gate holds it first, so the adapter is never invoked.
    const result = await processPublishQueue();

    expect(result.published).toBe(0);
    expect(result.held).toBe(1);
    expect(mockPublishToYouTube).not.toHaveBeenCalled();
  });
});

// ── Regression: a CalendarSlot-backed row is unaffected ───────────────────────

describe('processPublishQueue — legit calendar-slot row is unaffected', () => {
  const SLOT_ID = 'slot-normal-1';
  const APPROVED_MANIFEST = buildApprovedCampaignAuthorityManifest({
    platformOutputs: [
      { platform: 'instagram', status: 'approved', contentRef: 'post-ig' },
    ],
  });
  const CAL_DATA = {
    weekStart: '2026-03-31',
    weekEnd: '2026-04-06',
    slots: [
      {
        id: SLOT_ID,
        dayOfWeek: 0,
        scheduledAt: new Date(Date.now() + 1000).toISOString(),
        platform: 'instagram',
        captions: ['Caption A'],
        hashtags: ['#test'],
        contentType: 'educational',
        status: 'approved',
        selectedCaption: 0,
        campaignAuthorityManifest: APPROVED_MANIFEST,
      },
    ],
    signalsVersion: '1.0',
    digestCount: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.findMany.mockResolvedValue([{ id: 'user-1' }]);
    mockSubscription.findFirst.mockResolvedValue({ id: 'sub-1' });
    mockOrganization.findUnique.mockResolvedValue({ calendarMode: 'live' });
    mockAIWeeklyDigest.count.mockResolvedValue(5);
    mockContentCalendar.findFirst.mockResolvedValue({ slots: CAL_DATA });
    mockContentCalendar.findUnique.mockResolvedValue({ slots: CAL_DATA });
    mockContentCalendar.update.mockResolvedValue({});
    mockPlatformConnection.findFirst.mockResolvedValue({
      id: 'conn-ig',
      accessToken: 'encrypted-token',
      refreshToken: null,
      encryptionKeyVersion: 1,
      profileId: 'ig-user-1',
      expiresAt: null,
      isActive: true,
    });
    mockDecryptField.mockImplementation((v: string) => `decrypted:${v}`);
    mockPublishQueueItem.update.mockResolvedValue({});
    mockPublishQueueItem.updateMany.mockImplementation(
      (args: { where?: { id?: string } }) =>
        Promise.resolve({ count: args?.where?.id ? 1 : 0 })
    );
    mockNotification.createMany.mockResolvedValue({ count: 1 });
    mockPublishToInstagram.mockResolvedValue({
      success: true,
      platformPostId: 'ig-post-1',
    });
  });

  it('publishes a normal instagram slot without touching the social-cut resolver', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([
      {
        ...BASE_QUEUE_ITEM,
        id: 'qi-ig',
        slotId: SLOT_ID,
        platform: 'instagram',
      },
    ]);

    const result = await processPublishQueue();

    expect(result.published).toBe(1);
    expect(mockPublishToInstagram).toHaveBeenCalledWith(
      expect.objectContaining({ caption: expect.any(String) })
    );
    // The videoAsset resolver must never be consulted for a calendar slot.
    expect(mockVideoAsset.findUnique).not.toHaveBeenCalled();
  });
});

// ── §15.9 invariant: this dispatch path never auto-transitions gated→pending ──

describe('§15.9 invariant — social-cut dispatch never bypasses the human gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeHealthyOrg();
    mockPublishQueueItem.updateMany.mockResolvedValue({ count: 0 });
    mockContentCalendar.findUnique.mockResolvedValue({ slots: { slots: [] } });
    mockContentCalendar.update.mockResolvedValue({});
  });

  it('the due-fetch selects only pending/failed rows — a queued_human_gated cut is inert', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([]);

    await processPublishQueue();

    const [fetchArgs] = mockPublishQueueItem.findMany.mock.calls[0];
    const statuses = JSON.stringify(fetchArgs.where);
    // The queue only ever drains pending + failed — never queued_human_gated.
    expect(statuses).toContain('pending');
    expect(statuses).toContain('failed');
    expect(statuses).not.toContain('queued_human_gated');
  });

  it('never writes status pending/publishing on a social-cut queue row during dispatch', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(socialCutAsset());
    mockDecryptField.mockImplementation((v: string) => `decrypted:${v}`);
    mockPublishQueueItem.update.mockResolvedValue({});
    mockPublishQueueItem.updateMany.mockImplementation(
      (args: { where?: { id?: string } }) =>
        Promise.resolve({ count: args?.where?.id ? 1 : 0 })
    );
    mockPublishToYouTube.mockResolvedValue({
      success: true,
      platformPostId: 'yt-1',
    });
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);

    await processPublishQueue();

    // The only status writes on the queue row are the atomic claim
    // (pending/failed → publishing, via updateMany, NOT a fabricated transition
    // into pending) and the terminal published mark. No update() call may set
    // the row back to 'pending' — that transition belongs to the release route.
    const updateWrotePending = mockPublishQueueItem.update.mock.calls.some(
      ([arg]: [{ data?: { status?: string } }]) =>
        arg?.data?.status === 'pending'
    );
    expect(updateWrotePending).toBe(false);
  });
});
