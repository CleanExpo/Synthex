/**
 * SEAM: quoteMedia() in lib/services/ai/media-quote.ts — the exported service
 * function POST /api/media/quote calls. Catches: a quote drifting from the
 * charge (image hold compared with what holdImageSpend really reserves, video
 * hold with what reserveSpendBatch is handed), a budget read error becoming a
 * zero quote, and any write on the quote path. Misses: the real database
 * (spendSnapshot and the reserve writers are the only mocks).
 */
const mockSnapshot = jest.fn();
const mockReserve = jest.fn();
const mockReserveBatch = jest.fn();
const mockOtherWrite = jest.fn();

jest.mock('@/lib/services/ai/image/spend-log', () => {
  const actual = jest.requireActual('@/lib/services/ai/image/spend-log');
  return {
    ...actual,
    spendSnapshot: (...a: unknown[]) => mockSnapshot(...a),
    reserveSpend: (...a: unknown[]) => mockReserve(...a),
    reserveSpendBatch: (...a: unknown[]) => mockReserveBatch(...a),
    recordAttempt: (...a: unknown[]) => mockOtherWrite('recordAttempt', ...a),
    finalizeSpend: (...a: unknown[]) => mockOtherWrite('finalizeSpend', ...a),
  };
});
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: new Proxy(
    {},
    {
      get: (_t, prop) => {
        mockOtherWrite('prisma', String(prop));
        throw new Error('quote path touched prisma');
      },
    }
  ),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
  quoteMedia,
  MediaQuoteUnavailableError,
} from '@/lib/services/ai/media-quote';
import { holdImageSpend } from '@/lib/services/ai/image/meter';
import { holdQuotaBatch } from '@/lib/services/ai/video/quota';

const roomy = {
  dailyUsd: 1,
  monthlyUsd: 10,
  mcpDailyUsd: 0,
  dailyCapUsd: 15,
  monthlyCapUsd: 75,
};

const image = {
  kind: 'image' as const,
  organizationId: 'org-1',
  initiatedBy: 'studio' as const,
  count: 2,
  options: { useReferences: true },
};
const video = {
  kind: 'video' as const,
  organizationId: 'org-1',
  initiatedBy: 'studio' as const,
  tier: 'draft' as const,
  aspectRatio: '9:16' as const,
  durationSeconds: 6,
  variants: 3,
};

describe('quoteMedia', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSnapshot.mockResolvedValue(roomy);
    mockReserve.mockResolvedValue({});
    mockReserveBatch.mockResolvedValue([]);
  });

  it('image hold equals what holdImageSpend reserves for the same request', async () => {
    await holdImageSpend('org-1', 'studio', image.options, image.count);
    const charged = mockReserve.mock.calls[0][0].amountUsd;
    jest.clearAllMocks();
    mockSnapshot.mockResolvedValue(roomy);

    const q = await quoteMedia(image);

    expect(q.holdUsd).toBe(charged);
    expect(q.kind).toBe('image');
    expect(q.count).toBe(2);
    expect(q.totalUsd).toBeCloseTo(q.unitPriceUsd * 2, 4);
    expect(q.wouldBeAdmitted).toBe(true);
  });

  it('video hold equals what holdQuotaBatch hands the reserve', async () => {
    await holdQuotaBatch('org-1', 0.5, 'studio', ['a', 'b', 'c']);
    expect(mockReserveBatch.mock.calls[0][0].perHoldUsd).toBe(0.5);

    const q = await quoteMedia(video);

    // draft tier @ 6s: unit price is the registry's, hold = unit x variants.
    expect(q.kind).toBe('video');
    expect(q.count).toBe(3);
    expect(q.unitPriceUsd).toBeGreaterThan(0);
    expect(q.holdUsd).toBeCloseTo(q.unitPriceUsd * 3, 4);
    expect(q.totalUsd).toBe(q.holdUsd);
  });

  it('reports remaining budget as the tightest cap', async () => {
    const q = await quoteMedia(image);
    expect(q.remainingBudgetUsd).toBe(14); // min(15-1 daily, 75-10 monthly)
  });

  it('refuses admission with a reason when the daily cap would be breached', async () => {
    mockSnapshot.mockResolvedValue({ ...roomy, dailyUsd: 14.99 });
    const q = await quoteMedia(image);
    expect(q.wouldBeAdmitted).toBe(false);
    expect(q.reason).toMatch(/daily/);
  });

  it('applies the agent daily cap to mcp-initiated quotes only', async () => {
    mockSnapshot.mockResolvedValue({ ...roomy, mcpDailyUsd: 7.49 });
    expect((await quoteMedia(image)).wouldBeAdmitted).toBe(true);
    const q = await quoteMedia({ ...image, initiatedBy: 'mcp' });
    expect(q.wouldBeAdmitted).toBe(false);
    expect(q.reason).toMatch(/mcp-daily/);
  });

  it('fails closed: a budget read error is an error, never a zero quote', async () => {
    mockSnapshot.mockRejectedValue(new Error('db down'));
    await expect(quoteMedia(image)).rejects.toBeInstanceOf(
      MediaQuoteUnavailableError
    );
  });

  it('writes nothing and calls no provider on the quote path', async () => {
    await quoteMedia(image);
    await quoteMedia(video);
    expect(mockReserve).not.toHaveBeenCalled();
    expect(mockReserveBatch).not.toHaveBeenCalled();
    expect(mockOtherWrite).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range count rather than quoting it', async () => {
    await expect(quoteMedia({ ...image, count: 0 })).rejects.toBeInstanceOf(
      RangeError
    );
    await expect(quoteMedia({ ...video, variants: 9 })).rejects.toBeInstanceOf(
      RangeError
    );
  });
});

describe('quoteMedia (control: planted failure is caught)', () => {
  it('a quote whose hold ignores the worst-case call count would differ from the charge', async () => {
    mockSnapshot.mockResolvedValue(roomy);
    mockReserve.mockResolvedValue({});
    const q = await quoteMedia(image);
    // Grounded images can make 3 provider calls per variant, so the hold must
    // exceed the single-call total; a quote returning total as hold goes red.
    expect(q.holdUsd).toBeGreaterThan(q.totalUsd);
  });
});
