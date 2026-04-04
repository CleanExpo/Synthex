/**
 * Unit tests — Content Intelligence Blend Model (SYN-631)
 *
 * Covers:
 *  - computeConfidenceLevel at boundary values (0, 15, 30, 45, 60, 90 posts)
 *  - blendProfiles: full trust (alpha=1), zero trust (alpha=0), half-trust (alpha=0.5)
 *  - blendTopics: merged correctly with weighted engagement rates
 *  - blendOptimalTimes: org favoured when alpha >= 0.5
 *  - blendHashtags: correct dedup + ordering
 *  - blendFormatScores: weighted average per format
 */

import {
  computeConfidenceLevel,
  blendProfiles,
  blendTopics,
  blendOptimalTimes,
  blendHashtags,
  blendFormatScores,
  CONFIDENCE_POST_THRESHOLD,
} from '@/lib/content-intelligence/blend';
import type { ContentProfile } from '@/lib/content-intelligence/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_PROFILE: ContentProfile = {
  topTopics: [
    { topic: 'before-after', avgEngagementRate: 0.08, postCount: 12 },
    { topic: 'tip', avgEngagementRate: 0.05, postCount: 8 },
  ],
  optimalTimes: {
    MON: ['09:00', '17:00'],
    FRI: ['12:00'],
  },
  winningHashtags: ['plumbing', 'emergency'],
  contentFormatScores: { video: 0.1, image: 0.06, carousel: 0.07, text: 0.03 },
};

const BASELINE: ContentProfile = {
  topTopics: [
    { topic: 'tip', avgEngagementRate: 0.04, postCount: 100 },
    { topic: 'promotion', avgEngagementRate: 0.03, postCount: 80 },
  ],
  optimalTimes: {
    MON: ['08:00'],
    WED: ['14:00'],
  },
  winningHashtags: ['hvac', 'plumbing', 'tradie'],
  contentFormatScores: { video: 0.06, image: 0.05, carousel: 0.04, text: 0.02 },
};

const EMPTY_PROFILE: ContentProfile = {
  topTopics: [],
  optimalTimes: {},
  winningHashtags: [],
  contentFormatScores: { video: 0, image: 0, carousel: 0, text: 0 },
};

// ── computeConfidenceLevel ────────────────────────────────────────────────────

describe('computeConfidenceLevel', () => {
  it('returns 0 for 0 posts', () => {
    expect(computeConfidenceLevel(0)).toBe(0);
  });

  it('returns 0.25 for 15 posts (1/4 threshold)', () => {
    expect(computeConfidenceLevel(15)).toBeCloseTo(0.25);
  });

  it('returns 0.5 for 30 posts (half threshold)', () => {
    expect(computeConfidenceLevel(30)).toBeCloseTo(0.5);
  });

  it('returns 0.75 for 45 posts (3/4 threshold)', () => {
    expect(computeConfidenceLevel(45)).toBeCloseTo(0.75);
  });

  it('returns 1.0 for exactly 60 posts (full threshold)', () => {
    expect(computeConfidenceLevel(CONFIDENCE_POST_THRESHOLD)).toBe(1.0);
  });

  it('caps at 1.0 for more than 60 posts', () => {
    expect(computeConfidenceLevel(90)).toBe(1.0);
    expect(computeConfidenceLevel(200)).toBe(1.0);
  });
});

// ── blendProfiles ─────────────────────────────────────────────────────────────

describe('blendProfiles', () => {
  it('returns 0 confidence for 0 posts', () => {
    const result = blendProfiles({
      orgProfile: EMPTY_PROFILE,
      baseline: BASELINE,
      postCount: 0,
      industry: 'plumbing-hvac',
    });
    expect(result.confidenceLevel).toBe(0);
    expect(result.postCount).toBe(0);
    expect(result.industry).toBe('plumbing-hvac');
  });

  it('returns full org profile at 60 posts (alpha=1)', () => {
    const result = blendProfiles({
      orgProfile: ORG_PROFILE,
      baseline: BASELINE,
      postCount: 60,
      industry: 'plumbing-hvac',
    });
    expect(result.confidenceLevel).toBe(1.0);
    // At alpha=1, org's best topic should dominate
    const topTopic = result.topTopics[0];
    expect(topTopic?.topic).toBe('before-after');
  });

  it('blends both at 30 posts (alpha=0.5)', () => {
    const result = blendProfiles({
      orgProfile: ORG_PROFILE,
      baseline: BASELINE,
      postCount: 30,
      industry: 'plumbing-hvac',
    });
    expect(result.confidenceLevel).toBeCloseTo(0.5);
    // 'tip' exists in both; its blended rate should be between the two values
    const tip = result.topTopics.find((t) => t.topic === 'tip');
    expect(tip).toBeDefined();
    expect(tip!.avgEngagementRate).toBeGreaterThan(0.04 * 0.5); // > baseline contribution
    expect(tip!.avgEngagementRate).toBeLessThan(0.08); // < pure org value
  });

  it('returns baseline when org profile is empty', () => {
    const result = blendProfiles({
      orgProfile: EMPTY_PROFILE,
      baseline: BASELINE,
      postCount: 0,
      industry: 'general',
    });
    // alpha=0, so purely baseline
    expect(result.topTopics).toHaveLength(BASELINE.topTopics.length);
  });
});

// ── blendTopics ───────────────────────────────────────────────────────────────

describe('blendTopics', () => {
  it('at alpha=0 returns only baseline topics', () => {
    const result = blendTopics(ORG_PROFILE.topTopics, BASELINE.topTopics, 0);
    const topics = result.map((t) => t.topic);
    expect(topics).toContain('tip');
    expect(topics).toContain('promotion');
    // Org-only topics should have 0 contribution
    const beforeAfter = result.find((t) => t.topic === 'before-after');
    expect(beforeAfter?.avgEngagementRate).toBe(0);
  });

  it('at alpha=1 returns only org topics', () => {
    const result = blendTopics(ORG_PROFILE.topTopics, BASELINE.topTopics, 1);
    const beforeAfter = result.find((t) => t.topic === 'before-after');
    expect(beforeAfter?.avgEngagementRate).toBeCloseTo(0.08);
    // Baseline-only topics get 0 contribution
    const promotion = result.find((t) => t.topic === 'promotion');
    expect(promotion?.avgEngagementRate).toBe(0);
  });

  it('at alpha=0.5 blends tip correctly', () => {
    const result = blendTopics(ORG_PROFILE.topTopics, BASELINE.topTopics, 0.5);
    const tip = result.find((t) => t.topic === 'tip');
    // Expected: 0.04 * 0.5 (baseline) + 0.05 * 0.5 (org) = 0.045
    expect(tip?.avgEngagementRate).toBeCloseTo(0.045);
  });

  it('sorts by avgEngagementRate descending', () => {
    const result = blendTopics(ORG_PROFILE.topTopics, BASELINE.topTopics, 0.5);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].avgEngagementRate).toBeGreaterThanOrEqual(
        result[i].avgEngagementRate
      );
    }
  });
});

// ── blendOptimalTimes ─────────────────────────────────────────────────────────

describe('blendOptimalTimes', () => {
  it('at alpha=1 uses org times for shared days', () => {
    const result = blendOptimalTimes(ORG_PROFILE.optimalTimes, BASELINE.optimalTimes, 1);
    expect(result['MON']).toEqual(['09:00', '17:00']); // org's MON times
  });

  it('at alpha=0 uses baseline times for shared days', () => {
    const result = blendOptimalTimes(ORG_PROFILE.optimalTimes, BASELINE.optimalTimes, 0);
    expect(result['MON']).toEqual(['08:00']); // baseline's MON times
  });

  it('includes days from both when org has alpha >= 0.5', () => {
    const result = blendOptimalTimes(ORG_PROFILE.optimalTimes, BASELINE.optimalTimes, 0.5);
    expect(result['FRI']).toBeDefined(); // org-only day
    expect(result['WED']).toBeDefined(); // baseline-only day
  });

  it('falls back to baseline day when org has no times for that day', () => {
    // MON is in both; WED is baseline-only
    const result = blendOptimalTimes({ MON: ['09:00'] }, { MON: ['08:00'], WED: ['14:00'] }, 0.5);
    expect(result['WED']).toEqual(['14:00']); // filled from baseline
  });
});

// ── blendHashtags ─────────────────────────────────────────────────────────────

describe('blendHashtags', () => {
  it('at alpha=1 returns only org hashtags', () => {
    const result = blendHashtags(['plumbing', 'emergency'], ['hvac', 'tradie'], 1);
    expect(result).toEqual(['plumbing', 'emergency']);
  });

  it('at alpha=0 returns only baseline hashtags', () => {
    const result = blendHashtags(['plumbing', 'emergency'], ['hvac', 'tradie'], 0);
    expect(result).toEqual(['hvac', 'tradie']);
  });

  it('deduplicates shared hashtags (org first)', () => {
    const result = blendHashtags(['plumbing', 'emergency'], ['hvac', 'plumbing', 'tradie'], 0.5);
    const plumbingCount = result.filter((h) => h === 'plumbing').length;
    expect(plumbingCount).toBe(1);
    // org-sourced tags appear first
    expect(result.indexOf('plumbing')).toBeLessThan(result.indexOf('hvac'));
  });
});

// ── blendFormatScores ─────────────────────────────────────────────────────────

describe('blendFormatScores', () => {
  it('at alpha=0 returns baseline scores', () => {
    const result = blendFormatScores(
      { video: 0.1, image: 0.06, carousel: 0.07, text: 0.03 },
      { video: 0.06, image: 0.05, carousel: 0.04, text: 0.02 },
      0
    );
    expect(result.video).toBeCloseTo(0.06);
    expect(result.image).toBeCloseTo(0.05);
  });

  it('at alpha=1 returns org scores', () => {
    const result = blendFormatScores(
      { video: 0.1, image: 0.06, carousel: 0.07, text: 0.03 },
      { video: 0.06, image: 0.05, carousel: 0.04, text: 0.02 },
      1
    );
    expect(result.video).toBeCloseTo(0.1);
  });

  it('at alpha=0.5 returns midpoint', () => {
    const result = blendFormatScores(
      { video: 0.1, image: 0.0, carousel: 0.0, text: 0.0 },
      { video: 0.0, image: 0.0, carousel: 0.0, text: 0.0 },
      0.5
    );
    expect(result.video).toBeCloseTo(0.05); // 0.1 * 0.5 + 0 * 0.5
  });

  it('includes all 4 formats in output', () => {
    const result = blendFormatScores(
      ORG_PROFILE.contentFormatScores,
      BASELINE.contentFormatScores,
      0.5
    );
    expect(result).toHaveProperty('video');
    expect(result).toHaveProperty('image');
    expect(result).toHaveProperty('carousel');
    expect(result).toHaveProperty('text');
  });
});
