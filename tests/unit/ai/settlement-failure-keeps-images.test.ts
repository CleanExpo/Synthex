/** @jest-environment node */
/**
 * A settlement WRITE failure must not destroy images the provider produced.
 *
 * `settleImageSpend` was awaited unguarded on both metered entry points while
 * the release path was guarded with `.catch(() => undefined)`. So a transient
 * database error at settlement threw, and the caller lost images the provider
 * had already generated AND billed — paying for work that was then thrown away.
 *
 * This is the same trade `recordAttempt` refuses at every call site, in the
 * codebase's own words: "a bookkeeping failure must not destroy an image the
 * caller already paid for". The money is not lost by swallowing it — the hold
 * stays unsettled and the stale sweep charges it from the recorded attempts,
 * which errs high rather than writing spend off.
 *
 * Reported by CodeRabbit on PR #820.
 */
const mockSettle = jest.fn();
jest.mock('@/lib/services/ai/image/meter', () => ({
  ...jest.requireActual('@/lib/services/ai/image/meter'),
  settleImageSpend: (...a: unknown[]) => mockSettle(...a),
}));

jest.mock('@/lib/services/ai/image/spend-log', () =>
  jest.requireActual('../../support/mock-media-quota').mockSpendLog()
);

jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: jest.fn(async () => undefined),
}));

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
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/services/ai/reference-library', () => ({
  resolveReferences: jest.fn(),
}));
jest.mock('@/lib/services/ai/reference-library-private', () => ({
  resolvePrivateReferenceUrls: jest.fn(async () => []),
}));
jest.mock('@/lib/services/ai/image/providers/flux-fal', () => ({
  generateFluxImage: jest.fn(),
}));
jest.mock('@/lib/services/ai/image/providers/flux-lora-fal', () => ({
  generateFluxLoraImage: jest.fn(),
}));
jest.mock('@/lib/services/ai/image/trained-loras', () => ({
  resolveLora: jest.fn(),
  resolveLoraForIndustry: jest.fn(),
}));

import { generateImage } from '@/lib/services/ai/image-generation';
import { resolveReferences } from '@/lib/services/ai/reference-library';
import { generateFluxImage } from '@/lib/services/ai/image/providers/flux-fal';
import { resolveLoraForIndustry } from '@/lib/services/ai/image/trained-loras';
import { resolvePrivateReferenceUrls } from '@/lib/services/ai/reference-library-private';

const CARPET_REFS = {
  industry: 'carpet-cleaning',
  subject: 'carpet-cleaning-wand',
  imagePaths: [
    '/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp',
  ],
  count: 1,
  vendorKey: 'unite-group',
};

const ctx = {
  organizationId: 'org-1',
  userId: 'u1',
  autonomyLevel: 'manual',
  traceId: 't1',
} as never;

const ORIGINAL_ENV = { ...process.env };
beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.social';
});
afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockTrendFindMany.mockResolvedValue([]);
  (resolveReferences as jest.Mock).mockReturnValue(CARPET_REFS);
  (resolveLoraForIndustry as jest.Mock).mockReturnValue(null);
  // resetMocks: true wipes a jest.fn's implementation between tests, so anything
  // whose RETURN VALUE the code under test depends on must be reinstated here —
  // the same hazard tests/support/mock-media-quota.ts documents. Without this
  // the second test received undefined and failed on 'privateUrls is not
  // iterable', while the first passed only because the factory impl survived.
  (resolvePrivateReferenceUrls as jest.Mock).mockResolvedValue([]);
  (generateFluxImage as jest.Mock).mockResolvedValue({
    imageUrl: 'https://out/grounded.png',
    seed: 1,
    model: 'fal-ai/flux-2-pro',
  });
});

describe('settlement failure does not destroy the generated image', () => {
  it('returns the image when the settlement write throws', async () => {
    mockSettle.mockRejectedValue(new Error('settlement write failed'));

    const r = await generateImage({ prompt: 'our carpet wand' }, ctx);

    // THE assertion: the caller still gets what the provider produced.
    expect(r.success).toBe(true);
    expect(r.imageUrl).toBe('https://out/grounded.png');
    // The actual is unknown because settlement did not complete — reported as
    // undefined rather than fabricated as zero, which would read as "free".
    expect(r.actualCostUsd).toBeUndefined();
    // And the estimate is still stamped, so the hold is visible to the caller.
    expect(r.estimatedCostUsd).toBeGreaterThan(0);
  });

  it('still settles normally when the write succeeds', async () => {
    // The negative half: the guard must not swallow the happy path.
    mockSettle.mockResolvedValue({ totalUsd: 0.42, perVariantUsd: [0.42] });

    const r = await generateImage({ prompt: 'our carpet wand' }, ctx);

    expect(r.success).toBe(true);
    expect(r.actualCostUsd).toBeCloseTo(0.42, 4);
  });
});
