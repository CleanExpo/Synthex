/**
 * Tests for the auto-publish queue engine — SYN-523
 *
 * Coverage:
 *  - safetyChecks: each publish gate independently
 *  - processPublishQueue: happy path (published)
 *  - processPublishQueue: safety gate blocks publish
 *  - processPublishQueue: platform adapter failure → retry scheduled
 *  - processPublishQueue: max retries exhausted → held + notification created
 *  - seedPublishQueue: creates items for approved slots, skips duplicates
 */

// ── Shared mock objects ───────────────────────────────────────────────────────

const mockPublishQueueItem = {
  findMany: jest.fn(),
  update: jest.fn(),
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
    mockNotification.createMany.mockResolvedValue({ count: 1 });
    mockPublishToInstagram.mockResolvedValue({
      success: true,
      platformPostId: 'ig-post-xyz',
    });
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
    mockNotification.createMany.mockResolvedValue({ count: 1 });
  });

  it('publishes a Twitter/X slot through the real twitter adapter (gates still enforced)', async () => {
    // Safety-check calendar lookup must see an approved slot for THIS platform.
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
    mockContentCalendar.findUnique.mockResolvedValue({ slots: twitterCalendar });
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
        text: expect.any(String),
      })
    );
    // Other adapters must NOT be invoked for a twitter slot.
    expect(mockPublishToInstagram).not.toHaveBeenCalled();
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
    mockContentCalendar.findUnique.mockResolvedValue({ slots: threadsCalendar });
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
    mockContentCalendar.findFirst.mockResolvedValue({ slots: BASE_CALENDAR_DATA });
    mockContentCalendar.findUnique.mockResolvedValue({ slots: BASE_CALENDAR_DATA });
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
    mockContentCalendar.findUnique.mockResolvedValue({ slots: noCaptionCalendar });

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
