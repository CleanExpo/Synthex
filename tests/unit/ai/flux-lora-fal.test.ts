import { generateFluxLoraImage } from '@/lib/services/ai/image/providers/flux-lora-fal';

describe('flux-lora-fal adapter', () => {
  const realFetch = global.fetch;
  const realKey = process.env.FAL_API_KEY;
  beforeEach(() => {
    process.env.FAL_API_KEY = 'test-key';
  });
  afterEach(() => {
    global.fetch = realFetch;
    process.env.FAL_API_KEY = realKey;
  });

  it('t2i branch: calls /fal-ai/flux-2/lora with loras verbatim (no scale key when undefined)', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    global.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return {
        ok: true,
        json: async () => ({
          images: [{ url: 'https://out/img.png' }],
          seed: 99,
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const r = await generateFluxLoraImage({
      prompt: 'carpet water damage',
      loras: [{ path: 'https://x/carpet.safetensors' }],
    });

    expect(calls[0].url).toBe('https://fal.run/fal-ai/flux-2/lora');
    const body = calls[0].body as {
      prompt: string;
      loras: Array<{ path: string; scale?: number }>;
      image_urls?: string[];
    };
    expect(body.prompt).toBe('carpet water damage');
    expect(body.loras).toEqual([{ path: 'https://x/carpet.safetensors' }]);
    expect(body.loras[0]).not.toHaveProperty('scale');
    expect(body.image_urls).toBeUndefined();
    expect(r.imageUrl).toBe('https://out/img.png');
    expect(r.seed).toBe(99);
    expect(r.model).toBe('fal-ai/flux-2/lora');
  });

  it('edit branch: calls /fal-ai/flux-2/lora/edit with image_urls and loras with scale preserved', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    global.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return {
        ok: true,
        json: async () => ({
          images: [{ url: 'https://out/edited.png' }],
          seed: 42,
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const r = await generateFluxLoraImage({
      prompt: 'edited carpet',
      loras: [
        { path: 'https://x/carpet.safetensors', scale: 0.8 },
        { path: 'https://x/damage.safetensors' },
      ],
      imageUrls: ['https://site/ref-1.webp'],
      seed: 123,
    });

    expect(calls[0].url).toBe('https://fal.run/fal-ai/flux-2/lora/edit');
    const body = calls[0].body as {
      prompt: string;
      loras: Array<{ path: string; scale?: number }>;
      image_urls: string[];
      seed: number;
    };
    expect(body.prompt).toBe('edited carpet');
    expect(body.image_urls).toEqual(['https://site/ref-1.webp']);
    expect(body.seed).toBe(123);
    // First lora should have scale
    expect(body.loras[0]).toEqual({
      path: 'https://x/carpet.safetensors',
      scale: 0.8,
    });
    // Second lora should NOT have scale key
    expect(body.loras[1]).toEqual({ path: 'https://x/damage.safetensors' });
    expect(body.loras[1]).not.toHaveProperty('scale');
    expect(r.imageUrl).toBe('https://out/edited.png');
    expect(r.seed).toBe(42);
  });

  it('throws when FAL_API_KEY is not set', async () => {
    delete process.env.FAL_API_KEY;
    await expect(
      generateFluxLoraImage({
        prompt: 'test',
        loras: [{ path: 'https://x/l.safetensors' }],
      })
    ).rejects.toThrow('FAL_API_KEY not configured');
  });

  it('throws on non-OK response with status and body', async () => {
    global.fetch = (async () => {
      return {
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      } as Response;
    }) as unknown as typeof fetch;

    await expect(
      generateFluxLoraImage({
        prompt: 'test',
        loras: [{ path: 'https://x/l.safetensors' }],
      })
    ).rejects.toThrow('fal flux-lora failed (500): Internal server error');
  });

  it('throws when response has no image url', async () => {
    global.fetch = (async () => {
      return {
        ok: true,
        json: async () => ({ images: [] }),
      } as Response;
    }) as unknown as typeof fetch;

    await expect(
      generateFluxLoraImage({
        prompt: 'test',
        loras: [{ path: 'https://x/l.safetensors' }],
      })
    ).rejects.toThrow('fal flux-lora returned no image');
  });
});
