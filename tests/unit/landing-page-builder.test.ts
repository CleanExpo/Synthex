/**
 * Unit tests for lib/landing-page/
 *
 * Covers:
 *  - Validation: required fields + serviceCategory whitelist
 *  - Slug + canonical URL shape
 *  - JSON-LD: shape, schema.org context, Service+LocalBusiness+Place
 *  - Validators (Aid Rule, category-claim, schema-vs-content, PII leak)
 *  - copyOverride bypasses template but still validates
 *  - HTML embedding of source-of-truth job ID
 *
 * @see SYN-838 (parent: SYN-834 epic)
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  buildLandingPage,
  buildDeterministicCopy,
  buildLandingPageJsonLd,
  validateLandingPageCopy,
  type BrandIdentity,
  type BuildLandingPageInput,
} from '@/lib/landing-page';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const brand: BrandIdentity = {
  name: 'Disaster Recovery',
  legalName: 'Disaster Recovery Pty Ltd',
  url: 'https://disasterrecovery.com.au',
  logoUrl: 'https://disasterrecovery.com.au/logo.png',
  telephone: '+61730000000',
  hq: { lat: -27.4698, lng: 153.0251, addressLocality: 'Brisbane' },
};

function inputFor(
  overrides: Partial<BuildLandingPageInput> = {}
): BuildLandingPageInput {
  return {
    sourceOfTruthJobId: 'job_abc',
    serviceAreaCoverageId: 'cov_123',
    suburb: 'Brisbane CBD',
    postcode: '4000',
    serviceCategory: 'water-damage',
    brand,
    ...overrides,
  };
}

describe('buildLandingPage — validation', () => {
  it('throws on missing sourceOfTruthJobId', () => {
    expect(() =>
      buildLandingPage(inputFor({ sourceOfTruthJobId: '' }))
    ).toThrow(/sourceOfTruthJobId required/);
  });

  it('throws on missing serviceAreaCoverageId', () => {
    expect(() =>
      buildLandingPage(inputFor({ serviceAreaCoverageId: '' }))
    ).toThrow(/serviceAreaCoverageId required/);
  });

  it('throws on missing suburb', () => {
    expect(() => buildLandingPage(inputFor({ suburb: '' }))).toThrow(
      /suburb required/
    );
  });

  it('throws on missing postcode', () => {
    expect(() => buildLandingPage(inputFor({ postcode: '' }))).toThrow(
      /postcode required/
    );
  });

  it('throws on invalid serviceCategory', () => {
    expect(() =>
      buildLandingPage(
        // @ts-expect-error — deliberately invalid
        inputFor({ serviceCategory: 'asbestos' })
      )
    ).toThrow(/serviceCategory must be water-damage, fire, or mould/);
  });

  it('throws when brand identity is incomplete', () => {
    expect(() =>
      buildLandingPage(
        // @ts-expect-error — deliberately invalid
        inputFor({ brand: { ...brand, url: '' } })
      )
    ).toThrow(/brand.name and brand.url required/);
  });
});

describe('buildLandingPage — slug + canonical URL', () => {
  it('builds slug from serviceCategory + suburb', () => {
    const result = buildLandingPage(inputFor());
    expect(result.slug).toBe('water-damage/brisbane-cbd');
    expect(result.canonicalUrl).toBe(
      'https://disasterrecovery.com.au/water-damage/brisbane-cbd/'
    );
  });

  it('honours baseUrl override + strips trailing slashes', () => {
    const result = buildLandingPage(inputFor(), {
      baseUrl: 'https://staging.example.com///',
    });
    expect(result.canonicalUrl).toBe(
      'https://staging.example.com/water-damage/brisbane-cbd/'
    );
  });

  it('handles different service categories', () => {
    const fire = buildLandingPage(inputFor({ serviceCategory: 'fire' }));
    expect(fire.slug).toBe('fire/brisbane-cbd');
    const mould = buildLandingPage(
      inputFor({ serviceCategory: 'mould', suburb: 'Mount Cotton' })
    );
    expect(mould.slug).toBe('mould/mount-cotton');
  });
});

describe('buildLandingPage — happy path', () => {
  it('returns ok=true for the deterministic template', () => {
    const result = buildLandingPage(inputFor());
    expect(result.ok).toBe(true);
    expect(result.validations.filter(v => v.severity === 'block')).toHaveLength(
      0
    );
  });

  it('embeds source-of-truth job ID as an HTML comment', () => {
    const result = buildLandingPage(inputFor());
    expect(result.html).toContain('source-of-truth-job-id: job_abc');
  });

  it('html mentions the suburb + postcode', () => {
    const result = buildLandingPage(inputFor());
    expect(result.html).toContain('Brisbane CBD');
    expect(result.html).toContain('4000');
  });

  it('html escapes HTML in inputs (defence-in-depth)', () => {
    const result = buildLandingPage(
      inputFor({ sourceOfTruthJobId: 'job<script>x</script>' })
    );
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });
});

describe('buildLandingPage — JSON-LD shape', () => {
  it('emits a graph with LocalBusiness + Service nodes', () => {
    const result = buildLandingPage(inputFor());
    expect(result.jsonLd['@context']).toBe('https://schema.org');
    const graph = result.jsonLd['@graph'] as Array<Record<string, unknown>>;
    expect(graph).toHaveLength(2);
    expect(graph.find(n => n['@type'] === 'LocalBusiness')).toBeDefined();
    expect(graph.find(n => n['@type'] === 'Service')).toBeDefined();
  });

  it('Service.areaServed is the suburb Place', () => {
    const result = buildLandingPage(inputFor({ suburb: 'Mansfield' }));
    const graph = result.jsonLd['@graph'] as Array<Record<string, unknown>>;
    const service = graph.find(n => n['@type'] === 'Service')!;
    const areaServed = service.areaServed as Record<string, unknown>;
    expect(areaServed['@type']).toBe('Place');
    expect(areaServed.name).toBe('Mansfield');
  });

  it('Service.serviceType matches the category label', () => {
    const result = buildLandingPage(inputFor({ serviceCategory: 'mould' }));
    const graph = result.jsonLd['@graph'] as Array<Record<string, unknown>>;
    const service = graph.find(n => n['@type'] === 'Service')!;
    expect(service.serviceType).toBe('mould remediation');
  });

  it('does not embed contractor PII in the JSON-LD (brand phone is allowed)', () => {
    const result = buildLandingPage(inputFor());
    const serialised = JSON.stringify(result.jsonLd);
    expect(serialised).not.toMatch(/contractor/i);
    // Brand telephone IS allowed (it's the LocalBusiness contact, not contractor PII).
    // Assert by exact match on brand.telephone — anything else phone-shaped would be a leak.
    expect(serialised).toContain(brand.telephone);
  });
});

describe('buildLandingPage — validators via copyOverride', () => {
  it('blocks Aid-Rule violation', () => {
    const result = buildLandingPage(inputFor(), {
      copyOverride: {
        headline: 'Water damage in Brisbane CBD',
        intro:
          'AI restores your property after a flood — water damage gone fast.',
        bodyParagraphs: ['Water damage handled.'],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.validations.find(v => v.rule === 'aid-rule')?.severity).toBe(
      'block'
    );
  });

  it('blocks category-claim without verificationGateState', () => {
    const findings = validateLandingPageCopy({
      copy: {
        headline: 'Water damage in Brisbane CBD',
        intro: 'The leading water damage team in Brisbane.',
        bodyParagraphs: ['Water damage handled.'],
      },
      serviceCategory: 'water-damage',
    });
    expect(findings.find(f => f.rule === 'category-claim')?.severity).toBe(
      'block'
    );
  });

  it('downgrades category-claim to warn when verificationGateState=verified', () => {
    const findings = validateLandingPageCopy({
      copy: {
        headline: 'Water damage in Brisbane CBD',
        intro: 'The leading water damage team in Brisbane.',
        bodyParagraphs: ['Water damage handled.'],
      },
      serviceCategory: 'water-damage',
      verificationGateState: 'verified',
    });
    expect(findings.find(f => f.rule === 'category-claim')?.severity).toBe(
      'warn'
    );
  });

  it('blocks schema-vs-content mismatch (Q3.2.3 A4)', () => {
    const result = buildLandingPage(inputFor({ serviceCategory: 'fire' }), {
      copyOverride: {
        headline: 'Premium service in Brisbane CBD',
        intro: 'Professional restoration in Brisbane CBD.',
        bodyParagraphs: ['Restoration delivered.'],
      },
    });
    expect(result.ok).toBe(false);
    expect(
      result.validations.find(v => v.rule === 'schema-content-match')?.severity
    ).toBe('block');
  });

  it('blocks copy containing a phone-number-shaped string', () => {
    const result = buildLandingPage(inputFor(), {
      copyOverride: {
        headline: 'Water damage in Brisbane CBD',
        intro: 'Call 0412 345 678 for water damage help.',
        bodyParagraphs: ['Water damage handled.'],
      },
    });
    expect(result.ok).toBe(false);
    expect(
      result.validations.find(v => v.rule === 'pii-phone-leak')?.severity
    ).toBe('block');
  });

  it('blocks copy containing a street-address-shaped string', () => {
    const result = buildLandingPage(inputFor(), {
      copyOverride: {
        headline: 'Water damage in Brisbane CBD',
        intro: 'Visit us at 123 Queen Street for water damage help.',
        bodyParagraphs: ['Water damage handled.'],
      },
    });
    expect(result.ok).toBe(false);
    expect(
      result.validations.find(v => v.rule === 'pii-address-leak')?.severity
    ).toBe('block');
  });

  it('blocks forbidden contractor-name substrings', () => {
    const findings = validateLandingPageCopy({
      copy: {
        headline: 'Water damage in Brisbane CBD',
        intro: 'Acme Restoration Pty Ltd handles water damage.',
        bodyParagraphs: ['Water damage handled.'],
      },
      serviceCategory: 'water-damage',
      forbiddenPiiSubstrings: ['Acme Restoration Pty Ltd'],
    });
    expect(findings.find(f => f.rule === 'pii-substring-leak')?.severity).toBe(
      'block'
    );
  });
});

describe('buildDeterministicCopy', () => {
  it('produces brand-voice-safe template that passes validators', () => {
    const copy = buildDeterministicCopy({
      brandName: 'Disaster Recovery',
      serviceCategory: 'water-damage',
      suburb: 'Brisbane CBD',
      postcode: '4000',
    });
    const findings = validateLandingPageCopy({
      copy,
      serviceCategory: 'water-damage',
    });
    expect(findings.filter(f => f.severity === 'block')).toEqual([]);
  });

  it('mentions the suburb + postcode in the headline', () => {
    const copy = buildDeterministicCopy({
      brandName: 'Disaster Recovery',
      serviceCategory: 'fire',
      suburb: 'Mansfield',
      postcode: '4122',
    });
    expect(copy.headline).toContain('Mansfield');
    expect(copy.headline).toContain('4122');
  });
});

describe('buildLandingPageJsonLd standalone', () => {
  it('produces a valid graph for direct callers', () => {
    const ld = buildLandingPageJsonLd({
      brand,
      serviceCategory: 'water-damage',
      suburb: 'Brisbane CBD',
      postcode: '4000',
      canonicalUrl:
        'https://disasterrecovery.com.au/water-damage/brisbane-cbd/',
    });
    expect(ld['@context']).toBe('https://schema.org');
    expect(Array.isArray(ld['@graph'])).toBe(true);
  });
});
