/**
 * Unit tests — lib/eeat/digest-summary.ts — SYN-510
 *
 * Validates the pure aggregator that folds the existing E-E-A-T content scorer
 * across an org's recent content into the concise summary surfaced in the
 * Weekly Digest (average score + top improvement opportunities). No I/O — the
 * cron route supplies the org-scoped content.
 */

import {
  summariseContentEEAT,
  type EEATDigestSummary,
} from '@/lib/eeat/digest-summary';

describe('summariseContentEEAT', () => {
  it('returns null when there is no content', () => {
    expect(summariseContentEEAT([])).toBeNull();
  });

  it('returns null when all content is empty/whitespace', () => {
    expect(summariseContentEEAT(['', '   ', '\n'])).toBeNull();
  });

  it('produces a score and up to 3 opportunities for weak content', () => {
    const summary = summariseContentEEAT([
      'Buy our product now. It is great.',
      'Cheap deals today only.',
    ]) as EEATDigestSummary;

    expect(summary).not.toBeNull();
    expect(summary.postCount).toBe(2);
    expect(summary.averageScore).toBeGreaterThanOrEqual(0);
    expect(summary.averageScore).toBeLessThanOrEqual(100);
    // Weak marketing copy misses many E-E-A-T signals, so opportunities surface.
    expect(summary.topOpportunities.length).toBeGreaterThan(0);
    expect(summary.topOpportunities.length).toBeLessThanOrEqual(3);
    summary.topOpportunities.forEach((o) => expect(typeof o).toBe('string'));
  });

  it('ignores empty entries when counting posts', () => {
    const summary = summariseContentEEAT([
      'We tested this in March 2026 and found a 42% improvement.',
      '',
      '   ',
    ]) as EEATDigestSummary;

    expect(summary.postCount).toBe(1);
  });

  it('scores richer E-E-A-T content higher than thin content', () => {
    const thin = summariseContentEEAT([
      'Great product. Buy it.',
    ]) as EEATDigestSummary;

    const rich = summariseContentEEAT([
      'Written by Dr Jane Smith, PhD. In our case study we helped an actual client. ' +
        'Research shows a 42% improvement in March 2026. According to Google, this ' +
        'methodology works. Contact us at team@example.com. Updated 15/03/2026. ' +
        'Please consult a professional. We have 12 years of experience serving 5,000 customers.',
    ]) as EEATDigestSummary;

    expect(rich.averageScore).toBeGreaterThan(thin.averageScore);
  });
});
