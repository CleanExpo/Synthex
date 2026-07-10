import { generateFluxImage } from '@/lib/services/ai/image/providers/flux-fal';

describe('flux-fal adapter', () => {
  const realFetch = global.fetch;
  const realKey = process.env.FAL_API_KEY;
  beforeEach(() => {
    process.env.FAL_API_KEY = 'test-key';
  });
  afterEach(() => {
    global.fetch = realFetch;
    process.env.FAL_API_KEY = realKey;
  });

  it('calls the /edit endpoint with image_urls when references are present', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    global.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return {
        ok: true,
        json: async () => ({
          images: [{ url: 'https://out/img.png' }],
          seed: 42,
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const r = await generateFluxImage({
      prompt: 'grounded wand',
      imageUrls: ['https://site/ref-1.webp'],
    });

    expect(calls[0].url).toBe('https://fal.run/fal-ai/flux-2-pro/edit');
    expect((calls[0].body as { image_urls: string[] }).image_urls).toEqual([
      'https://site/ref-1.webp',
    ]);
    expect(r.imageUrl).toBe('https://out/img.png');
    expect(r.seed).toBe(42);
  });

  it('calls the base endpoint (no image_urls) when there are no references', async () => {
    const calls: string[] = [];
    global.fetch = (async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => ({ images: [{ url: 'https://out/x.png' }] }),
      } as Response;
    }) as unknown as typeof fetch;

    await generateFluxImage({ prompt: 'plain' });
    expect(calls[0]).toBe('https://fal.run/fal-ai/flux-2-pro');
  });
});
