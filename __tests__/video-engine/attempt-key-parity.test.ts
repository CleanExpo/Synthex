/** @jest-environment node */

/**
 * SYN-1115 — video submit and the completion webhook must derive the SAME
 * attempt key, driven through the PRODUCTION call sites.
 *
 * ## Why this file exists
 *
 * The original defect: `generation-service.ts` composed
 * `` `${spendHoldId}:video:${i}` `` (batch index) while `webhook/fal/route.ts`
 * composed `` `${row.spendHoldId}:video:${row.providerJobId}` ``. They never
 * matched, so the webhook inserted a SECOND attempt row rather than updating
 * the submit row, and every video generation doubled its recorded spend.
 *
 * The first attempt at a regression test called `videoAttemptKey` itself for
 * both sides — so restoring the old literal in either production module left
 * it green. An independent review caught that: it guarded the helper, not the
 * behaviour.
 *
 * This file drives `submitGenerativeVideo` and the webhook `POST` handler for
 * real, captures the `attemptKey` each one passes to `recordAttempt`, and
 * asserts they are identical. Reintroducing a literal in either module fails
 * it.
 */

// jest.fn here, but its implementation is restored in beforeEach — the unit
// profile sets resetMocks, which would otherwise make it return undefined.
const mockRecordAttempt = jest.fn(async () => undefined);
jest.mock('@/lib/services/ai/image/spend-log', () => {
  const actual = jest.requireActual('@/lib/services/ai/image/spend-log');
  return {
    ...actual,
    // The KEY DERIVATION stays real — that is the thing under test. Only the
    // persistence is stubbed.
    recordAttempt: (...a: unknown[]) => mockRecordAttempt(...(a as [])),
  };
});

const mockSubmitToFal = jest.fn();
jest.mock('@/lib/services/ai/video/fal-adapter', () => ({
  ...jest.requireActual('@/lib/services/ai/video/fal-adapter'),
  submitToFal: (...a: unknown[]) => mockSubmitToFal(...a),
  webhookUrl: () => 'https://synthex.example/api/video/webhook/fal?token=shh',
  verifyWebhookToken: () => true,
}));

const mockCreate = jest.fn();
const mockFindFirst = jest.fn();
const mockUpdateMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: {
      create: (...a: unknown[]) => mockCreate(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
  },
}));

const mockSettleQuota = jest.fn(async () => true);
jest.mock('@/lib/services/ai/video/quota', () => ({
  holdQuota: async () => undefined,
  holdQuotaBatch: async (
    _o: unknown,
    _u: unknown,
    _i: unknown,
    ids: string[]
  ) => ids,
  settleQuota: (...a: unknown[]) => mockSettleQuota(...(a as [])),
  releaseQuota: async () => true,
}));

jest.mock('@/lib/services/ai/video/artifact-store', () => ({
  storeArtifact: async () => ({ storedUrl: 'https://cdn.example/v.mp4' }),
}));

jest.mock('@/lib/services/ai/reference-library', () => ({
  resolveReferences: () => ({
    industry: 'carpet-cleaning',
    subject: 'wand',
    imagePaths: ['/reference-library/carpet-cleaning/a.webp'],
    count: 1,
  }),
}));

import { NextRequest } from 'next/server';
import { UnaddressableSubmitError } from '@/lib/services/ai/video/types';
import {
  videoAttemptKey,
  unaddressableAttemptKey,
} from '@/lib/services/ai/image/spend-log';
import { submitGenerativeVideo } from '@/lib/services/ai/video/generation-service';
import { POST } from '@/app/api/video/webhook/fal/route';

const PROVIDER_JOB_ID = 'fal-req-abc123';
const ORG = 'org-parity';

beforeEach(() => {
  jest.clearAllMocks();
  mockRecordAttempt.mockImplementation(async () => undefined);
  mockSettleQuota.mockImplementation(async () => true);
  process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.example';
  process.env.FAL_WEBHOOK_SECRET = 'shh';
  mockSubmitToFal.mockResolvedValue(PROVIDER_JOB_ID);
  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockCreate.mockImplementation(async ({ data }: { data: unknown }) => ({
    id: 'row-1',
    ...(data as Record<string, unknown>),
  }));
});

function webhookRequest(): NextRequest {
  return new NextRequest(
    'https://synthex.example/api/video/webhook/fal?token=shh',
    {
      method: 'POST',
      body: JSON.stringify({
        request_id: PROVIDER_JOB_ID,
        status: 'OK',
        payload: { video: { url: 'https://cdn.fal/v.mp4' } },
      }),
    }
  );
}

/** The attemptKey each production module actually passed to recordAttempt. */
function capturedKeys(): string[] {
  return mockRecordAttempt.mock.calls.map(
    c => (c[0] as unknown as { attemptKey: string }).attemptKey
  );
}

describe('submit and webhook derive the same attempt key', () => {
  it('the two PRODUCTION call sites agree', async () => {
    await submitGenerativeVideo({
      organizationId: ORG,
      userId: 'u1',
      initiatedBy: 'studio',
      prompt: 'a carpet wand',
      methodCardId: 'freeform',
      variants: 1,
      useReferences: false,
    } as never);

    const submitKeys = capturedKeys();
    expect(submitKeys).toHaveLength(1);

    mockRecordAttempt.mockClear();
    mockFindFirst.mockResolvedValue({
      id: 'row-1',
      organizationId: ORG,
      status: 'generating',
      initiatedBy: 'studio',
      estimatedCostUsd: 1.8204,
      durationSeconds: 6,
      model: 'bytedance/seedance-2.0/fast/text-to-video',
      userId: 'u1',
      enhancedPrompt: 'a carpet wand',
      batchGroupId: 'b1',
      metadata: null,
      providerJobId: PROVIDER_JOB_ID,
      spendHoldId: (
        mockCreate.mock.calls[0][0] as { data: { spendHoldId: string } }
      ).data.spendHoldId,
    });

    await POST(webhookRequest());
    const webhookKeys = capturedKeys();
    expect(webhookKeys).toHaveLength(1);

    // THE assertion. Under the original mismatch this was
    // '<hold>:video:0' vs '<hold>:video:fal-req-abc123'.
    expect(webhookKeys[0]).toBe(submitKeys[0]);
    expect(submitKeys[0]).toContain(PROVIDER_JOB_ID);
    expect(submitKeys[0]).not.toMatch(/:video:\d+$/);
  });

  it('each variant of a batch gets its own key', async () => {
    mockSubmitToFal
      .mockResolvedValueOnce('fal-a')
      .mockResolvedValueOnce('fal-b');

    await submitGenerativeVideo({
      organizationId: ORG,
      userId: 'u1',
      initiatedBy: 'studio',
      prompt: 'a carpet wand',
      methodCardId: 'freeform',
      variants: 2,
      useReferences: false,
    } as never);

    const keys = capturedKeys();
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('a blank provider job id is refused, not silently collapsed', () => {
  it('fails the submit rather than deriving a colliding key', async () => {
    // A 2xx with no request_id used to yield an empty id, which would give
    // every variant of a batch the SAME key — the second paid call upserting
    // the first's row and under-recording spend.
    mockSubmitToFal.mockResolvedValue('');

    await expect(
      submitGenerativeVideo({
        organizationId: ORG,
        userId: 'u1',
        initiatedBy: 'studio',
        prompt: 'a carpet wand',
        methodCardId: 'freeform',
        variants: 1,
        useReferences: false,
      } as never)
    ).rejects.toThrow(/provider job id/i);
  });
});

describe('an ACCEPTED submit with no job id is counted as spend, not as unsent', () => {
  it('records an attempt and settles the batch INCLUDING the ambiguous call', async () => {
    // The provider returned 2xx, so the request was accepted and may be
    // billed — it is simply unaddressable. Treating it as never-sent would
    // settle the batch one variant short, and settlement is terminal: no
    // webhook or sweep could correct it afterwards.
    mockSubmitToFal
      .mockResolvedValueOnce('fal-a')
      .mockRejectedValueOnce(
        new UnaddressableSubmitError(
          'bytedance/seedance-2.0/fast/text-to-video',
          200
        )
      );

    // Variant one succeeded, so the batch resolves partially rather than
    // throwing — the caller still gets the job it got.
    const jobs = await submitGenerativeVideo({
      organizationId: ORG,
      userId: 'u1',
      initiatedBy: 'studio',
      prompt: 'a carpet wand',
      methodCardId: 'freeform',
      variants: 2,
      useReferences: false,
    } as never);
    expect(jobs).toHaveLength(1);

    const keys = capturedKeys();
    // TWO attempts recorded: the addressable one and the ambiguous one.
    expect(keys).toHaveLength(2);
    expect(keys.some(k => k.includes('unaddressable'))).toBe(true);

    // The ambiguous attempt carries an UNKNOWN cost, so settlement charges the
    // reservation rate for it rather than writing it off.
    const ambiguous = mockRecordAttempt.mock.calls
      .map(c => c[0] as unknown as { attemptKey: string; costUsd: unknown })
      .find(a => a.attemptKey.includes('unaddressable'));
    expect(ambiguous?.costUsd).toBeNull();

    // THE accounting assertions. With BOTH variants counted as submitted there
    // is no unsubmitted remainder, so nothing is RELEASED — under the original
    // behaviour the ambiguous call was treated as never-sent and its money
    // handed back, terminally and uncorrectably.
    //
    // Its own hold is instead SETTLED at the reservation, and only its own:
    // the call was accepted and may be billed, but it never got a
    // video_generations row, so no webhook will finalise it and the stale
    // sweep cannot tell it from a hold that never spent. Left open it swept to
    // zero (SYN-1115 round-8).
    expect(mockSettleQuota).toHaveBeenCalledTimes(1);
    const [, settledHoldId, held, actual] = mockSettleQuota.mock
      .calls[0] as unknown as [string, string, number, number];
    expect(typeof settledHoldId).toBe('string');
    expect(actual).toBeCloseTo(held, 4);
  });

  it('gives each ambiguous variant its own key', async () => {
    mockSubmitToFal.mockRejectedValue(new UnaddressableSubmitError('m', 200));

    await expect(
      submitGenerativeVideo({
        organizationId: ORG,
        userId: 'u1',
        initiatedBy: 'studio',
        prompt: 'a carpet wand',
        methodCardId: 'freeform',
        variants: 1,
        useReferences: false,
      } as never)
    ).rejects.toBeInstanceOf(UnaddressableSubmitError);

    const keys = capturedKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('real and synthetic attempt keys occupy disjoint namespaces', () => {
  it('a provider id shaped like the synthetic key cannot collide with it', async () => {
    // The adversarial case: fal returns the literal string 'unaddressable:1'
    // as a job id. Without a structural separator that derives the SAME key as
    // the synthetic attempt for variant 1, collapsing two paid calls onto one
    // row. fal's ids look like UUIDs today but nothing guarantees the format.
    const real = videoAttemptKey('hold-1', 'unaddressable:1');
    const synthetic = unaddressableAttemptKey('hold-1', 1);
    expect(real).not.toBe(synthetic);
  });

  it('drives that collision through the PRODUCTION path', async () => {
    mockSubmitToFal
      .mockResolvedValueOnce('unaddressable:1')
      .mockRejectedValueOnce(new UnaddressableSubmitError('m', 200));

    await submitGenerativeVideo({
      organizationId: ORG,
      userId: 'u1',
      initiatedBy: 'studio',
      prompt: 'a carpet wand',
      methodCardId: 'freeform',
      variants: 2,
      useReferences: false,
    } as never);

    const keys = capturedKeys();
    expect(keys).toHaveLength(2);
    // TWO distinct rows — under the shared namespace these were one, and the
    // ambiguous call vanished from spend entirely.
    expect(new Set(keys).size).toBe(2);
  });

  it('real keys are namespaced so no provider id can escape into another form', () => {
    expect(videoAttemptKey('h', 'abc')).toBe('h:video:job:abc');
    expect(unaddressableAttemptKey('h', 0)).toBe('h:video:unaddressable:0');
  });
});

describe('every unusable 2xx is an accepted submit, however it fails', () => {
  // submitToFal is exercised for real here — only global fetch is stubbed —
  // because the defect was in HOW the response is decoded, not in the guard.
  const { submitToFal } = jest.requireActual(
    '@/lib/services/ai/video/fal-adapter'
  ) as { submitToFal: (m: string, i: object) => Promise<string> };

  const okResponse = (body: unknown, malformed = false) =>
    ({
      ok: true,
      status: 200,
      json: async () => {
        if (malformed) throw new SyntaxError('Unexpected token < in JSON');
        return body;
      },
      text: async () => 'x',
    }) as unknown as Response;

  beforeEach(() => {
    process.env.FAL_API_KEY = 'k';
    process.env.FAL_WEBHOOK_SECRET = 'shh';
    process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.example';
  });

  it('a malformed 2xx body is accepted-but-unaddressable, not a plain error', async () => {
    // Previously res.json() rejected and a SyntaxError escaped, so the caller
    // treated a request the provider ACCEPTED as never-sent.
    global.fetch = jest.fn(async () => okResponse(null, true)) as never;
    await expect(submitToFal('m', {})).rejects.toBeInstanceOf(
      UnaddressableSubmitError
    );
  });

  it('a null 2xx body is accepted-but-unaddressable', async () => {
    global.fetch = jest.fn(async () => okResponse(null)) as never;
    await expect(submitToFal('m', {})).rejects.toBeInstanceOf(
      UnaddressableSubmitError
    );
  });

  it('a 2xx with a blank request_id is accepted-but-unaddressable', async () => {
    global.fetch = jest.fn(async () =>
      okResponse({ request_id: '   ' })
    ) as never;
    await expect(submitToFal('m', {})).rejects.toBeInstanceOf(
      UnaddressableSubmitError
    );
  });

  it('a well-formed 2xx still returns the id', async () => {
    global.fetch = jest.fn(async () =>
      okResponse({ request_id: 'fal-ok' })
    ) as never;
    await expect(submitToFal('m', {})).resolves.toBe('fal-ok');
  });
});
