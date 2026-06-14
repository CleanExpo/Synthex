/**
 * Unit tests — content-scorer.ts — SYN-666
 *
 * Validates that saveContentScore, after a successful content_score_history
 * upsert, records the issued score to the `score_accuracy_events` ledger
 * (domain='content') for the right org — closing the doc-vs-code gap where the
 * docstring claimed ledger persistence but the code only carried a stale TODO.
 *
 * Follows the accuracy-ledger.test.ts convention: mock Supabase admin, assert
 * the mapped params. recordScoreIssued itself is unit-tested separately; here we
 * mock it to assert content-scorer wires it with correctly-mapped params.
 */

import { createClient } from '@supabase/supabase-js';
import { saveContentScore, type ComputedContentScore } from '@/lib/intelligence/content-scorer';
import { recordScoreIssued } from '@/lib/intelligence/accuracy-ledger';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUpsert = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/intelligence/accuracy-ledger', () => ({
  recordScoreIssued: jest.fn().mockResolvedValue(undefined),
}));

function buildComputed(
  overrides: Partial<ComputedContentScore> = {}
): ComputedContentScore {
  return {
    organizationId: 'org-abc',
    weekStart: '2026-06-08',
    score: 72,
    delta: 4,
    components: { data_availability: 32, engagement_lift: 28, volume_bonus: 12 },
    dataPoints: 18,
    ...overrides,
  };
}

beforeEach(() => {
  // jest config sets resetMocks: true — re-apply implementations each test.
  mockUpsert.mockResolvedValue({ error: null });
  (createClient as jest.Mock).mockReturnValue({
    from: (_table: string) => ({ upsert: mockUpsert }),
  });
  (recordScoreIssued as jest.Mock).mockResolvedValue(undefined);

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

describe('saveContentScore → accuracy ledger (SYN-666)', () => {
  it('records a content score_accuracy_events row with correctly-mapped params', async () => {
    await saveContentScore(buildComputed());

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(recordScoreIssued).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'org-abc',
        domain: 'content',
        scoreValue: 72,
        calibrationDataPoints: 18,
        entityId: 'org-abc',
      })
    );
  });

  it("marks confidence 'high' once post count meets the calibration bar (>=15)", async () => {
    await saveContentScore(buildComputed({ dataPoints: 15 }));

    expect(recordScoreIssued).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: 'high', calibrationDataPoints: 15 })
    );
  });

  it("marks confidence 'low' while the org is still below the calibration bar", async () => {
    await saveContentScore(buildComputed({ dataPoints: 9 }));

    expect(recordScoreIssued).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: 'low', calibrationDataPoints: 9 })
    );
  });

  it('does NOT record to the ledger when the history upsert fails', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'DB down' } });

    await saveContentScore(buildComputed());

    expect(recordScoreIssued).not.toHaveBeenCalled();
  });

  it('does NOT record to the ledger when Supabase admin is unavailable', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await saveContentScore(buildComputed());

    expect(recordScoreIssued).not.toHaveBeenCalled();
  });
});
