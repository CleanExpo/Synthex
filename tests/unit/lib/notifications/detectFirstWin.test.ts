/**
 * Unit tests for detectFirstWin pure function
 *
 * @task SYN-525
 */

import {
  detectFirstWin,
  formatWinMessage,
  type DetectFirstWinParams,
  type WinMetric,
} from '@/lib/notifications/detectFirstWin';

// ─── detectFirstWin ───────────────────────────────────────────────────────────

describe('detectFirstWin', () => {
  const baseParams: DetectFirstWinParams = {
    postId: 'post_abc123',
    metric: 'impressions',
    actualValue: 312,
    baselineValue: 212,
  };

  it('returns null when actual is below the 1.3× threshold', () => {
    // 220 / 212 = 1.037× — below 1.3× threshold
    const result = detectFirstWin({
      ...baseParams,
      actualValue: 220,
      baselineValue: 212,
    });
    expect(result).toBeNull();
  });

  it('detects a win when actual equals exactly 1.3× baseline', () => {
    // 212 * 1.3 = 275.6 — use 276 to hit exactly at-or-above
    const result = detectFirstWin({
      ...baseParams,
      actualValue: 276,
      baselineValue: 212,
    });
    expect(result).not.toBeNull();
    expect(result?.postId).toBe('post_abc123');
    expect(result?.metric).toBe('impressions');
    expect(result?.improvementPct).toBe(30); // 276/212 - 1 = 0.302 → 30%
  });

  it('detects a win when actual is well above 1.3× baseline', () => {
    // 312 / 212 = 1.47× → 47% improvement
    const result = detectFirstWin(baseParams);
    expect(result).not.toBeNull();
    expect(result?.actualValue).toBe(312);
    expect(result?.baselineValue).toBe(212);
    expect(result?.improvementPct).toBe(47);
    expect(result?.detectedAt).toBeInstanceOf(Date);
  });

  it('returns null when baseline is zero (avoids division by zero)', () => {
    const result = detectFirstWin({
      ...baseParams,
      baselineValue: 0,
    });
    expect(result).toBeNull();
  });

  it('returns null when baseline is negative', () => {
    const result = detectFirstWin({
      ...baseParams,
      baselineValue: -10,
    });
    expect(result).toBeNull();
  });

  it('returns null when actualValue is zero', () => {
    const result = detectFirstWin({
      ...baseParams,
      actualValue: 0,
    });
    expect(result).toBeNull();
  });

  it('respects a custom threshold', () => {
    // With threshold 2.0×: actual must be >= 2× baseline
    // 300 / 212 = 1.41× — below 2× threshold
    const noWin = detectFirstWin({
      ...baseParams,
      actualValue: 300,
      baselineValue: 212,
      threshold: 2.0,
    });
    expect(noWin).toBeNull();

    // 500 / 212 = 2.36× — above 2× threshold
    const win = detectFirstWin({
      ...baseParams,
      actualValue: 500,
      baselineValue: 212,
      threshold: 2.0,
    });
    expect(win).not.toBeNull();
  });

  it('works for engagementRate metric', () => {
    const result = detectFirstWin({
      postId: 'post_xyz',
      metric: 'engagementRate',
      actualValue: 8.5, // 8.5%
      baselineValue: 4.2, // 4.2% average — 2.02× → win
    });
    expect(result).not.toBeNull();
    expect(result?.metric).toBe('engagementRate');
    expect(result?.improvementPct).toBe(102); // (8.5/4.2 - 1) * 100 ≈ 102%
  });

  it('returns all required fields on a win event', () => {
    const result = detectFirstWin(baseParams);
    expect(result).toMatchObject({
      postId: 'post_abc123',
      metric: 'impressions',
      actualValue: 312,
      baselineValue: 212,
      improvementPct: expect.any(Number),
      detectedAt: expect.any(Date),
    });
  });

  // Idempotency is handled by the caller (createFirstWinNotification checks
  // org.firstWinDetected before calling this function). This test documents
  // that detectFirstWin itself has no idempotency logic — it always evaluates.
  it('has no built-in idempotency — always evaluates the given values', () => {
    const result1 = detectFirstWin(baseParams);
    const result2 = detectFirstWin(baseParams);
    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    // Both calls produce a win — idempotency is the caller's responsibility
  });
});

// ─── formatWinMessage ─────────────────────────────────────────────────────────

describe('formatWinMessage', () => {
  it('formats an impressions win with locale numbers', () => {
    const msg = formatWinMessage({
      postId: 'p1',
      metric: 'impressions',
      actualValue: 312,
      baselineValue: 212,
      improvementPct: 47,
      detectedAt: new Date(),
    });
    expect(msg).toContain('312');
    expect(msg).toContain('212');
    expect(msg).toContain('47%');
    expect(msg).toContain('impressions');
  });

  it('formats an engagementRate win with percentage display', () => {
    const msg = formatWinMessage({
      postId: 'p2',
      metric: 'engagementRate',
      actualValue: 8.5,
      baselineValue: 4.2,
      improvementPct: 102,
      detectedAt: new Date(),
    });
    expect(msg).toContain('8.5%');
    expect(msg).toContain('4.2%');
    expect(msg).toContain('102%');
  });

  const allMetrics: WinMetric[] = [
    'reach',
    'impressions',
    'engagementRate',
    'clicks',
    'saves',
  ];

  it.each(allMetrics)('produces a non-empty message for metric: %s', metric => {
    const msg = formatWinMessage({
      postId: 'p',
      metric,
      actualValue: 100,
      baselineValue: 50,
      improvementPct: 100,
      detectedAt: new Date(),
    });
    expect(msg.length).toBeGreaterThan(10);
    expect(msg).toContain('100%');
  });
});
