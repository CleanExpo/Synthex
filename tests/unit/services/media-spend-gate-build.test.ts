/**
 * P5 media holds can be attributed to a build (follow-up 1 to PR #1066).
 *
 * The build cap counts a hold whose RESERVE event carries run_id = buildId
 * (lib/ai/governor/build-cap.ts). This suite proves the write side: a hold
 * taken with a buildId records it on the reserve, a hold without one is
 * unchanged, and an unusable buildId is refused before anything is reserved —
 * a blank run_id would pool unrelated holds under one key.
 *
 * SEAM: the spend log's reserveSpendBatch, faked; everything in
 * media-spend-gate runs for real.
 */

jest.mock('@/lib/services/ai/image/spend-log', () => ({
  reserveSpendBatch: jest.fn(),
  finalizeSpend: jest.fn(),
  reserveKey: (holdId: string) => `reserve:${holdId}`,
  finalizeKey: (holdId: string) => `finalize:${holdId}`,
}));
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { reserveSpendBatch } from '@/lib/services/ai/image/spend-log';
import {
  holdMediaSpend,
  holdMediaSpendBatch,
  MediaSpendRefusedError,
} from '@/lib/services/ai/media-spend-gate';

const reserve = reserveSpendBatch as unknown as jest.Mock;
const BASE = {
  organizationId: 'org-1',
  initiatedBy: 'studio' as const,
  pipeline: 'voice-generation',
  model: 'eleven_multilingual_v2',
};

beforeEach(() => {
  reserve.mockResolvedValue([]);
});

describe('media holds attributed to a build', () => {
  it('C4 holdMediaSpend with a buildId writes it as the reserve run_id', async () => {
    await holdMediaSpend({ ...BASE, heldUsd: 0.5, buildId: 'build-42' });

    expect(reserve).toHaveBeenCalledTimes(1);
    expect(reserve.mock.calls[0][0]).toMatchObject({
      runId: 'build-42',
      mediaType: 'audio',
      perHoldUsd: 0.5,
    });
  });

  it('C4 holdMediaSpendBatch with a buildId attributes every hold in the batch', async () => {
    const holds = await holdMediaSpendBatch({
      ...BASE,
      perHoldUsd: 0.25,
      count: 3,
      buildId: 'build-42',
    });

    expect(holds).toHaveLength(3);
    expect(reserve.mock.calls[0][0]).toMatchObject({ runId: 'build-42' });
    expect(reserve.mock.calls[0][0].holdIds).toHaveLength(3);
  });

  it('C4 a hold without a buildId reserves exactly as before (no run_id)', async () => {
    await holdMediaSpend({ ...BASE, heldUsd: 0.5 });

    expect(reserve.mock.calls[0][0].runId).toBeUndefined();
  });

  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['non-string', 42 as unknown as string],
  ])(
    'C4 an unusable buildId (%s) is refused before any reservation',
    async (_label, buildId) => {
      const attempt = holdMediaSpend({ ...BASE, heldUsd: 0.5, buildId });

      await expect(attempt).rejects.toBeInstanceOf(MediaSpendRefusedError);
      await expect(attempt).rejects.toMatchObject({
        code: 'media_build_invalid',
        status: 422,
      });
      expect(reserve).not.toHaveBeenCalled();
    }
  );
});
