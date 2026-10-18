/**
 * content-safety — `content_moderation_logs`, `content_reviews` and
 * `brand_guidelines` have no Prisma model. Moderation still computes; storage
 * paths must fail honestly instead of returning empty data or dropping writes.
 */

import {
  contentSafety,
  ModerationStorageNotProvisionedError,
  type ModerationResult,
} from '@/lib/moderation/content-safety';
import { logger } from '@/lib/logger';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('content-safety storage (NOT_PROVISIONED)', () => {
  it('getModerationHistory rejects with a typed error instead of returning []', async () => {
    const err = await contentSafety
      .getModerationHistory('user-1')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ModerationStorageNotProvisionedError);
    expect(err).toMatchObject({
      code: 'FEATURE_NOT_PROVISIONED',
      table: 'content_moderation_logs',
    });
  });

  it('submitForReview rejects with a typed error naming content_reviews', async () => {
    const err = await contentSafety
      .submitForReview('user-1', 'content-1', 'hello', {} as ModerationResult)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ModerationStorageNotProvisionedError);
    expect(err).toMatchObject({
      code: 'FEATURE_NOT_PROVISIONED',
      table: 'content_reviews',
    });
  });

  it('moderateContent still runs and reports the unpersisted log write', async () => {
    const result = await contentSafety.moderateContent(
      'user-1',
      `A friendly post about gardening ${Date.now()}`
    );
    expect(result.categories.length).toBeGreaterThan(0);
    expect(result.suggestions).not.toContain(
      'Manual review recommended due to moderation system error'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not persisted'),
      expect.objectContaining({
        reason: 'FEATURE_NOT_PROVISIONED',
        table: 'content_moderation_logs',
        userId: 'user-1',
      })
    );
  });

  it('without stored guidelines brand safety fails and requires human review', async () => {
    const result = await contentSafety.moderateContent(
      'user-1',
      `We beat Acme on price ${Date.now()}`
    );
    expect(result.approved).toBe(false);
    expect(result.requiresHumanReview).toBe(true);
    expect(result.brandSafety.passed).toBe(false);
    expect(result.brandSafety.score).toBe(0);
    expect(result.brandSafety.issues).toEqual([
      expect.objectContaining({ type: 'brand_guidelines_unavailable' }),
    ]);
    expect(result.brandGuidelines).toMatchObject({
      available: false,
      reason: expect.stringContaining('brand_guidelines'),
    });
  });

  it('explicit guidelines are still applied and not reported unavailable', async () => {
    const result = await contentSafety.moderateContent(
      'user-1',
      `A friendly post about gardening ${Date.now()}`,
      {
        brandGuidelines: {
          companyName: 'Us',
          competitors: ['Acme'],
          blockedWords: [],
          requiredDisclosures: [],
          toneOfVoice: 'friendly',
          sensitiveTopics: [],
          approvedHashtags: [],
          blockedHashtags: [],
        },
      }
    );
    expect(result.brandSafety.passed).toBe(true);
    expect(result.brandGuidelines).toBeUndefined();
  });
});
