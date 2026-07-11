import { submitGenerativeVideo } from '@/lib/services/ai/video/generation-service';
import type { GenerativeVideoRequest } from '@/lib/services/ai/video/types';

// Hermetic: no fal, no DB, no spend, no real manifest.
jest.mock('@/lib/services/ai/video/fal-adapter', () => ({
  submitToFal: jest.fn(async () => 'prov-1'),
}));
jest.mock('@/lib/services/ai/video/quota', () => ({
  holdQuota: jest.fn(async () => {}),
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

import { submitToFal } from '@/lib/services/ai/video/fal-adapter';
import { resolveReferences } from '@/lib/services/ai/reference-library';
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

describe('video grounding', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = APP;
    (resolveReferences as jest.Mock).mockReturnValue(CARPET);
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

  it('lets an explicit imageUrl win over a referenceSet (grounded=false)', async () => {
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

  it('does NOT ground a bare prompt (no set, no useReferences)', async () => {
    const jobs = await submitGenerativeVideo(baseReq());
    expect(lastFalInput().image_url).toBeUndefined();
    expect(jobs[0].grounded).not.toBe(true);
    expect(resolveReferences).not.toHaveBeenCalled();
  });

  it('grounds via auto-detect when useReferences:true', async () => {
    const jobs = await submitGenerativeVideo(baseReq({ useReferences: true }));
    expect(lastFalInput().image_url).toBe(`${APP}${CARPET.imagePaths[0]}`);
    expect(jobs[0].grounded).toBe(true);
  });

  it('treats useReferences:false as a hard opt-out even with a referenceSet', async () => {
    const jobs = await submitGenerativeVideo(
      baseReq({ referenceSet: 'carpet-cleaning', useReferences: false })
    );
    expect(lastFalInput().image_url).toBeUndefined();
    expect(jobs[0].grounded).not.toBe(true);
  });

  it('fails open (ungrounded) when NEXT_PUBLIC_APP_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const jobs = await submitGenerativeVideo(
      baseReq({ referenceSet: 'carpet-cleaning' })
    );
    expect(lastFalInput().image_url).toBeUndefined();
    expect(jobs[0].grounded).not.toBe(true);
  });

  it('fails open (ungrounded, no throw) when the resolver throws', async () => {
    (resolveReferences as jest.Mock).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const jobs = await submitGenerativeVideo(
      baseReq({ referenceSet: 'carpet-cleaning' })
    );
    expect(lastFalInput().image_url).toBeUndefined();
    expect(jobs[0].grounded).not.toBe(true);
  });

  it('falls back ungrounded when the standard tier has no image-capable model (auto-grounded seed)', async () => {
    const jobs = await submitGenerativeVideo(
      baseReq({ referenceSet: 'carpet-cleaning', modelTier: 'standard' })
    );
    expect(jobs[0].grounded).not.toBe(true);
    expect(lastFalInput().image_url).toBeUndefined();
  });

  it('still throws when an explicit imageUrl has no image model at the requested tier', async () => {
    await expect(
      submitGenerativeVideo(
        baseReq({ imageUrl: 'https://x/seed.png', modelTier: 'standard' })
      )
    ).rejects.toThrow();
  });
});
