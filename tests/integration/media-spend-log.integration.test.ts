/**
 * SYN-1115 round-4 refactor — the append-only spend log, against a real database.
 *
 * These are the properties that cannot be proven with mocks, because the whole
 * point of the refactor is that correctness comes from a UNIQUE INDEX and a ROW
 * LOCK rather than from careful ordering in application code:
 *
 *   - one terminal event per hold, whichever writer gets there first;
 *   - a replayed settle / release / sweep is a no-op, not a double-charge;
 *   - concurrent reservations serialise and cannot jointly breach the cap;
 *   - spend is a SUM, so a crashed run leaves a reservation counted rather
 *     than stranded.
 *
 * ZERO SPEND: no provider is called anywhere in this file.
 */

/** @jest-environment node */

jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import {
  reserveSpend,
  finalizeSpend,
  findStaleReservations,
  spendSnapshot,
  finalizeKey,
  recordAttempt,
  attemptTotals,
  settlementAmountUsd,
  videoAttemptKey,
} from '@/lib/services/ai/image/spend-log';
import { QuotaExceededError } from '@/lib/services/ai/video/types';

const ORG = `spendlog-${randomUUID().slice(0, 8)}`;

async function setCaps(dailyUsd: number, monthlyUsd: number) {
  await prisma.organizationVideoQuota.upsert({
    where: { organizationId: ORG },
    create: {
      organizationId: ORG,
      dailyBudgetUsd: dailyUsd,
      monthlyBudgetUsd: monthlyUsd,
    },
    update: { dailyBudgetUsd: dailyUsd, monthlyBudgetUsd: monthlyUsd },
  });
}

const SWEEP_USER = `sweep-user-${randomUUID().slice(0, 8)}`;

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG },
    create: { id: ORG, name: 'SYN-1115 spend log', slug: ORG },
    update: {},
  });
  // video_generations carries an FK to users.
  await prisma.user.upsert({
    where: { id: SWEEP_USER },
    create: {
      id: SWEEP_USER,
      email: `${SWEEP_USER}@example.test`,
      name: 'spend log sweep',
    },
    update: {},
  });
});

beforeEach(async () => {
  await prisma.mediaProviderAttempt.deleteMany({
    where: { organizationId: ORG },
  });
  await prisma.mediaSpendEvent.deleteMany({ where: { organizationId: ORG } });
  await setCaps(5, 25);
});

afterAll(async () => {
  await prisma.mediaProviderAttempt.deleteMany({
    where: { organizationId: ORG },
  });
  await prisma.mediaSpendEvent.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationVideoQuota.deleteMany({
    where: { organizationId: ORG },
  });
  await prisma.videoGeneration.deleteMany({ where: { userId: SWEEP_USER } });
  await prisma.user.deleteMany({ where: { id: SWEEP_USER } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.$disconnect();
});

describe('spend is a SUM over an append-only log', () => {
  it('a reservation counts immediately and settles to the actual', async () => {
    const holdId = randomUUID();
    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 0.42,
    });

    let snap = await spendSnapshot(ORG);
    expect(snap.dailyUsd).toBeCloseTo(0.42, 4);

    await finalizeSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.42,
      actualUsd: 0.105,
      kind: 'settle',
    });

    snap = await spendSnapshot(ORG);
    // 0.42 reserved + (0.105 - 0.42) settled = 0.105 actually spent.
    expect(snap.dailyUsd).toBeCloseTo(0.105, 4);
  });

  it('a release returns the whole reservation', async () => {
    const holdId = randomUUID();
    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 0.42,
    });
    await finalizeSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.42,
      kind: 'release',
    });

    const snap = await spendSnapshot(ORG);
    expect(snap.dailyUsd).toBeCloseTo(0, 4);
  });
});

describe('exactly one terminal event per hold — the core guarantee', () => {
  it('a replayed settle is a no-op, not a double-charge', async () => {
    const holdId = randomUUID();
    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 0.42,
    });

    const args = {
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio' as const,
      heldUsd: 0.42,
      actualUsd: 0.105,
      kind: 'settle' as const,
    };
    expect(await finalizeSpend(args)).toBe(true);
    expect(await finalizeSpend(args)).toBe(false);
    expect(await finalizeSpend(args)).toBe(false);

    const snap = await spendSnapshot(ORG);
    expect(snap.dailyUsd).toBeCloseTo(0.105, 4);

    const events = await prisma.mediaSpendEvent.findMany({ where: { holdId } });
    expect(events).toHaveLength(2); // reserve + exactly one terminal
  });

  it('the SWEEP cannot subtract spend a real settlement already recorded', async () => {
    // This is the round-4 review finding the refactor exists to remove: the
    // old counter-based sweep released the hold and could double-subtract.
    const holdId = randomUUID();
    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 0.42,
    });
    await finalizeSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.42,
      actualUsd: 0.105,
      kind: 'settle',
    });

    // The sweep now runs against the same hold.
    const swept = await finalizeSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.42,
      kind: 'sweep',
    });

    expect(swept).toBe(false);
    const snap = await spendSnapshot(ORG);
    // Still the real spend — NOT 0.105 - 0.42.
    expect(snap.dailyUsd).toBeCloseTo(0.105, 4);
  });

  it('settle and release share one key, so only the first stands', async () => {
    const holdId = randomUUID();
    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 0.42,
    });
    await finalizeSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.42,
      kind: 'release',
    });
    const late = await finalizeSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.42,
      actualUsd: 0.105,
      kind: 'settle',
    });

    expect(late).toBe(false);
    const rows = await prisma.mediaSpendEvent.findMany({
      where: { eventKey: finalizeKey(holdId) },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('release');
  });
});

describe('the ceiling holds under concurrency', () => {
  it('refuses the reservation that would breach the daily cap', async () => {
    await setCaps(1, 25);
    await reserveSpend({
      holdId: randomUUID(),
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 0.9,
    });

    await expect(
      reserveSpend({
        holdId: randomUUID(),
        organizationId: ORG,
        initiatedBy: 'studio',
        amountUsd: 0.2,
      })
    ).rejects.toBeInstanceOf(QuotaExceededError);

    // A refused reservation writes NOTHING.
    const snap = await spendSnapshot(ORG);
    expect(snap.dailyUsd).toBeCloseTo(0.9, 4);
  });

  it('N concurrent reservations cannot jointly breach the cap', async () => {
    await setCaps(1, 25);

    // Ten simultaneous $0.2 reservations against a $1 cap: at most five may
    // succeed. Without the row lock they would all read 0 and all commit.
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        reserveSpend({
          holdId: randomUUID(),
          organizationId: ORG,
          initiatedBy: 'studio',
          amountUsd: 0.2,
        })
      )
    );

    const granted = attempts.filter(a => a.status === 'fulfilled').length;
    expect(granted).toBeGreaterThan(0);
    expect(granted).toBeLessThanOrEqual(5);

    const snap = await spendSnapshot(ORG);
    expect(snap.dailyUsd).toBeLessThanOrEqual(1);
  });

  it('applies the agent sub-cap to mcp-initiated spend', async () => {
    await setCaps(1, 25); // mcp sub-cap = 50% = 0.5
    await expect(
      reserveSpend({
        holdId: randomUUID(),
        organizationId: ORG,
        initiatedBy: 'mcp',
        amountUsd: 0.6,
      })
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });
});

describe('stale reservations are discoverable from the database alone', () => {
  it('finds a reservation with no terminal event, and not one that has settled', async () => {
    const stale = randomUUID();
    const settled = randomUUID();
    for (const holdId of [stale, settled]) {
      await reserveSpend({
        holdId,
        organizationId: ORG,
        initiatedBy: 'studio',
        amountUsd: 0.42,
      });
    }
    await finalizeSpend({
      holdId: settled,
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.42,
      actualUsd: 0.105,
      kind: 'settle',
    });

    const found = await findStaleReservations(new Date(Date.now() + 60_000));
    const ids = found.map(f => f.holdId);
    expect(ids).toContain(stale);
    expect(ids).not.toContain(settled);

    const target = found.find(f => f.holdId === stale)!;
    expect(target.heldUsd).toBeCloseTo(0.42, 4);
    expect(target.organizationId).toBe(ORG);
  });

  it('does not surface reservations younger than the cutoff', async () => {
    await reserveSpend({
      holdId: randomUUID(),
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 0.42,
    });
    const found = await findStaleReservations(new Date(Date.now() - 60_000));
    expect(found.filter(f => f.organizationId === ORG)).toHaveLength(0);
  });
});

describe('window attribution — a hold lands in exactly ONE window', () => {
  it('attributes the finalize to the RESERVE window, not its own timestamp', async () => {
    const holdId = randomUUID();
    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 0.42,
    });
    await finalizeSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.42,
      actualUsd: 0.105,
      kind: 'settle',
    });

    const events = await prisma.mediaSpendEvent.findMany({ where: { holdId } });
    expect(events).toHaveLength(2);
    // Both events carry the SAME window instant.
    const windows = new Set(events.map(e => e.windowAt.toISOString()));
    expect(windows.size).toBe(1);
  });

  it('a hold reserved YESTERDAY does not make today negative', async () => {
    // The exact defect: filtering deltas by each event's own created_at meant a
    // reserve before midnight and a settle after it left today summing to the
    // negative remainder.
    const holdId = randomUUID();
    const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000);

    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 0.42,
      now: yesterday,
    });
    // Finalised NOW, a day later.
    await finalizeSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.42,
      actualUsd: 0.105,
      kind: 'settle',
    });

    const snap = await spendSnapshot(ORG);
    // Today sees nothing from a hold that belongs to yesterday — and crucially
    // NOT minus 0.315.
    expect(snap.dailyUsd).toBeCloseTo(0, 4);
    expect(snap.dailyUsd).toBeGreaterThanOrEqual(0);
  });

  it('yesterday keeps the ACTUAL, not the reservation', async () => {
    const holdId = randomUUID();
    const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000);
    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 0.42,
      now: yesterday,
    });
    await finalizeSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.42,
      actualUsd: 0.105,
      kind: 'settle',
    });

    const rows = await prisma.mediaSpendEvent.findMany({ where: { holdId } });
    const net = rows.reduce((sum, r) => sum + Number(r.deltaUsd), 0);
    expect(net).toBeCloseTo(0.105, 4);
  });

  it('refuses to finalize a hold that was never reserved', async () => {
    // Otherwise a stray finalize would fabricate NEGATIVE spend.
    const wrote = await finalizeSpend({
      holdId: randomUUID(),
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.42,
      kind: 'release',
    });
    expect(wrote).toBe(false);
    const snap = await spendSnapshot(ORG);
    expect(snap.dailyUsd).toBeCloseTo(0, 4);
  });
});

describe('the sweep needs evidence the run is dead, not just old', () => {
  it('does NOT sweep a reservation whose video job is still generating', async () => {
    // The round-5 defect: an in-flight generation past the cutoff got swept,
    // and the genuine settlement then no-opped — erasing paid spend.
    const holdId = randomUUID();
    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 0.42,
    });

    const jobId = `job-${randomUUID().slice(0, 8)}`;
    await prisma.videoGeneration.create({
      data: {
        id: jobId,
        userId: SWEEP_USER,
        organizationId: ORG,
        title: 'in flight',
        topic: 't',
        style: 'social-reel',
        duration: '15-60s',
        status: 'generating', // LIVE owner
        mode: 'generative',
        spendHoldId: holdId,
      },
    });

    const found = await findStaleReservations(new Date(Date.now() + 60_000));
    expect(found.map(f => f.holdId)).not.toContain(holdId);

    await prisma.videoGeneration.delete({ where: { id: jobId } });
  });

  it('DOES sweep once that job reaches a terminal state', async () => {
    const holdId = randomUUID();
    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 0.42,
    });

    const jobId = `job-${randomUUID().slice(0, 8)}`;
    await prisma.videoGeneration.create({
      data: {
        id: jobId,
        userId: SWEEP_USER,
        organizationId: ORG,
        title: 'dead',
        topic: 't',
        style: 'social-reel',
        duration: '15-60s',
        status: 'failed', // terminal — nothing will settle it now
        mode: 'generative',
        spendHoldId: holdId,
      },
    });

    const found = await findStaleReservations(new Date(Date.now() + 60_000));
    expect(found.map(f => f.holdId)).toContain(holdId);

    await prisma.videoGeneration.delete({ where: { id: jobId } });
  });
});

describe('provider attempts are the record of what was ACTUALLY charged', () => {
  async function reserve(amountUsd = 0.42) {
    const holdId = randomUUID();
    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd,
    });
    return holdId;
  }

  it('counts EVERY paid call, including fallbacks and retries', async () => {
    // The defect: one logical image could make a LoRA call, a Pro fallback and
    // a retry, and settlement recorded only the final result — so two of three
    // paid calls were invisible.
    const holdId = await reserve();
    await recordAttempt({
      attemptKey: `${holdId}:lora`,
      holdId,
      organizationId: ORG,
      mediaType: 'image',
      provider: 'fal',
      modelId: 'fal-ai/flux-2/lora',
      status: 'failed',
      costUsd: 0.021,
    });
    await recordAttempt({
      attemptKey: `${holdId}:flux`,
      holdId,
      organizationId: ORG,
      mediaType: 'image',
      provider: 'fal',
      modelId: 'fal-ai/flux-2-pro',
      status: 'succeeded',
      costUsd: 0.03,
    });

    const totals = await attemptTotals(holdId);
    expect(totals.count).toBe(2);
    expect(totals.knownCostUsd).toBeCloseTo(0.051, 4);

    // Settlement charges BOTH, not just the one that succeeded.
    expect(await settlementAmountUsd(holdId, 0.105)).toBeCloseTo(0.051, 4);
  });

  it('treats an attempt of UNKNOWN cost as spend, not as free', async () => {
    // A timeout after the provider accepted the request is billable. Asserting
    // zero would erase real money.
    const holdId = await reserve();
    await recordAttempt({
      attemptKey: `${holdId}:timeout`,
      holdId,
      organizationId: ORG,
      mediaType: 'image',
      provider: 'fal',
      modelId: 'fal-ai/flux-2-pro',
      status: 'failed',
      costUsd: null,
    });

    const totals = await attemptTotals(holdId);
    expect(totals.unknownCount).toBe(1);
    // Falls back to the reservation rate rather than 0.
    expect(await settlementAmountUsd(holdId, 0.105)).toBeCloseTo(0.105, 4);
  });

  it('a run that made NO call settles at zero', async () => {
    const holdId = await reserve();
    expect(await settlementAmountUsd(holdId, 0.105)).toBe(0);
  });

  it('is idempotent on attemptKey — a replayed handler does not inflate spend', async () => {
    const holdId = await reserve();
    const attempt = {
      attemptKey: `${holdId}:once`,
      holdId,
      organizationId: ORG,
      mediaType: 'image' as const,
      provider: 'fal',
      modelId: 'fal-ai/flux-2-pro',
      status: 'succeeded' as const,
      costUsd: 0.03,
    };
    await recordAttempt(attempt);
    await recordAttempt(attempt);
    await recordAttempt(attempt);

    const totals = await attemptTotals(holdId);
    expect(totals.count).toBe(1);
    expect(totals.knownCostUsd).toBeCloseTo(0.03, 4);
  });

  it('an attempt for an unknown reservation is ignored, not fabricated', async () => {
    await recordAttempt({
      attemptKey: `orphan-${randomUUID()}`,
      holdId: randomUUID(),
      organizationId: ORG,
      mediaType: 'image',
      provider: 'fal',
      modelId: 'fal-ai/flux-2-pro',
      status: 'succeeded',
      costUsd: 0.03,
    });
    const rows = await prisma.mediaProviderAttempt.findMany({
      where: { organizationId: ORG },
    });
    expect(rows).toHaveLength(0);
  });

  it('THE sweep case: a run that paid and then died is CHARGED, not written off', async () => {
    // Round-5/6 erase defect, closed at the root. The sweep reads attempts.
    const holdId = await reserve(0.42);
    await recordAttempt({
      attemptKey: `${holdId}:paid`,
      holdId,
      organizationId: ORG,
      mediaType: 'image',
      provider: 'fal',
      modelId: 'fal-ai/flux-2/lora',
      status: 'succeeded',
      costUsd: 0.021,
    });

    const actualUsd = await settlementAmountUsd(holdId, 0.42);
    await finalizeSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.42,
      actualUsd,
      kind: 'sweep',
    });

    const snap = await spendSnapshot(ORG);
    // The paid call is recorded — NOT swept to zero.
    expect(snap.dailyUsd).toBeCloseTo(0.021, 4);
  });
});

// SYN-1115 round-8 review finding: video submit keyed the attempt on the batch
// index while the completion webhook keyed it on the provider job id. The two
// never matched, so every video generation wrote TWO attempt rows and doubled
// its recorded spend. Submit and the webhook are separate processes recording
// the SAME paid call, so the key must be derived identically by both.
describe('a video generation records exactly ONE attempt across submit and webhook', () => {
  it('the webhook UPDATES the submit row rather than adding a second', async () => {
    const holdId = randomUUID();
    const providerJobId = `fal-${randomUUID().slice(0, 8)}`;
    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 1.8204,
    });

    // Submit side: the call was made, outcome unknown.
    await recordAttempt({
      attemptKey: videoAttemptKey(holdId, providerJobId),
      holdId,
      organizationId: ORG,
      mediaType: 'video',
      provider: 'fal',
      modelId: 'bytedance/seedance-2.0/fast/text-to-video',
      status: 'submitted',
      costUsd: null,
      providerJobId,
    });

    // Webhook side: the same call, now with its real cost.
    await recordAttempt({
      attemptKey: videoAttemptKey(holdId, providerJobId),
      holdId,
      organizationId: ORG,
      mediaType: 'video',
      provider: 'fal',
      modelId: 'bytedance/seedance-2.0/fast/text-to-video',
      status: 'succeeded',
      costUsd: 1.4514,
      providerJobId,
    });

    const rows = await prisma.mediaProviderAttempt.findMany({
      where: { holdId },
    });

    // THE assertion: one paid call, one row. Under the mismatched keys this
    // was two rows and the settlement charged 2.9028 instead of 1.4514.
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('succeeded');
    expect(Number(rows[0].costUsd)).toBeCloseTo(1.4514, 4);

    const totals = await attemptTotals(holdId);
    expect(totals.count).toBe(1);
    expect(totals.unknownCount).toBe(0);
    expect(await settlementAmountUsd(holdId, 1.8204)).toBeCloseTo(1.4514, 4);
  });

  it('distinct jobs of one batch still record distinct attempts', async () => {
    // The key must collapse a replay of the SAME job without collapsing
    // genuinely different jobs sharing a batch hold.
    const holdId = randomUUID();
    await reserveSpend({
      holdId,
      organizationId: ORG,
      initiatedBy: 'studio',
      amountUsd: 2.9,
    });

    for (const jobId of ['fal-a', 'fal-b']) {
      await recordAttempt({
        attemptKey: videoAttemptKey(holdId, jobId),
        holdId,
        organizationId: ORG,
        mediaType: 'video',
        provider: 'fal',
        modelId: 'bytedance/seedance-2.0/fast/text-to-video',
        status: 'succeeded',
        costUsd: 1.4514,
        providerJobId: jobId,
      });
    }

    const totals = await attemptTotals(holdId);
    expect(totals.count).toBe(2);
    expect(totals.knownCostUsd).toBeCloseTo(2.9028, 4);
  });

  it('the key derivation is a single shared function, not two literals', () => {
    // Regression guard for the drift itself: both call sites import this.
    expect(videoAttemptKey('hold-1', 'job-1')).toBe('hold-1:video:job-1');
    expect(videoAttemptKey('hold-1', 'job-2')).not.toBe(
      videoAttemptKey('hold-1', 'job-1')
    );
  });
});
