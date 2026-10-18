/**
 * P2 noop-client retirement — lib/automation/content-optimizer.ts.
 *
 * scheduled_posts has no Prisma model and the ab_tests model lacks the
 * content_id / split_ratio / variation columns this engine writes, so every
 * data path throws ContentOptimizerNotProvisionedError instead of faking a
 * saved A/B test or optimising against fabricated empty history.
 */

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
  contentOptimizer,
  ContentOptimizerNotProvisionedError,
} from '@/lib/automation/content-optimizer';

async function expectNotProvisioned(p: Promise<unknown>, table: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(ContentOptimizerNotProvisionedError);
  expect(err).toMatchObject({ code: 'FEATURE_NOT_PROVISIONED', table });
}

describe('contentOptimizer — NOT_PROVISIONED data paths', () => {
  it('createABTest throws instead of returning an unsaved test', async () => {
    await expectNotProvisioned(
      contentOptimizer.createABTest(
        'user-1',
        'post-1',
        [{ name: 'A', content: 'x' }],
        {
          name: 'test',
        }
      ),
      'ab_tests'
    );
  });

  it('getABTestResults throws instead of returning null (not found)', async () => {
    await expectNotProvisioned(
      contentOptimizer.getABTestResults('user-1', 'ab_1'),
      'ab_tests'
    );
  });

  it('optimizeContent rethrows instead of success:false with original content', async () => {
    await expectNotProvisioned(
      contentOptimizer.optimizeContent('user-1', 'hello', 'twitter'),
      'scheduled_posts'
    );
  });

  it('getTrendingHashtags and autoOptimizeUnderperformers throw instead of []', async () => {
    await expectNotProvisioned(
      contentOptimizer.getTrendingHashtags('user-1', 'twitter'),
      'scheduled_posts'
    );
    await expectNotProvisioned(
      contentOptimizer.autoOptimizeUnderperformers('user-1', 'twitter'),
      'scheduled_posts'
    );
  });
});
