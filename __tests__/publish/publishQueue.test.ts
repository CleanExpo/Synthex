/**
 * Tests for the auto-publish queue engine — SYN-523
 *
 * Coverage:
 *  - safetyChecks: each publish gate independently
 *  - processPublishQueue: happy path (published)
 *  - processPublishQueue: safety gate blocks publish
 *  - processPublishQueue: platform adapter failure → retry scheduled
 *  - processPublishQueue: max retries exhausted → held + notification created
 *  - processPublishQueue: atomic publish-claim → no double-post on concurrent runs
 *  - seedPublishQueue: creates items for approved slots, skips duplicates
 */

// ── Shared mock objects ───────────────────────────────────────────────────────

const mockPublishQueueItem = {
  findMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  create: jest.fn(),
  findFirst: jest.fn(),
};
const mockOrganization = { findUnique: jest.fn(), update: jest.fn() };
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

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const mockPublishToInstagram = jest.fn();
const mockPublishToFacebook = jest.fn();
const mockPublishToLinkedIn = jest.fn();
const mockPublishToTwitter = jest.fn();
const mockPublishToThreads = jest.fn();
// NOTE: jest.config has resetMocks:true, which wipes mock implementations
// before each test. Re-apply this impl in the relevant beforeEach.
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
jest.mock('@/lib/security/field-encryption', () => ({
  __esModule: true,
  decryptField: (...args: unknown[]) => mockDecryptField(...args),
  encryptField: jest.fn((v: string) => `enc:${v}`),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { runSafetyChecks } from '@/lib/publish/safetyChecks';
import {
  processPublishQueue,
  seedPublishQueue,
} from '@/lib/publish/publishQueue';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';

// ── Test data ─────────────────────────────────────────────────────────────────

const ORG_ID = 'org-test-123';
const CALENDAR_ID = 'cal-test-456';
const SLOT_ID = 'slot-test-789';
const APPROVED_MANIFEST = buildApprovedCampaignAuthorityManifest({
  platformOutputs: [
    { platform: 'instagram', status: 'approved', contentRef: 'post-ig' },
  ],
});

const BASE_SLOT = {
  id: SLOT_ID,
  dayOfWeek: 0,
  scheduledAt: new Date(Date.now() + 1000).toISOString(),
  platform: 'instagram' as const,
  captions: ['Caption A', 'Caption B', 'Caption C'],
  hashtags: ['#test'],
  contentType: 'educational' as const,
  status: 'approved',
  selectedCaption: 0,
  campaignAuthorityManifest: APPROVED_MANIFEST,
};

const BASE_CALENDAR_DATA = {
  weekStart: '2026-03-31',
  weekEnd: '2026-04-06',
  slots: [BASE_SLOT],
  signalsVersion: '1.0' as const,
  digestCount: 5,
};

const BASE_QUEUE_ITEM = {
  id: 'qi-test-001',
  organizationId: ORG_ID,
  calendarId: CALENDAR_ID,
  slotId: SLOT_ID,
  platform: 'instagram',
  scheduledAt: new Date(Date.now() - 1000), // past due
  status: 'pending',
  attempts: 0,
  nextRetryAt: null,
  lastError: null,
  publishedAt: null,
};

// ── safetyChecks ──────────────────────────────────────────────────────────────

describe('safetyChecks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: all gates pass
    mockUser.findMany.mockResolvedValue([{ id: 'user-1' }]);
    mockSubscription.findFirst.mockResolvedValue({ id: 'sub-1' });
    mockOrganization.findUnique.mockResolvedValue({ calendarMode: 'live' });
    mockContentCalendar.findFirst.mockResolvedValue({
      slots: BASE_CALENDAR_DATA,
    });
    mockPlatformConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      accessToken: 'encrypted-token',
      expiresAt: null,
      isActive: true,
    });
    mockAIWeeklyDigest.count.mockResolvedValue(5);
  });

  it('passes when all gates clear', async () => {
    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SLOT_ID,
      platform: 'instagram',
    });
    expect(result.pass).toBe(true);
    expect(result.failedGate).toBeUndefined();
  });

  it('fails gate 1 — no active subscription', async () => {
    mockSubscription.findFirst.mockResolvedValue(null);
    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SLOT_ID,
      platform: 'instagram',
    });
    expect(result.pass).toBe(false);
    expect(result.failedGate).toBe('subscription_inactive');
  });

  it('fails gate 2 — shadow mode', async () => {
    mockOrganization.findUnique.mockResolvedValue({ calendarMode: 'shadow' });
    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SLOT_ID,
      platform: 'instagram',
    });
    expect(result.pass).toBe(false);
    expect(result.failedGate).toBe('shadow_mode');
  });

  it('fails gate 3 — slot not approved', async () => {
    const unapprovedSlot = { ...BASE_SLOT, status: 'draft' };
    mockContentCalendar.findFirst.mockResolvedValue({
      slots: { ...BASE_CALENDAR_DATA, slots: [unapprovedSlot] },
    });
    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SLOT_ID,
      platform: 'instagram',
    });
    expect(result.pass).toBe(false);
    expect(result.failedGate).toBe('slot_not_approved');
  });

  it('fails gate 4 — missing campaign authority manifest', async () => {
    mockContentCalendar.findFirst.mockResolvedValue({
      slots: {
        ...BASE_CALENDAR_DATA,
        slots: [{ ...BASE_SLOT, campaignAuthorityManifest: undefined }],
      },
    });
    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SLOT_ID,
      platform: 'instagram',
    });
    expect(result.pass).toBe(false);
    expect(result.failedGate).toBe('campaign_authority_blocked');
  });

  it('fails gate 5 — no platform connection', async () => {
    mockPlatformConnection.findFirst.mockResolvedValue(null);
    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SLOT_ID,
      platform: 'instagram',
    });
    expect(result.pass).toBe(false);
    expect(result.failedGate).toBe('token_invalid');
  });

  it('fails gate 5 — token expired', async () => {
    mockPlatformConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      accessToken: 'encrypted-token',
      expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      isActive: true,
    });
    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SLOT_ID,
      platform: 'instagram',
    });
    expect(result.pass).toBe(false);
    expect(result.failedGate).toBe('token_invalid');
  });

  it('passes gate 5 when Twitter OAuth 2.0 access token is expired but refreshable', async () => {
    const twitterManifest = buildApprovedCampaignAuthorityManifest({
      platformOutputs: [
        {
          platform: 'twitter',
          status: 'approved',
          contentRef: 'post-tw-oauth2',
        },
      ],
    });
    const twitterSlot = {
      ...BASE_SLOT,
      platform: 'twitter' as const,
      campaignAuthorityManifest: twitterManifest,
    };
    mockContentCalendar.findFirst.mockResolvedValue({
      slots: { ...BASE_CALENDAR_DATA, slots: [twitterSlot] },
    });
    mockPlatformConnection.findFirst.mockResolvedValue({
      id: 'conn-tw-oauth2',
      accessToken: 'encrypted-token',
      refreshToken: 'enc-refresh',
      expiresAt: new Date(Date.now() - 1000),
      metadata: { tokenType: 'bearer', oauthVersion: '2.0' },
      isActive: true,
    });
    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SLOT_ID,
      platform: 'twitter',
    });
    expect(result.pass).toBe(true);
  });

  it('fails gate 5 — pending OAuth placeholder token', async () => {
    mockPlatformConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      accessToken: 'PENDING_OAUTH',
      expiresAt: null,
      isActive: true,
    });
    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SLOT_ID,
      platform: 'instagram',
    });
    expect(result.pass).toBe(false);
    expect(result.failedGate).toBe('token_invalid');
    expect(result.reason).toContain('pending OAuth');
  });

  it('fails gate 6 — insufficient digests', async () => {
    mockAIWeeklyDigest.count.mockResolvedValue(1); // only 1 digest, need 3
    const result = await runSafetyChecks({
      organizationId: ORG_ID,
      calendarId: CALENDAR_ID,
      slotId: SLOT_ID,
      platform: 'instagram',
    });
    expect(result.pass).toBe(false);
    expect(result.failedGate).toBe('insufficient_digests');
  });
});

// ── processPublishQueue ───────────────────────────────────────────────────────

describe('processPublishQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Healthy defaults
    mockUser.findMany.mockResolvedValue([{ id: 'user-1' }]);
    mockSubscription.findFirst.mockResolvedValue({ id: 'sub-1' });
    mockOrganization.findUnique.mockResolvedValue({ calendarMode: 'live' });
    mockContentCalendar.findFirst.mockResolvedValue({
      slots: BASE_CALENDAR_DATA,
    });
    mockContentCalendar.findUnique.mockResolvedValue({
      slots: BASE_CALENDAR_DATA,
    });
    mockContentCalendar.update.mockResolvedValue({});
    mockPlatformConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      accessToken: 'encrypted-token',
      encryptionKeyVersion: 1,
      profileId: 'ig-user-123',
      expiresAt: null,
      isActive: true,
    });
    mockAIWeeklyDigest.count.mockResolvedValue(5);
    mockPublishQueueItem.update.mockResolvedValue({});
    // updateMany backs two distinct operations: the start-of-pass stale reclaim
    // (where: { status: 'publishing' }) and the per-item atomic publish-claim
    // (where: { id, status: { in: ['pending','failed'] } }). Discriminate by the
    // where clause so the reclaim finds nothing stale (count 0) while every claim
    // succeeds (count 1) — the default healthy path.
    mockPublishQueueItem.updateMany.mockImplementation(
      (args: { where?: { id?: string } }) =>
        Promise.resolve({ count: args?.where?.id ? 1 : 0 })
    );
    mockNotification.createMany.mockResolvedValue({ count: 1 });
    mockPublishToInstagram.mockResolvedValue({
      success: true,
      platformPostId: 'ig-post-xyz',
    });
  });

  it('reclaims stale publishing items before fetching due items', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([]);

    await processPublishQueue();

    // The crash-recovery reclaim runs every pass (releases items stranded in
    // 'publishing' by a worker that died before resolving them).
    expect(mockPublishQueueItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'publishing' }),
        data: expect.objectContaining({
          status: 'failed',
          nextRetryAt: expect.any(Date),
        }),
      })
    );
  });

  it('a reclaimed (failed) item becomes due and publishes on the same pass', async () => {
    // Repro: an item was stranded in 'publishing' (worker crashed). The reclaim
    // flips it to 'failed' + nextRetryAt<=now; the due-fetch then returns it and
    // it publishes normally — proving the post is no longer silently lost.
    // One stale item reclaimed, then the per-item claim succeeds — both
    // updateMany calls report count 1.
    mockPublishQueueItem.updateMany.mockResolvedValue({ count: 1 });
    mockPublishQueueItem.findMany.mockResolvedValue([
      {
        ...BASE_QUEUE_ITEM,
        status: 'failed',
        attempts: 0,
        nextRetryAt: new Date(Date.now() - 1000),
      },
    ]);

    const result = await processPublishQueue();

    // updateMany fires twice: the start-of-pass reclaim + the per-item claim.
    expect(mockPublishQueueItem.updateMany).toHaveBeenCalledTimes(2);
    expect(result.published).toBe(1);
  });

  it('publishes successfully and marks item published', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);

    const result = await processPublishQueue();

    expect(result.processed).toBe(1);
    expect(result.published).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.held).toBe(0);
    expect(mockPublishQueueItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BASE_QUEUE_ITEM.id },
        data: expect.objectContaining({ status: 'published' }),
      })
    );
  });

  it('skips when no items are due', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([]);
    const result = await processPublishQueue();
    expect(result.processed).toBe(0);
    expect(result.published).toBe(0);
  });

  it('holds item immediately when safety gate is shadow_mode', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);
    mockOrganization.findUnique.mockResolvedValue({ calendarMode: 'shadow' });

    const result = await processPublishQueue();

    expect(result.held).toBe(1);
    expect(mockPublishQueueItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'held' }),
      })
    );
  });

  it('schedules retry when platform adapter fails (< max attempts)', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);
    mockPublishToInstagram.mockResolvedValue({
      success: false,
      error: 'Rate limit exceeded',
    });

    const result = await processPublishQueue();

    expect(result.failed).toBe(1);
    expect(mockPublishQueueItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          nextRetryAt: expect.any(Date),
        }),
      })
    );
  });

  it('holds and notifies when max retries exhausted', async () => {
    const exhaustedItem = { ...BASE_QUEUE_ITEM, attempts: 11 }; // one more = 12
    mockPublishQueueItem.findMany.mockResolvedValue([exhaustedItem]);
    mockPublishToInstagram.mockResolvedValue({
      success: false,
      error: 'Platform unavailable',
    });

    const result = await processPublishQueue();

    expect(result.held).toBe(1);
    expect(mockPublishQueueItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'held' }),
      })
    );
    // Notification should be created for org users
    expect(mockNotification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ type: 'warning', userId: 'user-1' }),
        ]),
      })
    );
  });

  // ── Double-post race (atomic publish-claim) ──────────────────────────────────

  it('claims a due item atomically (status pending/failed → publishing) before dispatch', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);

    await processPublishQueue();

    // The claim is a CONDITIONAL updateMany gated on the row still being due —
    // an unconditional update() would give no mutual exclusion and let two
    // overlapping passes both dispatch the same post.
    expect(mockPublishQueueItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: BASE_QUEUE_ITEM.id,
          status: { in: ['pending', 'failed'] },
        }),
        data: expect.objectContaining({ status: 'publishing' }),
      })
    );
  });

  it('does NOT publish when the atomic claim is lost to a concurrent worker', async () => {
    // Two overlapping queue passes both fetch the same due item. The first won
    // the claim and is mid-publish; THIS pass loses (claim updateMany → count 0)
    // and MUST skip — never calling the platform adapter — so the real post is
    // not sent to the client's social account twice.
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);
    // reclaim (no id in where) → 0; claim (id in where) → 0 (lost the race).
    mockPublishQueueItem.updateMany.mockResolvedValue({ count: 0 });

    const result = await processPublishQueue();

    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.published).toBe(0);
    // The platform adapter must never be invoked for a lost claim.
    expect(mockPublishToInstagram).not.toHaveBeenCalled();
    // And we must not have marked it published.
    expect(mockPublishQueueItem.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'published' }),
      })
    );
  });
});

// ── processPublishQueue: multi-platform adapters (SYN-P1) ─────────────────────

describe('processPublishQueue — Twitter/X + Threads auto-publish (SYN-P1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDecryptField.mockImplementation((v: string) => `decrypted:${v}`);
    mockUser.findMany.mockResolvedValue([{ id: 'user-1' }]);
    mockSubscription.findFirst.mockResolvedValue({ id: 'sub-1' });
    mockOrganization.findUnique.mockResolvedValue({ calendarMode: 'live' });
    mockContentCalendar.findUnique.mockResolvedValue({
      slots: BASE_CALENDAR_DATA,
    });
    mockContentCalendar.update.mockResolvedValue({});
    mockAIWeeklyDigest.count.mockResolvedValue(5);
    mockPublishQueueItem.update.mockResolvedValue({});
    mockPublishQueueItem.updateMany.mockImplementation(
      (args: { where?: { id?: string } }) =>
        Promise.resolve({ count: args?.where?.id ? 1 : 0 })
    );
    mockNotification.createMany.mockResolvedValue({ count: 1 });
  });

  it('publishes a Twitter/X slot through the real twitter adapter (gates still enforced)', async () => {
    const twitterManifest = buildApprovedCampaignAuthorityManifest({
      platformOutputs: [
        { platform: 'twitter', status: 'approved', contentRef: 'post-tw' },
      ],
    });
    const twitterSlot = {
      ...BASE_SLOT,
      platform: 'twitter' as const,
      campaignAuthorityManifest: twitterManifest,
    };
    const twitterCalendar = { ...BASE_CALENDAR_DATA, slots: [twitterSlot] };
    mockContentCalendar.findFirst.mockResolvedValue({ slots: twitterCalendar });
    mockContentCalendar.findUnique.mockResolvedValue({
      slots: twitterCalendar,
    });
    mockPlatformConnection.findFirst.mockResolvedValue({
      id: 'conn-tw',
      accessToken: 'enc-access',
      refreshToken: 'enc-secret',
      encryptionKeyVersion: 1,
      profileId: 'tw-user-1',
      expiresAt: null,
      isActive: true,
    });
    mockPublishQueueItem.findMany.mockResolvedValue([
      { ...BASE_QUEUE_ITEM, id: 'qi-tw', platform: 'twitter' },
    ]);
    mockPublishToTwitter.mockResolvedValue({
      success: true,
      platformPostId: 'tw-post-1',
    });

    const result = await processPublishQueue();

    expect(result.published).toBe(1);
    // The OAuth1 access-token secret must be decrypted from refreshToken and
    // passed to the adapter — Twitter cannot post without it.
    expect(mockDecryptField).toHaveBeenCalledWith('enc-secret');
    expect(mockPublishToTwitter).toHaveBeenCalledWith(
      expect.objectContaining({
        accessTokenSecret: 'decrypted:enc-secret',
        connectionId: 'conn-tw',
        text: expect.any(String),
      })
    );
    // Other adapters must NOT be invoked for a twitter slot.
    expect(mockPublishToInstagram).not.toHaveBeenCalled();
  });

  it('passes OAuth 2.0 refresh token (not accessSecret) for bearer Twitter connections', async () => {
    const twitterManifest = buildApprovedCampaignAuthorityManifest({
      platformOutputs: [
        {
          platform: 'twitter',
          status: 'approved',
          contentRef: 'post-tw-oauth2',
        },
      ],
    });
    const twitterSlot = {
      ...BASE_SLOT,
      platform: 'twitter' as const,
      campaignAuthorityManifest: twitterManifest,
    };
    const twitterCalendar = { ...BASE_CALENDAR_DATA, slots: [twitterSlot] };
    mockContentCalendar.findFirst.mockResolvedValue({ slots: twitterCalendar });
    mockContentCalendar.findUnique.mockResolvedValue({
      slots: twitterCalendar,
    });
    // Access token already expired — OAuth 2.0 publish must still proceed
    // because refresh_token is present (AT-031 residual / gate 5 exception).
    const expiredAt = new Date(Date.now() - 60_000);
    mockPlatformConnection.findFirst.mockResolvedValue({
      id: 'conn-tw-oauth2',
      accessToken: 'enc-access',
      refreshToken: 'enc-refresh',
      encryptionKeyVersion: 1,
      profileId: 'tw-user-2',
      expiresAt: expiredAt,
      metadata: { tokenType: 'bearer', oauthVersion: '2.0' },
      isActive: true,
    });
    mockPublishQueueItem.findMany.mockResolvedValue([
      { ...BASE_QUEUE_ITEM, id: 'qi-tw-oauth2', platform: 'twitter' },
    ]);
    mockPublishToTwitter.mockResolvedValue({
      success: true,
      platformPostId: 'tw-post-oauth2',
    });

    const result = await processPublishQueue();

    expect(result.published).toBe(1);
    expect(mockPublishToTwitter).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshToken: 'decrypted:enc-refresh',
        metadata: { tokenType: 'bearer', oauthVersion: '2.0' },
        expiresAt: expiredAt,
        connectionId: 'conn-tw-oauth2',
        text: expect.any(String),
      })
    );
    expect(mockPublishToTwitter).toHaveBeenCalledWith(
      expect.not.objectContaining({
        accessTokenSecret: expect.anything(),
      })
    );
  });

  it('publishes a Threads slot through the real threads adapter', async () => {
    const threadsManifest = buildApprovedCampaignAuthorityManifest({
      platformOutputs: [
        { platform: 'threads', status: 'approved', contentRef: 'post-th' },
      ],
    });
    const threadsSlot = {
      ...BASE_SLOT,
      platform: 'threads' as const,
      campaignAuthorityManifest: threadsManifest,
    };
    const threadsCalendar = { ...BASE_CALENDAR_DATA, slots: [threadsSlot] };
    mockContentCalendar.findFirst.mockResolvedValue({ slots: threadsCalendar });
    mockContentCalendar.findUnique.mockResolvedValue({
      slots: threadsCalendar,
    });
    mockPlatformConnection.findFirst.mockResolvedValue({
      id: 'conn-th',
      accessToken: 'enc-access',
      refreshToken: null,
      encryptionKeyVersion: 1,
      profileId: 'th-user-1',
      expiresAt: null,
      isActive: true,
    });
    mockPublishQueueItem.findMany.mockResolvedValue([
      { ...BASE_QUEUE_ITEM, id: 'qi-th', platform: 'threads' },
    ]);
    mockPublishToThreads.mockResolvedValue({
      success: true,
      platformPostId: 'th-post-1',
    });

    const result = await processPublishQueue();

    expect(result.published).toBe(1);
    expect(mockPublishToThreads).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.any(String) })
    );
    // Threads is Bearer-token only — no OAuth1 secret decryption.
    expect(mockDecryptField).not.toHaveBeenCalled();
  });

  it('still blocks a twitter slot when a safety gate fails (no security regression)', async () => {
    const twitterSlot = { ...BASE_SLOT, platform: 'twitter' as const };
    const twitterCalendar = { ...BASE_CALENDAR_DATA, slots: [twitterSlot] };
    mockContentCalendar.findFirst.mockResolvedValue({ slots: twitterCalendar });
    mockOrganization.findUnique.mockResolvedValue({ calendarMode: 'shadow' });
    mockPublishQueueItem.findMany.mockResolvedValue([
      { ...BASE_QUEUE_ITEM, id: 'qi-tw', platform: 'twitter' },
    ]);

    const result = await processPublishQueue();

    expect(result.held).toBe(1);
    expect(result.published).toBe(0);
    expect(mockPublishToTwitter).not.toHaveBeenCalled();
  });
});

// ── processPublishQueue: failure modes (Wave-2 hardening) ─────────────────────
// These lock the in-flight failure paths that sit between "safety passed" and
// "platform call": a non-shadow safety failure (transient retry, not a hold),
// the connection vanishing after the safety check, an unresolvable/undecryptable
// token, and a slot that has no caption to publish. Each must move the item to a
// terminal-or-retry state WITHOUT calling the platform.

describe('processPublishQueue — in-flight failure modes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDecryptField.mockImplementation((v: string) => `decrypted:${v}`);
    mockUser.findMany.mockResolvedValue([{ id: 'user-1' }]);
    mockSubscription.findFirst.mockResolvedValue({ id: 'sub-1' });
    mockOrganization.findUnique.mockResolvedValue({ calendarMode: 'live' });
    mockContentCalendar.findFirst.mockResolvedValue({
      slots: BASE_CALENDAR_DATA,
    });
    mockContentCalendar.findUnique.mockResolvedValue({
      slots: BASE_CALENDAR_DATA,
    });
    mockContentCalendar.update.mockResolvedValue({});
    mockPlatformConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      accessToken: 'encrypted-token',
      refreshToken: null,
      encryptionKeyVersion: 1,
      profileId: 'ig-user-123',
      expiresAt: null,
      isActive: true,
    });
    mockAIWeeklyDigest.count.mockResolvedValue(5);
    mockPublishQueueItem.update.mockResolvedValue({});
    mockPublishQueueItem.updateMany.mockImplementation(
      (args: { where?: { id?: string } }) =>
        Promise.resolve({ count: args?.where?.id ? 1 : 0 })
    );
    mockNotification.createMany.mockResolvedValue({ count: 1 });
    mockPublishToInstagram.mockResolvedValue({
      success: true,
      platformPostId: 'ig-post-xyz',
    });
  });

  it('a NON-shadow safety failure (insufficient digests) is a transient retry, not a hold', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);
    // Pass the approval/connection gates, fail the digest gate → token_invalid /
    // insufficient_digests is NOT in the indefinite-hold set, so it retries.
    mockAIWeeklyDigest.count.mockResolvedValue(1); // need 3

    const result = await processPublishQueue();

    expect(result.failed).toBe(1);
    expect(result.held).toBe(0);
    expect(mockPublishQueueItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          attempts: { increment: 1 },
          nextRetryAt: expect.any(Date),
        }),
      })
    );
    // Never reached the platform.
    expect(mockPublishToInstagram).not.toHaveBeenCalled();
  });

  it('connection disappearing AFTER the safety check → failed with retry (TOCTOU guard)', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);
    // Safety check sees a connection (default), but the in-flight lookup returns
    // null — the connection was revoked/deleted between gate and publish.
    mockPlatformConnection.findFirst
      .mockResolvedValueOnce({
        id: 'conn-1',
        accessToken: 'encrypted-token',
        expiresAt: null,
        isActive: true,
      }) // safety check
      .mockResolvedValueOnce(null); // in-flight lookup → gone

    const result = await processPublishQueue();

    expect(result.failed).toBe(1);
    expect(result.published).toBe(0);
    expect(mockPublishQueueItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          lastError: 'Platform connection disappeared after safety check',
          nextRetryAt: expect.any(Date),
        }),
      })
    );
    expect(mockPublishToInstagram).not.toHaveBeenCalled();
  });

  it('undecryptable token (key mismatch) passes safety but fails in-flight resolve → failed with retry', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);
    // Safety gate sees a plaintext token (resolves OK) and passes; the
    // in-flight lookup returns a real-looking ciphertext (enc:v1: prefix) whose
    // decryption throws (key wrong/rotated). resolvePlatformAccessToken flags
    // keyMismatch → transient failure (reconnect needed), NOT a silent drop and
    // NOT a platform call with a bad token. Distinct findFirst calls let the two
    // checkpoints see different connection rows.
    mockPlatformConnection.findFirst
      .mockResolvedValueOnce({
        id: 'conn-1',
        accessToken: 'plaintext-good-token',
        expiresAt: null,
        isActive: true,
      }) // safety check → resolves OK, gate passes
      .mockResolvedValueOnce({
        id: 'conn-1',
        accessToken: 'enc:v1:UNDECRYPTABLE',
        refreshToken: null,
        encryptionKeyVersion: 1,
        profileId: 'ig-user-123',
        expiresAt: null,
        isActive: true,
      }); // in-flight lookup → decrypt throws below
    mockDecryptField.mockImplementation((v: string) => {
      if (typeof v === 'string' && v.startsWith('enc:v1:')) {
        throw new Error('bad key');
      }
      return `decrypted:${v}`;
    });

    const result = await processPublishQueue();

    expect(result.failed).toBe(1);
    const failUpdate = mockPublishQueueItem.update.mock.calls.find(
      ([arg]: [{ data?: { status?: string; nextRetryAt?: unknown } }]) =>
        arg?.data?.status === 'failed' && arg?.data?.nextRetryAt != null
    );
    expect(failUpdate).toBeDefined();
    expect(mockPublishToInstagram).not.toHaveBeenCalled();
  });

  it('slot with no caption → held (cannot publish empty), platform never called', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);
    // Safety calendar lookup keeps the approved slot, but the in-flight caption
    // lookup returns a slot whose captions are empty.
    const noCaptionSlot = { ...BASE_SLOT, captions: [] as string[] };
    const noCaptionCalendar = { ...BASE_CALENDAR_DATA, slots: [noCaptionSlot] };
    mockContentCalendar.findUnique.mockResolvedValue({
      slots: noCaptionCalendar,
    });

    const result = await processPublishQueue();

    expect(result.held).toBe(1);
    expect(result.published).toBe(0);
    expect(mockPublishQueueItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'held',
          lastError: 'No caption available for this slot',
        }),
      })
    );
    expect(mockPublishToInstagram).not.toHaveBeenCalled();
  });
});

// ── processPublishQueue: Instagram Reels media-type threading (backlog #13) ───
// The IG adapter already supports a REELS container but no caller ever set
// mediaType/mediaUrl, so Reels were unreachable. These lock the additive thread:
//  (a) a REELS slot WITH a mediaUrl reaches the adapter's REELS branch;
//  (b) a REELS slot WITHOUT a mediaUrl does NOT post as a Reel — graceful
//      fallback to the existing caption-only call (never placeholder media);
//  (c) an ordinary image/text slot is unchanged (no mediaType/mediaUrl passed).

describe('processPublishQueue — Instagram Reels media-type threading (#13)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.findMany.mockResolvedValue([{ id: 'user-1' }]);
    mockSubscription.findFirst.mockResolvedValue({ id: 'sub-1' });
    mockOrganization.findUnique.mockResolvedValue({ calendarMode: 'live' });
    mockContentCalendar.findFirst.mockResolvedValue({
      slots: BASE_CALENDAR_DATA,
    });
    mockContentCalendar.findUnique.mockResolvedValue({
      slots: BASE_CALENDAR_DATA,
    });
    mockContentCalendar.update.mockResolvedValue({});
    mockPlatformConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      accessToken: 'encrypted-token',
      refreshToken: null,
      encryptionKeyVersion: 1,
      profileId: 'ig-user-123',
      expiresAt: null,
      isActive: true,
    });
    mockAIWeeklyDigest.count.mockResolvedValue(5);
    mockPublishQueueItem.update.mockResolvedValue({});
    mockPublishQueueItem.updateMany.mockImplementation(
      (args: { where?: { id?: string } }) =>
        Promise.resolve({ count: args?.where?.id ? 1 : 0 })
    );
    mockNotification.createMany.mockResolvedValue({ count: 1 });
    mockPublishToInstagram.mockResolvedValue({
      success: true,
      platformPostId: 'ig-post-xyz',
    });
  });

  it('(a) a REELS slot WITH a mediaUrl threads mediaType+mediaUrl to the adapter', async () => {
    const reelsSlot = {
      ...BASE_SLOT,
      mediaType: 'REELS' as const,
      mediaUrl: 'https://cdn.example.com/reel.mp4',
    };
    const reelsCalendar = { ...BASE_CALENDAR_DATA, slots: [reelsSlot] };
    mockContentCalendar.findUnique.mockResolvedValue({ slots: reelsCalendar });
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);

    const result = await processPublishQueue();

    expect(result.published).toBe(1);
    expect(mockPublishToInstagram).toHaveBeenCalledWith(
      expect.objectContaining({
        igUserId: 'ig-user-123',
        mediaType: 'REELS',
        mediaUrl: 'https://cdn.example.com/reel.mp4',
        caption: expect.any(String),
      })
    );
  });

  it('(b) a REELS slot WITHOUT a mediaUrl does NOT post as a Reel — graceful caption-only fallback', async () => {
    const reelsNoUrlSlot = { ...BASE_SLOT, mediaType: 'REELS' as const };
    const reelsNoUrlCalendar = {
      ...BASE_CALENDAR_DATA,
      slots: [reelsNoUrlSlot],
    };
    mockContentCalendar.findUnique.mockResolvedValue({
      slots: reelsNoUrlCalendar,
    });
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);

    const result = await processPublishQueue();

    // It still publishes (the existing caption-only path), but MUST NOT claim to
    // be a Reel — no mediaType/mediaUrl reaches the adapter, so no placeholder
    // video is ever posted.
    expect(result.published).toBe(1);
    const igArgs = mockPublishToInstagram.mock.calls[0][0];
    expect(igArgs.mediaType).toBeUndefined();
    expect(igArgs.mediaUrl).toBeUndefined();
    // And the fallback is logged for the operator.
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('marked REELS but has no mediaUrl'),
      expect.objectContaining({ platform: 'instagram' })
    );
  });

  it('(c) an ordinary image/text slot is unchanged — no mediaType/mediaUrl passed', async () => {
    // BASE_SLOT has no mediaType/mediaUrl — the existing behaviour.
    mockPublishQueueItem.findMany.mockResolvedValue([BASE_QUEUE_ITEM]);

    const result = await processPublishQueue();

    expect(result.published).toBe(1);
    const igArgs = mockPublishToInstagram.mock.calls[0][0];
    expect(igArgs.mediaType).toBeUndefined();
    expect(igArgs.mediaUrl).toBeUndefined();
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('marked REELS but has no mediaUrl'),
      expect.anything()
    );
  });
});

// ── seedPublishQueue ──────────────────────────────────────────────────────────

describe('seedPublishQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContentCalendar.findFirst.mockResolvedValue({
      slots: BASE_CALENDAR_DATA,
    });
    mockPublishQueueItem.findFirst.mockResolvedValue(null); // no existing items
    mockPublishQueueItem.create.mockResolvedValue({ id: 'qi-new-1' });
  });

  it('creates a queue item for each approved slot', async () => {
    const count = await seedPublishQueue(CALENDAR_ID, ORG_ID);
    expect(count).toBe(1);
    expect(mockPublishQueueItem.create).toHaveBeenCalledTimes(1);
    expect(mockPublishQueueItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          calendarId: CALENDAR_ID,
          slotId: SLOT_ID,
          platform: 'instagram',
          status: 'pending',
        }),
      })
    );
  });

  it('skips approved slots whose campaign authority manifest is not approved', async () => {
    mockContentCalendar.findFirst.mockResolvedValue({
      slots: {
        ...BASE_CALENDAR_DATA,
        slots: [
          {
            ...BASE_SLOT,
            campaignAuthorityManifest: {
              ...APPROVED_MANIFEST,
              approval: {
                status: 'review',
                humanApproved: false,
              },
            },
          },
        ],
      },
    });

    const count = await seedPublishQueue(CALENDAR_ID, ORG_ID);

    expect(count).toBe(0);
    expect(mockPublishQueueItem.create).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'publishQueue: approved slot skipped by authority gate',
      expect.objectContaining({
        calendarId: CALENDAR_ID,
        slotId: SLOT_ID,
        platform: 'instagram',
        blockers: expect.arrayContaining(['campaign_human_approval_missing']),
      })
    );
  });

  it('skips slots that already have a queue item', async () => {
    mockPublishQueueItem.findFirst.mockResolvedValue({ id: 'qi-existing' });
    const count = await seedPublishQueue(CALENDAR_ID, ORG_ID);
    expect(count).toBe(0);
    expect(mockPublishQueueItem.create).not.toHaveBeenCalled();
  });

  it('skips approved slots for platforms without auto-publish adapters', async () => {
    mockContentCalendar.findFirst.mockResolvedValue({
      slots: {
        ...BASE_CALENDAR_DATA,
        slots: [{ ...BASE_SLOT, platform: 'reddit' }],
      },
    });

    const count = await seedPublishQueue(CALENDAR_ID, ORG_ID);

    expect(count).toBe(0);
    expect(mockPublishQueueItem.create).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'publishQueue: approved slot skipped by platform adapter gate',
      expect.objectContaining({
        calendarId: CALENDAR_ID,
        slotId: SLOT_ID,
        platform: 'reddit',
      })
    );
  });

  it('returns 0 when calendar not found', async () => {
    mockContentCalendar.findFirst.mockResolvedValue(null);
    const count = await seedPublishQueue(CALENDAR_ID, ORG_ID);
    expect(count).toBe(0);
  });

  // ── SYN-P1: caption-only platforms ARE seeded ───────────────────────────────
  it.each(['twitter', 'threads'])(
    'seeds an approved %s slot (caption-only real publish client)',
    async platform => {
      const manifest = buildApprovedCampaignAuthorityManifest({
        platformOutputs: [
          { platform, status: 'approved', contentRef: `post-${platform}` },
        ],
      });
      mockContentCalendar.findFirst.mockResolvedValue({
        slots: {
          ...BASE_CALENDAR_DATA,
          slots: [
            { ...BASE_SLOT, platform, campaignAuthorityManifest: manifest },
          ],
        },
      });

      const count = await seedPublishQueue(CALENDAR_ID, ORG_ID);

      expect(count).toBe(1);
      expect(mockPublishQueueItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ platform, status: 'pending' }),
        })
      );
    }
  );

  // ── SYN-P1: metadata-requiring platforms stay OUT of the caption-only queue ─
  it.each(['reddit', 'pinterest', 'youtube', 'tiktok'])(
    'does NOT seed a %s slot (real client but needs extra slot metadata)',
    async platform => {
      mockContentCalendar.findFirst.mockResolvedValue({
        slots: {
          ...BASE_CALENDAR_DATA,
          slots: [{ ...BASE_SLOT, platform }],
        },
      });

      const count = await seedPublishQueue(CALENDAR_ID, ORG_ID);

      expect(count).toBe(0);
      expect(mockPublishQueueItem.create).not.toHaveBeenCalled();
    }
  );
});
