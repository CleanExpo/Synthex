// SYN-1115: image generation now holds against the org's shared media budget
// before any provider call, so these behaviour suites stub the quota out. The
// quota's own behaviour stays covered by its dedicated suites.
jest.mock('@/lib/services/ai/video/quota', () =>
  jest.requireActual('../../support/mock-media-quota').mockMediaQuota()
);

/**
 * SYN-MCP-003 — provider-as-platform fix + ctx guard for
 * lib/services/ai/image-generation.ts.
 *
 * Defect (vs 2bd24eb5, image-generation.ts:405-411): generateImage passed
 * options.provider ('stability'/'dalle'/'gemini') to getVisualStyleInsights,
 * which expects a PLATFORM — no trendInsight row ever matched, so visual
 * style trends were silently dropped on every call.
 *
 * Contract now: the trend lookup receives options.platform (default
 * 'instagram'), NEVER the provider; generateImage/generateVariations require
 * a GenerationContext.
 *
 * Real Images Only update (2026-07-12): trend enrichment lives on the legacy
 * text-only path, which is now reachable ONLY via the explicit escape hatch
 * (useReferences: false) — and a pinned provider REQUIRES that escape hatch.
 * These tests pass it so the trend-lookup contract stays observable.
 */

const mockTrendFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    trendInsight: { findMany: (...a: unknown[]) => mockTrendFindMany(...a) },
  },
  prisma: {
    trendInsight: { findMany: (...a: unknown[]) => mockTrendFindMany(...a) },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
  generateImage,
  generateVariations,
} from '@/lib/services/ai/image-generation';
import {
  GenerationContextError,
  systemGenerationContext,
} from '@/lib/ai/generation-context';

const CTX = systemGenerationContext('org-img-1');

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // No provider keys → every provider fails fast without network I/O; we
  // only assert the trend-lookup arguments here.
  delete process.env.STABILITY_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  mockTrendFindMany.mockResolvedValue([]);
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('generateImage — platform (not provider) drives trend lookup', () => {
  it('passes options.platform to the visual-style trend lookup', async () => {
    await generateImage(
      {
        prompt: 'a plumber van',
        provider: 'stability',
        platform: 'linkedin',
        useReferences: false, // escape hatch — pinned providers require it
      },
      CTX
    );

    expect(mockTrendFindMany).toHaveBeenCalledTimes(1);
    const where = (
      mockTrendFindMany.mock.calls[0][0] as {
        where: { platform: string };
      }
    ).where;
    expect(where.platform).toBe('linkedin');
  });

  it("defaults to 'instagram' when no platform is supplied", async () => {
    await generateImage(
      { prompt: 'a plumber van', provider: 'dalle', useReferences: false },
      CTX
    );

    const where = (
      mockTrendFindMany.mock.calls[0][0] as {
        where: { platform: string };
      }
    ).where;
    expect(where.platform).toBe('instagram');
  });

  it('NEVER passes the provider where a platform is expected', async () => {
    for (const provider of ['stability', 'dalle', 'gemini'] as const) {
      mockTrendFindMany.mockClear();
      await generateImage(
        { prompt: 'x', provider, platform: 'tiktok', useReferences: false },
        CTX
      );
      const where = (
        mockTrendFindMany.mock.calls[0][0] as {
          where: { platform: string };
        }
      ).where;
      expect(where.platform).toBe('tiktok');
      expect(['stability', 'dalle', 'gemini']).not.toContain(where.platform);
    }
  });

  it('still surfaces the all-providers-failed result (no key configured)', async () => {
    const result = await generateImage(
      {
        prompt: 'x',
        provider: 'stability',
        platform: 'twitter',
        useReferences: false,
      },
      CTX
    );
    expect(result.success).toBe(false);
    expect(result.provider).toBe('stability');
  });
});

describe('generateImage / generateVariations — ctx runtime guard', () => {
  it('generateImage rejects without a GenerationContext', async () => {
    await expect(
      generateImage(
        { prompt: 'x' },
        undefined as unknown as ReturnType<typeof systemGenerationContext>
      )
    ).rejects.toThrow(GenerationContextError);
  });

  it('generateVariations rejects without a GenerationContext', async () => {
    await expect(
      generateVariations(
        { prompt: 'x' },
        undefined as unknown as ReturnType<typeof systemGenerationContext>,
        1
      )
    ).rejects.toThrow(GenerationContextError);
  });
});
