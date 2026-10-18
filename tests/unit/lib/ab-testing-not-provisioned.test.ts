/**
 * P2 noop-client retirement — lib/ab-testing.ts.
 *
 * experiment_assignments, experiment_events and profiles have no Prisma model,
 * and the `experiments` model has no variants/metrics columns, so every
 * persistence path throws ABTestingNotProvisionedError instead of faking a
 * saved experiment, returning [] / null, or dropping a tracked event.
 */

import {
  abTestingService,
  ABTestingNotProvisionedError,
} from '@/lib/ab-testing';

async function expectNotProvisioned(p: Promise<unknown>, table: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(ABTestingNotProvisionedError);
  expect(err).toMatchObject({ code: 'FEATURE_NOT_PROVISIONED', table });
}

const variants = [
  { id: 'a', name: 'A', weight: 50, isControl: true },
  { id: 'b', name: 'B', weight: 50, isControl: false },
];

describe('abTestingService — NOT_PROVISIONED data paths', () => {
  it('createExperiment still validates weights before anything else', async () => {
    await expect(
      abTestingService.createExperiment({
        name: 'x',
        status: 'draft',
        startDate: new Date(),
        variants: [{ id: 'a', name: 'A', weight: 10, isControl: true }],
      })
    ).rejects.toThrow('Variant weights must sum to 100%');
  });

  it('createExperiment throws instead of returning an unsaved experiment', async () => {
    await expectNotProvisioned(
      abTestingService.createExperiment({
        name: 'x',
        status: 'draft',
        startDate: new Date(),
        variants,
      }),
      'experiments'
    );
  });

  it('reads throw instead of returning null / []', async () => {
    await expectNotProvisioned(
      abTestingService.getExperiment('e1'),
      'experiments'
    );
    await expectNotProvisioned(
      abTestingService.getExperiments(),
      'experiments'
    );
    await expectNotProvisioned(
      abTestingService.getVariant('e1', 'user-1'),
      'experiments'
    );
    await expectNotProvisioned(
      abTestingService.getResults('e1'),
      'experiments'
    );
  });

  it('writes throw instead of silently dropping', async () => {
    await expectNotProvisioned(
      abTestingService.trackEvent('e1', 'a', 'conversion', 'user-1'),
      'experiment_events'
    );
    await expectNotProvisioned(
      abTestingService.updateExperimentStatus('e1', 'running'),
      'experiments'
    );
  });
});
