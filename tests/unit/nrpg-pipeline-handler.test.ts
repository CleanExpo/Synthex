/**
 * Unit tests for lib/nrpg-pipeline/
 *
 * Covers:
 *  - Gates: brand, consent, mappable categories
 *  - Stage ordering + per-stage error isolation
 *  - Idempotency end-to-end (same event twice = zero new commits)
 *  - GBP failure does NOT block Bing
 *  - Sitemap ping skipped when zero new pages
 *  - Service-category mapper handles unknowns + dedupes
 *
 * @see SYN-834 (epic — final integration)
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  createNrpgPipelineHandler,
  mapNrpgServiceCategories,
} from '@/lib/nrpg-pipeline';
import type { NrpgPipelineOptions } from '@/lib/nrpg-pipeline';
import type { ContractorOnboardedEvent } from '@/lib/contractor';
import type { BrandIdentity } from '@/lib/landing-page';
import type { GbpApiClient, GbpPlace } from '@/lib/gbp';
import type { BingLocality, BingPlacesApiClient } from '@/lib/bing-places';
import type { PostcodeDatasetRow } from '@/lib/postcode';
import { _resetPingRateLimitForTests } from '@/lib/sitemap/ping-client';

// Reset budget ledger module state between tests by re-requiring would
// require module-cache shenanigans; instead we inject a custom budget
// repository via a process-env-free pathway. The budget lib reads its
// repo via the default import OR opts.repository — but commitLocation
// in the pipeline doesn't expose opts. So we mock the module.
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Inject a mock budget repository at module level so commitLocation
// runs without Supabase. We re-set the in-memory entries between tests.
const budgetEntries: Array<{
  serviceAreaCoverageId: string;
  contractorId: string;
  monthlyAmountAud: number;
}> = [];
let nextLedgerId = 1;

jest.mock('@/lib/budget/supabase-repository', () => ({
  supabaseBudgetLedgerRepository: {
    async insert(input: {
      serviceAreaCoverageId: string;
      sourceOfTruthJobId: string;
      contractorId: string;
      postcode: string;
      suburb: string;
      monthlyAmountAud: number;
    }) {
      const entry = {
        id: `ledger_${nextLedgerId++}`,
        serviceAreaCoverageId: input.serviceAreaCoverageId,
        sourceOfTruthJobId: input.sourceOfTruthJobId,
        contractorId: input.contractorId,
        postcode: input.postcode,
        suburb: input.suburb,
        monthlyAmountAud: input.monthlyAmountAud,
        openedAt: new Date().toISOString(),
        pausedAt: null,
        pausedReason: null,
        closedAt: null,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
      };
      budgetEntries.push(entry);
      return entry;
    },
    async findActiveByCoverage(coverageId: string) {
      const e = budgetEntries.find(x => x.serviceAreaCoverageId === coverageId);
      if (!e) return null;
      return {
        ...e,
        sourceOfTruthJobId: 'unused',
        openedAt: '',
        pausedAt: null,
        pausedReason: null,
        closedAt: null,
        status: 'active' as const,
        createdAt: '',
        id: 'unused',
      };
    },
    async sumActiveMonthlyAud() {
      return budgetEntries.reduce((s, e) => s + e.monthlyAmountAud, 0);
    },
    async countActive() {
      return budgetEntries.length;
    },
    async sumActiveMonthlyAudForContractor(contractorId: string) {
      return budgetEntries
        .filter(e => e.contractorId === contractorId)
        .reduce((s, e) => s + e.monthlyAmountAud, 0);
    },
    async findByContractor() {
      return [];
    },
    async pause() {
      return null;
    },
    async resume() {
      return null;
    },
  },
}));

// ─── FIXTURES ─────────────────────────────────────────────────────────────

const brand: BrandIdentity = {
  name: 'Disaster Recovery',
  legalName: 'Disaster Recovery Pty Ltd',
  url: 'https://disasterrecovery.com.au',
  logoUrl: 'https://disasterrecovery.com.au/logo.png',
  telephone: '+61730000000',
  hq: { lat: -27.4698, lng: 153.0251, addressLocality: 'Brisbane' },
};

// Three suburbs near Brisbane CBD (-27.4698, 153.0251). All within 30km.
const testDataset: PostcodeDatasetRow[] = [
  {
    postcode: '4000',
    suburb: 'Brisbane City',
    state: 'QLD',
    lat: -27.4698,
    lng: 153.0251,
  },
  {
    postcode: '4101',
    suburb: 'South Brisbane',
    state: 'QLD',
    lat: -27.481,
    lng: 153.0235,
  },
  {
    postcode: '4152',
    suburb: 'Carindale',
    state: 'QLD',
    lat: -27.5,
    lng: 153.1,
  },
  // One way out — 1000+ km, won't appear in 50km radius
  {
    postcode: '0800',
    suburb: 'Darwin',
    state: 'NT',
    lat: -12.4634,
    lng: 130.8456,
  },
];

function event(
  overrides: Partial<ContractorOnboardedEvent> = {}
): ContractorOnboardedEvent {
  return {
    sourceOfTruthJobId: `job_${Math.random().toString(36).slice(2, 8)}`,
    contractorId: 'contractor_a',
    brand: 'NRPG',
    baseLocation: {
      lat: -27.4698,
      lng: 153.0251,
      addressHash: 'sha256:fake',
    },
    radiusKm: 50,
    serviceCategories: ['water-damage'],
    paymentConfirmedAt: '2026-04-29T00:00:00.000Z',
    consentForServiceAreaListing: true,
    emittedAt: '2026-04-29T00:00:00.000Z',
    ...overrides,
  };
}

function makeFakeGbp(initial: GbpPlace[] = []): GbpApiClient & {
  _patches: GbpPlace[][];
  failOnPatch?: boolean;
} {
  const places: GbpPlace[] = [...initial];
  const patches: GbpPlace[][] = [];
  const obj: GbpApiClient & { _patches: GbpPlace[][]; failOnPatch?: boolean } =
    {
      _patches: patches,
      async getServiceArea(locationId: string) {
        return {
          locationId,
          readAt: new Date().toISOString(),
          places: [...places],
        };
      },
      async patchServiceArea(_id: string, next: GbpPlace[]) {
        if (obj.failOnPatch) throw new Error('GBP API down');
        patches.push([...next]);
        places.length = 0;
        places.push(...next);
        return { status: 200 };
      },
    };
  return obj;
}

function makeFakeBing(initial: BingLocality[] = []): BingPlacesApiClient & {
  _puts: BingLocality[][];
} {
  const localities: BingLocality[] = [...initial];
  const puts: BingLocality[][] = [];
  return {
    _puts: puts,
    async getServiceArea(storeId: string) {
      return {
        storeId,
        readAt: new Date().toISOString(),
        localities: [...localities],
      };
    },
    async putServiceArea(_storeId: string, next: BingLocality[]) {
      puts.push([...next]);
      localities.length = 0;
      localities.push(...next);
      return { status: 200 };
    },
  };
}

function baseOpts(
  overrides: Partial<NrpgPipelineOptions> = {}
): NrpgPipelineOptions {
  return {
    brand,
    gbpLocationId: 'locations/test',
    bingStoreId: 'store_test',
    loadCurrentSitemapXml: async () => '',
    saveSitemapXml: async () => undefined,
    saveLandingPage: async () => undefined,
    gbpClient: makeFakeGbp(),
    bingClient: makeFakeBing(),
    postcodeResolveOptions: { dataset: testDataset },
    skipPing: true,
    ...overrides,
  };
}

beforeEach(() => {
  budgetEntries.length = 0;
  nextLedgerId = 1;
  _resetPingRateLimitForTests();
});

// ─── TESTS ────────────────────────────────────────────────────────────────

describe('mapNrpgServiceCategories', () => {
  it('maps NRPG strings to DR whitelist + dedupes', () => {
    expect(
      mapNrpgServiceCategories([
        'water-damage',
        'fire-restoration',
        'mould-remediation',
        'water-damage', // dup
      ])
    ).toEqual(['water-damage', 'fire', 'mould']);
  });

  it('drops unknown categories silently', () => {
    expect(mapNrpgServiceCategories(['water-damage', 'asbestos'])).toEqual([
      'water-damage',
    ]);
  });

  it('returns empty array when no mappable categories', () => {
    expect(mapNrpgServiceCategories(['asbestos', 'crime-scene'])).toEqual([]);
  });
});

describe('createNrpgPipelineHandler — gates', () => {
  it('refuses non-NRPG brand', async () => {
    const handler = createNrpgPipelineHandler(baseOpts());
    const result = await handler(
      // @ts-expect-error — deliberately invalid
      event({ brand: 'DR' })
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/brand 'DR'/);
    expect(result.gbp).toBeUndefined();
  });

  it('refuses when consent missing', async () => {
    const handler = createNrpgPipelineHandler(baseOpts());
    const result = await handler(
      // @ts-expect-error — deliberately invalid
      event({ consentForServiceAreaListing: false })
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/consent/i);
  });

  it('refuses when no DR-mappable categories', async () => {
    const handler = createNrpgPipelineHandler(baseOpts());
    const result = await handler(event({ serviceCategories: ['asbestos'] }));
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/no DR-mapped service categories/);
  });
});

describe('createNrpgPipelineHandler — happy path', () => {
  it('runs all stages and reports ok per stage', async () => {
    const gbp = makeFakeGbp();
    const bing = makeFakeBing();
    const savedPages: { slug: string }[] = [];
    let savedSitemap: string | null = null;

    const handler = createNrpgPipelineHandler(
      baseOpts({
        gbpClient: gbp,
        bingClient: bing,
        saveLandingPage: async page => {
          savedPages.push({ slug: page.slug });
        },
        saveSitemapXml: async xml => {
          savedSitemap = xml;
        },
      })
    );

    const result = await handler(event());

    expect(result.accepted).toBe(true);
    expect(result.postcodeResolve?.ok).toBe(true);
    expect(result.postcodeResolve?.result?.suburbCount).toBeGreaterThanOrEqual(
      3
    );
    expect(result.budgetCommits?.ok).toBe(true);
    expect(
      result.budgetCommits?.result?.committed.length
    ).toBeGreaterThanOrEqual(3);
    expect(result.gbp?.ok).toBe(true);
    expect(result.gbp?.result?.added).toBeGreaterThanOrEqual(3);
    expect(result.bingPlaces?.ok).toBe(true);
    expect(result.bingPlaces?.result?.added).toBeGreaterThanOrEqual(3);
    expect(result.landingPages?.ok).toBe(true);
    expect(result.landingPages?.result?.pages.length).toBeGreaterThanOrEqual(3);
    expect(result.sitemap?.ok).toBe(true);
    expect(result.sitemap?.result?.regen.added.length).toBeGreaterThanOrEqual(
      3
    );
    expect(result.sitemap?.result?.pings).toEqual([]); // skipPing=true
    expect(gbp._patches).toHaveLength(1);
    expect(bing._puts).toHaveLength(1);
    expect(savedPages.length).toBeGreaterThanOrEqual(3);
    expect(savedSitemap).not.toBeNull();
  });
});

describe('createNrpgPipelineHandler — error isolation', () => {
  it('GBP failure does NOT block Bing or downstream stages', async () => {
    const flakyGbp = makeFakeGbp();
    flakyGbp.failOnPatch = true;
    const bing = makeFakeBing();

    const handler = createNrpgPipelineHandler(
      baseOpts({ gbpClient: flakyGbp, bingClient: bing })
    );
    const result = await handler(event());

    expect(result.accepted).toBe(true);
    expect(result.gbp?.ok).toBe(false);
    expect(result.gbp?.error).toMatch(/GBP API down/);
    expect(result.bingPlaces?.ok).toBe(true);
    expect(bing._puts).toHaveLength(1);
    expect(result.landingPages?.ok).toBe(true);
    expect(result.sitemap?.ok).toBe(true);
  });
});

describe('createNrpgPipelineHandler — idempotency', () => {
  it('re-running the same event produces zero NEW budget commits', async () => {
    const handler = createNrpgPipelineHandler(baseOpts());
    const e = event({ sourceOfTruthJobId: 'job_idempotent' });

    const first = await handler(e);
    expect(
      first.budgetCommits?.result?.committed.length
    ).toBeGreaterThanOrEqual(3);
    const firstCount = budgetEntries.length;

    const second = await handler(e);
    expect(second.accepted).toBe(true);
    // Second run: idempotent commits return committed=true, inserted=false
    // so they appear in `committed` but no NEW rows in budgetEntries.
    expect(budgetEntries.length).toBe(firstCount);
  });
});

describe('createNrpgPipelineHandler — sitemap ping behaviour', () => {
  it('skips ping when sitemap regen adds zero URLs', async () => {
    let currentXml = '';
    const handler = createNrpgPipelineHandler(
      baseOpts({
        loadCurrentSitemapXml: async () => currentXml,
        saveSitemapXml: async xml => {
          currentXml = xml;
        },
        skipPing: false, // allow ping in principle
        pingFetch: jest.fn(
          async () => ({ status: 200 }) as Response
        ) as unknown as typeof fetch,
      })
    );

    // First run adds pages and writes them into currentXml
    const first = await handler(event({ sourceOfTruthJobId: 'job_first' }));
    expect(first.sitemap?.result?.regen.added.length).toBeGreaterThan(0);
    expect(currentXml.length).toBeGreaterThan(0);

    // Second run reads the now-populated XML; idempotent merge → zero adds
    const second = await handler(event({ sourceOfTruthJobId: 'job_first' }));
    expect(second.sitemap?.result?.regen.added.length).toBe(0);
    expect(second.sitemap?.result?.pings).toEqual([]);
  });
});
