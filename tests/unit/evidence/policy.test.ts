/**
 * Evidence policy gate — table-driven threshold matrix (SYN-MCP-006).
 *
 * evaluateEvidencePolicy is PURE (injectable clock) — no mocks needed.
 */
import {
  DEFAULT_EVIDENCE_POLICY,
  evaluateEvidencePolicy,
  type EvidencePolicy,
} from '@/lib/evidence/policy';
import type {
  EvidenceStance,
  ScoredSourceEvidence,
} from '@/lib/evidence/types';

const NOW = new Date('2026-07-10T00:00:00.000Z');
const CLAIM = { id: 'claim-1', claimType: 'factual' };

function source(
  overrides: Partial<ScoredSourceEvidence> & { url: string }
): ScoredSourceEvidence {
  return {
    title: 'fixture',
    publishedAt: null,
    retrievedAt: NOW.toISOString(),
    provider: 'firecrawl',
    contentHash: 'deadbeef',
    excerpt: 'fixture excerpt',
    domain: new URL(overrides.url).hostname.replace(/^www\./, ''),
    stance: 'supports' as EvidenceStance,
    confidence: 0.9,
    scorer: 'llm-judge-v1',
    ...overrides,
  };
}

function policy(overrides: Partial<EvidencePolicy> = {}): EvidencePolicy {
  return { ...DEFAULT_EVIDENCE_POLICY, ...overrides };
}

describe('evaluateEvidencePolicy — verdict matrix', () => {
  interface MatrixCase {
    name: string;
    claimType?: string;
    sources: ScoredSourceEvidence[];
    policy: EvidencePolicy;
    verdict: string;
    evidenceStatus: string | null;
  }

  const cases: MatrixCase[] = [
    {
      name: 'claim type outside requiredForClaimTypes → not_required / no status change',
      claimType: 'aspiration',
      sources: [],
      policy: policy(),
      verdict: 'not_required',
      evidenceStatus: null,
    },
    {
      name: '2 confident supports on distinct domains → verified',
      sources: [
        source({ url: 'https://a.example.com/1' }),
        source({ url: 'https://b.other.org/2' }),
      ],
      policy: policy(),
      verdict: 'verified',
      evidenceStatus: 'verified',
    },
    {
      name: 'only 1 qualifying support (minSources=2) → insufficient / blocked',
      sources: [source({ url: 'https://a.example.com/1' })],
      policy: policy(),
      verdict: 'insufficient',
      evidenceStatus: 'blocked',
    },
    {
      name: 'no sources at all → insufficient / blocked',
      sources: [],
      policy: policy(),
      verdict: 'insufficient',
      evidenceStatus: 'blocked',
    },
    {
      name: '2 supports on the SAME domain + diversity required → insufficient',
      sources: [
        source({ url: 'https://www.same.com/1' }),
        source({ url: 'https://same.com/2' }), // www. normalization → same domain
      ],
      policy: policy(),
      verdict: 'insufficient',
      evidenceStatus: 'blocked',
    },
    {
      name: '2 supports on the same domain + diversity OFF → verified',
      sources: [
        source({ url: 'https://same.com/1' }),
        source({ url: 'https://same.com/2' }),
      ],
      policy: policy({ requireDomainDiversity: false }),
      verdict: 'verified',
      evidenceStatus: 'verified',
    },
    {
      name: 'confidence below minSupportConfidence does not qualify',
      sources: [
        source({ url: 'https://a.example.com/1', confidence: 0.69 }),
        source({ url: 'https://b.other.org/2', confidence: 0.5 }),
      ],
      policy: policy(),
      verdict: 'insufficient',
      evidenceStatus: 'blocked',
    },
    {
      name: 'neutral/unverifiable stances never qualify as support',
      sources: [
        source({ url: 'https://a.example.com/1', stance: 'neutral' }),
        source({ url: 'https://b.other.org/2', stance: 'unverifiable' }),
      ],
      policy: policy(),
      verdict: 'insufficient',
      evidenceStatus: 'blocked',
    },
    {
      name: 'a confident refutation overrides 2 supports → refuted / disputed',
      sources: [
        source({ url: 'https://a.example.com/1' }),
        source({ url: 'https://b.other.org/2' }),
        source({
          url: 'https://c.press.net/3',
          stance: 'refutes',
          confidence: 0.9,
        }),
      ],
      policy: policy(),
      verdict: 'refuted',
      evidenceStatus: 'disputed',
    },
    {
      name: 'a low-confidence refutation is ignored',
      sources: [
        source({ url: 'https://a.example.com/1' }),
        source({ url: 'https://b.other.org/2' }),
        source({
          url: 'https://c.press.net/3',
          stance: 'refutes',
          confidence: 0.3,
        }),
      ],
      policy: policy(),
      verdict: 'verified',
      evidenceStatus: 'verified',
    },
    {
      name: 'minSources=1 verifies with a single qualifying source',
      sources: [source({ url: 'https://a.example.com/1' })],
      policy: policy({ minSources: 1 }),
      verdict: 'verified',
      evidenceStatus: 'verified',
    },
  ];

  it.each(cases)(
    '$name',
    ({ claimType, sources, policy: p, verdict, evidenceStatus }) => {
      const decision = evaluateEvidencePolicy(
        { ...CLAIM, claimType: claimType ?? CLAIM.claimType },
        sources,
        p,
        { now: NOW }
      );
      expect(decision.bundle.aggregate.verdict).toBe(verdict);
      expect(decision.evidenceStatus).toBe(evidenceStatus);
      expect(decision.bundle.aggregate.policyId).toBe(p.id);
      expect(decision.bundle.claimId).toBe(CLAIM.id);
    }
  );
});

describe('evaluateEvidencePolicy — source age (publishedAt null = unknown age)', () => {
  const aged = policy({ maxSourceAgeDays: 30 });

  it('uses publishedAt when present (basis "published") and excludes stale sources', () => {
    const decision = evaluateEvidencePolicy(
      CLAIM,
      [
        source({
          url: 'https://a.example.com/fresh',
          publishedAt: '2026-07-01T00:00:00.000Z', // 9 days old — fresh
        }),
        source({
          url: 'https://b.other.org/stale',
          publishedAt: '2025-01-01T00:00:00.000Z', // way past 30 days
        }),
      ],
      aged,
      { now: NOW }
    );
    expect(decision.bundle.aggregate.verdict).toBe('insufficient');
    expect(decision.bundle.aggregate.sourceAgeBasis).toEqual([
      { url: 'https://a.example.com/fresh', basis: 'published' },
      { url: 'https://b.other.org/stale', basis: 'published' },
    ]);
    expect(
      decision.bundle.aggregate.reasons.some(r =>
        r.includes('maxSourceAgeDays')
      )
    ).toBe(true);
  });

  it('publishedAt null → falls back to retrievedAt recency (basis "retrieved")', () => {
    const decision = evaluateEvidencePolicy(
      CLAIM,
      [
        source({
          url: 'https://a.example.com/1',
          publishedAt: null,
          retrievedAt: '2026-07-09T00:00:00.000Z', // retrieved yesterday — fresh
        }),
        source({
          url: 'https://b.other.org/2',
          publishedAt: null,
          retrievedAt: '2026-07-08T00:00:00.000Z',
        }),
      ],
      aged,
      { now: NOW }
    );
    expect(decision.bundle.aggregate.verdict).toBe('verified');
    expect(decision.bundle.aggregate.sourceAgeBasis).toEqual([
      { url: 'https://a.example.com/1', basis: 'retrieved' },
      { url: 'https://b.other.org/2', basis: 'retrieved' },
    ]);
  });

  it('publishedAt null + stale retrievedAt → excluded', () => {
    const decision = evaluateEvidencePolicy(
      CLAIM,
      [
        source({
          url: 'https://a.example.com/1',
          publishedAt: null,
          retrievedAt: '2026-01-01T00:00:00.000Z', // retrieved 6 months ago
        }),
        source({
          url: 'https://b.other.org/2',
          retrievedAt: NOW.toISOString(),
        }),
      ],
      aged,
      { now: NOW }
    );
    expect(decision.bundle.aggregate.verdict).toBe('insufficient');
  });

  it('unparseable timestamp fails closed (never fresh)', () => {
    const decision = evaluateEvidencePolicy(
      CLAIM,
      [
        source({ url: 'https://a.example.com/1', publishedAt: 'not-a-date' }),
        source({ url: 'https://b.other.org/2' }),
      ],
      aged,
      { now: NOW }
    );
    expect(decision.bundle.aggregate.verdict).toBe('insufficient');
  });

  it('no maxSourceAgeDays → age never disqualifies', () => {
    const decision = evaluateEvidencePolicy(
      CLAIM,
      [
        source({
          url: 'https://a.example.com/1',
          publishedAt: '1999-01-01T00:00:00.000Z',
        }),
        source({
          url: 'https://b.other.org/2',
          publishedAt: null,
          retrievedAt: '2001-01-01T00:00:00.000Z',
        }),
      ],
      policy(), // no maxSourceAgeDays
      { now: NOW }
    );
    expect(decision.bundle.aggregate.verdict).toBe('verified');
  });
});

describe('evaluateEvidencePolicy — bundle honesty fields', () => {
  it('records retrievers available vs used and the scoring timestamp', () => {
    const decision = evaluateEvidencePolicy(
      CLAIM,
      [
        source({ url: 'https://a.example.com/1' }),
        source({ url: 'https://b.other.org/2' }),
      ],
      policy(),
      {
        now: NOW,
        retrieversAvailable: ['firecrawl', 'apify'],
        retrieversUsed: ['firecrawl'],
      }
    );
    const agg = decision.bundle.aggregate;
    expect(agg.retrieversAvailable).toEqual(['firecrawl', 'apify']); // exa absent = dormant, visible
    expect(agg.retrieversUsed).toEqual(['firecrawl']);
    expect(agg.scoredAt).toBe(NOW.toISOString());
    expect(agg.sourceAgeBasis).toHaveLength(2);
  });

  it('verified bundles carry no failure reasons', () => {
    const decision = evaluateEvidencePolicy(
      CLAIM,
      [
        source({ url: 'https://a.example.com/1' }),
        source({ url: 'https://b.other.org/2' }),
      ],
      policy(),
      { now: NOW }
    );
    expect(decision.bundle.aggregate.reasons).toEqual([]);
  });
});

describe('DEFAULT_EVIDENCE_POLICY', () => {
  it('mirrors the existing export-gate evidence-required claim types', () => {
    // Keep in sync with EVIDENCE_REQUIRED in lib/marketing-agency/evidence.ts
    expect(DEFAULT_EVIDENCE_POLICY.requiredForClaimTypes).toEqual([
      'factual',
      'outcome',
      'comparative',
      'testimonial',
    ]);
    expect(DEFAULT_EVIDENCE_POLICY.minSources).toBeGreaterThanOrEqual(2);
    expect(DEFAULT_EVIDENCE_POLICY.requireDomainDiversity).toBe(true);
  });
});
