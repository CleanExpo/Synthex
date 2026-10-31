/**
 * @jest-environment node
 *
 * Every governed provider call runs inside its organisation's prompt scope,
 * so a portfolio brand's request is checked at the model boundary however
 * the route assembled it (lib/ai/prompt-scope.ts).
 */

jest.mock('@/lib/prisma', () => {
  const db = {
    runnerFlag: { findMany: jest.fn() },
    aPICredential: { findMany: jest.fn() },
    orgBudgetPolicy: { findUnique: jest.fn() },
    pipelineCostLedger: { groupBy: jest.fn(), create: jest.fn() },
    organization: { findUnique: async () => ({ slug: 'unite-group' }) },
  };
  return { __esModule: true, default: db, prisma: db };
});

jest.mock('@/lib/encryption/api-key-encryption', () => ({
  decryptApiKey: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption/api-key-encryption';
import { governedCall } from '@/lib/ai/governor';
import { guardScopedText } from '@/lib/ai/prompt-scope';
import {
  BRAND,
  ORG_ID,
  RUNNER,
  installDefaults,
  type GovernorMocks,
} from './governor-test-harness';

const mocks = {
  prisma: prisma as unknown as GovernorMocks['prisma'],
  decryptApiKey: decryptApiKey as unknown as jest.Mock,
} as GovernorMocks;

beforeEach(() => {
  installDefaults(mocks);
});

function call(prompt: string, send: () => void) {
  return governedCall({
    organizationId: ORG_ID,
    brandSlug: BRAND,
    runner: RUNNER,
    provider: 'anthropic',
    model: { kind: 'latest' },
    pipelineName: 'governor-prompt-scope-test',
    estimate: { inputTokens: 10, outputTokens: 10 },
    // Stands in for a provider: it checks the request, then sends.
    execute: async () => {
      await guardScopedText(prompt);
      send();
      return { data: 'ok', inputTokens: 1, outputTokens: 1 };
    },
  });
}

describe('governed calls run in their organisation prompt scope', () => {
  it('refuses a request that names a word the brand never uses, before sending', async () => {
    const send = jest.fn();
    const result = await call('Promote CARSI courses this week', send);
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('failed_provider_error');
    expect(send).not.toHaveBeenCalled();
  });

  it('lets a clean request through', async () => {
    const send = jest.fn();
    await call('A week of tips for local cafes', send);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
