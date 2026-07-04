/**
 * Unit tests — SYN-313: content-planner structured-output conversion.
 *
 * `parseBrief` now takes the schema-validated `parsed` object off the provider
 * response (no strip-fence + JSON.parse). It parses a known payload and
 * degrades to a minimal brief on a malformed one.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { parseBrief } from '@/lib/ai/content-planner';

describe('content-planner parseBrief — structured output (SYN-313)', () => {
  const goal = 'Drive trial signups from LinkedIn';

  it('maps a valid parsed payload into a ContentBrief', () => {
    const parsed = {
      goal,
      targetAudience: 'B2B marketing leads',
      contentPillars: ['Automation', 'ROI', 'Trust'],
      tone: 'authoritative',
      platformConstraints: { linkedin: 'Long-form, no hashtags spam' },
      keyMessages: ['Save 10 hours a week'],
      contentRequests: [
        {
          type: 'post',
          platform: 'linkedin',
          topic: '5 ways AI saves marketers time',
          tone: 'professional',
          keywords: ['ai', 'marketing'],
          targetAudience: 'B2B marketing leads',
          includeEmojis: false,
          includeHashtags: true,
          includeCTA: true,
        },
      ],
    };

    const brief = parseBrief(parsed, goal);

    expect(brief.goal).toBe(goal);
    expect(brief.targetAudience).toBe('B2B marketing leads');
    expect(brief.contentPillars).toEqual(['Automation', 'ROI', 'Trust']);
    expect(brief.contentRequests).toHaveLength(1);
    expect(brief.contentRequests[0].platform).toBe('linkedin');
    expect(brief.contentRequests[0].topic).toBe(
      '5 ways AI saves marketers time'
    );
  });

  it('degrades to a minimal fallback brief on a malformed payload', () => {
    const brief = parseBrief({ not: 'a brief' }, goal);

    expect(brief.goal).toBe(goal);
    expect(brief.contentRequests).toHaveLength(1);
    expect(brief.contentRequests[0].platform).toBe('linkedin');
    expect(brief.contentRequests[0].type).toBe('post');
    // fallback keyMessages echo the original goal
    expect(brief.keyMessages).toEqual([goal]);
  });

  it('degrades to fallback when parsed is null', () => {
    const brief = parseBrief(null, goal);
    expect(brief.contentRequests).toHaveLength(1);
    expect(brief.goal).toBe(goal);
  });
});
