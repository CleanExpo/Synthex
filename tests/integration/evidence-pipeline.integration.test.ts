/**
 * Evidence pipeline — sandbox integration proof (SYN-MCP-006).
 *
 * Proves the full core chain against the LIVE Docker sandbox DB (:5499):
 *
 *   claim (seeded, evidenceStatus 'blocked')
 *     → retrieve   (Firecrawl adapter, HTTP MOCKED — recorded fixture)
 *     → score      (LLM-judge, transport MOCKED — recorded judgement)
 *     → persist    (ClaimEvidenceScore upsert — uniqueness proven by re-run)
 *     → policy     (evaluateEvidencePolicy → 'verified')
 *     → apply      (applyEvidenceVerdict → evidenceStatus 'verified' in DB)
 *
 * ZERO NETWORK: @mendable/firecrawl-js is jest-mocked, the LLM transport is
 * injected, the cost ledger + prompt layer modules are jest-mocked. The only
 * I/O is the sandbox Postgres, guarded by global-setup (hard-fails off :5499).
 */
import type { PrismaClient } from '@prisma/client';
import { createSandboxPrismaClient } from './setup/seed';
import { createFirecrawlRetriever } from '@/lib/evidence/adapters/firecrawl';
import {
  createLlmEntailmentScorer,
  upsertClaimEvidenceScore,
  LLM_JUDGE_SCORER_ID,
  type CompleteFn,
} from '@/lib/evidence/entailment';
import {
  applyEvidenceVerdict,
  DEFAULT_EVIDENCE_POLICY,
  evaluateEvidencePolicy,
} from '@/lib/evidence/policy';
import { getAvailableRetrievers } from '@/lib/evidence/retriever';

// ---------------------------------------------------------------------------
// HTTP + LLM mocks (recorded fixtures — no network in the integration profile)
// ---------------------------------------------------------------------------

const mockSearch = jest.fn();
jest.mock('@mendable/firecrawl-js', () => ({
  __esModule: true,
  default: class MockFirecrawlApp {
    search(...args: unknown[]) {
      return mockSearch(...args);
    }
    scrape() {
      throw new Error('not used in this test');
    }
  },
}));

// Layered prompt: the real module queries the Supabase-tuned prisma singleton,
// which cannot connect to the local sandbox (forced SSL) — and the LLM side is
// mocked anyway. Judge instructions still lead the composed prompt.
jest.mock('@/lib/ai/prompt-layer-builder', () => ({
  buildLayeredPrompt: jest.fn().mockResolvedValue({
    systemPrompt: null,
    core: null,
    client: null,
    clientSource: null,
    task: 'evidence-entailment',
  }),
}));

// Cost ledger: guarantee zero network (the real module would try Supabase
// REST if shell env leaked NEXT_PUBLIC_SUPABASE_URL).
jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: jest.fn().mockResolvedValue(undefined),
  calculatePipelineCost: jest.fn().mockReturnValue(0.001),
}));

jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: jest.fn(() => {
    throw new Error('integration test must inject a complete() transport');
  }),
}));

const SEARCH_FIXTURE = {
  web: [
    {
      url: 'https://www.industry-journal.com/reports/acme-water-damage-2026',
      title: 'Acme Restoration cuts water damage drying time by 40%',
      description:
        'Independent field study finds a 40% average structural drying-time reduction across 120 insured losses.',
    },
    {
      url: 'https://standards-body.org/certifications/acme',
      title: 'Certification registry — Acme Restoration',
      description:
        'Acme Restoration holds current S500 certification, verified 2026.',
    },
  ],
};

const SUPPORTS_JUDGEMENT =
  '{"stance":"supports","confidence":0.9,"rationale":"Excerpt directly supports the claim."}';

const completeFixture: CompleteFn = async request => ({
  id: 'itest-llm-1',
  model: request.model,
  choices: [
    {
      message: { role: 'assistant', content: SUPPORTS_JUDGEMENT },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 400, completion_tokens: 50, total_tokens: 450 },
});

// ---------------------------------------------------------------------------

describe('evidence pipeline — claim → retrieve → score → policy → verified (sandbox)', () => {
  let prisma: PrismaClient;
  let pool: { end: () => Promise<void> };

  beforeAll(() => {
    ({ prisma, pool } = createSandboxPrismaClient());
    process.env.FIRECRAWL_API_KEY = 'itest-fake-key'; // module is mocked — no network
    delete process.env.EXA_API_KEY; // exa stays dormant
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  beforeEach(async () => {
    mockSearch.mockResolvedValue(SEARCH_FIXTURE);
    // Reset the seeded claim to its pre-verification state. claimType
    // 'factual' puts it inside DEFAULT_EVIDENCE_POLICY.requiredForClaimTypes
    // (the seed's 'capability' type is not evidence-required).
    await prisma.marketingAgencyClaim.update({
      where: { id: 'itest-claim' },
      data: {
        evidenceStatus: 'blocked',
        evidenceNotes: null,
        claimType: 'factual',
      },
    });
    await prisma.claimEvidenceScore.deleteMany({
      where: { claimId: 'itest-claim' },
    });
  });

  it('exa ships dormant: not in the available retriever set without a key', () => {
    const ids = getAvailableRetrievers().map(r => r.id);
    expect(ids).toContain('firecrawl'); // fake key set above, module mocked
    expect(ids).not.toContain('exa');
  });

  it('runs the full pipeline and writes evidenceStatus=verified to the sandbox DB', async () => {
    const claim = await prisma.marketingAgencyClaim.findUniqueOrThrow({
      where: { id: 'itest-claim' },
    });
    expect(claim.evidenceStatus).toBe('blocked');

    // 1. RETRIEVE (mocked HTTP → normalized SourceEvidence)
    const retriever = createFirecrawlRetriever();
    const evidence = await retriever.search(claim.statement, { limit: 5 });
    expect(evidence).toHaveLength(2);

    // 2. Persist evidence provenance on SourceRef rows (new SYN-MCP-006 columns)
    const refIds: string[] = [];
    for (let i = 0; i < evidence.length; i++) {
      const ev = evidence[i];
      const id = `itest-ev-ref-${i + 1}`;
      await prisma.marketingAgencySourceRef.upsert({
        where: { id },
        update: {
          contentHash: ev.contentHash,
          retrievedAt: new Date(ev.retrievedAt),
          provider: ev.provider,
          excerpt: ev.excerpt,
        },
        create: {
          id,
          organizationId: 'itest-org',
          createdById: 'itest-user',
          campaignId: 'itest-campaign',
          label: `Evidence: ${ev.title}`,
          url: ev.url,
          sourceType: 'web',
          contentHash: ev.contentHash,
          retrievedAt: new Date(ev.retrievedAt),
          provider: ev.provider,
          excerpt: ev.excerpt,
        },
      });
      refIds.push(id);
    }

    // 3. SCORE (mocked LLM transport, real routedCall path)
    const scorer = createLlmEntailmentScorer({ complete: completeFixture });
    const scored = await scorer.scoreSources({
      orgId: 'itest-org',
      claimId: claim.id,
      claimStatement: claim.statement,
      sources: evidence,
    });
    expect(scored.every(s => s.stance === 'supports')).toBe(true);

    // 4. PERSIST scores — run TWICE to prove (claimId, sourceRefId, scorer)
    //    upsert-uniqueness (no duplicate rows on re-score).
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < scored.length; i++) {
        await upsertClaimEvidenceScore(prisma, {
          organizationId: 'itest-org',
          claimId: claim.id,
          sourceRefId: refIds[i],
          stance: scored[i].stance,
          confidence: round === 0 ? 0.5 : scored[i].confidence, // re-score updates
          scorer: LLM_JUDGE_SCORER_ID,
          rationale: scored[i].rationale ?? null,
        });
      }
    }
    const scoreRows = await prisma.claimEvidenceScore.findMany({
      where: { claimId: claim.id },
    });
    expect(scoreRows).toHaveLength(2); // upserted, not duplicated
    expect(scoreRows.every(r => r.confidence === 0.9)).toBe(true); // updated in place

    // 5. POLICY (pure) → verified
    const decision = evaluateEvidencePolicy(
      { id: claim.id, claimType: claim.claimType },
      scored,
      DEFAULT_EVIDENCE_POLICY,
      {
        retrieversAvailable: getAvailableRetrievers().map(r => r.id),
        retrieversUsed: ['firecrawl'],
      }
    );
    expect(decision.bundle.aggregate.verdict).toBe('verified');

    // 6. APPLY — the only evidenceStatus writer — and verify IN THE DB.
    const written = await applyEvidenceVerdict(prisma, 'itest-org', decision);
    expect(written).toBe('verified');

    const updated = await prisma.marketingAgencyClaim.findUniqueOrThrow({
      where: { id: 'itest-claim' },
    });
    expect(updated.evidenceStatus).toBe('verified');

    // The bundle aggregate (policyId + honesty fields) is on the claim record.
    const notes = JSON.parse(updated.evidenceNotes ?? '{}');
    expect(notes.policyId).toBe(DEFAULT_EVIDENCE_POLICY.id);
    expect(notes.retrieversUsed).toEqual(['firecrawl']);
    expect(notes.retrieversAvailable).not.toContain('exa'); // honest about dormancy
    expect(notes.sourceAgeBasis).toEqual([
      expect.objectContaining({ basis: 'retrieved' }), // publishedAt null → retrievedAt basis
      expect.objectContaining({ basis: 'retrieved' }),
    ]);
  });

  it('tenancy: a cross-org applyEvidenceVerdict never flips the claim', async () => {
    const claim = await prisma.marketingAgencyClaim.findUniqueOrThrow({
      where: { id: 'itest-claim' },
    });
    const decision = evaluateEvidencePolicy(
      { id: claim.id, claimType: claim.claimType },
      [], // irrelevant — force a verdict via minSources 0
      { ...DEFAULT_EVIDENCE_POLICY, minSources: 0 }
    );
    expect(decision.evidenceStatus).toBe('verified');

    const written = await applyEvidenceVerdict(
      prisma,
      'some-other-org',
      decision
    );
    expect(written).toBeNull();

    const unchanged = await prisma.marketingAgencyClaim.findUniqueOrThrow({
      where: { id: 'itest-claim' },
    });
    expect(unchanged.evidenceStatus).toBe('blocked');
  });
});
