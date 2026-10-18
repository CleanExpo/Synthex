/**
 * P2 noop-client retirement — lib/automation/rules-engine.ts.
 *
 * automation_rules, automation_executions and scheduled_posts have no Prisma
 * model, so every persistence path throws AutomationStoreNotProvisionedError
 * instead of faking a saved rule or a successful run.
 */

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
  rulesEngine,
  AutomationStoreNotProvisionedError,
  RULE_TEMPLATES,
} from '@/lib/automation/rules-engine';

async function expectNotProvisioned(p: Promise<unknown>, table: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(AutomationStoreNotProvisionedError);
  expect(err).toMatchObject({ code: 'FEATURE_NOT_PROVISIONED', table });
}

describe('rulesEngine — NOT_PROVISIONED data paths', () => {
  it('rule CRUD throws instead of returning fabricated rules', async () => {
    await expectNotProvisioned(
      rulesEngine.createRule('user-1', {
        name: 'r',
        trigger: { type: 'manual', config: {} } as never,
        actions: [],
      }),
      'automation_rules'
    );
    await expectNotProvisioned(
      rulesEngine.getRules('user-1'),
      'automation_rules'
    );
    await expectNotProvisioned(
      rulesEngine.getRule('r1', 'user-1'),
      'automation_rules'
    );
    await expectNotProvisioned(
      rulesEngine.updateRule('r1', 'user-1', {}),
      'automation_rules'
    );
    await expectNotProvisioned(
      rulesEngine.deleteRule('r1', 'user-1'),
      'automation_rules'
    );
    await expectNotProvisioned(
      rulesEngine.toggleRule('r1', 'user-1'),
      'automation_rules'
    );
  });

  it('createFromTemplate throws once it reaches persistence', async () => {
    await expectNotProvisioned(
      rulesEngine.createFromTemplate('user-1', RULE_TEMPLATES[0].id),
      'automation_rules'
    );
  });

  it('executeRule rethrows instead of a generic failed ExecutionResult', async () => {
    await expectNotProvisioned(
      rulesEngine.executeRule('r1', 'user-1'),
      'automation_rules'
    );
  });

  it('getExecutionHistory throws instead of []', async () => {
    await expectNotProvisioned(
      rulesEngine.getExecutionHistory('r1', 'user-1'),
      'automation_executions'
    );
  });
});
