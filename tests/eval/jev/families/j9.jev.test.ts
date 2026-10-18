/**
 * J9 Cost and quota — 120 script-judged cases, hard gate.
 *
 * Spec: docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md, "JEV test
 * harness" (J9: quote before spend, settle equals ledger, fail-closed on budget
 * read error). P1 only measures: a property that fails against today's code is
 * a KNOWN_GAP in tests/eval/jev/known-gaps/J9.json, never a product change.
 *
 * Boundaries faked (and only these): Prisma, Redis, the logger sink, the fal
 * SDK adapter's submit, the paid prompt enhancer, artifact storage, Sentry and
 * key decryption. Provider calls are counted at those boundaries; the
 * governor, budget-enforcer, spend log, image meter and video quota run for
 * real. Synthetic organisations only (org-A, org-B).
 *
 * Groups (counts sum to 120):
 *   J9-gov-*     48  lib/ai/governor governedCall, all four providers
 *   J9-legacy-*  18  lib/ai/budget-enforcer (text path), org-A and org-B
 *   J9-img-*     18  image meter via generateBatch (injected provider)
 *   J9-vid-*     12  video submit + fal webhook settlement
 *   J9-ledger-*   5  lib/pipelines/track-cost ledger writes and rates
 *   J9-route-*   19  spending routes wired through governedCall (P5)
 */
jest.mock('@/lib/prisma', () =>
  jest.requireActual('./j9/fake-db').prismaModule()
);
jest.mock('@/lib/logger', () =>
  jest.requireActual('./j9/fake-db').loggerModule()
);
jest.mock('@/lib/redis-client', () =>
  jest.requireActual('./j9/fake-db').redisModule()
);
jest.mock('@/lib/encryption/api-key-encryption', () => ({
  decryptApiKey: () => 'BRAND-OWN-KEY-PLACEHOLDER',
}));
jest.mock('@/lib/services/ai/video/fal-adapter', () => {
  const actual = jest.requireActual('@/lib/services/ai/video/fal-adapter');
  const db = jest.requireActual('./j9/fake-db');
  return {
    ...actual,
    submitToFal: async () => {
      const n = db.bump('fal.submit');
      if (db.state().failures.has('fal.submit')) {
        throw new Error('J9 fal submit rejected before dispatch');
      }
      return `fal-job-${n}`;
    },
  };
});
jest.mock('@/lib/services/ai/video/prompt-enhancer', () => {
  const db = jest.requireActual('./j9/fake-db');
  return {
    enhancePrompt: async (s: string) => {
      db.bump('llm.enhance');
      return s;
    },
  };
});
jest.mock('@/lib/services/ai/video/artifact-store', () => ({
  storeArtifact: async ({ rowId }: { rowId: string }) => ({
    storedUrl: `https://storage.example.invalid/${rowId}.mp4`,
  }),
}));
jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: () => undefined,
}));

import fs from 'fs';
import path from 'path';
import { classify, recordResults, type JevResult } from '../runner/record';
import { invokeRoute } from '../runner/route-harness';
import {
  bump,
  calls,
  fakePrisma,
  netMediaSpend,
  resetState,
  seedMediaSpend,
  state,
} from './j9/fake-db';
import {
  all,
  amountsMatch,
  failClosed,
  routeUsesGovernor,
  type Verdict,
} from './j9/detectors';

const FAMILY = 'J9';
const ROOT = path.join(__dirname, '../../../..');
const ORG_A = 'org-A';
const ORG_B = 'org-B';
const BRAND = 'brand-a';
const RUNNER = 'j9-runner';
const PROVIDERS = ['anthropic', 'google', 'openai', 'openrouter'] as const;
type Provider = (typeof PROVIDERS)[number];

/** Governor costs are rounded to 6 dp (governor/model.ts). */
const GOVERNOR_TOLERANCE_USD = 0.000001;
/** The media spend log rounds every amount to 4 dp (spend-log.ts). */
const MEDIA_TOLERANCE_USD = 0.0001;

const results: JevResult[] = [];
afterAll(() => recordResults(FAMILY, results));

function errText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

/** Run one case on a fresh boundary. A harness throw is INCONCLUSIVE, never PASS. */
async function runCase(
  id: string,
  property: string,
  fn: () => Promise<Verdict>,
  route?: string
): Promise<void> {
  resetState();
  let verdict: Verdict;
  try {
    verdict = await fn();
  } catch (e) {
    results.push({
      id,
      family: FAMILY,
      kind: 'case',
      state: 'INCONCLUSIVE',
      route,
      detail: `${property} | could not run: ${errText(e)}`,
    });
    return;
  }
  const c = classify(id, verdict.passed, `${property} | ${verdict.observed}`);
  results.push({ id, family: FAMILY, kind: 'case', route, ...c });
}

/** A control's state is the detector's verdict on a planted defect: FAIL = caught. */
async function runControl(
  id: string,
  plant: string,
  fn: () => Promise<Verdict>
): Promise<void> {
  resetState();
  try {
    const v = await fn();
    results.push({
      id,
      family: FAMILY,
      kind: 'control',
      state: v.passed ? 'PASS' : 'FAIL',
      detail: `${plant} | ${v.observed}`,
    });
  } catch (e) {
    results.push({
      id,
      family: FAMILY,
      kind: 'control',
      state: 'INCONCLUSIVE',
      detail: `${plant} | could not run: ${errText(e)}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Governor (lib/ai/governor)
// ---------------------------------------------------------------------------

function seedGovernor(org = ORG_A): void {
  const s = state();
  s.runnerFlags.push({
    organizationId: org,
    brandSlug: BRAND,
    runner: RUNNER,
    enabled: true,
    killSwitch: false,
  });
  for (const provider of PROVIDERS) {
    s.credentials.push({
      organizationId: org,
      provider,
      id: `cred-${org}-${provider}`,
      encryptedKey: 'encrypted-placeholder',
      isActive: true,
      revokedAt: null,
    });
  }
  s.budgetPolicies.set(org, {
    dailyCeilingUsd: 100,
    providerDailyCeilingsUsd: null,
    enforcementMode: 'enforce',
  });
}

function seedLedgerSpend(
  org: string,
  costUsd: number,
  provider: string | null
): void {
  state().ledger.push({
    pipelineName: 'j9-prior-spend',
    clientId: org,
    runId: 'j9-prior',
    model: 'j9-prior',
    inputTokens: 0,
    outputTokens: 0,
    costUsd,
    provider,
    createdAt: new Date(),
  });
}

async function governor() {
  return import('@/lib/ai/governor');
}

/** Independent price from the registry's own per-1k rates. */
async function registryCost(
  provider: Provider,
  inputTokens: number,
  outputTokens: number
): Promise<{ modelId: string; usd: number }> {
  const { getLatestModel } = await import('@/lib/ai/model-registry');
  const m = getLatestModel(provider);
  return {
    modelId: m.id,
    usd:
      (inputTokens / 1000) * m.costPer1kTokens.input +
      (outputTokens / 1000) * m.costPer1kTokens.output,
  };
}

async function callGovernor(
  provider: Provider,
  estimate: { inputTokens: number; outputTokens: number },
  reported = estimate,
  extra: Record<string, unknown> = {}
) {
  const { governedCall } = await governor();
  const providerKey = `provider.${provider}`;
  const input = {
    organizationId: ORG_A,
    brandSlug: BRAND,
    runner: RUNNER,
    provider,
    model: { kind: 'latest' as const },
    pipelineName: 'j9-governor',
    runId: `run-j9-${provider}`,
    estimate,
    execute: async () => {
      bump(providerKey);
      return { data: 'ok', ...reported };
    },
    ...extra,
  };
  const res = await governedCall(input);
  return { res, providerCalls: calls(providerKey) };
}

const EST = { inputTokens: 1000, outputTokens: 1000 };

async function governorCases(): Promise<void> {
  for (const p of PROVIDERS) {
    const failRead = async (key: string, label: string) =>
      runCase(
        `J9-gov-${label}-${p}`,
        `governedCall(${p}): a ${key} read error refuses the spend before any provider call`,
        async () => {
          seedGovernor();
          state().failures.add(key);
          const { res, providerCalls } = await callGovernor(p, EST);
          return failClosed({
            providerCalls,
            refused: !res.ok,
            why: res.outcome,
          });
        }
      );
    await failRead('orgBudgetPolicy.findUnique', 'budget-policy-read-error');
    await failRead('pipelineCostLedger.groupBy', 'ledger-read-error');
    await failRead('aPICredential.findMany', 'byok-read-error');

    await runCase(
      `J9-gov-refusal-receipt-on-read-error-${p}`,
      `governedCall(${p}): a budget read error writes a zero-cost refusal receipt`,
      async () => {
        seedGovernor();
        state().failures.add('orgBudgetPolicy.findUnique');
        const { res } = await callGovernor(p, EST);
        const row = state().ledger.find(r => r.pipelineName === 'j9-governor');
        return all(
          {
            passed: row?.outcome === 'refused_control_plane_error',
            observed: `receipt outcome=${String(row?.outcome)} result=${res.outcome}`,
          },
          amountsMatch('receipt cost', 0, row?.costUsd, 0)
        );
      }
    );

    await runCase(
      `J9-gov-org-ceiling-spent-${p}`,
      `governedCall(${p}): an org whose daily ceiling is spent is refused before any provider call`,
      async () => {
        seedGovernor();
        state().budgetPolicies.set(ORG_A, {
          dailyCeilingUsd: 10,
          providerDailyCeilingsUsd: null,
          enforcementMode: 'enforce',
        });
        seedLedgerSpend(ORG_A, 10, null);
        const { res, providerCalls } = await callGovernor(p, EST);
        return failClosed({
          providerCalls,
          refused: !res.ok,
          why: res.outcome,
        });
      }
    );

    await runCase(
      `J9-gov-provider-ceiling-spent-${p}`,
      `governedCall(${p}): an org whose ${p} ceiling is spent is refused before any provider call`,
      async () => {
        seedGovernor();
        state().budgetPolicies.set(ORG_A, {
          dailyCeilingUsd: 1000,
          providerDailyCeilingsUsd: { [p]: 1 },
          enforcementMode: 'enforce',
        });
        seedLedgerSpend(ORG_A, 1, p);
        const { res, providerCalls } = await callGovernor(p, EST);
        return failClosed({
          providerCalls,
          refused: !res.ok,
          why: res.outcome,
        });
      }
    );

    await runCase(
      `J9-gov-estimate-breaches-ceiling-${p}`,
      `governedCall(${p}): a quote that would cross the ceiling is refused before any provider call`,
      async () => {
        seedGovernor();
        const big = { inputTokens: 100_000, outputTokens: 100_000 };
        const { usd } = await registryCost(
          p,
          big.inputTokens,
          big.outputTokens
        );
        state().budgetPolicies.set(ORG_A, {
          dailyCeilingUsd: 10,
          providerDailyCeilingsUsd: null,
          enforcementMode: 'enforce',
        });
        seedLedgerSpend(ORG_A, 10 - usd / 2, null);
        const { res, providerCalls } = await callGovernor(p, big);
        return failClosed({
          providerCalls,
          refused: !res.ok,
          why: res.outcome,
        });
      }
    );

    await runCase(
      `J9-gov-no-budget-policy-${p}`,
      `governedCall(${p}): an org with no budget policy is refused before any provider call`,
      async () => {
        seedGovernor();
        state().budgetPolicies.delete(ORG_A);
        const { res, providerCalls } = await callGovernor(p, EST);
        return failClosed({
          providerCalls,
          refused: !res.ok,
          why: res.outcome,
        });
      }
    );

    await runCase(
      `J9-gov-null-ceilings-${p}`,
      `governedCall(${p}): a policy row that sets no ceiling is refused before any provider call`,
      async () => {
        seedGovernor();
        state().budgetPolicies.set(ORG_A, {
          dailyCeilingUsd: null,
          providerDailyCeilingsUsd: null,
          enforcementMode: 'enforce',
        });
        const { res, providerCalls } = await callGovernor(p, EST);
        return failClosed({
          providerCalls,
          refused: !res.ok,
          why: res.outcome,
        });
      }
    );

    await runCase(
      `J9-gov-settle-equals-ledger-${p}`,
      `governedCall(${p}): the ledger row carries the provider-reported tokens and their registry price`,
      async () => {
        seedGovernor();
        const reported = { inputTokens: 1234, outputTokens: 567 };
        const { res, providerCalls } = await callGovernor(p, EST, reported);
        const { usd } = await registryCost(
          p,
          reported.inputTokens,
          reported.outputTokens
        );
        const row = state().ledger.find(r => r.pipelineName === 'j9-governor');
        return all(
          {
            passed:
              res.ok &&
              providerCalls === 1 &&
              row?.inputTokens === reported.inputTokens &&
              row?.outputTokens === reported.outputTokens,
            observed: `ok=${res.ok} calls=${providerCalls} tokens=${row?.inputTokens}/${row?.outputTokens}`,
          },
          amountsMatch('ledger cost', usd, row?.costUsd, GOVERNOR_TOLERANCE_USD)
        );
      }
    );

    await runCase(
      `J9-gov-quote-matches-settle-${p}`,
      `governedCall(${p}): the pre-spend quote equals the settled ledger cost when usage matches the estimate`,
      async () => {
        seedGovernor();
        const est = { inputTokens: 2000, outputTokens: 800 };
        const { res } = await callGovernor(p, est, est);
        const row = state().ledger.find(r => r.pipelineName === 'j9-governor');
        const quote = res.receipt.provenance.budgetDetail?.estimatedCostUsd;
        return amountsMatch(
          'quote vs settle',
          quote,
          row?.costUsd,
          GOVERNOR_TOLERANCE_USD
        );
      }
    );

    await runCase(
      `J9-gov-shadow-mode-logs-not-blocks-${p}`,
      `governedCall(${p}) in shadow mode logs the refusal it would make and does not block the call (P5 wires shadow mode)`,
      async () => {
        seedGovernor();
        state().budgetPolicies.set(ORG_A, {
          dailyCeilingUsd: 10,
          providerDailyCeilingsUsd: null,
          enforcementMode: 'enforce',
        });
        seedLedgerSpend(ORG_A, 10, null);
        const { res, providerCalls } = await callGovernor(p, EST, EST, {
          mode: 'shadow',
        });
        const logged = state().logs.some(
          l => l.level === 'warn' && /refus/i.test(l.message)
        );
        return {
          passed: providerCalls === 1 && logged,
          observed: `providerCalls=${providerCalls} loggedRefusal=${logged} outcome=${res.outcome}`,
        };
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Legacy text budget (lib/ai/budget-enforcer)
// ---------------------------------------------------------------------------

function seedLegacyPolicy(
  org: string,
  daily: number | null,
  monthly: number | null
): void {
  state().budgetPolicies.set(org, {
    organizationId: org,
    dailyCeilingUsd: daily,
    monthlyCeilingUsd: monthly,
    enforcementMode: 'enforce',
  });
}

/** The caller pattern the routes use: reserve, then call the provider. */
async function legacyReserveThenSpend(org: string, estimateUsd: number) {
  const { reserveBudget, commitActual } =
    await import('@/lib/ai/budget-enforcer');
  let reservation;
  try {
    reservation = await reserveBudget(
      { organizationId: org, traceId: `trace-${org}` },
      estimateUsd
    );
  } catch (e) {
    return {
      refused: true,
      providerCalls: calls('provider.text'),
      why: errText(e),
    };
  }
  bump('provider.text');
  await commitActual(reservation, estimateUsd);
  return {
    refused: false,
    providerCalls: calls('provider.text'),
    why: reservation ? 'reserved' : 'reserveBudget returned null (skipped)',
  };
}

async function legacyPreviewThenSpend(org: string, estimateUsd: number) {
  const { previewBudget } = await import('@/lib/ai/budget-enforcer');
  try {
    await previewBudget(org, estimateUsd);
  } catch (e) {
    return {
      refused: true,
      providerCalls: calls('provider.text'),
      why: errText(e),
    };
  }
  bump('provider.text');
  return {
    refused: false,
    providerCalls: calls('provider.text'),
    why: 'preview passed',
  };
}

async function legacyCases(): Promise<void> {
  for (const org of [ORG_A, ORG_B]) {
    const slug = org.toLowerCase();
    await runCase(
      `J9-legacy-reserve-policy-read-error-${slug}`,
      `reserveBudget(${org}): a budget policy read error blocks the text spend`,
      async () => {
        seedLegacyPolicy(org, 10, 100);
        state().failures.add('orgBudgetPolicy.findUnique');
        return failClosed(await legacyReserveThenSpend(org, 0.5));
      }
    );
    await runCase(
      `J9-legacy-reserve-ledger-read-error-${slug}`,
      `reserveBudget(${org}): a ledger read error under an enforcing policy blocks the text spend`,
      async () => {
        seedLegacyPolicy(org, 10, 100);
        state().failures.add('pipelineCostLedger.aggregate');
        return failClosed(await legacyReserveThenSpend(org, 0.5));
      }
    );
    await runCase(
      `J9-legacy-preview-policy-read-error-${slug}`,
      `previewBudget(${org}): a budget policy read error blocks the enqueue`,
      async () => {
        seedLegacyPolicy(org, 10, 100);
        state().failures.add('orgBudgetPolicy.findUnique');
        return failClosed(await legacyPreviewThenSpend(org, 0.5));
      }
    );
    await runCase(
      `J9-legacy-preview-ledger-read-error-${slug}`,
      `previewBudget(${org}): a ledger read error under an enforcing policy blocks the enqueue`,
      async () => {
        seedLegacyPolicy(org, 10, 100);
        state().failures.add('pipelineCostLedger.aggregate');
        return failClosed(await legacyPreviewThenSpend(org, 0.5));
      }
    );
    await runCase(
      `J9-legacy-reserve-daily-over-quota-${slug}`,
      `reserveBudget(${org}): an org over its enforced daily ceiling is refused before the provider call`,
      async () => {
        seedLegacyPolicy(org, 10, null);
        seedLedgerSpend(org, 10, null);
        return failClosed(await legacyReserveThenSpend(org, 0.5));
      }
    );
    await runCase(
      `J9-legacy-reserve-monthly-over-quota-${slug}`,
      `reserveBudget(${org}): an org over its enforced monthly ceiling is refused before the provider call`,
      async () => {
        seedLegacyPolicy(org, null, 100);
        seedLedgerSpend(org, 100, null);
        return failClosed(await legacyReserveThenSpend(org, 0.5));
      }
    );
    await runCase(
      `J9-legacy-preview-over-quota-${slug}`,
      `previewBudget(${org}): an org over its enforced daily ceiling is refused at enqueue`,
      async () => {
        seedLegacyPolicy(org, 10, null);
        seedLedgerSpend(org, 9.9, null);
        return failClosed(await legacyPreviewThenSpend(org, 0.5));
      }
    );
    await runCase(
      `J9-legacy-reserve-equals-quote-${slug}`,
      `reserveBudget(${org}): the reservation holds exactly the quoted estimate`,
      async () => {
        seedLegacyPolicy(org, 10, 100);
        const { reserveBudget } = await import('@/lib/ai/budget-enforcer');
        const quote = 0.123456;
        const r = await reserveBudget({ organizationId: org }, quote);
        return amountsMatch('reserved vs quote', quote, r?.amountUsd, 0.000001);
      }
    );
    await runCase(
      `J9-legacy-commit-clears-hold-${slug}`,
      `commitActual(${org}): settling a reservation returns every in-flight counter to zero`,
      async () => {
        seedLegacyPolicy(org, 10, 100);
        const { reserveBudget, commitActual } =
          await import('@/lib/ai/budget-enforcer');
        const r = await reserveBudget({ organizationId: org }, 0.25);
        const held = Array.from(state().redis.values()).reduce(
          (t, v) => t + v,
          0
        );
        await commitActual(r, 0.25);
        const after = Array.from(state().redis.values()).reduce(
          (t, v) => t + v,
          0
        );
        return {
          passed: r !== null && held > 0 && after === 0,
          observed: `reservation=${r ? 'yes' : 'null'} heldMicro=${held} afterMicro=${after}`,
        };
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Image meter (generateBatch with an injected provider)
// ---------------------------------------------------------------------------

const IMAGE_OPTIONS = {
  prompt: 'synthetic product shot for a test organisation',
  useReferences: false,
  provider: 'gemini',
};

function imageCtx(org: string, autonomous = false) {
  return {
    organizationId: org,
    userId: `user-${org}`,
    autonomyLevel: autonomous ? 'autonomous' : 'manual',
    traceId: `trace-j9-image-${org}`,
  };
}

type Gen = (o: unknown, c: unknown, s?: unknown) => Promise<unknown>;

function imageProvider(
  outcome: 'ok' | 'fail' = 'ok',
  reportedUsd?: number[]
): Gen {
  return async (_o, _c, s) => {
    const n = bump('provider.image');
    const spend = s as {
      holdId: string;
      organizationId: string;
      attemptedKeys: Set<string>;
      variant: number;
    } | null;
    if (reportedUsd && spend) {
      const { recordAttempt } =
        await import('@/lib/services/ai/image/spend-log');
      const attemptKey = `${spend.holdId}:j9:${spend.variant}`;
      spend.attemptedKeys.add(attemptKey);
      await recordAttempt({
        attemptKey,
        holdId: spend.holdId,
        organizationId: spend.organizationId,
        mediaType: 'image',
        provider: 'gemini',
        modelId: 'gemini-3-pro-image',
        status: 'succeeded',
        costUsd: reportedUsd[spend.variant],
      });
    }
    if (outcome === 'fail') {
      return { success: false, provider: 'gemini', error: 'provider failed' };
    }
    return {
      success: true,
      provider: 'gemini',
      imageUrl: `https://images.example.invalid/${n}.png`,
      metadata: { model: 'gemini-3-pro-image' },
    };
  };
}

async function runBatch(
  org: string,
  count: number,
  gen: Gen,
  options: Record<string, unknown> = IMAGE_OPTIONS,
  autonomous = false
) {
  const { generateBatch } = await import('@/lib/services/ai/image-generation');
  try {
    const out = await generateBatch(
      options as never,
      imageCtx(org, autonomous) as never,
      count,
      gen as never
    );
    return { refused: false, out, why: 'admitted' };
  } catch (e) {
    return { refused: true, out: [], why: errText(e) };
  }
}

async function perImageUsd(): Promise<number> {
  const { holdImageSpend } = await import('@/lib/services/ai/image/meter');
  // Priced on a scratch organisation in an isolated state; reset afterwards.
  state().quotas.set('org-price-probe', {
    monthlyBudgetUsd: 1e6,
    dailyBudgetUsd: 1e6,
  });
  const hold = await holdImageSpend(
    'org-price-probe',
    'studio',
    IMAGE_OPTIONS,
    1
  );
  state().events = state().events.filter(
    e => e.organizationId !== 'org-price-probe'
  );
  return hold.perImageUsd;
}

function imageLedger(org: string) {
  return state().ledger.filter(
    r => r.pipelineName === 'image-generation' && r.clientId === org
  );
}

async function imageCases(): Promise<void> {
  const refusedBatch = async (
    id: string,
    property: string,
    setup: (unit: number) => void,
    count = 1,
    autonomous = false
  ) =>
    runCase(id, property, async () => {
      const unit = await perImageUsd();
      setup(unit);
      const r = await runBatch(
        ORG_A,
        count,
        imageProvider(),
        IMAGE_OPTIONS,
        autonomous
      );
      return failClosed({
        providerCalls: calls('provider.image'),
        refused: r.refused,
        why: r.why,
      });
    });

  await refusedBatch(
    'J9-img-quota-transaction-error',
    'image: a quota transaction error refuses the batch before any provider call',
    () => state().failures.add('$transaction')
  );
  await refusedBatch(
    'J9-img-spend-read-error',
    'image: a spend-window read error refuses the batch before any provider call',
    () => state().failures.add('$queryRaw')
  );
  await refusedBatch(
    'J9-img-daily-over-quota',
    'image: an org at its daily media cap is refused before any provider call',
    () => {
      state().quotas.set(ORG_A, { monthlyBudgetUsd: 75, dailyBudgetUsd: 15 });
      seedMediaSpend(ORG_A, 15);
    }
  );
  await refusedBatch(
    'J9-img-monthly-over-quota',
    'image: an org at its monthly media cap is refused before any provider call',
    () => {
      state().quotas.set(ORG_A, { monthlyBudgetUsd: 20, dailyBudgetUsd: 100 });
      seedMediaSpend(ORG_A, 20);
    }
  );
  await refusedBatch(
    'J9-img-batch-breach-whole',
    'image: a batch whose total breaches the cap is refused whole, with no partial provider calls',
    unit =>
      state().quotas.set(ORG_A, {
        monthlyBudgetUsd: 75,
        dailyBudgetUsd: unit * 4,
      }),
    8
  );
  await refusedBatch(
    'J9-img-mcp-over-quota',
    'image: an agent (mcp) caller over its share of the daily cap is refused before any provider call',
    () => {
      state().quotas.set(ORG_A, { monthlyBudgetUsd: 75, dailyBudgetUsd: 15 });
      seedMediaSpend(ORG_A, 7.5, 'mcp');
    },
    1,
    true
  );

  for (const n of [1, 2, 3, 8]) {
    await runCase(
      `J9-img-settle-equals-ledger-n${n}`,
      `image batch of ${n}: the ledger row equals the settled spend-log amount and the per-image actuals`,
      async () => {
        const r = await runBatch(ORG_A, n, imageProvider());
        const ledger = imageLedger(ORG_A);
        const net = netMediaSpend(ORG_A);
        const actuals = (r.out as Array<{ actualCostUsd?: number }>).reduce(
          (t, x) => t + (x.actualCostUsd ?? NaN),
          0
        );
        return all(
          {
            passed: !r.refused && ledger.length === 1,
            observed: `admitted=${!r.refused} ledgerRows=${ledger.length}`,
          },
          amountsMatch(
            'ledger vs spend log',
            net,
            ledger[0]?.costUsd,
            MEDIA_TOLERANCE_USD
          ),
          amountsMatch(
            'ledger vs per-image actuals',
            actuals,
            ledger[0]?.costUsd,
            MEDIA_TOLERANCE_USD
          )
        );
      }
    );
  }

  for (const n of [1, 2, 3, 8]) {
    await runCase(
      `J9-img-quote-matches-settle-n${n}`,
      `image batch of ${n}: the settle stays within the hold and equals the per-image quote x successes (tolerance $${MEDIA_TOLERANCE_USD})`,
      async () => {
        const r = await runBatch(ORG_A, n, imageProvider());
        const reserve = state().events.find(
          e => e.organizationId === ORG_A && e.kind === 'reserve'
        );
        const held = Number(reserve?.deltaUsd ?? NaN);
        const settled = netMediaSpend(ORG_A);
        const quote = (r.out as Array<{ estimatedCostUsd?: number }>)[0]
          ?.estimatedCostUsd;
        return all(
          {
            passed: settled <= held + MEDIA_TOLERANCE_USD,
            observed: `held=${held} settled=${settled}`,
          },
          amountsMatch(
            'quote x successes vs settle',
            typeof quote === 'number' ? quote * n : undefined,
            settled,
            MEDIA_TOLERANCE_USD
          )
        );
      }
    );
  }

  await runCase(
    'J9-img-provider-reported-cost',
    'image: when the provider reports each call cost, the ledger records exactly their sum',
    async () => {
      const reported = [0.0111, 0.0222, 0.0333];
      const r = await runBatch(ORG_A, 3, imageProvider('ok', reported));
      const ledger = imageLedger(ORG_A);
      return all(
        { passed: !r.refused, observed: `admitted=${!r.refused}` },
        amountsMatch(
          'ledger vs provider-reported',
          reported.reduce((t, v) => t + v, 0),
          ledger[0]?.costUsd,
          MEDIA_TOLERANCE_USD
        )
      );
    }
  );

  await runCase(
    'J9-img-all-failed-costs-nothing',
    'image: a batch whose every provider call failed settles to zero and writes no cost row',
    async () => {
      const r = await runBatch(ORG_A, 3, imageProvider('fail'));
      return all(
        {
          passed: !r.refused && imageLedger(ORG_A).length === 0,
          observed: `admitted=${!r.refused} ledgerRows=${imageLedger(ORG_A).length}`,
        },
        amountsMatch('net spend', 0, netMediaSpend(ORG_A), MEDIA_TOLERANCE_USD)
      );
    }
  );

  await runCase(
    'J9-img-unpriced-provider-refused',
    'image: a pin to a deprecated, unpriced provider is refused before any provider call',
    async () => {
      const r = await runBatch(ORG_A, 1, imageProvider(), {
        ...IMAGE_OPTIONS,
        provider: 'dalle',
      });
      return failClosed({
        providerCalls: calls('provider.image'),
        refused: r.refused,
        why: r.why,
      });
    }
  );

  await runCase(
    'J9-img-quota-is-per-org',
    "image: org-B at its cap does not consume org-A's quota",
    async () => {
      state().quotas.set(ORG_B, { monthlyBudgetUsd: 75, dailyBudgetUsd: 15 });
      seedMediaSpend(ORG_B, 15);
      const r = await runBatch(ORG_A, 2, imageProvider());
      return {
        passed: !r.refused && calls('provider.image') === 2,
        observed: `org-A admitted=${!r.refused} providerCalls=${calls('provider.image')} (${r.why})`,
      };
    }
  );
}

// ---------------------------------------------------------------------------
// Video (submitGenerativeVideo + fal webhook)
// ---------------------------------------------------------------------------

const WEBHOOK_TOKEN = 'j9-synthetic-webhook-token';

function videoReq(
  org: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    userId: `user-${org}`,
    organizationId: org,
    initiatedBy: 'studio',
    prompt: 'synthetic product reveal for a test organisation',
    methodCardId: 'product-reveal',
    useReferences: false,
    variants: 1,
    modelTier: 'draft',
    aspectRatio: '9:16',
    durationSeconds: 6,
    ...extra,
  };
}

async function submitVideo(req: Record<string, unknown>) {
  const { submitGenerativeVideo } =
    await import('@/lib/services/ai/video/generation-service');
  try {
    const jobs = await submitGenerativeVideo(req as never);
    return { refused: false, jobs, why: 'admitted' };
  } catch (e) {
    return { refused: true, jobs: [], why: errText(e) };
  }
}

async function videoPerJobUsd(): Promise<number> {
  const { resolveModel, estimateCostUsd } =
    await import('@/lib/services/ai/video/registry');
  const model = resolveModel('draft', {
    aspectRatio: '9:16',
    durationSeconds: 6,
    requiresImage: false,
  } as never);
  return estimateCostUsd(model, 6);
}

async function fireWebhook(providerJobId: string) {
  const saved = process.env.FAL_WEBHOOK_SECRET;
  process.env.FAL_WEBHOOK_SECRET = WEBHOOK_TOKEN;
  try {
    return await invokeRoute('app/api/video/webhook/fal/route.ts', 'POST', {
      url: `http://localhost:3000/api/video/webhook/fal?token=${WEBHOOK_TOKEN}`,
      body: {
        request_id: providerJobId,
        status: 'OK',
        payload: { video: { url: 'https://fal.example.invalid/out.mp4' } },
      },
    });
  } finally {
    if (saved === undefined) delete process.env.FAL_WEBHOOK_SECRET;
    else process.env.FAL_WEBHOOK_SECRET = saved;
  }
}

async function videoCases(): Promise<void> {
  const videoProviderCalls = () => calls('fal.submit') + calls('llm.enhance');
  const refusedVideo = async (
    id: string,
    property: string,
    setup: (unit: number) => void,
    extra: Record<string, unknown> = {}
  ) =>
    runCase(id, property, async () => {
      setup(await videoPerJobUsd());
      const r = await submitVideo(videoReq(ORG_A, extra));
      return failClosed({
        providerCalls: videoProviderCalls(),
        refused: r.refused,
        why: r.why,
      });
    });

  await refusedVideo(
    'J9-vid-quota-read-error',
    'video: a quota read error refuses the submit before any provider call',
    () => state().failures.add('$transaction')
  );
  await refusedVideo(
    'J9-vid-daily-over-quota',
    'video: an org at its daily media cap is refused before any provider call',
    () => {
      state().quotas.set(ORG_A, { monthlyBudgetUsd: 75, dailyBudgetUsd: 15 });
      seedMediaSpend(ORG_A, 15);
    }
  );
  await refusedVideo(
    'J9-vid-monthly-over-quota',
    'video: an org at its monthly media cap is refused before any provider call',
    () => {
      state().quotas.set(ORG_A, { monthlyBudgetUsd: 20, dailyBudgetUsd: 100 });
      seedMediaSpend(ORG_A, 20);
    }
  );
  await refusedVideo(
    'J9-vid-batch-breach-whole',
    'video: a 3-variant batch whose total breaches the cap is refused whole',
    unit =>
      state().quotas.set(ORG_A, {
        monthlyBudgetUsd: 75,
        dailyBudgetUsd: unit * 2.5,
      }),
    { variants: 3 }
  );
  await refusedVideo(
    'J9-vid-mcp-over-quota',
    'video: an agent (mcp) caller over its share of the daily cap is refused before any provider call',
    () => {
      state().quotas.set(ORG_A, { monthlyBudgetUsd: 75, dailyBudgetUsd: 15 });
      seedMediaSpend(ORG_A, 7.5, 'mcp');
    },
    { initiatedBy: 'mcp' }
  );
  await refusedVideo(
    'J9-vid-freeform-enhancer-not-paid-over-quota',
    'video: an over-quota freeform submit never reaches the paid prompt enhancer',
    () => {
      state().quotas.set(ORG_A, { monthlyBudgetUsd: 75, dailyBudgetUsd: 15 });
      seedMediaSpend(ORG_A, 15);
    },
    { methodCardId: 'freeform' }
  );

  for (const n of [1, 3]) {
    await runCase(
      `J9-vid-quote-held-per-variant-n${n}`,
      `video batch of ${n}: each variant holds the quoted estimate before submit, and its row records it`,
      async () => {
        const unit = await videoPerJobUsd();
        const r = await submitVideo(videoReq(ORG_A, { variants: n }));
        const reserves = state().events.filter(
          e => e.organizationId === ORG_A && e.kind === 'reserve'
        );
        const rowsOk = state().videos.every(
          v =>
            Math.abs(Number(v.estimatedCostUsd) - unit) <= MEDIA_TOLERANCE_USD
        );
        const holdsOk = reserves.every(
          e => Math.abs(Number(e.deltaUsd) - unit) <= MEDIA_TOLERANCE_USD
        );
        return {
          passed:
            !r.refused &&
            reserves.length === n &&
            state().videos.length === n &&
            holdsOk &&
            rowsOk,
          observed: `admitted=${!r.refused} holds=${reserves.length} rows=${state().videos.length} quote=${unit} holdsMatch=${holdsOk} rowsMatch=${rowsOk}`,
        };
      }
    );
  }

  await runCase(
    'J9-vid-webhook-settle-equals-reported',
    'video: after the completion webhook, net spend equals the recorded provider cost on the attempt and the row',
    async () => {
      const r = await submitVideo(videoReq(ORG_A));
      const job = r.jobs[0];
      const res = await fireWebhook(job.providerJobId);
      if (res.status === null) throw new Error(res.error);
      const row = state().videos[0];
      const attempt = Array.from(state().attempts.values()).find(
        a =>
          a.providerJobId === job.providerJobId || a.holdId === row.spendHoldId
      );
      const attemptUsd =
        attempt?.costUsd == null ? undefined : Number(attempt.costUsd);
      const net = netMediaSpend(ORG_A, String(row.spendHoldId));
      return all(
        {
          passed: res.status === 200,
          observed: `webhook status=${res.status}`,
        },
        amountsMatch(
          'net vs attempt cost',
          attemptUsd,
          net,
          MEDIA_TOLERANCE_USD
        ),
        amountsMatch(
          'net vs row actual',
          Number(row.actualCostUsd),
          net,
          MEDIA_TOLERANCE_USD
        )
      );
    }
  );

  await runCase(
    'J9-vid-webhook-replay-no-double-settle',
    'video: a replayed completion webhook does not settle the same hold twice',
    async () => {
      const r = await submitVideo(videoReq(ORG_A));
      const job = r.jobs[0];
      const first = await fireWebhook(job.providerJobId);
      if (first.status === null) throw new Error(first.error);
      const afterFirst = netMediaSpend(ORG_A);
      const second = await fireWebhook(job.providerJobId);
      if (second.status === null) throw new Error(second.error);
      const finals = state().events.filter(e => e.kind !== 'reserve').length;
      return all(
        { passed: finals === 1, observed: `terminal events=${finals}` },
        amountsMatch('net after replay', afterFirst, netMediaSpend(ORG_A), 0)
      );
    }
  );

  await runCase(
    'J9-vid-settle-in-cost-ledger',
    'video: a settled generation writes a pipeline_cost_ledger row equal to its settled amount (one ledger for text, image and video)',
    async () => {
      const r = await submitVideo(videoReq(ORG_A));
      const res = await fireWebhook(r.jobs[0].providerJobId);
      if (res.status === null) throw new Error(res.error);
      const ledger = state().ledger.filter(l => l.clientId === ORG_A);
      return all(
        {
          passed: ledger.length === 1,
          observed: `ledgerRows=${ledger.length}`,
        },
        amountsMatch(
          'ledger vs settled',
          netMediaSpend(ORG_A),
          ledger[0]?.costUsd,
          MEDIA_TOLERANCE_USD
        )
      );
    }
  );

  await runCase(
    'J9-vid-unsent-submit-releases-hold',
    'video: a submit the provider rejected before dispatch releases its hold, leaving net spend at zero',
    async () => {
      state().failures.add('fal.submit');
      const r = await submitVideo(videoReq(ORG_A));
      const releases = state().events.filter(e => e.kind === 'release').length;
      return all(
        {
          passed: r.refused && releases === 1,
          observed: `threw=${r.refused} releases=${releases}`,
        },
        amountsMatch('net spend', 0, netMediaSpend(ORG_A), MEDIA_TOLERANCE_USD)
      );
    }
  );
}

// ---------------------------------------------------------------------------
// Cost ledger writer (lib/pipelines/track-cost)
// ---------------------------------------------------------------------------

async function ledgerCases(): Promise<void> {
  const models = [
    'claude-haiku-4-5',
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-sonnet-5',
  ];
  for (const model of models) {
    await runCase(
      `J9-ledger-row-equals-reported-${model}`,
      `trackPipelineCost(${model}): the ledger row carries exactly the reported tokens and cost`,
      async () => {
        const { trackPipelineCost, calculatePipelineCost } =
          await import('@/lib/pipelines/track-cost');
        const reported = { input: 4321, output: 876 };
        const cost = calculatePipelineCost(
          model,
          reported.input,
          reported.output
        );
        await trackPipelineCost({
          pipeline_name: 'j9-ledger',
          client_id: ORG_A,
          run_id: `run-${model}`,
          model,
          input_tokens: reported.input,
          output_tokens: reported.output,
          cost_usd: cost,
        });
        const row = state().ledger.find(r => r.pipelineName === 'j9-ledger');
        return all(
          {
            passed:
              row?.inputTokens === reported.input &&
              row?.outputTokens === reported.output &&
              row?.model === model &&
              row?.clientId === ORG_A,
            observed: `row tokens=${row?.inputTokens}/${row?.outputTokens} model=${row?.model}`,
          },
          amountsMatch('ledger cost', cost, row?.costUsd, 0)
        );
      }
    );
  }

  await runCase(
    'J9-ledger-rate-openai-latest',
    'calculatePipelineCost: a non-Anthropic model is priced at its own registry rate, not a fallback',
    async () => {
      const { calculatePipelineCost } =
        await import('@/lib/pipelines/track-cost');
      const { modelId, usd } = await registryCost(
        'openai',
        1_000_000,
        1_000_000
      );
      return amountsMatch(
        `price of ${modelId}`,
        usd,
        calculatePipelineCost(modelId, 1_000_000, 1_000_000),
        GOVERNOR_TOLERANCE_USD
      );
    }
  );
}

// ---------------------------------------------------------------------------
// Spending routes wired through the Governor (static; P5 wires them)
// ---------------------------------------------------------------------------

function routeSlug(file: string): string {
  return file
    .replace(/^app\/api\//, '')
    .replace(/\/route\.ts$/, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

async function routeCases(): Promise<void> {
  const { routes } = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../cases/J9/spend-routes.json'),
      'utf8'
    )
  ) as { routes: string[] };
  for (const file of [...routes].sort()) {
    await runCase(
      `J9-route-${routeSlug(file)}`,
      `${file}: its paid provider call goes through governedCall`,
      async () => {
        const abs = path.join(ROOT, file);
        if (!fs.existsSync(abs)) throw new Error(`route file missing: ${file}`);
        return routeUsesGovernor(fs.readFileSync(abs, 'utf8'));
      },
      file
    );
  }
}

// ---------------------------------------------------------------------------
// Positive controls: planted spenders, judged by the same detectors
// ---------------------------------------------------------------------------

async function controls(): Promise<void> {
  await runControl(
    'J9-ctl-spender-ignores-budget-read-error',
    'planted spender swallows a budget read error and calls the provider anyway',
    async () => {
      state().failures.add('orgBudgetPolicy.findUnique');
      try {
        await fakePrisma.orgBudgetPolicy.findUnique({
          where: { organizationId: ORG_A },
        });
      } catch {
        // the planted defect: an unreadable budget is treated as "go ahead"
      }
      bump('provider.planted');
      return failClosed({
        providerCalls: calls('provider.planted'),
        refused: false,
      });
    }
  );

  await runControl(
    'J9-ctl-spender-misrecords-cost',
    'planted spender records 110% of the provider-reported cost',
    async () => {
      const reported = 0.042;
      await fakePrisma.pipelineCostLedger.create({
        data: {
          pipelineName: 'j9-planted',
          clientId: ORG_A,
          runId: 'run-planted',
          model: 'planted',
          inputTokens: 10,
          outputTokens: 10,
          costUsd: reported * 1.1,
        },
      });
      const row = state().ledger.find(r => r.pipelineName === 'j9-planted');
      return amountsMatch(
        'ledger vs provider-reported',
        reported,
        row?.costUsd,
        MEDIA_TOLERANCE_USD
      );
    }
  );

  await runControl(
    'J9-ctl-spender-past-quota',
    'planted spender reads an exhausted media quota and spends anyway',
    async () => {
      state().quotas.set(ORG_A, { monthlyBudgetUsd: 75, dailyBudgetUsd: 1 });
      seedMediaSpend(ORG_A, 1);
      const quota = await fakePrisma.organizationVideoQuota.findUnique({
        where: { organizationId: ORG_A },
      });
      const spent = netMediaSpend(ORG_A);
      void (spent >= Number(quota?.dailyBudgetUsd)); // seen, then ignored
      bump('provider.planted');
      return failClosed({
        providerCalls: calls('provider.planted'),
        refused: false,
      });
    }
  );

  await runControl(
    'J9-ctl-route-bypasses-governor',
    'planted route calls a provider SDK directly with no governedCall',
    async () =>
      routeUsesGovernor(
        [
          "import Anthropic from '@anthropic-ai/sdk';",
          'export async function POST() {',
          '  const client = new Anthropic();',
          "  const msg = await client.messages.create({ model: 'x', max_tokens: 1, messages: [] });",
          '  return Response.json(msg);',
          '}',
        ].join('\n')
      )
  );
}

describe('J9 Cost and quota', () => {
  it('governor cases', governorCases);
  it('legacy text budget cases', legacyCases);
  it('image meter cases', imageCases);
  it('video cases', videoCases);
  it('ledger writer cases', ledgerCases);
  it('spending route cases', routeCases);
  it('positive controls', controls);
});
