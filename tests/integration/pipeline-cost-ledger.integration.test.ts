/**
 * P1-G2 / Phase 1.6 (SYN-1115) — the cost ledger write is PROVABLE.
 *
 * The gap this closes: `trackPipelineCost` wrote to `pipeline_cost_ledger`
 * through a separately-constructed supabase-js client, which required
 * NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on top of DATABASE_URL.
 * With those absent it logged `pipeline_cost_ledger_skipped` and wrote nothing.
 * The SYN-1115 image canary hit exactly that: a real $0.021 generation produced
 * a correct log line and NO ledger row, so spend was auditable only by grepping
 * logs.
 *
 * `PipelineCostLedger` was already a Prisma model, so the write now goes
 * through Prisma — one connection string, one client, and a row that can be
 * asserted here.
 *
 * ZERO SPEND: no provider is called anywhere in this file. It settles a
 * synthetic hold against the sandbox database and reads the row back.
 */

// The app's lib/prisma singleton is Supabase-tuned (forces SSL) and rejects the
// local sandbox Postgres — swap it for the sandbox client, exactly as
// budget-enforcer.integration.test.ts does, so the REAL trackPipelineCost and
// meter code paths hit the sandbox DB.
jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { trackPipelineCost } from '@/lib/pipelines/track-cost';
import {
  holdImageSpend,
  settleImageSpend,
} from '@/lib/services/ai/image/meter';
import { recordAttempt } from '@/lib/services/ai/image/spend-log';

const ORG = `ledger-it-${randomUUID().slice(0, 8)}`;

afterAll(async () => {
  await prisma.pipelineCostLedger.deleteMany({ where: { clientId: ORG } });
  await prisma.mediaSpendEvent
    .deleteMany({ where: { organizationId: ORG } })
    .catch(() => undefined);
  await prisma.organizationVideoQuota
    .deleteMany({ where: { organizationId: ORG } })
    .catch(() => undefined);
  await prisma.$disconnect();
});

describe('trackPipelineCost — writes a real row through Prisma', () => {
  it('persists the ledger row and reads it back', async () => {
    const runId = randomUUID();

    await trackPipelineCost({
      pipeline_name: 'image-generation',
      client_id: ORG,
      run_id: runId,
      model: 'fal-ai/flux-2/lora',
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0.021,
    });

    const rows = await prisma.pipelineCostLedger.findMany({
      where: { runId },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      pipelineName: 'image-generation',
      clientId: ORG,
      model: 'fal-ai/flux-2/lora',
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(Number(rows[0].costUsd)).toBeCloseTo(0.021, 6);
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  it('still records board-level pipelines with a null client_id', async () => {
    const runId = randomUUID();
    await trackPipelineCost({
      pipeline_name: 'weekly-digest',
      client_id: null,
      run_id: runId,
      model: 'claude-sonnet-4-6',
      input_tokens: 1200,
      output_tokens: 800,
      cost_usd: 0.0156,
    });

    const rows = await prisma.pipelineCostLedger.findMany({ where: { runId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].clientId).toBeNull();
    // Text pipelines still carry real token counts — the image path's zeroes
    // are specific to area/image billing, not a regression here.
    expect(rows[0].inputTokens).toBe(1200);
    expect(rows[0].outputTokens).toBe(800);

    await prisma.pipelineCostLedger.deleteMany({ where: { runId } });
  });
});

describe('the image spend meter lands a ledger row end to end', () => {
  // organization_video_quotas carries an FK to organizations, so the tenant
  // must exist before a hold can be taken against it.
  beforeAll(async () => {
    await prisma.organization.upsert({
      where: { id: ORG },
      create: { id: ORG, name: 'SYN-1115 ledger IT', slug: ORG },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.organization
      .deleteMany({ where: { id: ORG } })
      .catch(() => undefined);
  });

  it('settles a synthetic hold and writes the settled cost to the ledger', async () => {
    // Seed a quota row so the hold has a budget to draw on. No provider call.
    await prisma.organizationVideoQuota.upsert({
      where: { organizationId: ORG },
      create: { organizationId: ORG },
      update: {},
    });

    const hold = await holdImageSpend(ORG, 'studio', { aspectRatio: '1:1' }, 1);
    expect(hold.perImageUsd).toBe(0.03); // FLUX.2 pro estimate, 1 MP

    // SYN-1115 round-7: the hold settles at what its ATTEMPTS cost, so a run
    // with no recorded provider call settles at zero. Record the paid call.
    await recordAttempt({
      attemptKey: `${hold.holdId}:lora`,
      holdId: hold.holdId,
      organizationId: ORG,
      mediaType: 'image',
      provider: 'fal',
      modelId: 'fal-ai/flux-2/lora',
      status: 'succeeded',
      costUsd: 0.021,
    });

    const runId = randomUUID();
    const { totalUsd } = await settleImageSpend(
      hold,
      // The model that "ran" — cheaper than the estimate, as in the live canary.
      [{ model: 'fal-ai/flux-2/lora' }],
      { runId, organizationId: ORG }
    );

    expect(totalUsd).toBe(0.021);

    const rows = await prisma.pipelineCostLedger.findMany({ where: { runId } });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].costUsd)).toBeCloseTo(0.021, 6);
    expect(rows[0].clientId).toBe(ORG);

    // And spend — now DERIVED from the append-only log rather than read off a
    // mutable counter — reflects the ACTUAL, not the estimate.
    const events = await prisma.mediaSpendEvent.findMany({
      where: { holdId: hold.holdId },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map(e => e.kind)).toEqual(['reserve', 'settle']);
    const spent = events.reduce((sum, e) => sum + Number(e.deltaUsd), 0);
    expect(spent).toBeCloseTo(0.021, 6);
  });

  it('writes NO ledger row when nothing was generated', async () => {
    const hold = await holdImageSpend(ORG, 'studio', { aspectRatio: '1:1' }, 2);
    const runId = randomUUID();

    const { totalUsd } = await settleImageSpend(hold, [], {
      runId,
      organizationId: ORG,
    });

    expect(totalUsd).toBe(0);
    const rows = await prisma.pipelineCostLedger.findMany({ where: { runId } });
    expect(rows).toHaveLength(0);
  });
});
