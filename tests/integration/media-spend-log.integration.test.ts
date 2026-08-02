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

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG },
    create: { id: ORG, name: 'SYN-1115 spend log', slug: ORG },
    update: {},
  });
});

beforeEach(async () => {
  await prisma.mediaSpendEvent.deleteMany({ where: { organizationId: ORG } });
  await setCaps(5, 25);
});

afterAll(async () => {
  await prisma.mediaSpendEvent.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationVideoQuota.deleteMany({
    where: { organizationId: ORG },
  });
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
