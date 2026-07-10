/**
 * Unit coverage for the "Featured in Synthex" programme primitives (SYN-508).
 * Pure functions — no DB, no network.
 */
import {
  FEATURED_PROGRAMME_STATUSES,
  DEFAULT_FEATURED_STATUS,
  isFeaturedProgrammeStatus,
  canOptIn,
  shouldShowFeaturedBadge,
  extractBestMetric,
  buildOptInSlackMessage,
  PROGRAMME_BENEFITS,
} from '@/lib/videos/featuredProgramme';

describe('featuredProgramme — status vocabulary', () => {
  it('exposes exactly the four lifecycle states in order', () => {
    expect(FEATURED_PROGRAMME_STATUSES).toEqual([
      'not_applied',
      'applied',
      'in_production',
      'published',
    ]);
    expect(DEFAULT_FEATURED_STATUS).toBe('not_applied');
  });

  it('isFeaturedProgrammeStatus narrows valid values only', () => {
    expect(isFeaturedProgrammeStatus('applied')).toBe(true);
    expect(isFeaturedProgrammeStatus('published')).toBe(true);
    expect(isFeaturedProgrammeStatus('nope')).toBe(false);
    expect(isFeaturedProgrammeStatus(null)).toBe(false);
    expect(isFeaturedProgrammeStatus(42)).toBe(false);
  });
});

describe('featuredProgramme — canOptIn (idempotency guard)', () => {
  it('allows opt-in only from not_applied / null / undefined', () => {
    expect(canOptIn('not_applied')).toBe(true);
    expect(canOptIn(null)).toBe(true);
    expect(canOptIn(undefined)).toBe(true);
  });
  it('blocks re-opt-in once applied or further along', () => {
    expect(canOptIn('applied')).toBe(false);
    expect(canOptIn('in_production')).toBe(false);
    expect(canOptIn('published')).toBe(false);
  });
});

describe('featuredProgramme — shouldShowFeaturedBadge', () => {
  it('shows the badge only when published', () => {
    expect(shouldShowFeaturedBadge('published')).toBe(true);
    expect(shouldShowFeaturedBadge('applied')).toBe(false);
    expect(shouldShowFeaturedBadge('not_applied')).toBe(false);
    expect(shouldShowFeaturedBadge(null)).toBe(false);
    expect(shouldShowFeaturedBadge(undefined)).toBe(false);
  });
});

describe('featuredProgramme — extractBestMetric', () => {
  it('returns null for empty / non-array input', () => {
    expect(extractBestMetric(null)).toBeNull();
    expect(extractBestMetric([])).toBeNull();
    expect(extractBestMetric('not-an-array')).toBeNull();
    expect(extractBestMetric([{ nope: 1 }])).toBeNull();
  });

  it('picks the highlight with the largest positive change', () => {
    const highlights = [
      { metric: 'reach', value: '1.2k', change: '+4%' },
      { metric: 'engagement rate', value: '6.4%', change: '+18%' },
      { metric: 'followers', value: 320, change: 2 },
    ];
    expect(extractBestMetric(highlights)).toBe('6.4% engagement rate');
  });

  it('falls back to a well-formed highlight when change is absent', () => {
    expect(extractBestMetric([{ metric: 'posts published', value: 12 }])).toBe(
      '12 posts published'
    );
  });

  it('handles a metric with no value', () => {
    expect(extractBestMetric([{ metric: 'top platform: Instagram' }])).toBe(
      'top platform: Instagram'
    );
  });
});

describe('featuredProgramme — buildOptInSlackMessage', () => {
  it('includes client name and best metric', () => {
    const { text } = buildOptInSlackMessage({
      clientName: 'Acme Roofing',
      bestMetric: '6.4% engagement rate',
    });
    expect(text).toContain('Acme Roofing');
    expect(text).toContain('6.4% engagement rate');
    expect(text).toContain('applied');
  });

  it('omits the metric line when none is available', () => {
    const { text } = buildOptInSlackMessage({
      clientName: 'Acme Roofing',
      bestMetric: null,
    });
    expect(text).toContain('Acme Roofing');
    expect(text).not.toContain('Best metric:');
  });
});

describe('featuredProgramme — benefits copy', () => {
  it('exposes exactly the three programme benefit bullets', () => {
    expect(PROGRAMME_BENEFITS).toEqual([
      'Free professional video',
      'Indexed by Google',
      'Linked from your Authority Hub',
    ]);
  });
});
