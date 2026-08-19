/** @jest-environment node */

/**
 * SYN-1115 round-8 — a video batch must settle every variant, not just the
 * first webhook to arrive. Driven through the PRODUCTION submit and webhook
 * call sites against a REAL database.
 *
 * ## The defect this file exists to catch
 *
 * `submitGenerativeVideo` reserved `perJobUsd * variants` under ONE
 * `spendHoldId` and stamped that same hold on every row of the batch. Each
 * webhook then finalised with `heldUsd = row.estimatedCostUsd` — ONE variant's
 * estimate — against the shared finalize key `hold:{id}:final`.
 *
 * Exactly one terminal event per hold is expressible by construction, so the
 * first webhook to land won and every later variant's outcome became a P2002
 * no-op. The batch could record ONE outcome for N variants.
 *
 * ## What makes the money assertion discriminating — read before editing
 *
 * The obvious test — three variants that all succeed — does NOT catch this.
 * Each settles at its estimate, so its delta is zero, and the surviving
 * reservation total coincidentally equals the true spend. The first draft of
 * this file asserted exactly that and passed against the broken code.
 *
 * The defect is ORDER-DEPENDENT, and that is what to aim at. With one failure
 * and one success:
 *
 *   - failure webhook first: releases one variant's hold and the total lands
 *     on the right number BY LUCK;
 *   - success webhook first: settles at delta 0, the failure's release is
 *     swallowed, and the batch is charged for a variant that produced nothing.
 *
 * So `success first` is the case that must be tested. The all-succeed case
 * still earns its place by pinning the terminal-event COUNT, which catches the
 * defect regardless of ordering luck.
 *
 * ZERO SPEND: fal is stubbed, no provider is called.
 */

jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

const mockSubmitToFal = jest.fn();
jest.mock('@/lib/services/ai/video/fal-adapter', () => ({
  ...jest.requireActual('@/lib/services/ai/video/fal-adapter'),
  submitToFal: (...a: unknown[]) => mockSubmitToFal(...a),
  webhookUrl: () => 'https://synthex.example/api/video/webhook/fal?token=shh',
  verifyWebhookToken: () => true,
}));

jest.mock('@/lib/services/ai/video/artifact-store', () => ({
  storeArtifact: async () => ({ storedUrl: 'https://cdn.example/v.mp4' }),
}));

jest.mock('@/lib/services/ai/video/prompt-enhancer', () => ({
  enhancePrompt: async (p: string) => p,
}));

jest.mock('@/lib/services/ai/reference-library', () => ({
  resolveReferences: () => ({
    industry: 'carpet-cleaning',
    subject: 'wand',
    imagePaths: ['/reference-library/carpet-cleaning/a.webp'],
    count: 1,
  }),
}));

import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { submitGenerativeVideo } from '@/lib/services/ai/video/generation-service';
import { POST } from '@/app/api/video/webhook/fal/route';

const ORG = `vbatch-${randomUUID().slice(0, 8)}`;
const USER = `vbatch-user-${randomUUID().slice(0, 8)}`;

/**
 * Derived spend for the org — the log IS the spend.
 *
 * Scoped to ORG, and every provider job id below carries the ORG suffix,
 * because the sandbox database persists between jest runs: an unscoped lookup
 * by `providerJobId` matches rows left by an earlier run, and the webhook
 * happily transitions those instead of this run's.
 */
async function derivedSpendUsd(): Promise<number> {
  const rows = await prisma.mediaSpendEvent.findMany({
    where: { organizationId: ORG },
    select: { deltaUsd: true },
  });
  return (
    Math.round(rows.reduce((t, r) => t + Number(r.deltaUsd), 0) * 10000) / 10000
  );
}

function okWebhook(providerJobId: string): NextRequest {
  return new NextRequest(
    'https://synthex.example/api/video/webhook/fal?token=shh',
    {
      method: 'POST',
      body: JSON.stringify({
        request_id: providerJobId,
        status: 'OK',
        payload: { video: { url: 'https://cdn.fal/v.mp4' } },
      }),
    }
  );
}

function errorWebhook(providerJobId: string): NextRequest {
  return new NextRequest(
    'https://synthex.example/api/video/webhook/fal?token=shh',
    {
      method: 'POST',
      body: JSON.stringify({
        request_id: providerJobId,
        status: 'ERROR',
        error: 'provider exploded',
      }),
    }
  );
}

async function submitBatch(variants: number, tag: string): Promise<string[]> {
  const jobIds = Array.from(
    { length: variants },
    (_, i) => `fal-${tag}-${i}-${ORG}`
  );
  jobIds.forEach(id => mockSubmitToFal.mockResolvedValueOnce(id));
  await submitGenerativeVideo({
    organizationId: ORG,
    userId: USER,
    initiatedBy: 'studio',
    prompt: 'a carpet wand',
    methodCardId: 'freeform',
    variants,
    useReferences: false,
  } as never);
  return jobIds;
}

async function holdsFor(jobIds: string[]): Promise<string[]> {
  const rows = await prisma.videoGeneration.findMany({
    where: { organizationId: ORG, providerJobId: { in: jobIds } },
    select: { spendHoldId: true },
  });
  return rows.map(r => r.spendHoldId as string);
}

beforeAll(async () => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.example';
  process.env.FAL_WEBHOOK_SECRET = 'shh';

  await prisma.organization.upsert({
    where: { id: ORG },
    create: { id: ORG, name: 'Video Batch Org', slug: ORG },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: USER },
    create: { id: USER, email: `${USER}@example.test`, name: 'vbatch' },
    update: {},
  });
  await prisma.organizationVideoQuota.upsert({
    where: { organizationId: ORG },
    create: { organizationId: ORG, dailyBudgetUsd: 500, monthlyBudgetUsd: 500 },
    update: { dailyBudgetUsd: 500, monthlyBudgetUsd: 500 },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('a video batch settles every variant', () => {
  it('gives each variant its own hold and its own terminal event', async () => {
    const jobIds = await submitBatch(3, 'all-ok');

    const holds = await holdsFor(jobIds);
    expect(holds).toHaveLength(3);
    expect(holds.every(Boolean)).toBe(true);
    expect(new Set(holds).size).toBe(3);

    for (const jobId of jobIds) {
      expect((await POST(okWebhook(jobId))).status).toBe(200);
    }

    const rows = await prisma.videoGeneration.findMany({
      where: { organizationId: ORG, providerJobId: { in: jobIds } },
      select: { status: true },
    });
    expect(rows.map(r => r.status)).toEqual([
      'rendered',
      'rendered',
      'rendered',
    ]);

    // THE assertion for this case: three variants, three outcomes. Under the
    // shared hold this was 1 — the other two settles were swallowed as
    // duplicate-key no-ops. The money total is deliberately NOT asserted here:
    // with every variant settling at its estimate each delta is zero, so the
    // total is right for the wrong reason and would prove nothing.
    const terminals = await prisma.mediaSpendEvent.count({
      where: {
        organizationId: ORG,
        holdId: { in: holds },
        kind: { not: 'reserve' },
      },
    });
    expect(terminals).toBe(3);
  });

  it('does not charge for a failed variant when the success lands first', async () => {
    const before = await derivedSpendUsd();
    const jobIds = await submitBatch(2, 'mixed');
    const holds = await holdsFor(jobIds);

    // PRECONDITION: the reservation must actually have covered BOTH variants,
    // otherwise "we were not overcharged" is vacuous.
    expect((await derivedSpendUsd()) - before).toBeGreaterThan(0);
    expect(new Set(holds).size).toBe(2);

    // ORDER IS THE POINT: success first, failure second. The reverse order
    // lands on the right number by luck even when the batch shares one hold.
    expect((await POST(okWebhook(jobIds[1]))).status).toBe(200);
    expect((await POST(errorWebhook(jobIds[0]))).status).toBe(200);

    const rows = await prisma.videoGeneration.findMany({
      where: { organizationId: ORG, providerJobId: { in: jobIds } },
      select: { providerJobId: true, status: true, actualCostUsd: true },
      orderBy: { providerJobId: 'asc' },
    });
    expect(rows.map(r => r.status)).toEqual(['failed', 'rendered']);

    const succeeded = Number(rows[1].actualCostUsd ?? 0);
    expect(succeeded).toBeGreaterThan(0);

    // THE money assertion. The batch must cost exactly the one variant that
    // produced something. Sharing a hold charged for both, because the success
    // settled first and the failure's release was swallowed.
    expect((await derivedSpendUsd()) - before).toBeCloseTo(succeeded, 4);
  });
});
