/**
 * create-first-win-notification — `client_notifications` has no Prisma model,
 * so the writer must report the undelivered notification, never drop it silently.
 */

import { createFirstWinNotification } from '@/lib/notifications/create-first-win-notification';
import { logger } from '@/lib/logger';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const win = {
  userId: 'user-1',
  postId: 'post-1',
  postedAt: new Date('2026-10-01T00:00:00Z'),
  metric: 'reach' as const,
  actualValue: 200,
  baselineValue: 100,
  improvementPct: 100,
  detectedAt: new Date('2026-10-02T00:00:00Z'),
};

describe('createFirstWinNotification (NOT_PROVISIONED)', () => {
  it('returns an explicit not-provisioned result and does not throw', async () => {
    await expect(createFirstWinNotification(win)).resolves.toEqual({
      delivered: false,
      reason: 'FEATURE_NOT_PROVISIONED',
      table: 'client_notifications',
    });
  });

  it('logs the undelivered notification with the missing table', async () => {
    await createFirstWinNotification(win);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not provisioned'),
      expect.objectContaining({
        reason: 'FEATURE_NOT_PROVISIONED',
        table: 'client_notifications',
        userId: 'user-1',
        postId: 'post-1',
      })
    );
  });
});
