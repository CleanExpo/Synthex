/**
 * Unit tests for autopilot quality gate
 * Tests score-based routing: schedule / draft / reject
 */

// Mock content-scorer before importing quality-gate
jest.mock('@/lib/ai/content-scorer', () => ({
  contentScorer: {
    score: jest.fn(),
  },
}));

import { evaluateContent, scoreDimensions } from '@/lib/autopilot/quality-gate';
import { contentScorer } from '@/lib/ai/content-scorer';

const mockScore = contentScorer.score as jest.Mock;

const baseDimensions = {
  readability: { score: 80, label: 'Good' },
  engagement: { score: 75, label: 'Good' },
  platformFit: { score: 85, label: 'Excellent' },
  clarity: { score: 70, label: 'Good' },
  emotional: { score: 65, label: 'Fair' },
  writingQuality: { score: 78, label: 'Good' },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('evaluateContent', () => {
  it('returns "schedule" when score >= autoApproveThreshold', () => {
    mockScore.mockReturnValue({ overall: 85, dimensions: baseDimensions });
    const result = evaluateContent('Great content here', 'twitter', 80, 65);
    expect(result.decision).toBe('schedule');
    expect(result.score).toBe(85);
    expect(result.reason).toContain('auto-approve');
  });

  it('returns "schedule" when score exactly equals threshold', () => {
    mockScore.mockReturnValue({ overall: 80, dimensions: baseDimensions });
    const result = evaluateContent('Content', 'twitter', 80, 65);
    expect(result.decision).toBe('schedule');
  });

  it('returns "draft" when score between min and auto thresholds', () => {
    mockScore.mockReturnValue({ overall: 72, dimensions: baseDimensions });
    const result = evaluateContent('Decent content', 'instagram', 80, 65);
    expect(result.decision).toBe('draft');
    expect(result.score).toBe(72);
    expect(result.reason).toContain('held for review');
  });

  it('returns "draft" when score exactly equals minScoreThreshold', () => {
    mockScore.mockReturnValue({ overall: 65, dimensions: baseDimensions });
    const result = evaluateContent('Content', 'twitter', 80, 65);
    expect(result.decision).toBe('draft');
  });

  it('returns "reject" when score below minScoreThreshold', () => {
    mockScore.mockReturnValue({ overall: 40, dimensions: baseDimensions });
    const result = evaluateContent('Bad content', 'linkedin', 80, 65);
    expect(result.decision).toBe('reject');
    expect(result.score).toBe(40);
    expect(result.reason).toContain('regeneration');
  });

  it('uses default thresholds (80/65) when not specified', () => {
    mockScore.mockReturnValue({ overall: 70, dimensions: baseDimensions });
    const result = evaluateContent('Content', 'twitter');
    // 70 is between 65 (default min) and 80 (default auto)
    expect(result.decision).toBe('draft');
  });

  it('passes platform to content scorer', () => {
    mockScore.mockReturnValue({ overall: 90, dimensions: baseDimensions });
    evaluateContent('Content', 'tiktok', 80, 65);
    expect(mockScore).toHaveBeenCalledWith('Content', 'tiktok');
  });

  it('handles custom thresholds correctly', () => {
    mockScore.mockReturnValue({ overall: 55, dimensions: baseDimensions });
    // With very low thresholds, 55 should auto-approve
    const result = evaluateContent('Content', 'twitter', 50, 30);
    expect(result.decision).toBe('schedule');
  });

  it('always includes score in result', () => {
    mockScore.mockReturnValue({ overall: 42, dimensions: baseDimensions });
    const result = evaluateContent('Content', 'twitter');
    expect(typeof result.score).toBe('number');
    expect(result.score).toBe(42);
  });

  it('always includes a non-empty reason', () => {
    for (const overall of [90, 70, 30]) {
      mockScore.mockReturnValue({ overall, dimensions: baseDimensions });
      const result = evaluateContent('Content', 'twitter');
      expect(result.reason).toBeTruthy();
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('scoreDimensions', () => {
  it('returns flat record of dimension scores', () => {
    mockScore.mockReturnValue({ overall: 75, dimensions: baseDimensions });
    const dims = scoreDimensions('Content', 'twitter');

    expect(dims.readability).toBe(80);
    expect(dims.engagement).toBe(75);
    expect(dims.platformFit).toBe(85);
    expect(dims.clarity).toBe(70);
    expect(dims.emotional).toBe(65);
    expect(dims.writingQuality).toBe(78);
  });

  it('has exactly 6 dimension keys', () => {
    mockScore.mockReturnValue({ overall: 75, dimensions: baseDimensions });
    const dims = scoreDimensions('Content', 'twitter');
    expect(Object.keys(dims)).toHaveLength(6);
  });

  it('passes platform to scorer', () => {
    mockScore.mockReturnValue({ overall: 75, dimensions: baseDimensions });
    scoreDimensions('Content', 'linkedin');
    expect(mockScore).toHaveBeenCalledWith('Content', 'linkedin');
  });
});
