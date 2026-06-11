/**
 * Behavioural coverage for lib/publish/safetyChecks.ts — the publish guard that
 * stands between the publish engine and EVERY autonomous client post.
 *
 * A silent regression here is the worst class of bug on the platform: posting
 * unapproved/stale content, posting to a churned client, or posting on an
 * expired token. These tests lock each gate's blocking behaviour + the order
 * (an earlier gate must short-circuit before a later one is evaluated).
 */

const mockPrisma = {
  user: { findMany: jest.fn() },
  subscription: { findFirst: jest.fn() },
  organization: { findUnique: jest.fn() },
  contentCalendar: { findFirst: jest.fn() },
  platformConnection: { findFirst: jest.fn() },
  aIWeeklyDigest: { count: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

// Pin the cold-start threshold so the test is deterministic.
jest.mock('@/lib/calendar/digestReader', () => ({ MIN_DIGESTS_REQUIRED: 3 }));

import { runSafetyChecks } from '@/lib/publish/safetyChecks';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';

const INPUT = {
  organizationId: 'org-1',
  calendarId: 'cal-1',
  slotId: 'slot-1',
  platform: 'facebook',
};

/** Configure every gate to PASS; each test then breaks exactly one. */
function happyPath() {
  const manifest = buildApprovedCampaignAuthorityManifest({
    platformOutputs: [
      { platform: 'facebook', status: 'approved', contentRef: 'post-fb' },
    ],
  });
  mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
  mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });
  mockPrisma.organization.findUnique.mockResolvedValue({ calendarMode: 'live' });
  mockPrisma.contentCalendar.findFirst.mockResolvedValue({
    slots: {
      slots: [
        {
          id: 'slot-1',
          status: 'approved',
          campaignAuthorityManifest: manifest,
        },
      ],
    },
  });
  mockPrisma.platformConnection.findFirst.mockResolvedValue({
    id: 'conn-1',
    accessToken: 'enc',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isActive: true,
  });
  mockPrisma.aIWeeklyDigest.count.mockResolvedValue(5);
}

beforeEach(() => {
  jest.clearAllMocks();
  happyPath();
});

describe('runSafetyChecks — publish guard', () => {
  it('passes when every gate clears', async () => {
    const res = await runSafetyChecks(INPUT);
    expect(res).toEqual({ pass: true });
  });

  it('Gate 1: blocks when the org has no active subscription', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue(null);
    const res = await runSafetyChecks(INPUT);
    expect(res.pass).toBe(false);
    expect(res.failedGate).toBe('subscription_inactive');
    // short-circuits before evaluating calendar mode
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it('Gate 2: blocks when the calendar is in shadow mode (not live)', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ calendarMode: 'shadow' });
    const res = await runSafetyChecks(INPUT);
    expect(res.pass).toBe(false);
    expect(res.failedGate).toBe('shadow_mode');
    expect(mockPrisma.contentCalendar.findFirst).not.toHaveBeenCalled();
  });

  it('Gate 3: blocks when the slot is missing from the calendar', async () => {
    mockPrisma.contentCalendar.findFirst.mockResolvedValue({ slots: { slots: [] } });
    const res = await runSafetyChecks(INPUT);
    expect(res.pass).toBe(false);
    expect(res.failedGate).toBe('slot_not_approved');
    expect(mockPrisma.platformConnection.findFirst).not.toHaveBeenCalled();
  });

  it('Gate 3: blocks when the slot is not approved (draft)', async () => {
    mockPrisma.contentCalendar.findFirst.mockResolvedValue({
      slots: { slots: [{ id: 'slot-1', status: 'draft' }] },
    });
    const res = await runSafetyChecks(INPUT);
    expect(res.pass).toBe(false);
    expect(res.failedGate).toBe('slot_not_approved');
  });

  it('Gate 5: blocks when there is no active platform connection', async () => {
    mockPrisma.platformConnection.findFirst.mockResolvedValue(null);
    const res = await runSafetyChecks(INPUT);
    expect(res.pass).toBe(false);
    expect(res.failedGate).toBe('token_invalid');
    expect(mockPrisma.aIWeeklyDigest.count).not.toHaveBeenCalled();
  });

  it('Gate 5: blocks when the platform token has expired', async () => {
    mockPrisma.platformConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      accessToken: 'enc',
      expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 min ago
      isActive: true,
    });
    const res = await runSafetyChecks(INPUT);
    expect(res.pass).toBe(false);
    expect(res.failedGate).toBe('token_invalid');
  });

  it('Gate 5: blocks pending OAuth placeholder tokens', async () => {
    mockPrisma.platformConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      accessToken: 'PENDING_OAUTH',
      expiresAt: null,
      isActive: true,
    });
    const res = await runSafetyChecks(INPUT);
    expect(res.pass).toBe(false);
    expect(res.failedGate).toBe('token_invalid');
    expect(res.reason).toContain('pending OAuth');
  });

  it('Gate 6: blocks during cold-start (below the digest threshold)', async () => {
    mockPrisma.aIWeeklyDigest.count.mockResolvedValue(1); // < MIN_DIGESTS_REQUIRED (3)
    const res = await runSafetyChecks(INPUT);
    expect(res.pass).toBe(false);
    expect(res.failedGate).toBe('insufficient_digests');
  });

  it('Gate 4: blocks missing campaign authority manifest before token validation', async () => {
    mockPrisma.contentCalendar.findFirst.mockResolvedValue({
      slots: { slots: [{ id: 'slot-1', status: 'approved' }] },
    });

    const res = await runSafetyChecks(INPUT);

    expect(res.pass).toBe(false);
    expect(res.failedGate).toBe('campaign_authority_blocked');
    expect(mockPrisma.platformConnection.findFirst).not.toHaveBeenCalled();
  });
});
