/**
 * SYN-1196 — BYOK fail-closed, on every provider.
 *
 * Goal-card criterion: "BYOK fail-closed on every provider; revoked key =
 * refusal, no fallback."
 *
 * The load-bearing assertion is the NEGATIVE one: `execute` must never be
 * handed the platform key. The suite plants PLATFORM_KEY_SENTINEL in
 * ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY / OPENROUTER_API_KEY
 * before each test, so a `?? process.env.X` fallback has a real value to
 * return. Without that planting, such a mutant yields undefined, the call
 * still fails, and the test would pass while proving nothing.
 */

import { getLatestModel } from '@/lib/ai/model-registry';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    runnerFlag: { findMany: jest.fn() },
    aPICredential: { findFirst: jest.fn() },
    orgBudgetPolicy: { findUnique: jest.fn() },
    pipelineCostLedger: { groupBy: jest.fn(), create: jest.fn() },
  },
}));

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
import {
  ALL_PROVIDERS,
  BRAND,
  BRAND_KEY_SENTINEL,
  ORG_ID,
  PLATFORM_KEY_SENTINEL,
  RUNNER,
  installDefaults,
  plantPlatformKeys,
  receiptRow,
  restorePlatformKeys,
  type GovernorMocks,
} from './governor-test-harness';

const mocks = {
  prisma: prisma as unknown as GovernorMocks['prisma'],
  decryptApiKey: decryptApiKey as unknown as jest.Mock,
} as GovernorMocks;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = plantPlatformKeys();
  installDefaults(mocks);
});

afterEach(() => {
  restorePlatformKeys(savedEnv);
});

function callFor(provider: (typeof ALL_PROVIDERS)[number], execute: jest.Mock) {
  return governedCall({
    organizationId: ORG_ID,
    brandSlug: BRAND,
    runner: RUNNER,
    provider,
    // Model comes from the registry, never a literal — the same rule the
    // production path follows, enforced here so the test cannot drift from it.
    model: { kind: 'latest' },
    pipelineName: 'governor-byok-test',
    estimate: { inputTokens: 100, outputTokens: 100 },
    execute,
  });
}

describe.each(ALL_PROVIDERS)('BYOK fail-closed — %s', provider => {
  it('refuses when the brand has no key, and never reaches the provider', async () => {
    mocks.prisma.aPICredential.findFirst.mockResolvedValue(null);
    const execute = jest.fn();

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_byok_missing');
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a REVOKED key — distinctly from a missing one — with no fallback', async () => {
    mocks.prisma.aPICredential.findFirst.mockResolvedValue({
      id: 'cred_revoked',
      encryptedKey: 'encrypted-placeholder',
      isActive: true,
      revokedAt: new Date('2026-09-01T00:00:00Z'),
    });
    const execute = jest.fn();

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(false);
    // Distinct from refused_byok_missing: removing the revoked check must turn
    // THIS test red while the missing-key test above stays green.
    expect(result.outcome).toBe('refused_byok_revoked');
    expect(execute).not.toHaveBeenCalled();

    // The refusal is itself receipted — a refusal that leaves no trace is
    // indistinguishable from a call nobody made.
    const row = receiptRow(mocks);
    expect(row).not.toBeNull();
    expect(row!.outcome).toBe('refused_byok_revoked');
    expect(row!.provider).toBe(provider);
    expect(row!.costUsd).toBe(0);
  });

  it('refuses an inactive key', async () => {
    mocks.prisma.aPICredential.findFirst.mockResolvedValue({
      id: 'cred_inactive',
      encryptedKey: 'encrypted-placeholder',
      isActive: false,
      revokedAt: null,
    });
    const execute = jest.fn();

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_byok_inactive');
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a key that cannot be decrypted rather than substituting one', async () => {
    mocks.decryptApiKey.mockImplementation(() => {
      throw new Error('bad ciphertext');
    });
    const execute = jest.fn();

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_byok_undecryptable');
    expect(execute).not.toHaveBeenCalled();
  });

  it('NEVER hands the platform key to the provider on any refusal path', async () => {
    // The env holds PLATFORM_KEY_SENTINEL for every provider (planted in
    // beforeEach). If any fallback existed, execute would run with it.
    const execute = jest.fn();
    for (const credential of [
      null,
      {
        id: 'c1',
        encryptedKey: 'e',
        isActive: true,
        revokedAt: new Date(),
      },
      { id: 'c2', encryptedKey: 'e', isActive: false, revokedAt: null },
    ]) {
      mocks.prisma.aPICredential.findFirst.mockResolvedValue(credential);
      await callFor(provider, execute);
    }

    expect(execute).not.toHaveBeenCalled();
    const usedKeys = execute.mock.calls.map(c => c[0]?.apiKey);
    expect(usedKeys).not.toContain(PLATFORM_KEY_SENTINEL);
  });

  it("serves the call with the BRAND's own key when one is present", async () => {
    const execute = jest.fn().mockResolvedValue({
      data: 'ok',
      inputTokens: 100,
      outputTokens: 50,
    });

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);

    const ctx = execute.mock.calls[0][0];
    expect(ctx.apiKey).toBe(BRAND_KEY_SENTINEL);
    // The decisive assertion: it is the brand's key, not the platform's.
    expect(ctx.apiKey).not.toBe(PLATFORM_KEY_SENTINEL);
    expect(ctx.model.id).toBe(getLatestModel(provider).id);

    const row = receiptRow(mocks);
    expect(row!.outcome).toBe('completed');
    expect(row!.provider).toBe(provider);
    expect(row!.inputTokens).toBe(100);
    expect(row!.outputTokens).toBe(50);
  });

  it('scopes the credential lookup to the organisation and to this exact provider', async () => {
    const execute = jest
      .fn()
      .mockResolvedValue({ data: 'ok', inputTokens: 1, outputTokens: 1 });
    await callFor(provider, execute);

    expect(mocks.prisma.aPICredential.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID, provider },
      })
    );
  });
});
