/**
 * verify-claim job — sandbox integration proof (SYN-MCP-006 wiring).
 *
 * Proves the WIRED chain end-to-end against the LIVE Docker sandbox DB
 * (:5499), driving the actual handler core with injected deps
 * (must_fix `handler-di`):
 *
 *   seeded claim (evidenceStatus 'blocked') + sourceRef
 *     → runVerifyClaim({db, retrievers: [mock], scorer: LLM-judge w/ recorded
 *       CompleteFn fixtures})
 *     → SourceRef find-or-create + ClaimEvidenceScore upserts IN THE DB
 *     → evaluateAndApplyEvidencePolicy → applyEvidenceVerdict
 *     → evidenceStatus 'verified' IN THE DB + reviewLog audit entry
 *
 * Plus (must_fix `disputed-path-coverage`): a contradicted fixture
 * (refutes @ ≥0.7) → evidenceStatus 'disputed'. Plus idempotence (re-run →
 * score row count unchanged) and tenancy (cross-org claimId → no flip).
 *
 * ZERO NETWORK: the retriever is an injected in-memory mock, the LLM
 * transport is an injected CompleteFn, prompt-layer/cost-ledger/providers
 * are jest-mocked (same profile as evidence-pipeline.integration.test.ts).
 * The only I/O is the sandbox Postgres, guarded by global-setup.
 */
import type { PrismaClient } from '@prisma/client';
import { createSandboxPrismaClient } from './setup/seed';
import { runVerifyClaim } from '@/lib/evidence/verify-claim-job';
import {
  createLlmEntailmentScorer,
  LLM_JUDGE_SCORER_ID,
  type CompleteFn,
} from '@/lib/evidence/entailment';
import type { EvidenceRetriever } from '@/lib/evidence/retriever';
import type { SourceEvidence } from '@/lib/evidence/types';

// ---------------------------------------------------------------------------
// Module mocks — zero network (same set as evidence-pipeline integration)
// ---------------------------------------------------------------------------

jest.mock('@/lib/ai/prompt-layer-builder', () => ({
  buildLayeredPrompt: jest.fn().mockResolvedValue({
    systemPrompt: null,
    core: null,
    client: null,
    clientSource: null,
    task: 'evidence-entailment',
  }),
}));

jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: jest.fn().mockResolvedValue(undefined),
  calculatePipelineCost: jest.fn().mockReturnValue(0.001),
}));

jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: jest.fn(() => {
    throw new Error('integration test must inject a complete() transport');
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures — 2 distinct domains (DEFAULT_EVIDENCE_POLICY.minSources = 2 with
// domain diversity)
// ---------------------------------------------------------------------------

const RETRIEVED_AT = '2026-07-10T00:00:00.000Z';

const FIXTURE_SOURCES: SourceEvidence[] = [
  {
    url: 'https://www.industry-journal.com/reports/acme-water-damage-2026',
    title: 'Acme Restoration cuts water damage drying time by 40%',
    publishedAt: null,
    retrievedAt: RETRIEVED_AT,
    provider: 'firecrawl',
    contentHash: 'itest-hash-1',
    excerpt:
      'Independent field study finds a 40% average structural drying-time reduction across 120 insured losses.',
    domain: 'industry-journal.com',
  },
  {
    url: 'https://standards-body.org/certifications/acme',
    title: 'Certification registry — Acme Restoration',
    publishedAt: null,
    retrievedAt: RETRIEVED_AT,
    provider: 'firecrawl',
    contentHash: 'itest-hash-2',
    excerpt:
      'Acme Restoration holds current S500 certification, verified 2026.',
    domain: 'standards-body.org',
  },
];

function mockRetriever(sources: SourceEvidence[]): EvidenceRetriever {
  return {
    id: 'firecrawl',
    capabilities: { canSearch: true, canFetch: true },
    available: () => true,
    search: async () => sources,
    fetch: async () => null, // the seeded sourceRef URL yields no content
  };
}

const SUPPORTS =
  '{"stance":"supports","confidence":0.9,"rationale":"Excerpt directly supports the claim."}';
const REFUTES =
  '{"stance":"refutes","confidence":0.85,"rationale":"The excerpt reports the study was retracted and the true figure was 8%."}';

function transport(content: string): CompleteFn {
  return async request => ({
    id: 'itest-llm-verify',
    model: request.model,
    choices: [
      { message: { role: 'assistant', content }, finish_reason: 'stop' },
    ],
    usage: { prompt_tokens: 400, completion_tokens: 50, total_tokens: 450 },
  });
}

const JOB_DATA = {
  claimId: 'itest-claim',
  organizationId: 'itest-org',
  userId: 'itest-user',
};

// ---------------------------------------------------------------------------

describe('verify-claim job — full wired chain in the sandbox', () => {
  let prisma: PrismaClient;
  let pool: { end: () => Promise<void> };

  beforeAll(() => {
    ({ prisma, pool } = createSandboxPrismaClient());
  });

  afterAll(async () => {
    // Restore the seeded fixture. This suite mutates `itest-claim` (blocked ->
    // verified/disputed) and previously left it mutated, so any suite that
    // later asserts the SEEDED state — canary.integration.test.ts does —
    // failed depending on jest's file ordering. Restoring at the mutator keeps
    // the shared sandbox fixtures honest for whoever runs next.
    await prisma.marketingAgencyClaim
      .update({
        where: { id: 'itest-claim' },
        data: {
          evidenceStatus: 'blocked',
          evidenceNotes: null,
          claimType: 'factual',
          metadata: {},
        },
      })
      .catch(() => undefined);
    await prisma.claimEvidenceScore
      .deleteMany({ where: { claimId: 'itest-claim' } })
      .catch(() => undefined);

    await prisma.$disconnect();
    await pool.end();
  });

  beforeEach(async () => {
    // Reset the seeded claim to its pre-verification state ('factual' is
    // evidence-required under DEFAULT_EVIDENCE_POLICY).
    await prisma.marketingAgencyClaim.update({
      where: { id: 'itest-claim' },
      data: {
        evidenceStatus: 'blocked',
        evidenceNotes: null,
        claimType: 'factual',
        metadata: {},
      },
    });
    await prisma.claimEvidenceScore.deleteMany({
      where: { claimId: 'itest-claim' },
    });
  });

  it('verified path: sources → scores in DB → evidenceStatus verified + reviewLog entry', async () => {
    const deps = {
      db: prisma,
      retrievers: [mockRetriever(FIXTURE_SOURCES)],
      scorer: createLlmEntailmentScorer({ complete: transport(SUPPORTS) }),
    };

    const result = await runVerifyClaim(deps, JOB_DATA, 'itest-job-1');
    expect(result.status).toBe('completed');
    expect(result.previousEvidenceStatus).toBe('blocked');
    expect(result.evidenceStatus).toBe('verified');

    // ClaimEvidenceScore rows persisted, FK'd to find-or-created SourceRefs.
    const scoreRows = await prisma.claimEvidenceScore.findMany({
      where: { claimId: 'itest-claim' },
      include: { sourceRef: true },
    });
    expect(scoreRows).toHaveLength(2);
    expect(scoreRows.every(r => r.scorer === LLM_JUDGE_SCORER_ID)).toBe(true);
    expect(scoreRows.every(r => r.stance === 'supports')).toBe(true);
    // SourceRef provenance persisted (must_fix retrieved-source-persistence).
    const urls = scoreRows.map(r => r.sourceRef.url).sort();
    expect(urls).toEqual(FIXTURE_SOURCES.map(s => s.url).sort());
    expect(
      scoreRows.every(
        r =>
          r.sourceRef.sourceType === 'web' &&
          r.sourceRef.provider === 'firecrawl'
      )
    ).toBe(true);

    // evidenceStatus flipped IN THE DB by the evaluator chain.
    const claim = await prisma.marketingAgencyClaim.findUniqueOrThrow({
      where: { id: 'itest-claim' },
    });
    expect(claim.evidenceStatus).toBe('verified');

    // Bundle aggregate persisted on the claim.
    const notes = JSON.parse(claim.evidenceNotes ?? '{}');
    expect(notes.verdict).toBe('verified');
    expect(notes.retrieversUsed).toEqual(['firecrawl']);

    // reviewLog audit entry (must_fix reviewlog-additive-shape).
    const metadata = claim.metadata as {
      reviewLog?: Array<Record<string, unknown>>;
    };
    expect(metadata.reviewLog).toHaveLength(1);
    expect(metadata.reviewLog![0]).toMatchObject({
      action: 'evidence-verification',
      jobId: 'itest-job-1',
      previousEvidenceStatus: 'blocked',
      newEvidenceStatus: 'verified',
      verdict: 'verified',
    });
  });

  it('disputed path: contradicted fixture (refutes @ >= 0.7) → evidenceStatus disputed', async () => {
    const deps = {
      db: prisma,
      retrievers: [mockRetriever(FIXTURE_SOURCES)],
      scorer: createLlmEntailmentScorer({ complete: transport(REFUTES) }),
    };

    const result = await runVerifyClaim(deps, JOB_DATA, 'itest-job-2');
    expect(result.status).toBe('completed');
    expect(result.evidenceStatus).toBe('disputed');

    const claim = await prisma.marketingAgencyClaim.findUniqueOrThrow({
      where: { id: 'itest-claim' },
    });
    expect(claim.evidenceStatus).toBe('disputed');
    const notes = JSON.parse(claim.evidenceNotes ?? '{}');
    expect(notes.verdict).toBe('refuted');
  });

  it('idempotence: re-running the same job converges (no duplicate score rows)', async () => {
    const deps = {
      db: prisma,
      retrievers: [mockRetriever(FIXTURE_SOURCES)],
      scorer: createLlmEntailmentScorer({ complete: transport(SUPPORTS) }),
    };

    await runVerifyClaim(deps, JOB_DATA, 'itest-job-3');
    const afterFirst = await prisma.claimEvidenceScore.count({
      where: { claimId: 'itest-claim' },
    });
    const refsAfterFirst = await prisma.marketingAgencySourceRef.count({
      where: {
        organizationId: 'itest-org',
        url: { in: FIXTURE_SOURCES.map(s => s.url) },
      },
    });

    await runVerifyClaim(deps, JOB_DATA, 'itest-job-3');
    const afterSecond = await prisma.claimEvidenceScore.count({
      where: { claimId: 'itest-claim' },
    });
    const refsAfterSecond = await prisma.marketingAgencySourceRef.count({
      where: {
        organizationId: 'itest-org',
        url: { in: FIXTURE_SOURCES.map(s => s.url) },
      },
    });

    expect(afterFirst).toBe(2);
    expect(afterSecond).toBe(2); // upserted, not duplicated
    expect(refsAfterFirst).toBe(2);
    expect(refsAfterSecond).toBe(2); // find-or-create, not duplicated

    const claim = await prisma.marketingAgencyClaim.findUniqueOrThrow({
      where: { id: 'itest-claim' },
    });
    expect(claim.evidenceStatus).toBe('verified');
  });

  it('tenancy: a cross-org claimId is dropped — no retrieval, no flip', async () => {
    const search = jest.fn();
    const deps = {
      db: prisma,
      retrievers: [
        { ...mockRetriever(FIXTURE_SOURCES), search } as EvidenceRetriever,
      ],
      scorer: createLlmEntailmentScorer({ complete: transport(SUPPORTS) }),
    };

    const result = await runVerifyClaim(
      deps,
      { ...JOB_DATA, organizationId: 'some-other-org' },
      'itest-job-4'
    );
    expect(result.status).toBe('claim_not_found');
    expect(search).not.toHaveBeenCalled();

    const claim = await prisma.marketingAgencyClaim.findUniqueOrThrow({
      where: { id: 'itest-claim' },
    });
    expect(claim.evidenceStatus).toBe('blocked'); // untouched
  });
});
