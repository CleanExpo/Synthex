/** @jest-environment node */

/**
 * SYN-1115 round-8 — the PRODUCT write path must still record spend when
 * attempt persistence fails.
 *
 * The companion file `attempt-evidence-loss.integration.test.ts` pins the
 * settlement arithmetic directly. This one proves the real route benefits from
 * it, because the arithmetic is only worth anything if the generation path
 * actually supplies the floor: `withAttempt` has to claim each key BEFORE the
 * provider call, and `settleImageSpend` has to pass that count on. Testing
 * `settlementAmountUsd` alone would leave both of those unproven.
 *
 * The sabotage is `recordAttempt` throwing on every call — the failure mode the
 * try/catch at each call site was written to survive. The generation must still
 * succeed (that part of the fail-open reasoning is correct: a bookkeeping
 * failure must not destroy an image the caller already paid for) while the
 * ledger must NOT net to zero.
 *
 * Nothing here authors a cost field or an attempt row; the harness stubs the
 * provider boundary and the persistence seam, then reads what the route wrote.
 *
 * ZERO SPEND: only the provider adapters are stubbed.
 */

jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

const TEST_USER = 'attempt-loss-user';
const ORG = 'attempt-loss-org';

// THE SABOTAGE. Every attempt write fails; everything else in the spend log —
// the reservation, the cap check, settlement, the finalize key — stays real.
jest.mock('@/lib/services/ai/image/spend-log', () => {
  const actual = jest.requireActual('@/lib/services/ai/image/spend-log');
  return {
    ...actual,
    recordAttempt: async () => {
      throw new Error('simulated attempt-persistence failure');
    },
  };
});

jest.mock('@/lib/security/api-security-checker', () => ({
  __esModule: true,
  APISecurityChecker: {
    check: async () => ({
      allowed: true,
      context: { userId: 'attempt-loss-user' },
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

jest.mock('@/lib/multi-business/business-scope', () => ({
  __esModule: true,
  getEffectiveOrganizationId: async () => 'attempt-loss-org',
}));

// Provider behaviour is switchable so a batch can be made to FAIL at the
// provider. A failed variant is billable — the call was accepted — but it is
// absent from `outcomes`, so it is the case `outcomes.length` cannot cover.
const providerState = { fail: false, calls: 0 };
const fakeProvider = (model: string) => async () => {
  providerState.calls++;
  if (providerState.fail) throw new Error('provider rejected after accepting');
  return { imageUrl: 'https://example.test/generated.png', model, seed: 1234 };
};

jest.mock('@/lib/services/ai/image/providers/flux-lora-fal', () => ({
  __esModule: true,
  generateFluxLoraImage: (...a: unknown[]) =>
    (
      global as unknown as { __fluxLora: (...a: unknown[]) => Promise<unknown> }
    ).__fluxLora(...a),
}));
jest.mock('@/lib/services/ai/image/providers/flux-fal', () => ({
  __esModule: true,
  generateFluxImage: (...a: unknown[]) =>
    (
      global as unknown as { __flux: (...a: unknown[]) => Promise<unknown> }
    ).__flux(...a),
}));
(global as unknown as { __fluxLora: unknown }).__fluxLora =
  fakeProvider('fal-ai/flux-2/lora');
(global as unknown as { __flux: unknown }).__flux =
  fakeProvider('fal-ai/flux-2-pro');

process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { POST } from '@/app/api/media/generate/image/route';

function imageRequest(body: object): NextRequest {
  return new NextRequest('https://synthex.example/api/media/generate/image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function netSpendUsd(): Promise<number> {
  const rows = await prisma.mediaSpendEvent.findMany({
    where: { organizationId: ORG },
    select: { deltaUsd: true },
  });
  return (
    Math.round(rows.reduce((t, r) => t + Number(r.deltaUsd), 0) * 10000) / 10000
  );
}

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG },
    create: { id: ORG, name: 'SYN-1115 attempt loss', slug: ORG },
    update: {},
  });
  await prisma.user
    .upsert({
      where: { id: TEST_USER },
      create: {
        id: TEST_USER,
        email: `${TEST_USER}@example.test`,
        name: 'attempt loss',
      },
      update: {},
    })
    .catch(() => undefined);
  await prisma.organizationVideoQuota.upsert({
    where: { organizationId: ORG },
    create: { organizationId: ORG, dailyBudgetUsd: 500, monthlyBudgetUsd: 500 },
    update: { dailyBudgetUsd: 500, monthlyBudgetUsd: 500 },
  });
  // The sandbox database PERSISTS between jest runs, so this org carries the
  // spend of every earlier run. An org-lifetime total would be dominated by
  // that history: the first draft of this test asserted one, and a sabotaged
  // build still passed because a previous run's +0.378 masked this run's
  // net-zero. Start clean and assert on the DELTA.
  await prisma.mediaSpendEvent.deleteMany({ where: { organizationId: ORG } });
  await prisma.mediaProviderAttempt.deleteMany({
    where: { organizationId: ORG },
  });
  await prisma.imageGeneration.deleteMany({ where: { organizationId: ORG } });
});

afterAll(async () => {
  await prisma.imageGeneration.deleteMany({ where: { organizationId: ORG } });
  await prisma.$disconnect();
});

beforeEach(() => {
  providerState.fail = false;
  providerState.calls = 0;
});

describe('a completed batch still records spend when attempt writes fail', () => {
  it('the ledger does not net to zero', async () => {
    const before = await netSpendUsd();
    const res = await POST(
      imageRequest({
        prompt: 'carpet cleaning technician',
        aspectRatio: '1:1',
        variants: 2,
        saveToLibrary: false,
      })
    );
    expect(res.status).toBe(200);

    // PRECONDITION 1: the sabotage really took — no attempt row survived. If
    // any had, this would be testing the ordinary path and proving nothing.
    const attempts = await prisma.mediaProviderAttempt.count({
      where: { organizationId: ORG },
    });
    expect(attempts).toBe(0);

    // PRECONDITION 2: the generation still succeeded. A bookkeeping failure
    // must not destroy an image the caller already paid for — if the route
    // started failing instead, the assertion below would pass for the wrong
    // reason.
    const completed = await prisma.imageGeneration.count({
      where: { organizationId: ORG, status: 'completed' },
    });
    expect(completed).toBeGreaterThan(0);

    // PRECONDITION 3: the hold was actually taken and finalised, so the net
    // below is a real settle rather than an absent one.
    const events = await prisma.mediaSpendEvent.findMany({
      where: { organizationId: ORG },
      select: { kind: true },
    });
    expect(events.some(e => e.kind === 'reserve')).toBe(true);
    expect(events.some(e => e.kind !== 'reserve')).toBe(true);

    // THE assertion, on THIS run's delta. With no attempt rows, settlement
    // used to read "nothing reached a provider", settle at 0, and append
    // `0 - heldUsd` — refunding the whole reservation for images that were
    // generated and billed, so the run netted to exactly zero.
    expect((await netSpendUsd()) - before).toBeGreaterThan(0);
  });

  it('charges an all-FAILED batch whose attempt writes were also lost', async () => {
    // The case `outcomes.length` cannot cover. Every variant reached the
    // provider and was billable, every one then failed, so `outcomes` is empty
    // — the floor has to come from `attemptedKeys`, which withAttempt claims
    // BEFORE each call. If a batch path forgets to thread that set onto its
    // SpendContext, the floor is 0 and a paid batch settles at nothing.
    providerState.fail = true;
    const before = await netSpendUsd();

    await POST(
      imageRequest({
        prompt: 'carpet cleaning technician',
        aspectRatio: '1:1',
        variants: 2,
        saveToLibrary: false,
      })
    );

    // PRECONDITION: a hold was taken and finalised, and no attempt row and no
    // completed image survived — otherwise this is not the case described.
    const events = await prisma.mediaSpendEvent.findMany({
      where: { organizationId: ORG },
      select: { kind: true },
    });
    expect(events.some(e => e.kind === 'reserve')).toBe(true);
    expect(events.some(e => e.kind !== 'reserve')).toBe(true);
    expect(
      await prisma.mediaProviderAttempt.count({
        where: { organizationId: ORG },
      })
    ).toBe(0);

    // The reservation rate, read from the reserve event the meter wrote.
    const reserve = await prisma.mediaSpendEvent.findFirst({
      where: { organizationId: ORG, kind: 'reserve' },
      select: { deltaUsd: true },
    });
    const perCallUsd = Number(reserve!.deltaUsd) / 2; // 2 variants reserved

    // THE assertion: EVERY accepted-then-failed provider call is charged, not
    // just the distinct ones. The grounded retry re-derives the same attempt
    // key as its first try, so counting key identities charged 4 units for 6
    // real calls — the attempt table collapses them for the same reason, which
    // is why the key has to be unique per invocation rather than per shape.
    expect(providerState.calls).toBeGreaterThan(2);
    expect((await netSpendUsd()) - before).toBeCloseTo(
      providerState.calls * perCallUsd,
      4
    );
  });

  it('charges NOTHING when the adapter never reached a provider', async () => {
    // The inverse risk of a pre-call floor: `withAttempt` claims the attempt
    // BEFORE invoking the adapter, but some failures are provably local. Both
    // fal adapters throw on a missing FAL_API_KEY before any fetch, so no HTTP
    // request is made and nothing can have been billed — yet the claimed
    // attempt (and the 'submitted' row with an unknown cost) charged the
    // fallback rate for each one. A grounded variant could be billed for the
    // LoRA try, the FLUX fallback and the FLUX retry having made zero calls.
    const key = process.env.FAL_API_KEY;
    delete process.env.FAL_API_KEY;
    // Route to the REAL adapters so their preflight guard is what runs.
    // requireActual, NOT a plain import: importing from the mocked module
    // returns the stub, which calls back into `global.__flux` — the first
    // version of this did exactly that and blew the call stack instead of
    // testing anything.
    const { generateFluxImage } = jest.requireActual(
      '@/lib/services/ai/image/providers/flux-fal'
    ) as typeof import('@/lib/services/ai/image/providers/flux-fal');
    const { generateFluxLoraImage } = jest.requireActual(
      '@/lib/services/ai/image/providers/flux-lora-fal'
    ) as typeof import('@/lib/services/ai/image/providers/flux-lora-fal');
    (global as unknown as { __fluxLora: unknown }).__fluxLora =
      generateFluxLoraImage;
    (global as unknown as { __flux: unknown }).__flux = generateFluxImage;

    const before = await netSpendUsd();
    try {
      await POST(
        imageRequest({
          prompt: 'carpet cleaning technician',
          aspectRatio: '1:1',
          variants: 2,
          saveToLibrary: false,
        })
      );
    } finally {
      if (key === undefined) delete process.env.FAL_API_KEY;
      else process.env.FAL_API_KEY = key;
      (global as unknown as { __fluxLora: unknown }).__fluxLora =
        fakeProvider('fal-ai/flux-2/lora');
      (global as unknown as { __flux: unknown }).__flux =
        fakeProvider('fal-ai/flux-2-pro');
    }

    // PRECONDITION: a hold was taken and finalised, so this is a real
    // settlement rather than an absent one.
    const events = await prisma.mediaSpendEvent.findMany({
      where: { organizationId: ORG },
      select: { kind: true },
    });
    expect(events.some(e => e.kind === 'reserve')).toBe(true);
    expect(events.some(e => e.kind !== 'reserve')).toBe(true);

    // THE assertion: zero HTTP calls, zero charge.
    expect((await netSpendUsd()) - before).toBeCloseTo(0, 4);
  });

  it('charges NOTHING when a LEGACY adapter never reached a provider', async () => {
    // The ungrounded chain (useReferences:false) does not throw on a missing
    // key — it RETURNS a failure result — so the typed error alone does not
    // cover it. Without the returned-value check, withAttempt records those as
    // succeeded attempts at the estimate: real money invented for zero HTTP
    // requests, and the default ungrounded model is the dearest in the
    // registry.
    const saved = {
      stability: process.env.STABILITY_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      google: process.env.GOOGLE_API_KEY,
    };
    delete process.env.STABILITY_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const before = await netSpendUsd();
    try {
      await POST(
        imageRequest({
          prompt: 'carpet cleaning technician',
          aspectRatio: '1:1',
          variants: 1,
          useReferences: false,
          saveToLibrary: false,
        })
      );
    } finally {
      for (const [k, v] of [
        ['STABILITY_API_KEY', saved.stability],
        ['OPENAI_API_KEY', saved.openai],
        ['GEMINI_API_KEY', saved.gemini],
        ['GOOGLE_API_KEY', saved.google],
      ] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }

    // PRECONDITION: a hold was taken and finalised.
    const events = await prisma.mediaSpendEvent.findMany({
      where: { organizationId: ORG },
      select: { kind: true },
    });
    expect(events.some(e => e.kind === 'reserve')).toBe(true);
    expect(events.some(e => e.kind !== 'reserve')).toBe(true);

    // THE assertion: no key, no request, no charge.
    expect((await netSpendUsd()) - before).toBeCloseTo(0, 4);
  });
});
