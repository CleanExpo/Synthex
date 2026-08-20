import {
  avg,
  buildRecommendations,
  buildScore,
  contentMixFromTypes,
  engagementRate,
  inferPostingFrequency,
  profileCompleteness,
} from '@/lib/profile-analyser/scoring';
import type { ContentInsights, ProfileScore } from '@/lib/profile-analyser/types';

describe('scoring helpers', () => {
  it('averages integers and returns 0 for an empty list', () => {
    expect(avg([10, 20, 30])).toBe(20);
    expect(avg([])).toBe(0);
  });

  it('returns 0 engagement when there are no followers', () => {
    expect(engagementRate(50, 0)).toBe(0);
  });

  it('caps engagement rate at 100', () => {
    expect(engagementRate(500, 10)).toBe(100);
  });

  it('computes an overall score as the mean of four components', () => {
    const score = buildScore({
      completeness: 80,
      postsAnalysed: 15,
      engagementRate: 5,
      followers: 5000,
    });
    expect(score.profileCompleteness).toBe(80);
    expect(score.contentConsistency).toBe(50);
    expect(score.audienceEngagement).toBe(50);
    expect(score.growthVelocity).toBe(50);
    expect(score.overall).toBe(58);
  });

  it('infers posting frequency from dated posts', () => {
    expect(
      inferPostingFrequency(4, [
        '2026-08-01T00:00:00.000Z',
        '2026-08-03T00:00:00.000Z',
        '2026-08-05T00:00:00.000Z',
        '2026-08-07T00:00:00.000Z',
      ])
    ).toBe('4–5 times/week');
  });

  it('builds a content mix that sums to 100 when types are even', () => {
    const mix = contentMixFromTypes(['text', 'image', 'video', 'link']);
    expect(mix.text + mix.image + mix.video + mix.link).toBe(100);
  });

  it('scores completeness from available profile fields', () => {
    expect(
      profileCompleteness({
        hasName: true,
        hasHeadline: true,
        followers: 10,
        connections: 50,
      })
    ).toBe(100);
    expect(
      profileCompleteness({
        hasName: false,
        hasHeadline: false,
        followers: 0,
      })
    ).toBe(40);
  });

  it('recommends profile completion and video when those scores are low', () => {
    const score: ProfileScore = {
      overall: 40,
      profileCompleteness: 50,
      contentConsistency: 40,
      audienceEngagement: 20,
      growthVelocity: 10,
    };
    const content: ContentInsights = {
      postingFrequency: '1 time/week or less',
      primaryTopics: ['Flood'],
      contentMix: { text: 80, image: 20, video: 0, link: 0 },
      bestPostingTime: 'Tuesday',
      recommendedHashtags: ['#LocalSEO'],
    };
    const recs = buildRecommendations('linkedin', score, content, 200);
    expect(recs.some(r => r.includes('headline'))).toBe(true);
    expect(recs.some(r => r.includes('video'))).toBe(true);
    expect(recs.some(r => r.includes('#LocalSEO'))).toBe(true);
  });
});
