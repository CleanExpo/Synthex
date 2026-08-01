// SYN-1115: image generation now holds against the org's shared media budget
// before any provider call, so these behaviour suites stub the quota out. The
// quota's own behaviour stays covered by its dedicated suites.
jest.mock('@/lib/services/ai/video/quota', () =>
  jest.requireActual('../../support/mock-media-quota').mockMediaQuota()
);

import {
  clampSeed,
  generateBatch,
  MAX_SEED,
} from '@/lib/services/ai/image-generation';

const ctx = {
  organizationId: 'org1',
  userId: 'u1',
  autonomyLevel: 'manual',
  traceId: 'trace-123',
} as any;

describe('clampSeed', () => {
  it('passes through in-range ints and floors floats', () => {
    expect(clampSeed(42)).toBe(42);
    expect(clampSeed(42.9)).toBe(42);
  });
  it('clamps negatives to 0 and huge values to MAX_SEED', () => {
    expect(clampSeed(-5)).toBe(0);
    expect(clampSeed(9_999_999_999)).toBe(MAX_SEED);
  });
});

describe('generateBatch', () => {
  it('fans out count parallel calls with +1000 seed offsets', async () => {
    const seeds: number[] = [];
    const stub = jest.fn(async (o: any) => {
      seeds.push(o.seed);
      return {
        success: true,
        provider: 'stability',
        metadata: { seed: o.seed, width: 1, height: 1, model: 'm' },
      };
    });
    const out = await generateBatch(
      { prompt: 'p', seed: 100 } as any,
      ctx,
      3,
      stub as any
    );
    expect(out).toHaveLength(3);
    expect(seeds).toEqual([100, 1100, 2100]);
  });
  it('maps a rejected settlement to a failed result and keeps the batch alive', async () => {
    let i = 0;
    const stub = jest.fn(async () => {
      if (i++ === 1) throw new Error('provider exploded');
      return { success: true, provider: 'stability' };
    });
    const out = await generateBatch(
      { prompt: 'p', seed: 1 } as any,
      ctx,
      3,
      stub as any
    );
    expect(out.filter(r => r.success)).toHaveLength(2);
    expect(out[1]).toMatchObject({
      success: false,
      error: expect.stringContaining('provider exploded'),
    });
  });
  it('clamps an out-of-range base seed before offsetting', async () => {
    const seeds: number[] = [];
    const stub = jest.fn(async (o: any) => {
      seeds.push(o.seed);
      return { success: true, provider: 'x' };
    });
    await generateBatch(
      { prompt: 'p', seed: MAX_SEED + 999 } as any,
      ctx,
      2,
      stub as any
    );
    expect(seeds).toEqual([MAX_SEED, MAX_SEED + 1000]); // base clamped; offsets stay < 2^31-1
  });
  it('throws without a GenerationContext', async () => {
    await expect(
      generateBatch({ prompt: 'p' } as any, undefined as any)
    ).rejects.toThrow();
  });
});
