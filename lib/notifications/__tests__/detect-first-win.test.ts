import {
  detectFirstWin,
  formatWinCopy,
  WIN_THRESHOLD,
  PostPerformance,
  ClientBaseline,
} from '../detect-first-win';

const basePost: PostPerformance = {
  postId: 'post-001',
  postedAt: new Date('2026-03-25T10:00:00Z'),
  metric: 'impressions',
  value: 312,
};

const baseBaseline: ClientBaseline = {
  userId: 'user-001',
  metric: 'impressions',
  rollingAverage: 212,
  firstWinDetected: false,
};

describe('detectFirstWin', () => {
  it('returns WinEvent when post exceeds 1.3x threshold', () => {
    const result = detectFirstWin(basePost, baseBaseline);
    expect(result).not.toBeNull();
    expect(result!.improvementPct).toBe(47);
    expect(result!.userId).toBe('user-001');
    expect(result!.postId).toBe('post-001');
  });

  it('returns WinEvent when post is exactly at threshold (>= 1.3x triggers win)', () => {
    const post = { ...basePost, value: 212 * WIN_THRESHOLD }; // 275.6 — ratio exactly 1.3
    const result = detectFirstWin(post, baseBaseline);
    expect(result).not.toBeNull();
  });

  it('returns null when post is below threshold', () => {
    const post = { ...basePost, value: 220 }; // 220/212 = 1.037
    expect(detectFirstWin(post, baseBaseline)).toBeNull();
  });

  it('returns null when user already has first win (idempotent)', () => {
    const baseline = { ...baseBaseline, firstWinDetected: true };
    expect(detectFirstWin(basePost, baseline)).toBeNull();
  });

  it('returns null when baseline is zero', () => {
    const baseline = { ...baseBaseline, rollingAverage: 0 };
    expect(detectFirstWin(basePost, baseline)).toBeNull();
  });

  it('returns null when metrics do not match', () => {
    const post = { ...basePost, metric: 'saves' as const };
    expect(detectFirstWin(post, baseBaseline)).toBeNull();
  });

  it('computes correct improvementPct', () => {
    const post = { ...basePost, value: 424 }; // 2x baseline = 100% improvement
    const result = detectFirstWin(post, baseBaseline);
    expect(result!.improvementPct).toBe(100);
  });

  it('works for engagement_rate metric', () => {
    const post: PostPerformance = {
      postId: 'p2',
      postedAt: new Date(),
      metric: 'engagement_rate',
      value: 6.5,
    };
    const baseline: ClientBaseline = {
      userId: 'u1',
      metric: 'engagement_rate',
      rollingAverage: 4.0,
      firstWinDetected: false,
    };
    const result = detectFirstWin(post, baseline);
    expect(result).not.toBeNull(); // 6.5/4.0 = 1.625 > 1.3
    expect(result!.metric).toBe('engagement_rate');
  });
});

describe('formatWinCopy', () => {
  it('produces specific metric copy', () => {
    const win = detectFirstWin(basePost, baseBaseline)!;
    const { title, body } = formatWinCopy(win);
    expect(title).toContain('first win');
    expect(body).toContain('312');
    expect(body).toContain('47%');
    expect(body).toContain('212');
  });
});
