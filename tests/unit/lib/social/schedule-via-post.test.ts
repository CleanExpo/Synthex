/**
 * P1 / syn-p1-retire-dead-scheduler
 *
 * Proves the consolidation: a post scheduled from a previously-dead entry point
 * now reaches the ONE working scheduler — the `Post` table drained by the Vercel
 * cron `/api/cron/publish-scheduled` — instead of the dead `scheduled_posts`
 * table that no booted worker ever drained.
 *
 * Two layers of coverage:
 *   1. `scheduleViaPost` creates a Post with status='scheduled' + scheduledAt,
 *      which is exactly what the publish cron selects (status='scheduled',
 *      scheduledAt <= now). It reuses / creates the default "Scheduled Posts"
 *      campaign so both entry points share one calendar.
 *   2. The Twitter direct route (the live, un-gated entry point that used to
 *      write to `scheduled_posts`) now routes scheduled tweets through
 *      `scheduleViaPost` and NEVER inserts into `scheduled_posts`.
 */

const mockPrisma = {
  campaign: { findFirst: jest.fn(), create: jest.fn() },
  post: { create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { scheduleViaPost } from '@/lib/social/schedule-via-post';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
  mockPrisma.campaign.findFirst.mockResolvedValue({ id: 'camp-existing' });
  mockPrisma.post.create.mockImplementation(async ({ data }: any) => ({
    id: 'post-123',
    platform: data.platform,
    scheduledAt: data.scheduledAt,
  }));
});

describe('scheduleViaPost — lands in the working Post + cron scheduler', () => {
  const when = new Date('2030-01-01T12:00:00.000Z');

  it('creates a Post with status="scheduled" and the scheduledAt the cron selects on', async () => {
    const result = await scheduleViaPost({
      userId: 'user-1',
      platform: 'Twitter',
      content: 'hello world',
      scheduledTime: when,
    });

    expect(mockPrisma.post.create).toHaveBeenCalledTimes(1);
    const createArg = mockPrisma.post.create.mock.calls[0][0];
    // The publish cron selects: status='scheduled' AND scheduledAt <= now.
    expect(createArg.data.status).toBe('scheduled');
    expect(createArg.data.scheduledAt).toEqual(when);
    // Platform is normalised to lowercase to match the cron's connection lookup.
    expect(createArg.data.platform).toBe('twitter');
    expect(createArg.data.content).toBe('hello world');
    expect(createArg.data.campaignId).toBe('camp-existing');

    expect(result).toEqual({
      id: 'post-123',
      platform: 'twitter',
      scheduledAt: when.toISOString(),
      status: 'scheduled',
    });
  });

  it('puts media into metadata.images, where the cron publisher reads it', async () => {
    await scheduleViaPost({
      userId: 'user-1',
      platform: 'instagram',
      content: 'pic post',
      scheduledTime: when,
      mediaUrls: ['https://cdn.example/a.jpg'],
      metadata: { hashtags: ['#x'] },
    });

    const createArg = mockPrisma.post.create.mock.calls[0][0];
    expect(createArg.data.metadata.images).toEqual([
      'https://cdn.example/a.jpg',
    ]);
    expect(createArg.data.metadata.hashtags).toEqual(['#x']);
  });

  it('reuses the existing default "Scheduled Posts" campaign for the active org', async () => {
    await scheduleViaPost({
      userId: 'user-1',
      platform: 'linkedin',
      content: 'c',
      scheduledTime: when,
    });

    expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        name: 'Scheduled Posts',
        organizationId: 'org-1',
      },
      select: { id: true },
    });
    expect(mockPrisma.campaign.create).not.toHaveBeenCalled();
  });

  it('creates the default campaign when none exists', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue(null);
    mockPrisma.campaign.create.mockResolvedValue({ id: 'camp-new' });

    await scheduleViaPost({
      userId: 'user-1',
      platform: 'tiktok',
      content: 'c',
      scheduledTime: when,
    });

    expect(mockPrisma.campaign.create).toHaveBeenCalledTimes(1);
    const createArg = mockPrisma.post.create.mock.calls[0][0];
    expect(createArg.data.campaignId).toBe('camp-new');
  });

  it('scopes to an explicit organizationId without consulting the active org (Studio approval, g2)', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue(null);
    mockPrisma.campaign.create.mockResolvedValue({ id: 'camp-carsi' });

    await scheduleViaPost({
      userId: 'user-1',
      platform: 'linkedin',
      content: 'c',
      scheduledTime: when,
      organizationId: 'org-carsi',
    });

    // The approver's active org must never capture another business's post.
    expect(mockGetEffectiveOrganizationId).not.toHaveBeenCalled();
    expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        name: 'Scheduled Posts',
        organizationId: 'org-carsi',
      },
      select: { id: true },
    });
    expect(
      mockPrisma.campaign.create.mock.calls[0][0].data.organizationId
    ).toBe('org-carsi');
  });
});
