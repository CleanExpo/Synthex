import {
  submitGenerativeVideo,
  GroundingBlockedError,
} from '@/lib/services/ai/video/generation-service';
import type { GenerativeVideoRequest } from '@/lib/services/ai/video/types';

// Hermetic: no fal, no DB, no spend, no real manifest.
jest.mock('@/lib/services/ai/video/fal-adapter', () => ({
  submitToFal: jest.fn(async () => 'prov-1'),
}));
jest.mock('@/lib/services/ai/video/quota', () => ({
  holdQuota: jest.fn(async () => {}),
  holdQuotaBatch: jest.fn(async (_o, _u, _i, ids) => ids),
  releaseQuota: jest.fn(async () => {}),
}));
jest.mock('@/lib/services/ai/video/cards/method-cards', () => ({
  getMethodCard: jest.fn(() => ({
    id: 'stub',
    name: 'Stub',
    requiresImage: false,
  })),
}));
jest.mock('@/lib/services/ai/video/cards/modifier-chips', () => ({
  getChips: jest.fn(() => []),
}));
jest.mock('@/lib/services/ai/video/cards/brand-cards', () => ({
  getBrandFragment: jest.fn(async () => null),
}));
jest.mock('@/lib/services/ai/video/cards/compose', () => ({
  composePrompt: jest.fn(() => ({ prompt: 'composed', params: {} })),
}));
jest.mock('@/lib/services/ai/video/prompt-enhancer', () => ({
  enhancePrompt: jest.fn(async (p: string) => p),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: { create: jest.fn(async () => ({ id: 'row-1' })) },
  },
}));
jest.mock('@/lib/services/ai/reference-library', () => ({
  resolveReferences: jest.fn(),
}));
jest.mock('@/lib/services/ai/reference-library-private', () => ({
  resolvePrivateReferenceUrls: jest.fn(async () => []),
}));

import { submitToFal } from '@/lib/services/ai/video/fal-adapter';
import { resolveReferences } from '@/lib/services/ai/reference-library';
import { resolvePrivateReferenceUrls } from '@/lib/services/ai/reference-library-private';
import { getMethodCard } from '@/lib/services/ai/video/cards/method-cards';
import { composePrompt } from '@/lib/services/ai/video/cards/compose';
import prisma from '@/lib/prisma';

const CARPET = {
  industry: 'carpet-cleaning',
  subject: 'carpet-cleaning-wand',
  vendorKey: 'unite-group',
  imagePaths: [
    '/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp',
  ],
  count: 1,
};

const NO_COVERAGE = {
  industry: null,
  subject: null,
  imagePaths: [],
  count: 0,
};

const NO_COVERAGE_ERROR =
  'No owned references for this subject — add real photos to the reference library first.';

function baseReq(
  over: Partial<GenerativeVideoRequest> = {}
): GenerativeVideoRequest {
  return {
    userId: 'u1',
    organizationId: 'o1',
    initiatedBy: 'studio',
    prompt: 'a carpet cleaning wand on office carpet',
    methodCardId: 'stub',
    ...over,
  };
}

const APP = 'https://synthex.social';
const lastFalInput = () =>
  (submitToFal as jest.Mock).mock.calls.at(-1)?.[1] as Record<string, unknown>;

describe('video grounding — grounded by default (Real Images Only)', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = APP;
    (resolveReferences as jest.Mock).mockReturnValue(CARPET);
    (resolvePrivateReferenceUrls as jest.Mock).mockResolvedValue([]);
    // jest.worktree.cjs sets resetMocks: true, which wipes the factory-provided
    // default implementation after the first test consumes it. Reinstate the
    // implementations the submit path depends on before every test (same
    // pattern as tests/unit/ai/image-generation-grounding.test.ts).
    (getMethodCard as jest.Mock).mockReturnValue({
      id: 'stub',
      name: 'Stub',
      requiresImage: false,
    });
    (composePrompt as jest.Mock).mockReturnValue({
      prompt: 'composed',
      params: {},
    });
    (submitToFal as jest.Mock).mockResolvedValue('prov-1');
    (prisma.videoGeneration.create as jest.Mock).mockResolvedValue({
      id: 'row-1',
    });
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });

  it('grounds the I2V seed from an explicit referenceSet', async () => {
    const jobs = await submitGenerativeVideo(
      baseReq({ referenceSet: 'carpet-cleaning' })
    );
    expect(lastFalInput().image_url).toBe(`${APP}${CARPET.imagePaths[0]}`);
    expect(jobs[0].grounded).toBe(true);
    expect(jobs[0].referenceSet).toBe('carpet-cleaning');
    expect(jobs[0].groundedSubject).toBe('carpet-cleaning-wand');
    expect(jobs[0].groundedVendor).toBe('unite-group');
  });

  it('grounds a bare prompt by default (no set, no useReferences — auto-detect on)', async () => {
    const jobs = await submitGenerativeVideo(baseReq());
    expect(lastFalInput().image_url).toBe(`${APP}${CARPET.imagePaths[0]}`);
    expect(jobs[0].grounded).toBe(true);
    expect(resolveReferences).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: baseReq().prompt })
    );
  });

  it('lets an explicit imageUrl win over a referenceSet (grounded=false, resolver never called)', async () => {
    const jobs = await submitGenerativeVideo(
      baseReq({
        imageUrl: 'https://x/seed.png',
        referenceSet: 'carpet-cleaning',
      })
    );
    expect(lastFalInput().image_url).toBe('https://x/seed.png');
    expect(jobs[0].grounded).not.toBe(true);
    expect(resolveReferences).not.toHaveBeenCalled();
  });

  it('grounds via auto-detect when useReferences:true', async () => {
    const jobs = await submitGenerativeVideo(baseReq({ useReferences: true }));
    expect(lastFalInput().image_url).toBe(`${APP}${CARPET.imagePaths[0]}`);
    expect(jobs[0].grounded).toBe(true);
  });

  it('treats useReferences:false as a hard opt-out even with a referenceSet (escape hatch)', async () => {
    const jobs = await submitGenerativeVideo(
      baseReq({ referenceSet: 'carpet-cleaning', useReferences: false })
    );
    expect(lastFalInput().image_url).toBeUndefined();
    expect(jobs[0].grounded).not.toBe(true);
    expect(resolveReferences).not.toHaveBeenCalled();
  });

  it('falls back to a private signed reference URL when NEXT_PUBLIC_APP_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    (resolvePrivateReferenceUrls as jest.Mock).mockResolvedValue([
      'https://signed.example/private/wand.webp',
    ]);
    const jobs = await submitGenerativeVideo(
      baseReq({ referenceSet: 'carpet-cleaning' })
    );
    expect(lastFalInput().image_url).toBe(
      'https://signed.example/private/wand.webp'
    );
    expect(jobs[0].grounded).toBe(true);
    expect(resolvePrivateReferenceUrls).toHaveBeenCalledWith(
      CARPET.industry,
      1
    );
  });
});

describe('video grounding — fail-closed BLOCK cases (Real Images Only)', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = APP;
    (resolveReferences as jest.Mock).mockReturnValue(CARPET);
    (resolvePrivateReferenceUrls as jest.Mock).mockResolvedValue([]);
    (getMethodCard as jest.Mock).mockReturnValue({
      id: 'stub',
      name: 'Stub',
      requiresImage: false,
    });
    (composePrompt as jest.Mock).mockReturnValue({
      prompt: 'composed',
      params: {},
    });
    (submitToFal as jest.Mock).mockResolvedValue('prov-1');
    (prisma.videoGeneration.create as jest.Mock).mockResolvedValue({
      id: 'row-1',
    });
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });

  it('blocks when no owned references cover the subject and no imageUrl is given', async () => {
    (resolveReferences as jest.Mock).mockReturnValue(NO_COVERAGE);
    const call = submitGenerativeVideo(baseReq());
    await expect(call).rejects.toThrow(NO_COVERAGE_ERROR);
    await expect(call).rejects.toBeInstanceOf(GroundingBlockedError);
    expect(submitToFal).not.toHaveBeenCalled();
  });

  it('blocks when the reference resolver throws', async () => {
    (resolveReferences as jest.Mock).mockImplementation(() => {
      throw new Error('manifest read failed');
    });
    await expect(
      submitGenerativeVideo(baseReq({ referenceSet: 'carpet-cleaning' }))
    ).rejects.toThrow(NO_COVERAGE_ERROR);
    expect(submitToFal).not.toHaveBeenCalled();
  });

  it('blocks when owned coverage exists but no seed URL resolves (no public base, no private ref)', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    (resolvePrivateReferenceUrls as jest.Mock).mockResolvedValue([]);
    await expect(
      submitGenerativeVideo(baseReq({ referenceSet: 'carpet-cleaning' }))
    ).rejects.toThrow(NO_COVERAGE_ERROR);
    expect(submitToFal).not.toHaveBeenCalled();
  });

  it('blocks when the tier has no image-capable model for a grounded seed (tier-without-image-model)', async () => {
    await expect(
      submitGenerativeVideo(
        baseReq({ referenceSet: 'carpet-cleaning', modelTier: 'standard' })
      )
    ).rejects.toBeInstanceOf(GroundingBlockedError);
    expect(submitToFal).not.toHaveBeenCalled();
  });

  it('still throws (not GroundingBlockedError) when an explicit imageUrl has no image model at the requested tier', async () => {
    const call = submitGenerativeVideo(
      baseReq({ imageUrl: 'https://x/seed.png', modelTier: 'standard' })
    );
    await expect(call).rejects.toThrow(/No standard model supports/);
    await expect(call).rejects.not.toBeInstanceOf(GroundingBlockedError);
  });
});
