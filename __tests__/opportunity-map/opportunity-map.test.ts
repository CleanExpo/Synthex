import type { PipelineResult } from '@/lib/ai/onboarding-pipeline';
import {
  buildOpportunityMap,
  opportunityMapToMarkdown,
  parseOpportunityMapIntake,
} from '@/lib/opportunity-map';

function pipelineResult(
  overrides: Partial<PipelineResult> = {}
): PipelineResult {
  return {
    businessName: 'Acme Restoration',
    industry: 'other',
    description: '',
    teamSize: 'small',
    logoUrl: null,
    faviconUrl: null,
    brandColours: { primary: '' },
    seoSignals: {
      title: 'Acme Restoration',
      metaDescription: null,
      h1: 'Emergency restoration services',
      h1Count: 1,
      h2Count: 2,
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      imagesWithoutAlt: 3,
      totalImages: 4,
      wordCount: 420,
    },
    seoScore: 40,
    pageSpeed: {
      mobile: { score: 52, lcp: 3_200, fcp: 1_500, cls: 0.1 },
      desktop: { score: 78, lcp: 2_100, fcp: 900, cls: 0.05 },
    },
    overallHealth: 'needs-work',
    healthSummary: 'Website has room for improvement.',
    quickWins: [],
    contentGaps: [],
    keywordOpportunities: [],
    socialProfiles: [],
    socialHandles: {},
    keyTopics: [],
    targetAudience: '',
    suggestedTone: 'professional',
    suggestedPersonaName: 'Acme Restoration',
    confidence: 42,
    dataRequired: [
      'industry',
      'description',
      'targetAudience',
      'keyTopics',
      'socialHandles',
    ],
    sampleCaption: null,
    structuredData: {},
    url: 'https://acme.example.com',
    ...overrides,
  };
}

describe('Marketing Opportunity Map', () => {
  it('classifies a mixed paste while keeping sources and notes visible', () => {
    const parsed = parseOpportunityMapIntake({
      businessName: 'Acme Restoration',
      context: `
        https://acme.example.com
        https://instagram.com/acmerestoration
        https://docs.google.com/document/d/brief
        We need more commercial work without posting on every channel.
      `,
    });

    expect(parsed.website).toBe('https://acme.example.com');
    expect(parsed.evidence.map(item => item.kind)).toEqual([
      'website',
      'social',
      'document',
      'note',
    ]);
    expect(parsed.contextNote).toContain('more commercial work');
  });

  it('infers a readable business name only when one was not provided', () => {
    const parsed = parseOpportunityMapIntake({
      context: 'https://north-coast-restoration.com.au',
    });

    expect(parsed.businessName).toBe('North Coast Restoration');
  });

  it('rejects a paste without a primary website', () => {
    expect(() =>
      parseOpportunityMapIntake({
        context: 'https://instagram.com/acmerestoration',
      })
    ).toThrow('Add your website as a full link');
  });

  it('ranks three directions and preserves unknowns instead of inventing them', () => {
    const intake = parseOpportunityMapIntake({
      businessName: 'Acme Restoration',
      context: 'https://acme.example.com\nWe want more commercial enquiries.',
    });
    const map = buildOpportunityMap(
      intake,
      pipelineResult(),
      new Date('2026-08-03T02:00:00.000Z')
    );

    expect(map.opportunities).toHaveLength(3);
    expect(map.opportunities.map(item => item.rank)).toEqual([1, 2, 3]);
    expect(map.opportunities[0].score).toBeGreaterThanOrEqual(
      map.opportunities[1].score
    );
    expect(map.brandContext.industry).toBeNull();
    expect(map.brandContext.audience).toBeNull();
    expect(map.gaps.map(gap => gap.label)).toContain('Target audience');
    expect(map.serviceRecommendation.boundaries).toContain(
      'No public publishing or paid spend is authorized by this map.'
    );
  });

  it('qualifies evidence-rich opportunities without authorizing external effects', () => {
    const intake = parseOpportunityMapIntake({
      businessName: 'Acme Restoration',
      context:
        'https://acme.example.com\nhttps://linkedin.com/company/acme\nOur priority is commercial restoration enquiries.',
    });
    const map = buildOpportunityMap(
      intake,
      pipelineResult({
        industry: 'agency',
        description: 'Commercial restoration planning and response services.',
        targetAudience: 'Facilities and property managers',
        keyTopics: ['restoration planning', 'water damage', 'risk reduction'],
        confidence: 86,
        dataRequired: [],
        structuredData: { phone: '+61 7 5555 0100', abn: '12345678901' },
      })
    );

    expect(map.fit.state).toBe('qualified');
    expect(map.fit.score).toBeGreaterThanOrEqual(65);
    expect(map.serviceRecommendation.boundaries.join(' ')).toMatch(
      /No public publishing|No public publishing/i
    );
  });

  it('exports the same evidence and ranked directions into the brief', () => {
    const intake = parseOpportunityMapIntake({
      businessName: 'Acme Restoration',
      context: 'https://acme.example.com',
    });
    const map = buildOpportunityMap(intake, pipelineResult());
    const markdown = opportunityMapToMarkdown(map);

    expect(markdown).toContain(
      '# Acme Restoration — Nexus Marketing Opportunity Map'
    );
    expect(markdown).toContain('## Ranked directions');
    expect(markdown).toContain('## Boundaries');
    expect(markdown).toContain(map.opportunities[0].title);
  });
});
