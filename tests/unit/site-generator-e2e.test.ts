/**
 * End-to-end Phase 3 pipeline: GBP fetch → industry-starter gap-fill →
 * validator-gated LLM copy → validated site. Every stage is exercised with
 * stubs (fake GBP client + stub CopyWriter), proving the four slices compose.
 */
import {
  createGbpProfileFetcher,
  generateSiteFromGbp,
  type CopyWriter,
  type GbpClient,
  type SiteBrand,
  type SiteCopy,
} from '@/lib/site-generator';
import type {
  GBPLocationSummary,
  GBPReview,
} from '@/lib/google/business-profile';

const brand: SiteBrand = {
  slug: 'acme',
  displayName: 'Acme',
  forbiddenWords: ['cheap'],
};

// GBP's primary category is niche ('Drainage Service'); the industry signal is
// the secondary 'Plumber'. GBP returns no FAQs.
const location: GBPLocationSummary = {
  name: 'accounts/1/locations/2',
  locationName: 'Brisbane Blocked Drains',
  address: {
    addressLines: ['10 Trade St'],
    locality: 'Brisbane',
    administrativeArea: 'QLD',
    postalCode: '4000',
    regionCode: 'AU',
  },
  primaryPhone: '+61730000000',
  websiteUri: 'https://brisbaneblockeddrains.com.au',
  primaryCategory: { displayName: 'Drainage Service' },
  additionalCategories: [{ displayName: 'Plumber' }],
};

const reviews: GBPReview[] = [
  {
    name: 'r1',
    reviewId: '1',
    reviewer: { displayName: 'Sam' },
    starRating: 'FIVE',
    comment: 'Fast and tidy.',
    createTime: '',
    updateTime: '',
  },
];

function gbpClient(): GbpClient {
  return {
    async getLocationDetails() {
      return location;
    },
    async getReviews() {
      return { reviews };
    },
  };
}

// A compliant copywriter — names the hero service noun, no rule violations.
const goodWriter: CopyWriter = {
  async write({ heroService }) {
    const noun = heroService.label;
    return {
      headline: `Fast ${noun} in Brisbane`,
      intro: `Our Brisbane team handles ${noun} the same day.`,
      bodyParagraphs: [
        `Every ${noun} job starts with an on-site assessment and a written quote.`,
      ],
      faqs: [],
    } satisfies SiteCopy;
  },
};

describe('generateSiteFromGbp — GBP → starter-fill → LLM copy → site', () => {
  it('produces a validated, on-brand site from a GBP location using LLM copy', async () => {
    const fetcher = createGbpProfileFetcher(gbpClient(), 'conn-123');
    const { profile, result } = await generateSiteFromGbp(
      fetcher,
      goodWriter,
      'accounts/1/locations/2',
      brand
    );

    // Fetch worked: real GBP facts + aggregate rating.
    expect(profile.name).toBe('Brisbane Blocked Drains');
    expect(profile.rating).toEqual({ value: 5, count: 1 });
    // Starter gap-fill: GBP had no FAQs → inferred 'plumbing' starter supplied
    // them, WITHOUT overwriting GBP's real services.
    expect(profile.services[0].slug).toBe('drainage-service');
    expect(profile.faqs && profile.faqs.length).toBeGreaterThan(0);
    // LLM copy shipped (headline came from the writer, not the template).
    expect(result.ok).toBe(true);
    expect(result.copy.headline).toBe('Fast drainage service in Brisbane');
    // Site is fully assembled.
    expect(result.canonicalUrl).toBe(
      'https://brisbaneblockeddrains.com.au/drainage-service/'
    );
    const graph = result.jsonLd['@graph'] as Array<Record<string, unknown>>;
    expect(graph.some(n => n['@type'] === 'LocalBusiness')).toBe(true);
  });

  it('falls back to deterministic copy when the LLM output is non-compliant (gate holds end-to-end)', async () => {
    const badWriter: CopyWriter = {
      async write() {
        // Frames AI as the actor — aid-rule block on every attempt.
        return {
          headline: 'AI clears your drainage service overnight',
          intro: 'AI repairs everything.',
          bodyParagraphs: ['AI does the drainage service work.'],
          faqs: [],
        };
      },
    };
    const fetcher = createGbpProfileFetcher(gbpClient(), 'conn-123');
    const { result } = await generateSiteFromGbp(
      fetcher,
      badWriter,
      'accounts/1/locations/2',
      brand,
      { maxRepairs: 1 }
    );

    // The non-compliant LLM copy never shipped; deterministic copy took over.
    expect(result.ok).toBe(true);
    expect(result.copy.headline.toLowerCase()).not.toContain('ai clears');
    expect(result.copy.headline.toLowerCase()).toContain('drainage');
  });

  it('skips starter gap-fill when skipStarter is set', async () => {
    const fetcher = createGbpProfileFetcher(gbpClient(), 'conn-123');
    const { profile } = await generateSiteFromGbp(
      fetcher,
      goodWriter,
      'accounts/1/locations/2',
      brand,
      { skipStarter: true }
    );
    // No starter FAQs added — GBP supplied none.
    expect(profile.faqs).toBeUndefined();
  });
});
