/** @jest-environment node */
/**
 * Voice (ElevenLabs) and avatar video (ElevenLabs + HeyGen) spend is held by
 * the fail-closed MEDIA quota before any provider request (P5, spec M10).
 *
 * SEAM: each route's handler (voice POST generate/stream, voice PUT batch,
 * heygen POST), called with a NextRequest. Faked only at the boundaries: auth,
 * entitlement, rate limiter, audit sink, org lookup, storage upload, the
 * database (the J9 in-memory Prisma, so the spend log runs for real) and the
 * network (global fetch, counted as the provider).
 * CATCHES: a provider request sent before its hold exists; a quota read error
 * or exhausted quota that lets a provider request through; an unpriced model
 * reaching the provider; success that is not settled (and ledgered); a provider
 * failure that keeps the hold charged.
 * MISSES: Postgres row-lock semantics (tests/integration/
 * media-spend-log.integration.test.ts) and whether the providers' published
 * prices are still current.
 */
jest.mock('@/lib/prisma', () =>
  jest.requireActual('../../eval/jev/families/j9/fake-db').prismaModule()
);
jest.mock('@/lib/logger', () =>
  jest.requireActual('../../eval/jev/families/j9/fake-db').loggerModule()
);
jest.mock('@/lib/redis-client', () =>
  jest.requireActual('../../eval/jev/families/j9/fake-db').redisModule()
);
jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({ allowed: true }),
}));
jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));
jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: async () => undefined },
}));
jest.mock('@/lib/security/service-token-validator', () => ({
  validateServiceToken: () => ({ valid: false }),
}));
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: async () => ({ allowed: true, context: { userId: 'user-1' } }),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: async () => 'org-voice-1',
}));
jest.mock('@/lib/storage/platform-storage', () => ({
  uploadToStorage: async () => ({ url: 'https://storage.example/a.mp3' }),
}));

import { NextRequest } from 'next/server';
import {
  netMediaSpend,
  resetState,
  state,
} from '../../eval/jev/families/j9/fake-db';
import {
  POST as voicePost,
  PUT as voicePut,
} from '@/app/api/media/generate/voice/route';
import { POST as heygenPost } from '@/app/api/heygen/video/route';
import {
  holdMediaSpend,
  releaseMediaSpend,
  settleMediaSpend,
} from '@/lib/services/ai/media-spend-gate';

const ORG = 'org-voice-1';
const TEXT_1K = 'a'.repeat(1000);
/** 160,000 bytes of 128 kbps MP3 is 10 seconds of audio. */
const AUDIO_10S = new Uint8Array(160_000);

type Mode =
  | 'ok'
  | 'elevenlabs-fails'
  // HeyGen refused the job outright (4xx): it provably created nothing.
  | 'heygen-fails'
  // Outcomes after which HeyGen may have created, and billed, the job.
  | 'heygen-500'
  | 'heygen-no-id'
  | 'heygen-network';
let mode: Mode = 'ok';
let providerRequests: Array<{ url: string; holdsAtSend: number }> = [];
const realFetch = global.fetch;

const reserves = () =>
  state().events.filter(e => e.organizationId === ORG && e.kind === 'reserve')
    .length;
const finals = (kind: string) =>
  state().events.filter(e => e.organizationId === ORG && e.kind === kind)
    .length;

beforeAll(() => {
  process.env.ELEVENLABS_API_KEY = 'test-placeholder';
  process.env.HEYGEN_API_KEY = 'test-placeholder';
  global.fetch = (async (input: unknown) => {
    const url = String(input);
    providerRequests.push({ url, holdsAtSend: reserves() });
    if (url.includes('elevenlabs')) {
      if (mode === 'elevenlabs-fails') {
        return new Response(JSON.stringify({ detail: { message: 'stub' } }), {
          status: 503,
        });
      }
      return new Response(AUDIO_10S, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      });
    }
    if (mode === 'heygen-fails') {
      return new Response('stub', { status: 400 });
    }
    if (mode === 'heygen-500') {
      return new Response('stub', { status: 500 });
    }
    if (mode === 'heygen-no-id') {
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    }
    if (mode === 'heygen-network') {
      throw new TypeError('fetch failed');
    }
    return new Response(JSON.stringify({ data: { video_id: 'vid-1' } }), {
      status: 200,
    });
  }) as typeof fetch;
});
afterAll(() => {
  global.fetch = realFetch;
});

beforeEach(() => {
  resetState();
  providerRequests = [];
  mode = 'ok';
  state().quotas.set(ORG, { monthlyBudgetUsd: 75, dailyBudgetUsd: 15 });
});

const req = (url: string, body: object, method = 'POST') =>
  new NextRequest(url, { method, body: JSON.stringify(body) });

const routes = [
  {
    name: 'voice POST generate',
    // ElevenLabs Multilingual v2: $0.08 per 1K characters.
    costUsd: 0.08,
    providerFailure: 'elevenlabs-fails' as Mode,
    call: (body: object = {}) =>
      voicePost(
        req('https://synthex.example/api/media/generate/voice', {
          text: TEXT_1K,
          modelId: 'eleven_multilingual_v2',
          ...body,
        })
      ),
  },
  {
    name: 'voice POST stream',
    // Default streaming model eleven_turbo_v2: $0.04 per 1K characters.
    costUsd: 0.04,
    providerFailure: 'elevenlabs-fails' as Mode,
    call: (body: object = {}) =>
      voicePost(
        req('https://synthex.example/api/media/generate/voice?action=stream', {
          text: TEXT_1K,
          ...body,
        })
      ),
  },
  {
    name: 'voice PUT batch',
    costUsd: 0.16,
    providerFailure: 'elevenlabs-fails' as Mode,
    call: (body: object = {}) =>
      voicePut(
        req(
          'https://synthex.example/api/media/generate/voice',
          {
            requests: [
              { text: TEXT_1K, modelId: 'eleven_multilingual_v2', ...body },
              { text: TEXT_1K, modelId: 'eleven_multilingual_v2', ...body },
            ],
          },
          'PUT'
        )
      ),
  },
  {
    name: 'heygen POST',
    // $0.08 speech + 10 s of HeyGen Avatar III at $0.99/min = $0.165.
    costUsd: 0.245,
    providerFailure: 'heygen-fails' as Mode,
    call: (body: object = {}) =>
      heygenPost(
        req('https://synthex.example/api/heygen/video', {
          script: TEXT_1K,
          avatarId: 'avatar-1',
          ...body,
        })
      ),
  },
];

describe.each(routes)('$name — spend is held by the media quota', route => {
  it('reserves before the first provider request', async () => {
    await route.call();
    expect(providerRequests.length).toBeGreaterThan(0);
    expect(providerRequests[0].holdsAtSend).toBeGreaterThanOrEqual(1);
  });

  it('a quota read error refuses with 503 and zero provider requests', async () => {
    state().failures.add('$queryRaw');
    state().failures.add('$transaction');
    const res = await route.call();
    expect(providerRequests).toHaveLength(0);
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('media_quota_unavailable');
  });

  it('an exhausted quota refuses with 429 and zero provider requests', async () => {
    state().quotas.set(ORG, { monthlyBudgetUsd: 75, dailyBudgetUsd: 0.01 });
    const res = await route.call();
    expect(providerRequests).toHaveLength(0);
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('media_quota_exceeded');
  });

  it('success settles the actual cost and writes the ledger', async () => {
    const res = await route.call();
    expect(res.status).toBeLessThan(300);
    expect(finals('settle')).toBe(reserves());
    expect(netMediaSpend(ORG)).toBeCloseTo(route.costUsd, 4);
    const ledgered = state().ledger.reduce((t, r) => t + r.costUsd, 0);
    expect(ledgered).toBeCloseTo(route.costUsd, 4);
  });

  it('a provider failure releases the provider hold', async () => {
    mode = route.providerFailure;
    await route.call();
    expect(finals('release')).toBeGreaterThanOrEqual(1);
    expect(reserves()).toBe(finals('release') + finals('settle'));
  });
});

it('voice: an unpriced ElevenLabs model refuses with zero provider requests', async () => {
  const res = await routes[0].call({ modelId: 'eleven_monolingual_v1' });
  expect(providerRequests).toHaveLength(0);
  expect(res.status).toBe(422);
  expect((await res.json()).code).toBe('media_unpriced');
});

it('voice: the success response shape is unchanged', async () => {
  const res = await routes[0].call({ saveToLibrary: false });
  expect(res.status).toBe(200);
  expect(Object.keys(await res.json()).sort()).toEqual(
    [
      'audioBase64',
      'characterCount',
      'contentType',
      'success',
      'voiceId',
    ].sort()
  );
});

it('heygen: the HeyGen request is sent only after its own hold exists', async () => {
  await routes[3].call();
  const heygen = providerRequests.find(r => r.url.includes('heygen'));
  expect(heygen?.holdsAtSend).toBe(2);
});

it('heygen: a HeyGen failure still charges the speech that ran', async () => {
  mode = 'heygen-fails';
  const res = await routes[3].call();
  expect(res.status).toBe(500);
  expect(netMediaSpend(ORG)).toBeCloseTo(0.08, 4);
});

it('heygen: caller-supplied audio of unknown length refuses with zero provider requests', async () => {
  const res = await routes[3].call({
    audioUrl: 'https://cdn.example/voice.mp3',
  });
  expect(providerRequests).toHaveLength(0);
  expect(res.status).toBe(422);
  expect((await res.json()).code).toBe('media_unpriced');
});

it('settlement is idempotent on replay: one finalize, one ledger row', async () => {
  const hold = await holdMediaSpend({
    organizationId: ORG,
    initiatedBy: 'studio',
    heldUsd: 0.08,
    pipeline: 'voice-generation',
    model: 'eleven_multilingual_v2',
  });
  await settleMediaSpend(hold, 0.08);
  await settleMediaSpend({ ...hold }, 0.08);
  expect(finals('settle')).toBe(1);
  expect(state().ledger).toHaveLength(1);
});

it('(control: planted failure is caught) a provider request sent before any hold fails the ordering check', async () => {
  await fetch('https://api.elevenlabs.io/v1/text-to-speech/x'); // planted: no reserve first
  expect(() =>
    expect(providerRequests[0].holdsAtSend).toBeGreaterThanOrEqual(1)
  ).toThrow();
});

describe('heygen: a failure after dispatch keeps the avatar hold (outcome unknown)', () => {
  // The speech hold (0.08) settles either way; the avatar hold is 0.165.
  const AVATAR_HELD = 0.165;
  const heygenHolds = () =>
    state().events.filter(e => e.organizationId === ORG && e.kind === 'reserve')
      .length;

  it.each(['heygen-500', 'heygen-no-id', 'heygen-network'] as Mode[])(
    '%s: the avatar hold is neither released nor refunded',
    async failure => {
      mode = failure;
      const res = await routes[3].call();
      expect(res.status).toBe(500);
      expect(heygenHolds()).toBe(2);
      expect(finals('release')).toBe(0);
      // Speech settled at cost; the avatar hold still counts in full.
      expect(netMediaSpend(ORG)).toBeCloseTo(0.08 + AVATAR_HELD, 4);
    }
  );

  it('control: an explicit HeyGen refusal (4xx) releases the avatar hold', async () => {
    mode = 'heygen-fails';
    await routes[3].call();
    expect(finals('release')).toBe(1);
    expect(netMediaSpend(ORG)).toBeCloseTo(0.08, 4);
  });
});

describe('media spend: the audio ledger row survives a failed write', () => {
  const holdVoice = () =>
    holdMediaSpend({
      organizationId: ORG,
      initiatedBy: 'studio',
      heldUsd: 0.08,
      pipeline: 'voice-generation',
      model: 'eleven_multilingual_v2',
    });
  const backfill = async () => {
    const { backfillMediaSpendLedger } = jest.requireActual(
      '@/lib/services/ai/video/quota'
    ) as { backfillMediaSpendLedger?: (since: Date) => Promise<number> };
    if (typeof backfillMediaSpendLedger !== 'function') {
      throw new Error('no media ledger backfill exists');
    }
    return backfillMediaSpendLedger(new Date(Date.now() - 60_000));
  };

  it('a settle whose ledger write failed is repaired by a replay', async () => {
    const hold = await holdVoice();
    state().failures.add('pipelineCostLedger.create');
    await settleMediaSpend(hold, 0.08);
    expect(state().ledger).toHaveLength(0);

    state().failures.delete('pipelineCostLedger.create');
    await settleMediaSpend({ ...hold }, 0.08);

    expect(finals('settle')).toBe(1);
    expect(state().ledger).toHaveLength(1);
    expect(state().ledger[0]).toMatchObject({
      pipelineName: 'voice-generation',
      model: 'eleven_multilingual_v2',
      runId: hold.holdId,
      clientId: ORG,
      costUsd: 0.08,
    });
  });

  it('the sweep backfill writes the missing row for a charged audio hold', async () => {
    const hold = await holdVoice();
    state().failures.add('pipelineCostLedger.create');
    await settleMediaSpend(hold, 0.08);
    state().failures.delete('pipelineCostLedger.create');

    await expect(backfill()).resolves.toBe(1);

    expect(state().ledger).toHaveLength(1);
    expect(state().ledger[0]).toMatchObject({
      runId: hold.holdId,
      clientId: ORG,
      costUsd: 0.08,
    });
    // A second pass finds nothing left to write.
    await expect(backfill()).resolves.toBe(0);
  });

  it('control: a released audio hold gets no ledger row from the backfill', async () => {
    const hold = await holdVoice();
    await releaseMediaSpend(hold);

    await expect(backfill()).resolves.toBe(0);
    expect(state().ledger).toHaveLength(0);
  });
});

describe('media spend: the audio ledger row is dated in the reserve window', () => {
  // Reserved 23:59 UTC on the last day of a month, settled two minutes later
  // in the next day AND month. Budget windows SUM the ledger by createdAt.
  const RESERVED_AT = new Date('2026-10-31T23:59:00.000Z');
  const SETTLED_AT = new Date('2026-11-01T00:01:00.000Z');
  const at = async <T>(when: Date, fn: () => Promise<T>): Promise<T> => {
    jest.useFakeTimers({ now: when, doNotFake: ['nextTick', 'setImmediate'] });
    try {
      return await fn();
    } finally {
      jest.useRealTimers();
    }
  };
  const holdAtMidnight = () =>
    at(RESERVED_AT, () =>
      holdMediaSpend({
        organizationId: ORG,
        initiatedBy: 'studio',
        heldUsd: 0.08,
        pipeline: 'voice-generation',
        model: 'eleven_multilingual_v2',
      })
    );

  it('first settle', async () => {
    const hold = await holdAtMidnight();
    await at(SETTLED_AT, () => settleMediaSpend(hold, 0.08));

    expect(state().ledger).toHaveLength(1);
    expect(state().ledger[0].createdAt).toEqual(RESERVED_AT);
  });

  it('replay after a failed first write', async () => {
    const hold = await holdAtMidnight();
    state().failures.add('pipelineCostLedger.create');
    await at(SETTLED_AT, () => settleMediaSpend(hold, 0.08));
    state().failures.delete('pipelineCostLedger.create');

    await at(SETTLED_AT, () => settleMediaSpend({ ...hold }, 0.08));

    expect(state().ledger).toHaveLength(1);
    expect(state().ledger[0].createdAt).toEqual(RESERVED_AT);
  });

  it('sweep backfill after a failed first write', async () => {
    const hold = await holdAtMidnight();
    state().failures.add('pipelineCostLedger.create');
    await at(SETTLED_AT, () => settleMediaSpend(hold, 0.08));
    state().failures.delete('pipelineCostLedger.create');

    const { backfillMediaSpendLedger } = jest.requireActual(
      '@/lib/services/ai/video/quota'
    ) as { backfillMediaSpendLedger: (since: Date) => Promise<number> };
    await expect(
      backfillMediaSpendLedger(new Date('2026-10-30T00:00:00.000Z'))
    ).resolves.toBe(1);

    expect(state().ledger[0].createdAt).toEqual(RESERVED_AT);
  });
});
