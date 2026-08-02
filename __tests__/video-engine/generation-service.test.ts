const mockCreate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: { create: (...a: unknown[]) => mockCreate(...a) },
  },
}));

const mockHold = jest.fn();
const mockHoldBatch = jest.fn();
const mockRelease = jest.fn();
// SYN-1115 round-8: each variant holds its OWN reservation, so a partial batch
// RELEASES the holds of the variants that never reached the provider and
// leaves the submitted ones open for their webhooks. Round-6 had to settle the
// remainder of a single shared hold instead, because one terminal event per
// hold meant a partial release foreclosed the real settlement.
const mockSettle = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  holdQuota: (...a: unknown[]) => mockHold(...a),
  holdQuotaBatch: (...a: unknown[]) => mockHoldBatch(...a),
  releaseQuota: (...a: unknown[]) => mockRelease(...a),
  settleQuota: (...a: unknown[]) => mockSettle(...a),
}));

const mockSubmit = jest.fn();
jest.mock('@/lib/services/ai/video/fal-adapter', () => ({
  submitToFal: (...a: unknown[]) => mockSubmit(...a),
}));

const mockBrand = jest.fn();
jest.mock('@/lib/services/ai/video/cards/brand-cards', () => ({
  getBrandFragment: (...a: unknown[]) => mockBrand(...a),
}));

jest.mock('@/lib/services/ai/video/prompt-enhancer', () => ({
  enhancePrompt: jest.fn(async (s: string) => `ENHANCED: ${s}`),
}));

// Reference-library grounding is opt-in-by-default now (Real Images Only,
// docs/superpowers/specs/2026-07-12-real-images-only-design.md). This suite's
// job is queueing/quota/composition mechanics, not grounding resolution
// itself (that's covered end-to-end by tests/unit/ai/video-grounding.test.ts)
// — so it mocks the resolver purely to keep it deterministic and out of the
// way via the useReferences:false escape hatch, except for the one block
// case below that exercises the fail-closed default directly.
const mockResolveReferences = jest.fn();
jest.mock('@/lib/services/ai/reference-library', () => ({
  resolveReferences: (...a: unknown[]) => mockResolveReferences(...a),
}));

import {
  submitGenerativeVideo,
  GroundingBlockedError,
} from '@/lib/services/ai/video/generation-service';
import { enhancePrompt } from '@/lib/services/ai/video/prompt-enhancer';

const mockEnhance = enhancePrompt as jest.MockedFunction<typeof enhancePrompt>;

beforeEach(() => {
  jest.clearAllMocks();
  mockHold.mockResolvedValue(undefined);
  mockHoldBatch.mockImplementation(async (...a: unknown[]) => a[3]);
  mockRelease.mockResolvedValue(undefined);
  mockBrand.mockResolvedValue(null);
  mockEnhance.mockImplementation(async (s: string) => `ENHANCED: ${s}`);
  mockSubmit.mockImplementation(
    async () => `req-${mockSubmit.mock.calls.length}`
  );
  mockCreate.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: `row-${mockCreate.mock.calls.length}`,
      ...data,
    })
  );
  // Fail-closed default: any test that forgets to opt out of grounding (or
  // to stub its own coverage) blocks loudly instead of silently passing.
  mockResolveReferences.mockReturnValue({
    industry: null,
    subject: null,
    imagePaths: [],
    count: 0,
  });
});

const baseReq = {
  userId: 'u1',
  organizationId: 'org1',
  initiatedBy: 'studio' as const,
  prompt: 'a cordless moisture meter',
  methodCardId: 'product-reveal',
  // These tests exercise queueing/quota/composition mechanics, not
  // grounding — restore the pre-grounding default (synthetic first frame)
  // so a subject that doesn't happen to match an owned reference set
  // doesn't block them. The grounding path itself is covered separately
  // below and in tests/unit/ai/video-grounding.test.ts.
  useReferences: false as const,
};

// Derive the expected per-job cost from the live registry so catalogue
// repricing (e.g. the 2026-07-10 Wan retirement repair) never breaks these
// quota-math assertions — they test the SUM/RELEASE arithmetic, not the rate.
import {
  resolveModel,
  estimateCostUsd,
} from '@/lib/services/ai/video/registry';
const draftPerJobUsd = estimateCostUsd(
  resolveModel('draft', { aspectRatio: '9:16', durationSeconds: 6 }),
  6
);

describe('generation service', () => {
  it('holds one reservation PER VARIANT before submitting anything', async () => {
    await submitGenerativeVideo({ ...baseReq, variants: 4 });
    // One admission decision, four holds. The cap is still checked against the
    // summed amount inside reserveSpendBatch — what changed is that each
    // variant can now be settled or released on its own (SYN-1115 round-8).
    expect(mockHoldBatch).toHaveBeenCalledTimes(1);
    const [, perVariant, , holdIds] = mockHoldBatch.mock.calls[0];
    expect(perVariant).toBeCloseTo(draftPerJobUsd, 4);
    expect(holdIds).toHaveLength(4);
    expect(new Set(holdIds as string[]).size).toBe(4);
    expect(mockHoldBatch.mock.invocationCallOrder[0]).toBeLessThan(
      mockSubmit.mock.invocationCallOrder[0]
    );
  });

  it('creates one row per variant sharing batchGroupId, distinct seeds', async () => {
    const jobs = await submitGenerativeVideo({ ...baseReq, variants: 3 });
    expect(jobs).toHaveLength(3);
    const groups = new Set(jobs.map(j => j.batchGroupId));
    expect(groups.size).toBe(1);
    const seeds = mockCreate.mock.calls.map(c => c[0].data.seed);
    expect(new Set(seeds).size).toBe(3);
  });

  it('rejects unknown method cards', async () => {
    await expect(
      submitGenerativeVideo({ ...baseReq, methodCardId: 'nope' })
    ).rejects.toThrow(/unknown method card/i);
  });

  it('rejects image-required cards without an imageUrl', async () => {
    await expect(
      submitGenerativeVideo({ ...baseReq, methodCardId: 'logo-motion' })
    ).rejects.toThrow(/requires an input image/i);
  });

  it('caps variants at 8', async () => {
    await expect(
      submitGenerativeVideo({ ...baseReq, variants: 9 })
    ).rejects.toThrow(/variants/i);
  });

  it('does not create rows when quota hold fails', async () => {
    mockHoldBatch.mockRejectedValue(new Error('cap'));
    await expect(submitGenerativeVideo(baseReq)).rejects.toThrow('cap');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('applies the brand fragment when brandCardId is set', async () => {
    mockBrand.mockResolvedValue('In the visual style of AquaDry');
    await submitGenerativeVideo({ ...baseReq, brandCardId: 'org-brand-1' });
    const submittedPrompt = (mockSubmit.mock.calls[0][1] as { prompt: string })
      .prompt;
    expect(submittedPrompt).toContain('In the visual style of AquaDry');
  });

  it('releases only the variants that never reached the provider', async () => {
    mockSubmit
      .mockResolvedValueOnce('req-a')
      .mockRejectedValueOnce(new Error('fal down'));
    const jobs = await submitGenerativeVideo({ ...baseReq, variants: 3 });
    expect(jobs).toHaveLength(1); // first variant survived

    // One of three reached the provider, so the other two holds are returned
    // and the submitted one stays open for its webhook. Nothing is settled
    // here: this code cannot know what the live variant will cost.
    expect(mockSettle).not.toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalledTimes(2);
    const released = mockRelease.mock.calls.map(c => c[1] as string);
    expect(new Set(released).size).toBe(2);
    const submittedHold = (mockHoldBatch.mock.calls[0][3] as string[])[0];
    expect(released).not.toContain(submittedHold);
    for (const call of mockRelease.mock.calls) {
      expect(call[2]).toBeCloseTo(draftPerJobUsd, 4);
    }
  });

  it('persists the generative columns on each row', async () => {
    await submitGenerativeVideo(baseReq);
    const data = mockCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      mode: 'generative',
      provider: 'fal',
      initiatedBy: 'studio',
      methodCardId: 'product-reveal',
      status: 'generating',
    });
  });

  it('CHARGES a variant whose provider submit succeeded but row creation failed', async () => {
    // The billing basis is what reached the provider, not what persisted. One
    // of two variants submitted before the row write blew up, so its hold is
    // LEFT OPEN — the provider may bill for it and the sweep will finalise it
    // from the recorded attempt. Only the untouched variant is released
    // (SYN-1115 round-8).
    mockCreate.mockRejectedValueOnce(new Error('db down'));
    await expect(
      submitGenerativeVideo({ ...baseReq, variants: 2 })
    ).rejects.toThrow('db down');

    const holdIds = mockHoldBatch.mock.calls[0][3] as string[];
    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(mockRelease.mock.calls[0][1]).toBe(holdIds[1]);
    expect(mockRelease.mock.calls[0][2]).toBeCloseTo(draftPerJobUsd, 4);

    // The orphan is SETTLED at the reservation right here. It reached the
    // provider and may be billed, but with no row no webhook will finalise it
    // and the sweep cannot tell it from a hold that never spent — left open it
    // swept to zero and erased a paid call (SYN-1115 round-8).
    expect(mockSettle).toHaveBeenCalledTimes(1);
    expect(mockSettle.mock.calls[0][1]).toBe(holdIds[0]);
    expect(mockSettle.mock.calls[0][3]).toBeCloseTo(draftPerJobUsd, 4);
  });

  it('enhances the subject for the freeform card only', async () => {
    await submitGenerativeVideo({
      ...baseReq,
      methodCardId: 'freeform',
      prompt: 'a rainy street',
    });
    const submitted = (mockSubmit.mock.calls[0][1] as { prompt: string })
      .prompt;
    expect(submitted).toBe('ENHANCED: a rainy street');
  });

  it('blocks (fail-closed) when grounding is on, no imageUrl is given, and no owned reference resolves', async () => {
    // useReferences defaults to true — override baseReq's opt-out to
    // exercise the Real Images Only default directly. mockResolveReferences
    // already returns zero coverage per the beforeEach default.
    const call = submitGenerativeVideo({ ...baseReq, useReferences: true });
    await expect(call).rejects.toBeInstanceOf(GroundingBlockedError);
    await expect(call).rejects.toThrow(/no owned references/i);
    expect(mockHoldBatch).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
