/**
 * Unit tests for autopilot daily planner
 * Tests gap detection and slot allocation with Prisma mocks
 */

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    post: { findMany: jest.fn() },
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { planDailyContent } from '@/lib/autopilot/daily-planner';
import { prisma } from '@/lib/prisma';

const mockFindMany = (prisma as any).post.findMany as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('planDailyContent', () => {
  it('returns empty slots when all days are covered', async () => {
    // Simulate fully covered horizon: 7 days × 1 platform × 1 post = 7 posts
    const now = new Date();
    const posts = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() + i + 1);
      date.setHours(9, 0, 0, 0);
      return {
        platform: 'twitter',
        scheduledAt: date,
        metadata: { theme: 'educational' },
      };
    });
    mockFindMany.mockResolvedValue(posts);

    const result = await planDailyContent('org-1', ['twitter'], 7, 1);
    expect(result.totalExisting).toBe(7);
    expect(result.totalNeeded).toBe(0);
    expect(result.slots).toHaveLength(0);
  });

  it('detects gaps when no posts exist', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await planDailyContent('org-1', ['twitter'], 3, 1);
    expect(result.totalExisting).toBe(0);
    expect(result.totalNeeded).toBeGreaterThan(0);
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it('passes organisationId and platform filter to Prisma', async () => {
    mockFindMany.mockResolvedValue([]);

    await planDailyContent('org-123', ['instagram', 'twitter'], 7, 1);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.campaign.organizationId).toBe('org-123');
    expect(callArgs.where.platform.in).toEqual(['instagram', 'twitter']);
    expect(callArgs.where.status.in).toContain('scheduled');
    expect(callArgs.where.status.in).toContain('draft');
  });

  it('uses select narrowing for performance', async () => {
    mockFindMany.mockResolvedValue([]);

    await planDailyContent('org-1', ['twitter']);

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.select).toBeDefined();
    expect(callArgs.select.platform).toBe(true);
    expect(callArgs.select.scheduledAt).toBe(true);
    expect(callArgs.select.metadata).toBe(true);
  });

  it('assigns valid themes to gap slots', async () => {
    mockFindMany.mockResolvedValue([]);
    const validThemes = [
      'educational',
      'promotional',
      'engagement',
      'storytelling',
      'behind_the_scenes',
      'social_proof',
      'trend_reactive',
    ];

    const result = await planDailyContent('org-1', ['twitter'], 2, 1);

    for (const slot of result.slots) {
      expect(validThemes).toContain(slot.theme);
      expect(slot.platform).toBe('twitter');
      expect(slot.date).toBeInstanceOf(Date);
    }
  });

  it('handles multiple platforms independently', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await planDailyContent(
      'org-1',
      ['twitter', 'instagram'],
      2,
      1
    );

    const twitterSlots = result.slots.filter(s => s.platform === 'twitter');
    const instagramSlots = result.slots.filter(s => s.platform === 'instagram');

    expect(twitterSlots.length).toBeGreaterThan(0);
    expect(instagramSlots.length).toBeGreaterThan(0);
  });

  it('uses default horizon of 7 days', async () => {
    mockFindMany.mockResolvedValue([]);

    await planDailyContent('org-1', ['twitter']);

    const callArgs = mockFindMany.mock.calls[0][0];
    const lte = new Date(callArgs.where.scheduledAt.lte);
    const gte = new Date(callArgs.where.scheduledAt.gte);
    const diffDays = Math.round(
      (lte.getTime() - gte.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(8);
  });

  it('extracts themes from existing post metadata for mix continuity', async () => {
    const now = new Date();
    // Provide posts with metadata.theme — planner should extract these
    // and pass to allocateSlots for mix continuity
    const posts = [
      {
        platform: 'twitter',
        scheduledAt: new Date(now.getTime() + 86400000),
        metadata: { theme: 'educational' },
      },
      {
        platform: 'twitter',
        scheduledAt: new Date(now.getTime() + 172800000),
        metadata: { theme: 'promotional' },
      },
    ];
    mockFindMany.mockResolvedValue(posts);

    const result = await planDailyContent('org-1', ['twitter'], 7, 1);
    // Should still work without errors and account for existing themes
    expect(result.totalExisting).toBe(2);
  });

  it('excludes deleted posts via deletedAt: null filter', async () => {
    mockFindMany.mockResolvedValue([]);

    await planDailyContent('org-1', ['twitter']);

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.deletedAt).toBeNull();
  });
});
