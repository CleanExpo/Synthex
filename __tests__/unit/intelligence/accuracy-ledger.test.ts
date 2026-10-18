/**
 * Unit tests — accuracy-ledger.ts — SYN-669
 *
 * The score_accuracy_events table and get_score_calibration RPC have no Prisma
 * model, so the ledger is not provisioned. Validates:
 * 1. recordScoreIssued reports recorded:false with FEATURE_NOT_PROVISIONED,
 *    warns, and never throws
 * 2. getScoreCalibration never claims calibration: zero data points,
 *    meetsThreshold false, per-domain threshold, explicit unavailable summary
 */

import {
  recordScoreIssued,
  getScoreCalibration,
} from '@/lib/intelligence/accuracy-ledger';

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

// ── recordScoreIssued ────────────────────────────────────────────────────────

describe('recordScoreIssued', () => {
  it('reports not provisioned instead of a silent drop', async () => {
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
      { clientId: 'org-abc', domain: 'content' }
    );
  });

  it('never throws', async () => {
    await expect(
      recordScoreIssued({
        clientId: 'org-xyz',
        domain: 'geo',
        scoreValue: 50,
        confidence: 'low',
        calibrationDataPoints: 0,
        entityId: 'org-xyz',
      })
    ).resolves.toMatchObject({ recorded: false });
  });
});

// ── getScoreCalibration ──────────────────────────────────────────────────────

describe('getScoreCalibration', () => {
  it('never claims calibration while the ledger is not provisioned', async () => {
    const result = await getScoreCalibration('org-abc', 'content');

    expect(result.dataPoints).toBe(0);
    expect(result.meetsThreshold).toBe(false);
    expect(result.accuracyRate).toBeNull();
    expect(result.firstScoredAt).toBeNull();
    expect(result.calibrationSummary).toMatch(/not provisioned/);
  });

  it('uses correct threshold for each domain', async () => {
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
