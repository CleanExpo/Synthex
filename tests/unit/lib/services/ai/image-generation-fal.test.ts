/**
 * Unit tests — SYN-1066: FAL (FLUX) image provider fallback.
 *
 * In prod, STABILITY_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY are all
 * empty/unset, but FAL_API_KEY IS populated (used for video). The image
 * service must therefore succeed via the FAL provider using the key that is
 * already present — without an owner having to add a new secret. When NO
 * provider (including FAL) is keyed, it must still degrade to the existing
 * "All image generation providers failed" result and perform no fetch.
 */

/** @jest-environment node */
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// getVisualStyleInsights dynamically imports prisma; keep it DB-free.
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { trendInsight: { findMany: jest.fn().mockResolvedValue([]) } },
}));

import { generateImage } from '@/lib/services/ai/image-generation';

const IMAGE_KEYS = [
  'STABILITY_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'FAL_API_KEY',
] as const;

let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  for (const k of IMAGE_KEYS) delete process.env[k];
  fetchSpy = jest.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('generateImage — FAL fallback (SYN-1066)', () => {
  it('succeeds via FAL when it is the only populated key', async () => {
    process.env.FAL_API_KEY = 'fal-test-key';
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        images: [
          {
            url: 'https://fal.media/files/example.png',
            width: 1024,
            height: 1024,
            content_type: 'image/png',
          },
        ],
        seed: 42,
      }),
    } as unknown as Response);

    const result = await generateImage({ prompt: 'a drying wall, clean' });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('fal');
    expect(result.imageUrl).toBe('https://fal.media/files/example.png');

    // Only FAL should have made a network call (unkeyed providers no-op first).
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('fal.run');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Key fal-test-key',
    });
  });

  it('degrades gracefully with no fetch when NO provider is keyed', async () => {
    fetchSpy.mockRejectedValue(
      new Error('fetch must not be called when unconfigured')
    );

    const result = await generateImage({ prompt: 'a drying wall' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('All image generation providers failed');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
