/**
 * Per-build spending cap: media spend counts (follow-up 1 to PR #1066).
 *
 * The cap is "what this build has spent". Text calls land in
 * pipeline_cost_ledger under run_id = buildId. Audio and video holds (the P5
 * media-spend-gate, and the video quota) write their ledger row under
 * run_id = holdId, so the ledger SUM never saw them; their spend lives in
 * media_spend_events, where a hold's reserve event can carry run_id = buildId.
 * A hold's NET (reserve + its one terminal delta) is what it cost: the
 * reservation while in flight, the actual once settled, zero once released.
 *
 * SEAM: governedCall / checkBuildCap / getBuildSpend run for real against an
 * in-memory stand-in for the two Prisma models that filters on the `where`
 * it is given, so a wrong filter (a missing kind, an extra media type) is
 * caught as wrong spend, not as a wrong call shape.
 *
 * Test names carry the Done-contract criterion id (C1 ...).
 */

import { Prisma } from '@prisma/client';
import { getLatestModel } from '@/lib/ai/model-registry';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    runnerFlag: { findMany: jest.fn() },
    aPICredential: { findMany: jest.fn() },
    orgBudgetPolicy: { findUnique: jest.fn() },
    pipelineCostLedger: {
      groupBy: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    mediaSpendEvent: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
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
import {
  governedCall,
  getBuildSpend,
  BuildSpendUnreadableError,
  estimateCostUsd,
  type GovernedCallInput,
} from '@/lib/ai/governor';
import {
  BRAND,
  ORG_ID,
  RUNNER,
  installDefaults,
  receiptRow,
  type GovernorMocks,
} from './governor-test-harness';

type Mocks = GovernorMocks & {
  prisma: GovernorMocks['prisma'] & {
    pipelineCostLedger: { aggregate: jest.Mock };
    mediaSpendEvent: { findMany: jest.Mock; aggregate: jest.Mock };
  };
};

const mocks = {
  prisma: prisma as unknown as Mocks['prisma'],
  decryptApiKey: decryptApiKey as unknown as jest.Mock,
} as Mocks;

const PROVIDER = 'anthropic' as const;
const BUILD_ID = 'build_media_0001';
const ESTIMATE = { inputTokens: 1000, outputTokens: 1000 };
const ESTIMATE_USD = estimateCostUsd(
  getLatestModel(PROVIDER),
  ESTIMATE.inputTokens,
  ESTIMATE.outputTokens
);

// --- In-memory stand-in for the two tables --------------------------------
type Where = Record<string, unknown>;
interface LedgerRow {
  runId: string;
  costUsd: number;
}
interface EventRow {
  holdId: string;
  kind: 'reserve' | 'settle' | 'release' | 'sweep';
  deltaUsd: number;
  runId: string | null;
  mediaType: string | null;
}

let ledger: LedgerRow[];
let events: EventRow[];

function matches(row: object, where: Where): boolean {
  return Object.entries(where).every(([key, want]) => {
    const have = (row as Record<string, unknown>)[key];
    if (want && typeof want === 'object' && 'in' in want) {
      return (want as { in: unknown[] }).in.includes(have);
    }
    return have === want;
  });
}

function installTables() {
  mocks.prisma.pipelineCostLedger.aggregate.mockImplementation(
    async ({ where }: { where: Where }) => {
      const rows = ledger.filter(r => matches(r, where));
      return {
        _sum: {
          costUsd: rows.length ? rows.reduce((s, r) => s + r.costUsd, 0) : null,
        },
      };
    }
  );
  mocks.prisma.mediaSpendEvent.findMany.mockImplementation(
    async ({ where }: { where: Where }) =>
      events.filter(e => matches(e, where)).map(e => ({ holdId: e.holdId }))
  );
  // deltaUsd is Decimal(10,4) in Postgres; Prisma returns a Decimal sum.
  mocks.prisma.mediaSpendEvent.aggregate.mockImplementation(
    async ({ where }: { where: Where }) => {
      const rows = events.filter(e => matches(e, where));
      return {
        _sum: {
          deltaUsd: rows.length
            ? new Prisma.Decimal(rows.reduce((s, r) => s + r.deltaUsd, 0))
            : null,
        },
      };
    }
  );
}

/** One hold under `runId`: its reserve, plus an optional terminal event. */
function hold(
  holdId: string,
  mediaType: 'audio' | 'video' | 'image',
  heldUsd: number,
  terminal?: { kind: 'settle' | 'release' | 'sweep'; actualUsd?: number },
  runId: string | null = BUILD_ID
) {
  events.push({ holdId, kind: 'reserve', deltaUsd: heldUsd, runId, mediaType });
  if (terminal) {
    const delta =
      terminal.kind === 'release'
        ? -heldUsd
        : (terminal.actualUsd ?? 0) - heldUsd;
    // finalizeSpend writes the terminal event without a run_id or media type.
    events.push({
      holdId,
      kind: terminal.kind,
      deltaUsd: delta,
      runId: null,
      mediaType: null,
    });
  }
}

beforeEach(() => {
  installDefaults(mocks);
  ledger = [];
  events = [];
  installTables();
});

function call(
  execute: jest.Mock,
  extra: Partial<GovernedCallInput<string>> = {}
) {
  return governedCall<string>({
    organizationId: ORG_ID,
    brandSlug: BRAND,
    runner: RUNNER,
    provider: PROVIDER,
    model: { kind: 'latest' },
    pipelineName: 'governor-build-cap-media-test',
    estimate: ESTIMATE,
    execute,
    build: { buildId: BUILD_ID, capUsd: 12 },
    ...extra,
  });
}

function okExecute() {
  return jest.fn().mockResolvedValue({
    data: 'ok',
    inputTokens: 10,
    outputTokens: 10,
  });
}

function buildCapOf(): Record<string, unknown> {
  const provenance = receiptRow(mocks)!.provenance as Record<string, unknown>;
  return provenance.buildCap as Record<string, unknown>;
}

describe('build cap counts media spend', () => {
  it('sanity: the estimate is small and positive', () => {
    expect(ESTIMATE_USD).toBeGreaterThan(0);
    expect(ESTIMATE_USD).toBeLessThan(1);
  });

  it('C1 an in-flight audio hold counts its reservation and tips the build over the cap', async () => {
    ledger.push({ runId: BUILD_ID, costUsd: 9 });
    hold('hold-audio-1', 'audio', 3);
    const execute = jest.fn();

    const result = await call(execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_build_cap_exceeded');
    expect(execute).not.toHaveBeenCalled();
    expect(receiptRow(mocks)!.runId).toBe(BUILD_ID);
    expect(buildCapOf()).toMatchObject({ spentUsd: 12, capUsd: 12 });
  });

  it('C1 the same build without the media hold is allowed (control: the hold is what refuses)', async () => {
    ledger.push({ runId: BUILD_ID, costUsd: 9 });
    const execute = okExecute();

    const result = await call(execute);

    expect(result.ok).toBe(true);
    expect(buildCapOf()).toMatchObject({ spentUsd: 9 });
  });

  it('C1 a video hold under the build counts too', async () => {
    ledger.push({ runId: BUILD_ID, costUsd: 8 });
    hold('hold-video-1', 'video', 4);
    const execute = jest.fn();

    const result = await call(execute);

    expect(result.outcome).toBe('refused_build_cap_exceeded');
    expect(execute).not.toHaveBeenCalled();
  });

  it('C1 a settled hold counts what it actually cost, not its reservation', async () => {
    ledger.push({ runId: BUILD_ID, costUsd: 9 });
    hold('hold-audio-2', 'audio', 3, { kind: 'settle', actualUsd: 1 });
    const execute = okExecute();

    const result = await call(execute);

    expect(result.ok).toBe(true);
    expect(buildCapOf()).toMatchObject({
      verdict: 'within_build_cap',
      spentUsd: 10,
    });
  });

  it('C1 a released hold counts zero', async () => {
    ledger.push({ runId: BUILD_ID, costUsd: 9 });
    hold('hold-audio-3', 'audio', 3, { kind: 'release' });
    const execute = okExecute();

    const result = await call(execute);

    expect(result.ok).toBe(true);
    expect(buildCapOf()).toMatchObject({ spentUsd: 9 });
  });

  it('C1 getBuildSpend reports ledger plus net media spend', async () => {
    ledger.push({ runId: BUILD_ID, costUsd: 2 });
    hold('hold-audio-4', 'audio', 1.5);
    hold('hold-video-2', 'video', 4, { kind: 'settle', actualUsd: 0.5 });

    await expect(getBuildSpend(BUILD_ID, 12)).resolves.toEqual({
      buildId: BUILD_ID,
      spentUsd: 4,
      capUsd: 12,
      remainingUsd: 8,
    });
  });

  it('C2 an image hold under the build is not added again (its ledger row already carries run_id = buildId)', async () => {
    // Image generation writes its ledger row under run_id = traceId; in a
    // build the traceId is the buildId, so the ledger SUM already has it.
    ledger.push({ runId: BUILD_ID, costUsd: 9 });
    hold('hold-image-1', 'image', 9, { kind: 'settle', actualUsd: 9 });
    const execute = okExecute();

    const result = await call(execute);

    expect(result.ok).toBe(true);
    expect(buildCapOf()).toMatchObject({ spentUsd: 9 });
  });

  it("C2 a media hold's own ledger row (run_id = holdId) is not summed under the build", async () => {
    hold('hold-audio-5', 'audio', 3, { kind: 'settle', actualUsd: 3 });
    ledger.push({ runId: 'hold-audio-5', costUsd: 3 });

    await expect(getBuildSpend(BUILD_ID, 12)).resolves.toMatchObject({
      spentUsd: 3,
    });
  });

  it('C2 media holds attributed to another build, or to none, are not counted', async () => {
    hold('hold-other', 'audio', 11, undefined, 'build_someone_else');
    hold('hold-none', 'audio', 11, undefined, null);

    await expect(getBuildSpend(BUILD_ID, 12)).resolves.toMatchObject({
      spentUsd: 0,
    });
  });

  it('C3 a media-spend read that throws refuses (control-plane error), never reads as zero', async () => {
    mocks.prisma.mediaSpendEvent.findMany.mockRejectedValue(
      new Error('connection reset')
    );
    const execute = jest.fn();

    const result = await call(execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_control_plane_error');
    expect(execute).not.toHaveBeenCalled();
    expect(receiptRow(mocks)!.outcome).toBe('refused_control_plane_error');
  });

  it('C3 a media sum read that throws refuses too', async () => {
    hold('hold-audio-6', 'audio', 1);
    mocks.prisma.mediaSpendEvent.aggregate.mockRejectedValue(
      new Error('statement timeout')
    );
    const execute = jest.fn();

    const result = await call(execute);

    expect(result.outcome).toBe('refused_control_plane_error');
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['NaN', Number.NaN],
    ['negative', -5],
  ])(
    'C3 a poisoned media sum (%s) refuses as untrusted input',
    async (_l, value) => {
      hold('hold-audio-7', 'audio', 1);
      mocks.prisma.mediaSpendEvent.aggregate.mockResolvedValue({
        _sum: { deltaUsd: value },
      });
      const execute = jest.fn();

      const result = await call(execute);

      expect(result.outcome).toBe('refused_budget_untrusted_input');
      expect(execute).not.toHaveBeenCalled();
    }
  );

  it('C3 a rounding residue below zero (4-dp deltas) reads as zero, not as poison', async () => {
    hold('hold-audio-8', 'audio', 1);
    mocks.prisma.mediaSpendEvent.aggregate.mockResolvedValue({
      _sum: { deltaUsd: new Prisma.Decimal('-0.0001') },
    });
    const execute = okExecute();

    const result = await call(execute);

    expect(result.ok).toBe(true);
    expect(buildCapOf()).toMatchObject({ spentUsd: 0 });
  });

  it('C3 getBuildSpend throws when the media side is unreadable', async () => {
    mocks.prisma.mediaSpendEvent.findMany.mockRejectedValue(
      new Error('connection reset')
    );

    await expect(getBuildSpend(BUILD_ID, 12)).rejects.toBeInstanceOf(
      BuildSpendUnreadableError
    );
  });
});
