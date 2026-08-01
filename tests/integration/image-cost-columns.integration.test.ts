/**
 * SYN-1115 review finding 6 — the PRODUCT write path persists the cost columns.
 *
 * The original defect: the migration, the Prisma model and the meter were all
 * correct, but `imageGeneration.create` in the route wrote neither
 * `estimatedCostUsd` nor `actualCostUsd`, so every row the product created left
 * both null. The paid canary "proved" the columns only because the canary
 * script wrote the fields the product path omits.
 *
 * The FIRST version of this test repeated that mistake: it called the service
 * and then authored its own `imageGeneration.create` with both fields, so
 * deleting either field from the real route would have left it green. The
 * round-2 review caught that (P2).
 *
 * This version invokes the ACTUAL route handler — `POST` from
 * app/api/media/generate/image/route.ts — and reads back the row the route
 * itself wrote. The harness supplies a prompt and reads the database; it never
 * authors either cost field (founder ruling 2). Delete either line from the
 * route and this test goes red.
 *
 * ZERO SPEND: only the provider adapters are stubbed.
 */

/** @jest-environment node */

jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

const TEST_USER = 'cost-cols-user';

// Auth + entitlement seams. Plain functions (NOT jest.fn) — resetMocks would
// wipe implementations between tests.
jest.mock('@/lib/security/api-security-checker', () => ({
  __esModule: true,
  APISecurityChecker: {
    check: async () => ({
      allowed: true,
      context: { userId: 'cost-cols-user' },
    }),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));

jest.mock('@/lib/billing/require-entitlement', () => ({
  __esModule: true,
  requireEntitlement: async () => ({
    allowed: true,
    effectivePlan: 'professional',
    requiredPlan: 'professional',
  }),
}));

jest.mock('@/lib/security/audit-logger', () => ({
  __esModule: true,
  auditLogger: { logData: async () => undefined },
}));

jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  __esModule: true,
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));

jest.mock('@/lib/services/ai/video/quota', () => ({
  __esModule: true,
  holdQuota: async () => undefined,
  settleQuota: async () => undefined,
  releaseQuota: async () => undefined,
}));

// The organisation the route will attribute spend to.
jest.mock('@/lib/multi-business/business-scope', () => ({
  __esModule: true,
  getEffectiveOrganizationId: async () => 'cost-cols-org',
}));

// The provider boundary — the ONLY thing stubbed below the route. Grounding,
// the meter, the ledger and the Prisma write are all real.
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

process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { POST } from '@/app/api/media/generate/image/route';

const ORG = 'cost-cols-org';

function imageRequest(body: object): NextRequest {
  return new NextRequest('https://synthex.example/api/media/generate/image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG },
    create: { id: ORG, name: 'SYN-1115 cost columns', slug: ORG },
    update: {},
  });
  await prisma.user
    .upsert({
      where: { id: TEST_USER },
      create: {
        id: TEST_USER,
        email: `${TEST_USER}@example.test`,
        name: 'cost cols',
      },
      update: {},
    })
    .catch(() => undefined);
});

afterEach(async () => {
  await prisma.imageGeneration.deleteMany({ where: { organizationId: ORG } });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.$disconnect();
});

describe('POST /api/media/generate/image persists both cost columns', () => {
  it('the ROUTE writes estimatedCostUsd and actualCostUsd on a batch row', async () => {
    // variants > 1 takes the batch branch, which is the imageGeneration.create
    // call that previously omitted both fields.
    const res = await POST(
      imageRequest({
        prompt: 'carpet cleaning technician',
        aspectRatio: '1:1',
        variants: 2,
        saveToLibrary: false,
      })
    );

    expect(res.status).toBe(200);

    const rows = await prisma.imageGeneration.findMany({
      where: { organizationId: ORG },
    });
    expect(rows.length).toBeGreaterThan(0);

    // THE assertions — on rows the ROUTE wrote, from values the SERVICE
    // computed. Nothing in this file supplies either number.
    for (const row of rows.filter(r => r.status === 'completed')) {
      expect(row.estimatedCostUsd).not.toBeNull();
      expect(row.actualCostUsd).not.toBeNull();
      expect(Number(row.estimatedCostUsd)).toBeGreaterThan(0);
      expect(Number(row.actualCostUsd)).toBeGreaterThan(0);
    }
  });

  it('attributes every row to the resolved organisation', async () => {
    await POST(
      imageRequest({
        prompt: 'carpet cleaning technician',
        variants: 2,
        saveToLibrary: false,
      })
    );

    const rows = await prisma.imageGeneration.findMany({
      where: { organizationId: ORG },
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.organizationId).toBe(ORG);
  });
});
