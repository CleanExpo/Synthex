import { generateImage } from '@/lib/services/ai/image-generation';
import type { GenerationContext } from '@/lib/ai/generation-context';

jest.mock('@/lib/services/ai/image/providers/flux-fal', () => ({
  generateFluxImage: jest.fn(async (o: { imageUrls?: string[] }) => ({
    imageUrl: 'https://out/grounded.png',
    seed: 1,
    model: 'fal-ai/flux-2-pro',
    __refs: o.imageUrls,
  })),
}));

const ctx: GenerationContext = {
  organizationId: 'org1',
  userId: 'user1',
  traceId: 't1',
  autonomyLevel: 'manual',
};

describe('generateImage grounding', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.social';
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });

  it('grounds on the carpet-cleaning set via FLUX and tags metadata', async () => {
    const { generateFluxImage } =
      await import('@/lib/services/ai/image/providers/flux-fal');
    const r = await generateImage(
      { prompt: 'our carpet wand', referenceSet: 'carpet-cleaning' },
      ctx
    );
    expect(r.success).toBe(true);
    expect(r.grounded).toBe(true);
    expect(r.refCount).toBeGreaterThan(0);
    expect(r.metadata?.model).toBe('fal-ai/flux-2-pro');
    const arg = (generateFluxImage as jest.Mock).mock.calls[0][0];
    expect(arg.imageUrls[0]).toBe(
      'https://synthex.social/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp'
    );
  });

  it('leaves the legacy path ungrounded when useReferences is false', async () => {
    const r = await generateImage(
      {
        prompt: 'our carpet wand',
        referenceSet: 'carpet-cleaning',
        useReferences: false,
        provider: 'gemini',
      },
      ctx
    ).catch(e => ({ success: false, grounded: false, error: String(e) }));
    expect((r as { grounded?: boolean }).grounded).not.toBe(true);
  });
});
