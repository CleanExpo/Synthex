/**
 * Unit tests — canonical UTM builder — SYN-493
 *
 * Covers: happy path, existing-query-string preservation, omitted optionals,
 * no double-encoding, validation, and interop with the read-side classifier
 * (`classifyChannel`) so links the builder produces stay correctly bucketed.
 */

import { buildUtmUrl } from '@/lib/utm/build-utm-url';
import { classifyChannel } from '@/lib/attribution/channels';

describe('SYN-493 — buildUtmUrl', () => {
  it('happy path — appends the required utm trio', () => {
    const url = buildUtmUrl('https://synthex.social/dashboard/geo-score', {
      source: 'synthex_email',
      medium: 'geo_score_monthly',
      campaign: 'geo_score_improved',
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      'https://synthex.social/dashboard/geo-score'
    );
    expect(parsed.searchParams.get('utm_source')).toBe('synthex_email');
    expect(parsed.searchParams.get('utm_medium')).toBe('geo_score_monthly');
    expect(parsed.searchParams.get('utm_campaign')).toBe('geo_score_improved');
  });

  it('preserves an existing query string on the base URL', () => {
    const url = buildUtmUrl('https://synthex.social/refer?ref=org_123&story=st_9', {
      source: 'monthly_story',
      medium: 'referral',
      campaign: 'client_advocacy',
    });
    const parsed = new URL(url);
    // Pre-existing non-UTM params survive untouched.
    expect(parsed.searchParams.get('ref')).toBe('org_123');
    expect(parsed.searchParams.get('story')).toBe('st_9');
    // Canonical trio is appended alongside them.
    expect(parsed.searchParams.get('utm_source')).toBe('monthly_story');
    expect(parsed.searchParams.get('utm_medium')).toBe('referral');
    expect(parsed.searchParams.get('utm_campaign')).toBe('client_advocacy');
  });

  it('omits optional term/content when not supplied', () => {
    const url = buildUtmUrl('https://synthex.social/benchmark', {
      source: 'synthex-attribution',
      medium: 'gbp_post',
      campaign: 'content_attribution',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.has('utm_term')).toBe(false);
    expect(parsed.searchParams.has('utm_content')).toBe(false);
  });

  it('includes optional term/content when supplied', () => {
    const url = buildUtmUrl('https://synthex.social/x', {
      source: 's',
      medium: 'm',
      campaign: 'c',
      term: 'ai visibility',
      content: 'cta-a',
    });
    const parsed = new URL(url);
    // Space is encoded exactly once (%20 / '+'), not double-encoded.
    expect(parsed.searchParams.get('utm_term')).toBe('ai visibility');
    expect(parsed.searchParams.get('utm_content')).toBe('cta-a');
    expect(url).not.toContain('%2520'); // no double-encoding
  });

  it('rejects an empty required param', () => {
    expect(() =>
      buildUtmUrl('https://synthex.social/x', {
        source: '',
        medium: 'm',
        campaign: 'c',
      })
    ).toThrow();
  });

  it('classifyChannel buckets a built link by its utm_medium', () => {
    // owned medium → owned bucket
    const owned = buildUtmUrl('https://synthex.social/x', {
      source: 's',
      medium: 'email',
      campaign: 'c',
    });
    expect(
      classifyChannel(new URL(owned).searchParams.get('utm_medium'))
    ).toBe('owned');

    // paid medium → paid bucket
    const paid = buildUtmUrl('https://synthex.social/x', {
      source: 's',
      medium: 'cpc',
      campaign: 'c',
    });
    expect(
      classifyChannel(new URL(paid).searchParams.get('utm_medium'))
    ).toBe('paid');

    // unknown medium → organic fallback (matches legacy classifier behaviour)
    const organic = buildUtmUrl('https://synthex.social/x', {
      source: 's',
      medium: 'referral',
      campaign: 'c',
    });
    expect(
      classifyChannel(new URL(organic).searchParams.get('utm_medium'))
    ).toBe('organic');
  });
});
