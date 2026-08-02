const mockCreate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: { create: (...a: unknown[]) => mockCreate(...a) },
  },
}));

const mockHold = jest.fn();
const mockRelease = jest.fn();
// SYN-1115 round-6: a partial batch SETTLES at what was actually submitted
// rather than releasing a slice — the log allows exactly one terminal event per
// hold, so a partial release would foreclose the real settlement.
const mockSettle = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  holdQuota: (...a: unknown[]) => mockHold(...a),
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
  it('holds quota on the SUMMED estimate before submitting anything', async () => {
    await submitGenerativeVideo({ ...baseReq, variants: 4 });
    expect(mockHold).toHaveBeenCalledTimes(1);
    const [, sum] = mockHold.mock.calls[0];
    expect(sum).toBeCloseTo(4 * draftPerJobUsd, 4); // 4 variants x per-job draft estimate
    expect(mockHold.mock.invocationCallOrder[0]).toBeLessThan(
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
    mockHold.mockRejectedValue(new Error('cap'));
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

  it('settles a mid-batch failure at what was actually submitted', async () => {
    mockSubmit
      .mockResolvedValueOnce('req-a')
      .mockRejectedValueOnce(new Error('fal down'));
    const jobs = await submitGenerativeVideo({ ...baseReq, variants: 3 });
    expect(jobs).toHaveLength(1); // first variant survived
    // One variant reached the provider; the hold is settled at that, not
    // released in part (SYN-1115 round-6 — one terminal event per hold).
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockSettle).toHaveBeenCalledTimes(1);
    const [, , heldUsd, actualUsd] = mockSettle.mock.calls[0];
    expect(heldUsd).toBeCloseTo(3 * draftPerJobUsd, 4); // reserved for three
    expect(actualUsd).toBeCloseTo(1 * draftPerJobUsd, 4); // charged for one
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
    // of two variants submitted before the row write blew up, so exactly one
    // is charged — and it is charged by SETTLING the hold, not by releasing a
    // slice of it: the log allows one terminal event per hold, so a partial
    // release would foreclose the real settlement (SYN-1115 round-6).
    mockCreate.mockRejectedValueOnce(new Error('db down'));
    await expect(
      submitGenerativeVideo({ ...baseReq, variants: 2 })
    ).rejects.toThrow('db down');

    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockSettle).toHaveBeenCalledTimes(1);
    const [, holdId, , actualUsd] = mockSettle.mock.calls[0];
    expect(typeof holdId).toBe('string');
    expect(actualUsd).toBeCloseTo(1 * draftPerJobUsd, 4);
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
    expect(mockHold).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
