/**
 * SYN-1115 round-2 review finding 2 — holds are DURABLE and recoverable.
 *
 * The defect: `settleImageSpend` was made retryable, but every production
 * caller kept the hold in a local variable with no retry and no durable
 * handoff. A transient database error therefore left the estimate charged
 * against the organisation with nothing able to find it again — the retry test
 * passed only because it called the helper directly and manually kept the hold
 * object, which no production caller can do.
 *
 * A hold is now written to `media_spend_holds` before the provider call and
 * closed on settle/release. An 'open' row past the sweep threshold is a
 * recoverable straggler, reconciled by /api/cron/video-sweep.
 *
 * ZERO SPEND: no provider is called anywhere in this file.
 */

/** @jest-environment node */

jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

const quotaCalls: Array<{ op: string; org: string; amount: number }> = [];
let releaseShouldFail = false;

jest.mock('@/lib/services/ai/video/quota', () => ({
  __esModule: true,
  holdQuota: async (org: string, amount: number) => {
    quotaCalls.push({ op: 'hold', org, amount });
  },
  settleQuota: async (org: string, _held: number, actual: number) => {
    quotaCalls.push({ op: 'settle', org, amount: actual });
  },
  releaseQuota: async (org: string, amount: number) => {
    if (releaseShouldFail) throw new Error('connection reset');
    quotaCalls.push({ op: 'release', org, amount });
  },
}));

import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import {
  holdImageSpend,
  settleImageSpend,
  releaseImageSpend,
} from '@/lib/services/ai/image/meter';

const ORG = `hold-it-${randomUUID().slice(0, 8)}`;

beforeEach(() => {
  quotaCalls.length = 0;
  releaseShouldFail = false;
});

afterEach(async () => {
  await prisma.mediaSpendHold.deleteMany({ where: { organizationId: ORG } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('a hold is a durable, recoverable fact', () => {
  it('writes an open row BEFORE the provider would be called', async () => {
    const runId = randomUUID();
    const hold = await holdImageSpend(ORG, 'studio', {}, 2, runId);

    expect(hold.recordId).not.toBeNull();
    const row = await prisma.mediaSpendHold.findUniqueOrThrow({
      where: { id: hold.recordId! },
    });
    expect(row.status).toBe('open');
    expect(row.organizationId).toBe(ORG);
    expect(Number(row.heldUsd)).toBeCloseTo(hold.heldUsd, 4);
    expect(row.runId).toBe(runId);
    expect(row.settledUsd).toBeNull();
  });

  it('closes the row as settled, recording what was actually charged', async () => {
    const hold = await holdImageSpend(ORG, 'studio', {}, 1, randomUUID());
    await settleImageSpend(hold, [{ model: 'fal-ai/flux-2/lora' }], {
      runId: randomUUID(),
      organizationId: ORG,
    });

    const row = await prisma.mediaSpendHold.findUniqueOrThrow({
      where: { id: hold.recordId! },
    });
    expect(row.status).toBe('settled');
    expect(Number(row.settledUsd)).toBe(0.021);
  });

  it('closes the row as released when nothing was generated', async () => {
    const hold = await holdImageSpend(ORG, 'studio', {}, 3, randomUUID());
    await releaseImageSpend(hold);

    const row = await prisma.mediaSpendHold.findUniqueOrThrow({
      where: { id: hold.recordId! },
    });
    expect(row.status).toBe('released');
  });

  // THE point of the whole mechanism: the process loses the hold object and
  // the reservation is still findable.
  it('leaves the row OPEN when the quota mutation fails, so it survives the process', async () => {
    const hold = await holdImageSpend(ORG, 'studio', {}, 4, randomUUID());
    const recordId = hold.recordId!;
    releaseShouldFail = true;

    await expect(releaseImageSpend(hold)).rejects.toThrow('connection reset');

    // Simulate the request ending — the in-memory hold is gone.
    const stranded = await prisma.mediaSpendHold.findUniqueOrThrow({
      where: { id: recordId },
    });
    expect(stranded.status).toBe('open');

    // A sweeper can find it with nothing but the database.
    const findable = await prisma.mediaSpendHold.findMany({
      where: { status: 'open', organizationId: ORG },
    });
    expect(findable.map(r => r.id)).toContain(recordId);
  });

  it('an unpriced or over-budget request writes NO hold row', async () => {
    await expect(
      holdImageSpend(
        ORG,
        'studio',
        { useReferences: false, provider: 'dalle' },
        1
      )
    ).rejects.toThrow(/cannot be costed/);

    const rows = await prisma.mediaSpendHold.findMany({
      where: { organizationId: ORG },
    });
    expect(rows).toHaveLength(0);
  });
});
