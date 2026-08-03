/** @jest-environment node */

/**
 * SYN-1115 round-8 — losing an attempt row must not erase the spend it
 * evidenced. Against a REAL database.
 *
 * ## The defect this file exists to catch
 *
 * `recordAttempt` is best-effort at every call site: the video submit path, the
 * video webhook and the image `withAttempt` wrapper all wrap it in a try/catch
 * that logs and continues, on the reasoning that bookkeeping must not break a
 * generation the user already paid for.
 *
 * That reasoning is right about the generation and wrong about the money,
 * because settlement then reads the attempt table as if it were complete:
 *
 *     settlementAmountUsd: if (totals.count === 0) return 0;
 *
 * and the sweep documents the same inference in prose — "no attempts ->
 * nothing reached a provider, settle at 0". Both are sound ONLY if persistence
 * is guaranteed. It is not, so "no attempts recorded" is ambiguous between
 * *nothing was submitted* and *we failed to write it down*, and the code
 * resolves that ambiguity in the direction that erases real money.
 *
 * The sharpest case is not the sweep but the ordinary SUCCESS path: an image
 * batch that generated every variant settles at $0 if its attempt writes were
 * lost, consuming a reservation and recording no spend against it.
 *
 * ## The shape of the fix being pinned
 *
 * Settlement takes a PROVEN FLOOR of attempts from the caller — which knows how
 * many provider calls it made — and database evidence may only revise that
 * upward, never below it. Absence of evidence stops meaning absence of spend.
 *
 * ZERO SPEND: no provider is called anywhere in this file.
 */

jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import {
  reserveSpend,
  recordAttempt,
  settlementAmountUsd,
} from '@/lib/services/ai/image/spend-log';

const ORG = `evidence-${randomUUID().slice(0, 8)}`;
const PER_CALL_USD = 0.021;

async function newHold(amountUsd: number): Promise<string> {
  const holdId = randomUUID();
  await reserveSpend({
    holdId,
    organizationId: ORG,
    initiatedBy: 'studio',
    amountUsd,
  });
  return holdId;
}

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG },
    create: { id: ORG, name: 'Evidence Org', slug: ORG },
    update: {},
  });
  await prisma.organizationVideoQuota.upsert({
    where: { organizationId: ORG },
    create: { organizationId: ORG, dailyBudgetUsd: 500, monthlyBudgetUsd: 500 },
    update: { dailyBudgetUsd: 500, monthlyBudgetUsd: 500 },
  });
});

describe('settlement when attempt evidence is missing', () => {
  it('charges for calls the caller PROVES it made, even with no attempt rows', async () => {
    const holdId = await newHold(PER_CALL_USD * 3);

    // PRECONDITION: the evidence really is absent. If a row somehow existed,
    // this test would be asserting the ordinary path and proving nothing.
    const rows = await prisma.mediaProviderAttempt.count({ where: { holdId } });
    expect(rows).toBe(0);

    // Three provider calls were made; every attempt write was lost.
    const settled = await settlementAmountUsd(holdId, PER_CALL_USD, 3);

    // THE assertion. Previously this returned 0 — `count === 0` was read as
    // "nothing reached a provider" — so three paid calls settled at nothing.
    expect(settled).toBeCloseTo(PER_CALL_USD * 3, 4);
  });

  it('still settles at zero when nothing was attempted and nothing is claimed', async () => {
    const holdId = await newHold(PER_CALL_USD);
    // A hold that genuinely never reached a provider must not be charged. This
    // is the case the old `count === 0 -> 0` rule was right about, and it has
    // to keep working or the fix would just over-charge instead.
    expect(await settlementAmountUsd(holdId, PER_CALL_USD, 0)).toBe(0);
  });

  it('prefers recorded evidence over the floor when evidence is richer', async () => {
    const holdId = await newHold(PER_CALL_USD * 2);

    // Two calls claimed, but the log shows THREE — a retry the caller does not
    // know about. The richer evidence must win; the floor is a floor, not an
    // override.
    for (const n of [1, 2, 3]) {
      await recordAttempt({
        attemptKey: `${holdId}:image:${n}`,
        holdId,
        organizationId: ORG,
        mediaType: 'image',
        provider: 'fal',
        modelId: 'fal-ai/flux-2',
        status: 'succeeded',
        costUsd: PER_CALL_USD,
      });
    }
    expect(await prisma.mediaProviderAttempt.count({ where: { holdId } })).toBe(
      3
    );

    expect(await settlementAmountUsd(holdId, PER_CALL_USD, 2)).toBeCloseTo(
      PER_CALL_USD * 3,
      4
    );
  });

  it('tops up the floor when only SOME attempts survived', async () => {
    const holdId = await newHold(PER_CALL_USD * 4);

    // Four calls made, only two rows landed. The two known costs are used and
    // the two missing ones fall back to the reservation rate — partial
    // evidence must not be read as complete evidence.
    for (const n of [1, 2]) {
      await recordAttempt({
        attemptKey: `${holdId}:image:partial:${n}`,
        holdId,
        organizationId: ORG,
        mediaType: 'image',
        provider: 'fal',
        modelId: 'fal-ai/flux-2',
        status: 'succeeded',
        costUsd: 0.01,
      });
    }

    expect(await settlementAmountUsd(holdId, PER_CALL_USD, 4)).toBeCloseTo(
      0.01 * 2 + PER_CALL_USD * 2,
      4
    );
  });

  it('counts an attempt of UNKNOWN cost once, not twice', async () => {
    const holdId = await newHold(PER_CALL_USD * 2);

    // One row exists but its cost is not yet known (an accepted submit with no
    // outcome). It is already charged at the fallback rate by the unknown-cost
    // path, so the floor must not add it a second time.
    await recordAttempt({
      attemptKey: `${holdId}:image:unknown`,
      holdId,
      organizationId: ORG,
      mediaType: 'image',
      provider: 'fal',
      modelId: 'fal-ai/flux-2',
      status: 'submitted',
      costUsd: null,
    });

    expect(await settlementAmountUsd(holdId, PER_CALL_USD, 1)).toBeCloseTo(
      PER_CALL_USD,
      4
    );
  });

  it('reports an image hold as having NO video owner', async () => {
    // SYN-1115 round-8, second pass. `submittedToProvider` can only become true
    // through a linked video_generations row, so it is false for every image
    // hold — image generation is synchronous and never persists a link. The
    // sweep therefore cannot use it to tell "this image run never called a
    // provider" from "it called one and died before settling", and a floor of
    // 0 would permanently finalise a paid hold at $0.
    //
    // `hasOwnerRow` is what makes that distinguishable: absent entirely means
    // no proof either way, which the sweep must treat conservatively.
    const holdId = await newHold(PER_CALL_USD * 2);
    const { findStaleReservations } = jest.requireActual(
      '@/lib/services/ai/image/spend-log'
    ) as typeof import('@/lib/services/ai/image/spend-log');

    const stale = await findStaleReservations(new Date(Date.now() + 60_000));
    const mine = stale.find(r => r.holdId === holdId);

    // PRECONDITION: the hold must actually be in the stale set, or the
    // assertions below are about nothing.
    expect(mine).toBeDefined();
    expect(mine!.submittedToProvider).toBe(false);
    expect(mine!.hasOwnerRow).toBe(false);
  });

  it('does not let a zero-cost preflight row absorb a LOST paid call', async () => {
    // Mixed persistence, and the reason settlement joins on attempt KEY rather
    // than subtracting counts. A legacy fallback can leave a provably-unsent
    // preflight recorded at cost 0, and a later configured provider can then
    // make a real paid call whose attempt write is lost.
    //
    // Counting made those cancel: one recorded row, one claimed call, so
    // `claimed - rowCount` was 0 and settlement returned the surviving row's
    // $0 — erasing a different, genuinely paid call.
    const holdId = await newHold(PER_CALL_USD * 2);
    const preflightKey = `${holdId}:legacy-stability:sd3:0:1#1`;
    const paidKey = `${holdId}:legacy-gemini:g3:0:1#2`;

    await recordAttempt({
      attemptKey: preflightKey,
      holdId,
      organizationId: ORG,
      mediaType: 'image',
      provider: 'stability',
      modelId: 'stable-diffusion-3',
      status: 'failed',
      costUsd: 0, // provably sent nothing
    });

    // PRECONDITION: exactly one row, and it is the zero-cost one. The paid
    // call's write is the one that was lost.
    const rows = await prisma.mediaProviderAttempt.findMany({
      where: { holdId },
      select: { attemptKey: true, costUsd: true },
    });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].costUsd)).toBe(0);

    // The claim covers only the paid call — withAttempt retracted the
    // preflight's key when the adapter proved it never reached a provider.
    const claimed = new Set([paidKey]);

    // THE assertion: the paid call is charged at the reservation rate, and the
    // zero-cost row adds nothing rather than cancelling it.
    expect(
      await settlementAmountUsd(holdId, PER_CALL_USD, claimed)
    ).toBeCloseTo(PER_CALL_USD, 4);
  });

  it('charges a recorded call ONCE when its key is also claimed', async () => {
    // The other side of the join: a claimed call whose row DID survive must not
    // be charged twice — once from the row and again as an unrecorded claim.
    const holdId = await newHold(PER_CALL_USD * 2);
    const key = `${holdId}:flux:fal-ai/flux-2:0:7#1`;
    await recordAttempt({
      attemptKey: key,
      holdId,
      organizationId: ORG,
      mediaType: 'image',
      provider: 'fal',
      modelId: 'fal-ai/flux-2',
      status: 'succeeded',
      costUsd: 0.015,
    });

    expect(
      await settlementAmountUsd(holdId, PER_CALL_USD, new Set([key]))
    ).toBeCloseTo(0.015, 4);
  });
});
