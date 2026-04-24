/**
 * Unit tests — PostAttributionFooter — SYN-779
 *
 * Pure-function coverage: platform placement (GBP body, Instagram first
 * comment, Facebook/LinkedIn body, unknown → no-op) and feature-flag off.
 */

import { buildAttribution } from '@/components/marketing/PostAttributionFooter';

describe('SYN-779 — PostAttributionFooter.buildAttribution', () => {
  const BENCHMARK_HOST = 'synthex.social/benchmark';
  const originalFlag = process.env.ENABLE_ATTRIBUTION_FOOTER;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.ENABLE_ATTRIBUTION_FOOTER;
    } else {
      process.env.ENABLE_ATTRIBUTION_FOOTER = originalFlag;
    }
  });

  describe('GBP (Google Business Profile)', () => {
    it('appends attribution to body with gbp_post medium', () => {
      const out = buildAttribution({
        platform: 'gbp',
        existingBody: 'Hello customers.',
      });
      expect(out.body).toContain('Hello customers.');
      expect(out.body).toContain('AI-optimised with Synthex');
      expect(out.body).toContain(BENCHMARK_HOST);
      expect(out.body).toContain('utm_medium=gbp_post');
      expect(out.firstComment).toBeUndefined();
    });

    it('handles empty existing body without leading newlines', () => {
      const out = buildAttribution({ platform: 'gbp', existingBody: '' });
      expect(out.body).toMatch(/^AI-optimised with Synthex/);
    });
  });

  describe('Instagram', () => {
    it('leaves caption untouched and returns attribution as first comment', () => {
      const caption = 'Fresh drop #summer #local';
      const out = buildAttribution({
        platform: 'instagram',
        existingBody: caption,
      });
      expect(out.body).toBe(caption);
      expect(out.firstComment).toContain('AI-optimised with Synthex');
      expect(out.firstComment).toContain(BENCHMARK_HOST);
      expect(out.firstComment).toContain('utm_medium=ig_post');
    });
  });

  describe('Facebook', () => {
    it('appends attribution to body with fb_post medium', () => {
      const out = buildAttribution({
        platform: 'facebook',
        existingBody: 'Our weekly update.',
      });
      expect(out.body).toContain('Our weekly update.');
      expect(out.body).toContain('utm_medium=fb_post');
      expect(out.firstComment).toBeUndefined();
    });
  });

  describe('LinkedIn', () => {
    it('appends attribution to body with li_post medium', () => {
      const out = buildAttribution({
        platform: 'linkedin',
        existingBody: 'Industry insight:',
      });
      expect(out.body).toContain('Industry insight:');
      expect(out.body).toContain('utm_medium=li_post');
    });
  });

  describe('Unknown / unsupported platform', () => {
    it('returns body untouched and no first comment', () => {
      const out = buildAttribution({
        platform: 'mastodon',
        existingBody: 'Toot toot.',
      });
      expect(out.body).toBe('Toot toot.');
      expect(out.firstComment).toBeUndefined();
    });
  });

  describe('Feature flag ENABLE_ATTRIBUTION_FOOTER', () => {
    it('when "false" — returns body unchanged for every platform', () => {
      process.env.ENABLE_ATTRIBUTION_FOOTER = 'false';
      const platforms = ['gbp', 'instagram', 'facebook', 'linkedin'];
      for (const platform of platforms) {
        const out = buildAttribution({
          platform,
          existingBody: 'original',
        });
        expect(out.body).toBe('original');
        expect(out.firstComment).toBeUndefined();
      }
    });

    it('when "true" — attribution is applied (default behaviour)', () => {
      process.env.ENABLE_ATTRIBUTION_FOOTER = 'true';
      const out = buildAttribution({
        platform: 'gbp',
        existingBody: 'hi',
      });
      expect(out.body).toContain('AI-optimised with Synthex');
    });

    it('when unset — defaults to enabled', () => {
      delete process.env.ENABLE_ATTRIBUTION_FOOTER;
      const out = buildAttribution({
        platform: 'gbp',
        existingBody: 'hi',
      });
      expect(out.body).toContain('AI-optimised with Synthex');
    });
  });
});
