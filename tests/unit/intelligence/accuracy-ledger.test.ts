/**
 * Unit tests — accuracy-ledger.ts — SYN-669 / P2 truth
 *
 * `score_accuracy_events` and `get_score_calibration` have no Prisma model, so
 * the ledger must say it is not provisioned instead of dropping writes or
 * claiming calibration is in progress. Both functions still never throw.
 */

import {
  recordScoreIssued,
  getScoreCalibration,
} from '@/lib/intelligence/accuracy-ledger';

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('recordScoreIssued — not provisioned', () => {
  it('returns an explicit FEATURE_NOT_PROVISIONED result and warns (no silent drop)', async () => {
    const result = await recordScoreIssued({
      clientId: 'org-abc',
      domain: 'content',
      scoreValue: 72,
      confidence: 'medium',
      calibrationDataPoints: 15,
      entityId: 'org-abc',
      sprintVersion: 'sprint-7',
    });

    expect(result).toEqual({
      recorded: false,
      reason: 'FEATURE_NOT_PROVISIONED',
      table: 'score_accuracy_events',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('score_accuracy_events is not provisioned'),
      expect.objectContaining({ clientId: 'org-abc', domain: 'content' })
    );
  });
});

describe('getScoreCalibration — not provisioned', () => {
  it('reports calibration as unavailable, never as in progress', async () => {
    const result = await getScoreCalibration('org-abc', 'content');

    expect(result.dataPoints).toBe(0);
    expect(result.meetsThreshold).toBe(false);
    expect(result.accuracyRate).toBeNull();
    expect(result.calibrationSummary).toMatch(/Calibration unavailable/);
    expect(result.calibrationSummary).not.toMatch(/in progress/);
  });

  it('keeps the per-domain threshold', async () => {
    for (const [domain, threshold] of [
      ['content', 10],
      ['geo', 5],
      ['health', 8],
    ] as const) {
      const result = await getScoreCalibration('org-test', domain);
      expect(result.thresholdRequired).toBe(threshold);
    }
  });
});
