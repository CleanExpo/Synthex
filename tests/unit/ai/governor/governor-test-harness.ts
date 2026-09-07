/**
 * Shared harness for the SYN-1196 Governor tests.
 *
 * NOT a test file itself (no .test. in the name, so jest's testRegex skips it).
 *
 * Every implementation is installed by installMocks() which the suites call
 * from beforeEach, NOT from the jest.mock factory. config/jest/jest.worktree.cjs
 * sets `resetMocks: true`, which wipes factory-set implementations between
 * tests — a factory-configured mock silently becomes `undefined` in the second
 * test of a file, and the failure looks like a product bug.
 */

import {
  GOVERNOR_PROVIDERS,
  type GovernorProvider,
} from '@/lib/ai/governor/types';

/**
 * Platform keys. These are deliberately PLANTED in the environment by the BYOK
 * suites: the fail-closed test is only meaningful if a platform key is sitting
 * there to be grabbed. With the env unset, a `?? process.env.X` fallback mutant
 * yields undefined, the call still refuses for a different reason, and the test
 * passes while proving nothing.
 *
 * Obvious placeholders, never secret-shaped — nothing here is or resembles a
 * real credential.
 */
export const PLATFORM_ENV_KEYS: Record<GovernorProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

export const PLATFORM_KEY_SENTINEL = 'PLATFORM-KEY-MUST-NEVER-BE-USED';
export const BRAND_KEY_SENTINEL = 'BRAND-OWN-KEY-PLACEHOLDER';

export const ORG_ID = 'org_test_syn1196';
export const BRAND = 'ra';
export const RUNNER = 'content';

export const ALL_PROVIDERS: GovernorProvider[] = [...GOVERNOR_PROVIDERS];

export interface GovernorMocks {
  prisma: {
    runnerFlag: { findMany: jest.Mock };
    aPICredential: { findFirst: jest.Mock };
    orgBudgetPolicy: { findUnique: jest.Mock };
    pipelineCostLedger: { groupBy: jest.Mock; create: jest.Mock };
  };
  decryptApiKey: jest.Mock;
}

/** An enabled runner flag row, with no kill-switch. */
export function enabledFlagRows(runner = RUNNER) {
  return [{ runner, enabled: true, killSwitch: false }];
}

/** An active, non-revoked BYOK credential. */
export function activeCredential() {
  return {
    id: 'cred_active',
    encryptedKey: 'encrypted-placeholder',
    isActive: true,
    revokedAt: null,
  };
}

/** A budget policy with plenty of headroom. */
export function generousPolicy() {
  return {
    dailyCeilingUsd: 1000,
    providerDailyCeilingsUsd: null,
    enforcementMode: 'enforce',
  };
}

/**
 * Install the default happy-path implementations. Individual tests override
 * exactly one of these to isolate the control under test.
 */
export function installDefaults(mocks: GovernorMocks): void {
  mocks.prisma.runnerFlag.findMany.mockResolvedValue(enabledFlagRows());
  mocks.prisma.aPICredential.findFirst.mockResolvedValue(activeCredential());
  mocks.prisma.orgBudgetPolicy.findUnique.mockResolvedValue(generousPolicy());
  mocks.prisma.pipelineCostLedger.groupBy.mockResolvedValue([]);
  mocks.prisma.pipelineCostLedger.create.mockResolvedValue({ id: 'ledger_1' });
  mocks.decryptApiKey.mockReturnValue(BRAND_KEY_SENTINEL);
}

/** Plant platform keys so a fallback mutant has something to fall back TO. */
export function plantPlatformKeys(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const provider of ALL_PROVIDERS) {
    const name = PLATFORM_ENV_KEYS[provider];
    saved[name] = process.env[name];
    process.env[name] = PLATFORM_KEY_SENTINEL;
  }
  return saved;
}

export function restorePlatformKeys(
  saved: Record<string, string | undefined>
): void {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

/** The single ledger row written by a call, or null when none was written. */
export function receiptRow(
  mocks: GovernorMocks
): Record<string, unknown> | null {
  const calls = mocks.prisma.pipelineCostLedger.create.mock.calls;
  if (calls.length === 0) return null;
  return calls[calls.length - 1][0].data as Record<string, unknown>;
}
