/**
 * Unit tests — accuracy-ledger.ts — SYN-669
 *
 * Validates:
 * 1. recordScoreIssued writes correct fields and never throws
 * 2. getScoreCalibration maps RPC response to CalibrationState correctly
 * 3. calibrationSummary is always a non-empty string in both threshold states
 */

import { createClient } from '@supabase/supabase-js';
import { recordScoreIssued, getScoreCalibration } from '@/lib/intelligence/accuracy-ledger';

// ── Mock Supabase admin ──────────────────────────────────────────────────────

const mockInsert = jest.fn();
const mockRpc    = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

beforeEach(() => {
  // jest.config.cjs sets resetMocks: true, which strips mock implementations
  // before every test (including the first). Re-apply them here so each test
  // starts with a fully-configured mock client.
  mockInsert.mockResolvedValue({ error: null });
  (createClient as jest.Mock).mockReturnValue({
    from: (_table: string) => ({ insert: mockInsert }),
    rpc: mockRpc,
  });

  process.env.NEXT_PUBLIC_SUPABASE_URL  = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

// ── recordScoreIssued ────────────────────────────────────────────────────────

describe('recordScoreIssued', () => {
  it('inserts correct fields for a content score', async () => {
    await recordScoreIssued({
      clientId:               'org-abc',
      domain:                 'content',
      scoreValue:             72,
      confidence:             'medium',
      calibrationDataPoints:  15,
      entityId:               'org-abc',
      sprintVersion:          'sprint-7',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id:               'org-abc',
        score_domain:            'content',
        score_value:             72,
        confidence:              'medium',
        calibration_data_points: 15,
        entity_id:               'org-abc',
        sprint_version:          'sprint-7',
      })
    );
  });

  it('never throws on Supabase insert error', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'DB down' } });

    await expect(
      recordScoreIssued({
        clientId:               'org-xyz',
        domain:                 'geo',
        scoreValue:             50,
        confidence:             'low',
        calibrationDataPoints:  0,
        entityId:               'org-xyz',
      })
    ).resolves.toBeUndefined();
  });

  it('never throws on unexpected exception', async () => {
    mockInsert.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      recordScoreIssued({
        clientId:  'org-fail',
        domain:    'health',
        scoreValue: 30,
        confidence: 'low',
        calibrationDataPoints: 0,
        entityId:  'org-fail',
      })
    ).resolves.toBeUndefined();
  });
});

// ── getScoreCalibration ──────────────────────────────────────────────────────

describe('getScoreCalibration', () => {
  it('maps RPC response to CalibrationState when threshold met', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{
        data_points:        23,
        accuracy_rate:      0.78,
        meets_threshold:    true,
        threshold_required: 10,
        first_scored_at:    '2026-01-01T00:00:00Z',
      }],
      error: null,
    });

    const result = await getScoreCalibration('org-abc', 'content');

    expect(result.dataPoints).toBe(23);
    expect(result.meetsThreshold).toBe(true);
    expect(result.accuracyRate).toBe(0.78);
    expect(result.calibrationSummary).not.toBe('');
    expect(result.calibrationSummary).toMatch(/23/);
  });

  it('returns below-threshold summary when dataPoints < threshold', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{
        data_points:        3,
        accuracy_rate:      null,
        meets_threshold:    false,
        threshold_required: 10,
        first_scored_at:    null,
      }],
      error: null,
    });

    const result = await getScoreCalibration('org-new', 'content');

    expect(result.meetsThreshold).toBe(false);
    expect(result.calibrationSummary).not.toBe('');
    expect(result.calibrationSummary).toMatch(/Calibration in progress/);
  });

  it('returns safe default on RPC error — never throws', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await getScoreCalibration('org-broken', 'geo');

    expect(result.dataPoints).toBe(0);
    expect(result.meetsThreshold).toBe(false);
    expect(result.calibrationSummary).not.toBe('');
  });

  it('returns safe default on empty RPC response — never throws', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await getScoreCalibration('org-empty', 'health');

    expect(result.dataPoints).toBe(0);
    expect(result.calibrationSummary).not.toBe('');
  });

  it('uses correct threshold for each domain', async () => {
    for (const [domain, threshold] of [['content', 10], ['geo', 5], ['health', 8]] as const) {
      mockRpc.mockResolvedValueOnce({
        data: [{ data_points: 0, accuracy_rate: null, meets_threshold: false, threshold_required: threshold, first_scored_at: null }],
        error: null,
      });

      const result = await getScoreCalibration('org-test', domain);
      expect(result.thresholdRequired).toBe(threshold);
    }
  });
});
