/**
 * Tests for `lib/remotion/brand-registry`. Confirms the BrandContent ↔
 * BrandConfig bridge resolves correctly in both directions and handles the
 * known divergence (`'ccw'` exists in BrandConfig but has no BrandContent).
 *
 * Linear: SYN-898
 */

import { brands, type BrandSlug } from '@unite-group/brand-config';

import { BRAND_CONTENT } from '../../lib/remotion/brand-content';
import {
  BRAND_SLUG_MAP,
  getBrandConfig,
  getBrandContent,
  getBrandSlug,
  getPortfolioBrand,
} from '../../lib/remotion/brand-registry';

describe('lib/remotion/brand-registry', () => {
  describe('BRAND_SLUG_MAP', () => {
    it('every key matches an existing BrandContent.id', () => {
      const contentIds = new Set(BRAND_CONTENT.map(b => b.id));
      for (const contentId of Object.keys(BRAND_SLUG_MAP)) {
        expect(contentIds.has(contentId)).toBe(true);
      }
    });

    it('every value resolves to a real BrandConfig in the package', () => {
      for (const slug of Object.values(BRAND_SLUG_MAP)) {
        expect(brands[slug]).toBeDefined();
        expect(brands[slug].slug).toBe(slug);
      }
    });

    it('is frozen (cannot be mutated at runtime)', () => {
      expect(Object.isFrozen(BRAND_SLUG_MAP)).toBe(true);
    });
  });

  describe('getBrandConfig', () => {
    it('resolves BrandContent IDs to their BrandConfig', () => {
      expect(getBrandConfig('disaster-recovery')?.slug).toBe('dr');
      expect(getBrandConfig('restore-assist')?.slug).toBe('ra');
      expect(getBrandConfig('unite-group')?.slug).toBe('unite');
      expect(getBrandConfig('synthex')?.slug).toBe('synthex');
      expect(getBrandConfig('carsi')?.slug).toBe('carsi');
      expect(getBrandConfig('nrpg')?.slug).toBe('nrpg');
    });

    it('returns undefined for unknown IDs', () => {
      expect(getBrandConfig('not-a-brand')).toBeUndefined();
      expect(getBrandConfig('')).toBeUndefined();
    });
  });

  describe('getBrandSlug', () => {
    it('returns the canonical slug for a BrandContent.id', () => {
      expect(getBrandSlug('disaster-recovery')).toBe('dr');
      expect(getBrandSlug('restore-assist')).toBe('ra');
      expect(getBrandSlug('unite-group')).toBe('unite');
    });

    it('returns undefined for unmapped IDs', () => {
      expect(getBrandSlug('mystery-brand')).toBeUndefined();
    });
  });

  describe('getBrandContent', () => {
    it('resolves a slug back to its BrandContent', () => {
      expect(getBrandContent('dr')?.id).toBe('disaster-recovery');
      expect(getBrandContent('ra')?.id).toBe('restore-assist');
      expect(getBrandContent('unite')?.id).toBe('unite-group');
      expect(getBrandContent('synthex')?.id).toBe('synthex');
    });

    it('returns undefined for ccw (BrandConfig only — no BrandContent)', () => {
      // CCW exists in @unite-group/brand-config but is not in BRAND_CONTENT
      // because Synthex's video pipeline does not currently produce CCW
      // promotional videos. See brand-registry.ts module header.
      expect(getBrandContent('ccw')).toBeUndefined();
    });
  });

  describe('getPortfolioBrand', () => {
    it('returns both systems together for a mapped brand', () => {
      const dr = getPortfolioBrand('dr');
      expect(dr).toBeDefined();
      expect(dr?.slug).toBe('dr');
      expect(dr?.config.slug).toBe('dr');
      expect(dr?.content?.id).toBe('disaster-recovery');
    });

    it('returns config without content for ccw', () => {
      const ccw = getPortfolioBrand('ccw');
      expect(ccw).toBeDefined();
      expect(ccw?.slug).toBe('ccw');
      expect(ccw?.config.slug).toBe('ccw');
      expect(ccw?.content).toBeUndefined();
    });

    it('returns undefined for an invalid slug', () => {
      // Force-cast to test runtime behaviour even though TS would block this
      expect(getPortfolioBrand('not-a-slug' as BrandSlug)).toBeUndefined();
    });
  });
});
