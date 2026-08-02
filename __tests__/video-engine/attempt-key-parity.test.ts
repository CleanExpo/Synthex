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

jest.mock('@/lib/services/ai/video/quota', () => ({
  holdQuota: async () => undefined,
  settleQuota: async () => true,
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
import { submitGenerativeVideo } from '@/lib/services/ai/video/generation-service';
import { POST } from '@/app/api/video/webhook/fal/route';

const PROVIDER_JOB_ID = 'fal-req-abc123';
const ORG = 'org-parity';

beforeEach(() => {
  jest.clearAllMocks();
  mockRecordAttempt.mockImplementation(async () => undefined);
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
