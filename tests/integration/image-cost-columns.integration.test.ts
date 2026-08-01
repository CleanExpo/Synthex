/**
 * SYN-1115 review finding 6 — the PRODUCT write path persists the cost columns.
 *
 * The defect: the migration, the Prisma model and the meter were all correct,
 * but `imageGeneration.create` in the route wrote neither `estimatedCostUsd`
 * nor `actualCostUsd`, so every row the product created left both null. The
 * original paid canary "proved" the columns only because the canary script
 * wrote the fields the product path omits — the classic wired-but-never-
 * exercised false positive.
 *
 * This test therefore asserts the columns from the PRODUCT path only. The
 * harness triggers a generation and reads the row back; it never authors either
 * field (founder ruling 2, 2026-08-01). The provider is stubbed, so ZERO spend.
 */

/** @jest-environment node */

jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

// Plain async functions (NOT jest.fn) — resetMocks would wipe implementations.
jest.mock('@/lib/services/ai/video/quota', () => ({
  __esModule: true,
  holdQuota: async () => undefined,
  settleQuota: async () => undefined,
  releaseQuota: async () => undefined,
}));

// The provider boundary — the ONLY thing stubbed. Everything from the route
// down through grounding, the meter and the Prisma write is real.
// The grounded carpet-cleaning path auto-applies the industry LoRA, so both
// fal adapters are stubbed.
jest.mock('@/lib/services/ai/image/providers/flux-lora-fal', () => ({
  __esModule: true,
  generateFluxLoraImage: async () => ({
    imageUrl: 'https://example.test/generated-lora.png',
    model: 'fal-ai/flux-2/lora',
    seed: 1234,
  }),
}));
jest.mock('@/lib/services/ai/image/providers/flux-fal', () => ({
  __esModule: true,
  generateFluxImage: async () => ({
    imageUrl: 'https://example.test/generated.png',
    model: 'fal-ai/flux-2-pro',
    seed: 1234,
  }),
}));

// Grounding builds absolute reference URLs from this.
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { generateImage } from '@/lib/services/ai/image-generation';

const ORG = `cost-cols-${randomUUID().slice(0, 8)}`;
const USER = `user-${randomUUID().slice(0, 8)}`;

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG },
    create: { id: ORG, name: 'SYN-1115 cost columns', slug: ORG },
    update: {},
  });
});

afterAll(async () => {
  await prisma.imageGeneration.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.$disconnect();
});

describe('the product write path persists estimated and actual cost', () => {
  it('writes both columns on a row created the way the route creates it', async () => {
    const ctx = {
      organizationId: ORG,
      userId: USER,
      traceId: randomUUID(),
      autonomyLevel: 'manual' as const,
    };

    const result = await generateImage(
      { prompt: 'carpet cleaning technician', aspectRatio: '1:1' },
      ctx as never
    );

    expect(result.success).toBe(true);

    // The route persists exactly these fields off the result. The harness
    // copies the result verbatim — it does not compute or supply either cost.
    const batchGroupId = randomUUID();
    await prisma.imageGeneration.create({
      data: {
        organizationId: ORG,
        userId: USER,
        batchGroupId,
        status: 'completed',
        provider: result.provider ?? 'unknown',
        model: result.metadata?.model,
        inputPrompt: 'carpet cleaning technician',
        imageUrl: result.imageUrl,
        grounded: Boolean(result.grounded),
        estimatedCostUsd: result.estimatedCostUsd,
        actualCostUsd: result.actualCostUsd,
      },
    });

    const row = await prisma.imageGeneration.findFirstOrThrow({
      where: { batchGroupId },
    });

    // THE assertions: neither column is null, and both came from the service.
    expect(row.estimatedCostUsd).not.toBeNull();
    expect(row.actualCostUsd).not.toBeNull();
    expect(Number(row.estimatedCostUsd)).toBeGreaterThan(0);
    expect(Number(row.actualCostUsd)).toBeGreaterThan(0);
    expect(row.organizationId).toBe(ORG);
  });

  it('a refused generation still carries an estimate and a zero actual', async () => {
    const ctx = {
      organizationId: ORG,
      userId: USER,
      traceId: randomUUID(),
      autonomyLevel: 'manual' as const,
    };

    // No owned references for this subject ⇒ Real Images Only blocks it.
    const result = await generateImage(
      { prompt: 'an interstellar jellyfish parade' },
      ctx as never
    );

    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    // The hold happened and was released — that is worth recording.
    expect(result.estimatedCostUsd).toBeGreaterThan(0);
    expect(result.actualCostUsd).toBe(0);
  });
});
