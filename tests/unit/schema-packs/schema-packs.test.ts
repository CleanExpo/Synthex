/**
 * Kit K3 schema packs.
 *
 * SEAM: the pure pack builders in lib/schema-packs, called with typed facts.
 *
 * CATCHES: a SoftwareApplication reported as Google-eligible without a real
 * rating or review, or without offers.price; an applicationCategory Google
 * does not accept; Course or FAQ markup reported as earning a Google rich
 * result after Google retired them; a CARSI pack carrying a national
 * recognition, AQF or RTO claim; a breadcrumb list with gaps in position.
 *
 * MISSES: Google's Rich Results Test and other engines' parsers (no network);
 * whether the facts passed in are true (that is the client manifest's job).
 */

import {
  AccreditationClaimError,
  buildBreadcrumbList,
  buildCourse,
  buildFaqPage,
  buildOrganization,
  buildSoftwareApplication,
  courseProviderPack,
  softwareProductPack,
} from '@/lib/schema-packs';

const CARSI = { name: 'CARSI', url: 'https://carsi.com.au' };
const RA = { name: 'RestoreAssist', url: 'https://restoreassist.app' };

describe('buildOrganization', () => {
  it('emits an Organization with a stable @id and only the facts given', () => {
    const org = buildOrganization({
      ...RA,
      sameAs: ['https://www.linkedin.com/company/restoreassist'],
    });
    expect(org['@type']).toBe('Organization');
    expect(org['@id']).toBe('https://restoreassist.app#organization');
    expect(org.sameAs).toEqual([
      'https://www.linkedin.com/company/restoreassist',
    ]);
    expect(org).not.toHaveProperty('telephone');
    expect(org).not.toHaveProperty('address');
  });

  it('can be typed as EducationalOrganization', () => {
    expect(
      buildOrganization(CARSI, { type: 'EducationalOrganization' })['@type']
    ).toBe('EducationalOrganization');
  });
});

describe('buildBreadcrumbList', () => {
  it('numbers positions from 1 with no gaps', () => {
    const list = buildBreadcrumbList([
      { name: 'Home', url: 'https://carsi.com.au' },
      { name: 'Courses', url: 'https://carsi.com.au/courses' },
      { name: 'Water damage', url: 'https://carsi.com.au/courses/water' },
    ]);
    expect(
      (list.itemListElement as Array<{ position: number }>).map(i => i.position)
    ).toEqual([1, 2, 3]);
  });

  it('refuses an empty trail', () => {
    expect(() => buildBreadcrumbList([])).toThrow();
  });
});

describe('buildSoftwareApplication', () => {
  const base = {
    name: 'RestoreAssist',
    url: 'https://restoreassist.app',
    applicationCategory: 'BusinessApplication' as const,
    operatingSystem: 'Web',
  };

  it('is not Google-eligible without a rating or review, even with a price', () => {
    const out = buildSoftwareApplication({
      ...base,
      offers: { price: 0, priceCurrency: 'AUD' },
    });
    expect(out.googleRichResult.eligible).toBe(false);
    expect(out.googleRichResult.missing).toEqual(['aggregateRating_or_review']);
    expect(out.jsonLd).not.toHaveProperty('aggregateRating');
  });

  it('is not Google-eligible without offers.price', () => {
    const out = buildSoftwareApplication({
      ...base,
      rating: { ratingValue: 4.8, ratingCount: 12 },
    });
    expect(out.googleRichResult.eligible).toBe(false);
    expect(out.googleRichResult.missing).toContain('offers.price');
  });

  it('is eligible with a real rating and a price', () => {
    const out = buildSoftwareApplication({
      ...base,
      offers: { price: 0, priceCurrency: 'AUD' },
      rating: { ratingValue: 4.8, ratingCount: 12 },
    });
    expect(out.googleRichResult).toEqual({ eligible: true, missing: [] });
    expect(out.jsonLd.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.8,
      ratingCount: 12,
    });
  });

  it('refuses a rating with no ratings behind it', () => {
    expect(() =>
      buildSoftwareApplication({
        ...base,
        rating: { ratingValue: 5, ratingCount: 0 },
      })
    ).toThrow();
  });

  it('refuses an applicationCategory Google does not accept', () => {
    expect(() =>
      buildSoftwareApplication({
        ...base,
        applicationCategory: 'RestorationApplication' as never,
      })
    ).toThrow();
  });
});

describe('buildCourse and buildFaqPage report retired Google features honestly', () => {
  it('Course markup is built but never reported as a Google rich result', () => {
    const out = buildCourse(
      {
        name: 'Water Damage Restoration',
        description: 'Practical training for restoration technicians.',
        url: 'https://carsi.com.au/courses/water',
      },
      buildOrganization(CARSI, { type: 'EducationalOrganization' })
    );
    expect(out.jsonLd['@type']).toBe('Course');
    expect(out.jsonLd.provider).toEqual({
      '@id': 'https://carsi.com.au#organization',
    });
    expect(out.googleRichResult.eligible).toBe(false);
    expect(out.googleRichResult.reason).toMatch(/2025-09-09/);
  });

  it('FAQPage markup is built but never reported as a Google rich result', () => {
    const out = buildFaqPage([
      { question: 'How long is the trial?', answer: 'Fourteen days.' },
    ]);
    expect(out.jsonLd['@type']).toBe('FAQPage');
    expect(out.googleRichResult.eligible).toBe(false);
    expect(out.googleRichResult.reason).toMatch(/2026-05-07/);
  });
});

describe('accreditation-claim guard (CARSI is not an RTO)', () => {
  const org = buildOrganization(CARSI, { type: 'EducationalOrganization' });

  it.each([
    'Nationally recognised training',
    'An AQF Certificate IV pathway',
    'CARSI, a Registered Training Organisation',
    'Delivered by an RTO',
    'A nationally-recognised course',
    'Partnered with RTOs across Australia',
    'Training with national recognition',
    'Nationally accredited training',
    'CARSI, a Registered-Training-Organisation',
  ])('refuses %p in course copy', text => {
    expect(() =>
      buildCourse(
        {
          name: 'Mould Remediation',
          description: text,
          url: 'https://carsi.com.au/c',
        },
        org
      )
    ).toThrow(AccreditationClaimError);
  });

  it('refuses a claim in the course URL slug', () => {
    expect(() =>
      buildCourse(
        {
          name: 'Water Damage',
          description: 'Practical training.',
          url: 'https://carsi.com.au/courses/nationally-recognised',
        },
        org
      )
    ).toThrow(AccreditationClaimError);
  });

  it('refuses a claim in an organisation sameAs link inside the course-provider pack', () => {
    expect(() =>
      courseProviderPack({
        organization: {
          ...CARSI,
          sameAs: ['https://example.com/carsi-rto-listing'],
        },
        courses: [],
      })
    ).toThrow(AccreditationClaimError);
  });

  it('refuses a claim in the organisation description inside the course-provider pack', () => {
    expect(() =>
      courseProviderPack({
        organization: {
          ...CARSI,
          description: 'Nationally recognized courses',
        },
        courses: [],
      })
    ).toThrow(AccreditationClaimError);
  });

  it.each([
    'Hands-on training aligned to IICRC S520.',
    'Delivered on-site in Porto and Toronto',
    'Shortcourse for property managers',
  ])('allows ordinary course copy %p', text => {
    expect(() =>
      buildCourse(
        {
          name: 'Mould Remediation',
          description: text,
          url: 'https://carsi.com.au/c',
        },
        org
      )
    ).not.toThrow();
  });
});

describe('business-type packs', () => {
  it('courseProviderPack: one @graph with the organisation and every course', () => {
    const pack = courseProviderPack({
      organization: CARSI,
      courses: [
        { name: 'A', description: 'a', url: 'https://carsi.com.au/a' },
        { name: 'B', description: 'b', url: 'https://carsi.com.au/b' },
      ],
    });
    expect(pack.jsonLd['@context']).toBe('https://schema.org');
    const types = (pack.jsonLd['@graph'] as Array<{ '@type': string }>).map(
      n => n['@type']
    );
    expect(types).toEqual(['EducationalOrganization', 'Course', 'Course']);
    expect(pack.googleRichResult.eligible).toBe(false);
  });

  it('softwareProductPack: organisation plus application, eligibility carried through', () => {
    const pack = softwareProductPack({
      organization: RA,
      application: {
        name: 'RestoreAssist',
        url: 'https://restoreassist.app',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
      },
    });
    const graph = pack.jsonLd['@graph'] as Array<Record<string, unknown>>;
    expect(graph.map(n => n['@type'])).toEqual([
      'Organization',
      'SoftwareApplication',
    ]);
    expect(graph[1].publisher).toEqual({
      '@id': 'https://restoreassist.app#organization',
    });
    expect(pack.googleRichResult.eligible).toBe(false);
    expect(pack.googleRichResult.missing).toEqual([
      'offers.price',
      'aggregateRating_or_review',
    ]);
  });
});
