/**
 * SYN-1196 — model resolution comes from the registry file, and the Governor
 * path holds zero hardcoded model strings.
 *
 * Goal-card criterion: "Model registry live; zero hardcoded model strings in
 * runner paths — code audit."
 *
 * The audit is a script, and its verdict is its EXIT CODE, not its stdout.
 * This suite runs it two ways: `--selftest` (which plants a violation and
 * requires detection, so a clean result is known to be a real clean result)
 * and `--scope lib/ai/governor` (the actual claim).
 */

import { execFileSync } from 'child_process';
import { join } from 'path';
import {
  getLatestModel,
  getModel,
  isModelAvailable,
} from '@/lib/ai/model-registry';
import { estimateCostUsd, resolveModel } from '@/lib/ai/governor/model';
import { GOVERNOR_PROVIDERS } from '@/lib/ai/governor/types';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const AUDIT = join(REPO_ROOT, 'scripts', 'audit-governor-model-strings.mjs');

/** Runs the audit and returns its exit code — never parses its text. */
function runAudit(args: string[]): { code: number; output: string } {
  try {
    const output = execFileSync('node', [AUDIT, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    return { code: 0, output };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return {
      code: e.status ?? 1,
      output: `${e.stdout ?? ''}${e.stderr ?? ''}`,
    };
  }
}

describe('model-string audit', () => {
  it('is capable of failing — its own positive control passes', () => {
    // A scanner that has never been observed returning non-zero proves
    // nothing: an empty finding list from a broken matcher looks exactly like
    // a clean tree. --selftest plants a known violation and requires a catch.
    const { code, output } = runAudit(['--selftest']);
    expect(output).toContain('positive: quoted model id detected');
    // The regex-literal defeat found by the cursor lane at head f8c1257 is a
    // permanent control now, not a one-off fix.
    expect(output).toContain(
      'positive: regex literal does not hide a SAME-LINE hardcode'
    );
    expect(output).toContain('negative: model id in a comment is ignored');
    expect(output).not.toContain('FAIL');
    expect(code).toBe(0);
  });

  it('reports the Governor path clean', () => {
    const { code, output } = runAudit(['--scope', 'lib/ai/governor']);
    expect(output).toContain('CLEAN: 0 hardcoded model strings');
    expect(code).toBe(0);
  });

  it('still detects a hardcode when one is planted in the scanned scope', () => {
    // Scope the audit at a fixture that DOES contain a hardcode, proving the
    // clean verdict above is a finding about the code and not about the tool.
    const { code } = runAudit([
      '--scope',
      join('tests', 'unit', 'ai', 'governor', 'fixtures'),
    ]);
    expect(code).toBe(1);
  });
});

describe('resolveModel', () => {
  it.each([...GOVERNOR_PROVIDERS])(
    'resolves the registry latest model for %s without naming one',
    provider => {
      const result = resolveModel(provider, { kind: 'latest' });
      expect(result.ok).toBe(true);
      expect(result.model!.id).toBe(getLatestModel(provider).id);
      expect(result.reason).toBe('registry_latest');
    }
  );

  it.each([...GOVERNOR_PROVIDERS])(
    'accepts a pinned model for %s only while the registry still lists it',
    provider => {
      const registered = getLatestModel(provider).id;
      const ok = resolveModel(provider, {
        kind: 'registered',
        modelId: registered,
      });
      expect(ok.ok).toBe(true);
      expect(ok.model!.id).toBe(registered);
      expect(getModel(provider, registered)).not.toBeNull();
      expect(isModelAvailable(provider, registered)).toBe(true);
    }
  );

  it('refuses a model that is not in the registry', () => {
    const result = resolveModel('anthropic', {
      kind: 'registered',
      modelId: 'not-a-registered-model-id',
    });
    expect(result.ok).toBe(false);
    expect(result.model).toBeNull();
    expect(result.reason).toContain('model_not_in_registry');
  });
});

describe('estimateCostUsd', () => {
  it.each([...GOVERNOR_PROVIDERS])(
    'prices %s from the registry entry, not a hardcoded rate table',
    provider => {
      const model = getLatestModel(provider);
      const expected =
        (1000 / 1000) * model.costPer1kTokens.input +
        (500 / 1000) * model.costPer1kTokens.output;
      expect(estimateCostUsd(model, 1000, 500)).toBeCloseTo(expected, 9);
    }
  );
});

/**
 * THE CONTROL THAT ACTUALLY CLOSES THE CLASS (SYN-1196, round-2 review finding
 * P1-AUDIT-REGEX-LITERAL-AND-CONCAT-SMUGGLE).
 *
 * The static audit cannot see a model id that is CONSTRUCTED at runtime, and no
 * source-text guard can — the value does not exist until the program runs. That
 * is a real limit, and it is why the audit is defence in depth rather than the
 * boundary.
 *
 * The criterion that matters is that no UNREGISTERED model reaches a provider.
 * resolveModel enforces that at runtime regardless of how the string was built,
 * so a constructed id is either a model the registry already lists (not a
 * smuggle) or a refusal. This proves the refusal, and proves it is receipted.
 */
describe('runtime registry boundary — constructed ids cannot reach a provider', () => {
  jest.isolateModules(() => {});

  it('refuses a CONSTRUCTED model id that the registry does not list', async () => {
    jest.resetModules();

    const create = jest.fn().mockResolvedValue({ id: 'row' });
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        runnerFlag: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { runner: 'content', enabled: true, killSwitch: false },
            ]),
        },
        aPICredential: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'c',
              encryptedKey: 'e',
              isActive: true,
              revokedAt: null,
            },
          ]),
        },
        orgBudgetPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            dailyCeilingUsd: 1000,
            providerDailyCeilingsUsd: null,
            enforcementMode: 'enforce',
          }),
        },
        pipelineCostLedger: {
          groupBy: jest.fn().mockResolvedValue([]),
          create,
        },
      },
    }));
    jest.doMock('@/lib/encryption/api-key-encryption', () => ({
      decryptApiKey: jest.fn().mockReturnValue('BRAND-OWN-KEY-PLACEHOLDER'),
    }));
    jest.doMock('@/lib/logger', () => ({
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    }));

    const { governedCall } = await import('@/lib/ai/governor');

    // Built at runtime, exactly the shape the static audit cannot see.
    const smuggled = ['claude', 'definitely', 'not', 'registered'].join('-');
    const execute = jest.fn();

    const result = await governedCall({
      organizationId: 'org_test_syn1196',
      brandSlug: 'ra',
      runner: 'content',
      provider: 'anthropic',
      model: { kind: 'registered', modelId: smuggled },
      pipelineName: 'governor-registry-boundary-test',
      estimate: { inputTokens: 10, outputTokens: 10 },
      execute,
    });

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_model_unavailable');
    // The provider is never reached, however the string was built.
    expect(execute).not.toHaveBeenCalled();
    // And the refusal is receipted, like every other Governor exit.
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data.outcome).toBe(
      'refused_model_unavailable'
    );
  });
});
