const mockCreate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: { create: (...a: unknown[]) => mockCreate(...a) },
  },
}));

const mockHold = jest.fn();
const mockRelease = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  holdQuota: (...a: unknown[]) => mockHold(...a),
  releaseQuota: (...a: unknown[]) => mockRelease(...a),
}));

const mockSubmit = jest.fn();
jest.mock('@/lib/services/ai/video/fal-adapter', () => ({
  submitToFal: (...a: unknown[]) => mockSubmit(...a),
}));

const mockBrand = jest.fn();
jest.mock('@/lib/services/ai/video/cards/brand-cards', () => ({
  getBrandFragment: (...a: unknown[]) => mockBrand(...a),
}));

import { submitGenerativeVideo } from '@/lib/services/ai/video/generation-service';

beforeEach(() => {
  jest.clearAllMocks();
  mockHold.mockResolvedValue(undefined);
  mockRelease.mockResolvedValue(undefined);
  mockBrand.mockResolvedValue(null);
  mockSubmit.mockImplementation(
    async () => `req-${mockSubmit.mock.calls.length}`
  );
  mockCreate.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: `row-${mockCreate.mock.calls.length}`,
      ...data,
    })
  );
});

const baseReq = {
  userId: 'u1',
  organizationId: 'org1',
  initiatedBy: 'studio' as const,
  prompt: 'a cordless moisture meter',
  methodCardId: 'product-reveal',
};

describe('generation service', () => {
  it('holds quota on the SUMMED estimate before submitting anything', async () => {
    await submitGenerativeVideo({ ...baseReq, variants: 4 });
    expect(mockHold).toHaveBeenCalledTimes(1);
    const [, sum] = mockHold.mock.calls[0];
    expect(sum).toBeCloseTo(4 * 6 * 0.05, 4); // 4 variants x 6s x draft $/s
    expect(mockHold.mock.invocationCallOrder[0]).toBeLessThan(
      mockSubmit.mock.invocationCallOrder[0]
    );
  });

  it('creates one row per variant sharing batchGroupId, distinct seeds', async () => {
    const jobs = await submitGenerativeVideo({ ...baseReq, variants: 3 });
    expect(jobs).toHaveLength(3);
    const groups = new Set(jobs.map(j => j.batchGroupId));
    expect(groups.size).toBe(1);
    const seeds = mockCreate.mock.calls.map(c => c[0].data.seed);
    expect(new Set(seeds).size).toBe(3);
  });

  it('rejects unknown method cards', async () => {
    await expect(
      submitGenerativeVideo({ ...baseReq, methodCardId: 'nope' })
    ).rejects.toThrow(/unknown method card/i);
  });

  it('rejects image-required cards without an imageUrl', async () => {
    await expect(
      submitGenerativeVideo({ ...baseReq, methodCardId: 'logo-motion' })
    ).rejects.toThrow(/requires an input image/i);
  });

  it('caps variants at 8', async () => {
    await expect(
      submitGenerativeVideo({ ...baseReq, variants: 9 })
    ).rejects.toThrow(/variants/i);
  });

  it('does not create rows when quota hold fails', async () => {
    mockHold.mockRejectedValue(new Error('cap'));
    await expect(submitGenerativeVideo(baseReq)).rejects.toThrow('cap');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('applies the brand fragment when brandCardId is set', async () => {
    mockBrand.mockResolvedValue('In the visual style of AquaDry');
    await submitGenerativeVideo({ ...baseReq, brandCardId: 'org-brand-1' });
    const submittedPrompt = (mockSubmit.mock.calls[0][1] as { prompt: string })
      .prompt;
    expect(submittedPrompt).toContain('In the visual style of AquaDry');
  });

  it('releases the unsubmitted remainder when a mid-batch submit fails', async () => {
    mockSubmit
      .mockResolvedValueOnce('req-a')
      .mockRejectedValueOnce(new Error('fal down'));
    const jobs = await submitGenerativeVideo({ ...baseReq, variants: 3 });
    expect(jobs).toHaveLength(1); // first variant survived
    expect(mockRelease).toHaveBeenCalledTimes(1);
    const [, releasedUsd] = mockRelease.mock.calls[0];
    expect(releasedUsd).toBeCloseTo(2 * 6 * 0.05, 4); // two unsubmitted variants
  });
});
