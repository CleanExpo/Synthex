/**
 * Tests for the auto-publish queue engine — SYN-523
 *
 * Coverage:
 *  - safetyChecks: each of the 5 gates independently
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
const mockDecryptApiKey = jest.fn();
const mockPublishToInstagram = jest.fn();
const mockPublishToFacebook = jest.fn();
const mockPublishToLinkedIn = jest.fn();

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
jest.mock('@/lib/encryption/api-key-encryption', () => ({
  decryptApiKey: mockDecryptApiKey,
}));
jest.mock('@/lib/publish/platformAdapters/instagram', () => ({
  publishToInstagram: mockPublishToInstagram,
}));
jest.mock('@/lib/publish/platformAdapters/facebook', () => ({
  publishToFacebook: mockPublishToFacebook,
}));
jest.mock('@/lib/publish/platformAdapters/linkedin', () => ({
  publishToLinkedIn: mockPublishToLinkedIn,
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { runSafetyChecks } from '@/lib/publish/safetyChecks';
import {
  processPublishQueue,
  seedPublishQueue,
} from '@/lib/publish/publishQueue';

// ── Test data ─────────────────────────────────────────────────────────────────

const ORG_ID = 'org-test-123';
const CALENDAR_ID = 'cal-test-456';
const SLOT_ID = 'slot-test-789';

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

  it('fails gate 4 — no platform connection', async () => {
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

  it('fails gate 4 — token expired', async () => {
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

  it('fails gate 5 — insufficient digests', async () => {
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
    mockDecryptApiKey.mockReturnValue('clear-token-abc');
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

  it('skips slots that already have a queue item', async () => {
    mockPublishQueueItem.findFirst.mockResolvedValue({ id: 'qi-existing' });
    const count = await seedPublishQueue(CALENDAR_ID, ORG_ID);
    expect(count).toBe(0);
    expect(mockPublishQueueItem.create).not.toHaveBeenCalled();
  });

  it('returns 0 when calendar not found', async () => {
    mockContentCalendar.findFirst.mockResolvedValue(null);
    const count = await seedPublishQueue(CALENDAR_ID, ORG_ID);
    expect(count).toBe(0);
  });
});
