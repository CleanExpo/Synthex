/**
 * Unit tests for the verify-claim job (SYN-MCP-006 wiring).
 *
 * The handler core (runVerifyClaim) runs with fully injected deps
 * (bench must_fix `handler-di`) — mock db, mock retrievers, mock scorer.
 * Pins:
 *   - org-from-auth (must_fix): every db access is scoped by
 *     jobData.organizationId; a cross-tenant claimId is dropped untouched;
 *   - retrieved-source-persistence (must_fix): SourceRef rows are
 *     found-or-created on (org, campaign, url) with full provenance BEFORE
 *     the score upsert, createdById = the enqueuing userId;
 *   - reviewlog-additive-shape (must_fix): the audit entry is APPENDED with
 *     action 'evidence-verification' and the transition fields;
 *   - the handler NEVER writes evidenceStatus (its only claim write is the
 *     metadata reviewLog append) — the write is delegated to the evaluator;
 *   - enqueue helper + once-flag registration follow the repo queue pattern.
 */
import type { PrismaClient } from '@prisma/client';
import type { EvidenceRetriever } from '@/lib/evidence/retriever';
import type { SourceEvidence } from '@/lib/evidence/types';

const enqueueMock = jest.fn();
const registerHandlerMock = jest.fn();
jest.mock('@/lib/queue', () => ({
  enqueue: (...args: unknown[]) => enqueueMock(...args),
  registerHandler: (...args: unknown[]) => registerHandlerMock(...args),
  JobTypes: { EVIDENCE_VERIFY_CLAIM: 'evidence:verify-claim' },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const upsertScoreMock = jest.fn();
jest.mock('@/lib/evidence/entailment', () => ({
  upsertClaimEvidenceScore: (...args: unknown[]) => upsertScoreMock(...args),
  createLlmEntailmentScorer: jest.fn(),
  MAX_SCORED_SOURCES_PER_CLAIM: 5,
}));

const evaluateMock = jest.fn();
jest.mock('@/lib/marketing-agency/evidence-policy', () => ({
  evaluateAndApplyEvidencePolicy: (...args: unknown[]) => evaluateMock(...args),
}));

jest.mock('@/lib/evidence/retriever', () => ({
  getAvailableRetrievers: jest.fn(() => []),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG = 'org-1';
const JOB_DATA = { claimId: 'claim-1', organizationId: ORG, userId: 'user-1' };

function fixtureSource(
  overrides: Partial<SourceEvidence> = {}
): SourceEvidence {
  return {
    url: 'https://a.example.com/study',
    title: 'Study A',
    publishedAt: null,
    retrievedAt: '2026-07-10T00:00:00.000Z',
    provider: 'firecrawl',
    contentHash: 'hash-a',
    excerpt: 'excerpt A',
    domain: 'a.example.com',
    ...overrides,
  };
}

function mockRetriever(
  sources: SourceEvidence[],
  overrides: Partial<EvidenceRetriever> = {}
): EvidenceRetriever {
  return {
    id: 'firecrawl',
    capabilities: { canSearch: true, canFetch: true },
    available: () => true,
    search: jest.fn().mockResolvedValue(sources),
    fetch: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as EvidenceRetriever;
}

function mockScorer(stance = 'supports', confidence = 0.9) {
  return {
    id: 'llm-judge-v1',
    scoreSources: jest
      .fn()
      .mockImplementation(async ({ sources }: { sources: SourceEvidence[] }) =>
        sources.map(s => ({
          ...s,
          stance,
          confidence,
          scorer: 'llm-judge-v1',
        }))
      ),
  };
}

function mockDb(
  claim: Record<string, unknown> | null,
  options: {
    existingSourceRef?: { id: string } | null;
    metadata?: unknown;
  } = {}
) {
  const claimFindFirst = jest.fn().mockImplementation(async (args: any) => {
    if (args?.select?.metadata) return { metadata: options.metadata ?? {} };
    return claim;
  });
  const claimUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const refFindFirst = jest
    .fn()
    .mockResolvedValue(options.existingSourceRef ?? null);
  const refCreate = jest.fn().mockImplementation(async () => ({
    id: `ref-created-${refCreate.mock.calls.length}`,
  }));
  const refUpdate = jest.fn().mockResolvedValue({});
  const db = {
    marketingAgencyClaim: {
      findFirst: claimFindFirst,
      updateMany: claimUpdateMany,
    },
    marketingAgencySourceRef: {
      findFirst: refFindFirst,
      create: refCreate,
      update: refUpdate,
    },
  } as unknown as PrismaClient;
  return {
    db,
    claimFindFirst,
    claimUpdateMany,
    refFindFirst,
    refCreate,
    refUpdate,
  };
}

function baseClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: 'claim-1',
    organizationId: ORG,
    campaignId: 'campaign-1',
    statement: 'Acme cuts drying time by 40%',
    claimType: 'factual',
    evidenceStatus: 'blocked',
    sourceRef: null,
    metadata: {},
    ...overrides,
  };
}

const EVALUATION = {
  outcome: 'bundle',
  previousEvidenceStatus: 'blocked',
  written: 'verified',
  decision: {
    bundle: {
      claimId: 'claim-1',
      sources: [],
      aggregate: {
        verdict: 'verified',
        policyId: 'evidence-policy-v1',
        scoredAt: '2026-07-10T00:00:00.000Z',
        sourceAgeBasis: [],
        retrieversAvailable: ['firecrawl'],
        retrieversUsed: ['firecrawl'],
        reasons: [],
      },
    },
    evidenceStatus: 'verified',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  evaluateMock.mockResolvedValue(EVALUATION);
});

// ---------------------------------------------------------------------------

describe('runVerifyClaim — handler core (injected deps)', () => {
  test('happy path: retrieve → score → sourceRef create → score upsert → evaluate → reviewLog', async () => {
    const { runVerifyClaim } = await import('@/lib/evidence/verify-claim-job');
    const sources = [
      fixtureSource(),
      fixtureSource({ url: 'https://b.example.org/report', title: 'Report B' }),
    ];
    const { db, claimFindFirst, claimUpdateMany, refCreate } =
      mockDb(baseClaim());
    const retriever = mockRetriever(sources);
    const scorer = mockScorer();

    const result = await runVerifyClaim(
      { db, retrievers: [retriever], scorer },
      JOB_DATA,
      'job-1'
    );

    // Org-scoped claim lookup (must_fix org-from-auth).
    expect(claimFindFirst.mock.calls[0][0].where).toEqual({
      id: 'claim-1',
      organizationId: ORG,
    });

    // SourceRef persistence BEFORE the score upsert (must_fix
    // retrieved-source-persistence): org+campaign+url match, full provenance,
    // createdById = enqueuing userId.
    expect(refCreate).toHaveBeenCalledTimes(2);
    expect(refCreate.mock.calls[0][0].data).toMatchObject({
      organizationId: ORG,
      campaignId: 'campaign-1',
      createdById: 'user-1',
      label: 'Study A',
      url: 'https://a.example.com/study',
      sourceType: 'web',
      contentHash: 'hash-a',
      provider: 'firecrawl',
      excerpt: 'excerpt A',
    });
    expect(refCreate.mock.calls[0][0].data.retrievedAt).toEqual(
      new Date('2026-07-10T00:00:00.000Z')
    );

    // Score upserts carry the FK + org scope.
    expect(upsertScoreMock).toHaveBeenCalledTimes(2);
    expect(upsertScoreMock.mock.calls[0][1]).toMatchObject({
      organizationId: ORG,
      claimId: 'claim-1',
      sourceRefId: 'ref-created-1',
      stance: 'supports',
      confidence: 0.9,
      scorer: 'llm-judge-v1',
    });

    // Evaluator re-run with org-scoped input + retriever honesty fields.
    expect(evaluateMock).toHaveBeenCalledWith(
      db,
      { organizationId: ORG, claimId: 'claim-1' },
      expect.objectContaining({
        retrieversAvailable: ['firecrawl'],
        retrieversUsed: ['firecrawl'],
      })
    );

    // reviewLog append is the ONLY claim write from the handler — metadata
    // only, never evidenceStatus.
    expect(claimUpdateMany).toHaveBeenCalledTimes(1);
    const update = claimUpdateMany.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'claim-1', organizationId: ORG });
    expect(Object.keys(update.data)).toEqual(['metadata']);
    const entry = update.data.metadata.reviewLog[0];
    expect(entry).toMatchObject({
      action: 'evidence-verification',
      jobId: 'job-1',
      previousEvidenceStatus: 'blocked',
      newEvidenceStatus: 'verified',
      verdict: 'verified',
      policyId: 'evidence-policy-v1',
      scoredAt: '2026-07-10T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      status: 'completed',
      claimId: 'claim-1',
      previousEvidenceStatus: 'blocked',
      evidenceStatus: 'verified',
      verdict: 'verified',
      sourcesRetrieved: 2,
      scoresPersisted: 2,
    });
  });

  test('cross-tenant claimId → claim_not_found, nothing retrieved or written', async () => {
    const { runVerifyClaim } = await import('@/lib/evidence/verify-claim-job');
    const { db, claimUpdateMany } = mockDb(null);
    const retriever = mockRetriever([fixtureSource()]);
    const scorer = mockScorer();

    const result = await runVerifyClaim(
      { db, retrievers: [retriever], scorer },
      { ...JOB_DATA, organizationId: 'other-org' },
      'job-1'
    );

    expect(result.status).toBe('claim_not_found');
    expect(retriever.search).not.toHaveBeenCalled();
    expect(scorer.scoreSources).not.toHaveBeenCalled();
    expect(upsertScoreMock).not.toHaveBeenCalled();
    expect(evaluateMock).not.toHaveBeenCalled();
    expect(claimUpdateMany).not.toHaveBeenCalled();
  });

  test('dedupes retrieved sources by URL (search hit + linked sourceRef fetch)', async () => {
    const { runVerifyClaim } = await import('@/lib/evidence/verify-claim-job');
    const dup = fixtureSource();
    const { db } = mockDb(baseClaim({ sourceRef: { url: dup.url } }));
    const retriever = mockRetriever([dup, fixtureSource()], {
      fetch: jest.fn().mockResolvedValue(dup),
    });
    const scorer = mockScorer();

    const result = await runVerifyClaim(
      { db, retrievers: [retriever], scorer },
      JOB_DATA,
      'job-1'
    );

    expect(retriever.fetch).toHaveBeenCalledWith(dup.url);
    const scoredInput = (scorer.scoreSources as jest.Mock).mock.calls[0][0];
    expect(scoredInput.sources).toHaveLength(1);
    expect(result.sourcesRetrieved).toBe(1);
  });

  test('reuses an existing SourceRef (org+campaign+url match) and refreshes provenance', async () => {
    const { runVerifyClaim } = await import('@/lib/evidence/verify-claim-job');
    const { db, refFindFirst, refCreate, refUpdate } = mockDb(baseClaim(), {
      existingSourceRef: { id: 'ref-existing' },
    });

    await runVerifyClaim(
      {
        db,
        retrievers: [mockRetriever([fixtureSource()])],
        scorer: mockScorer(),
      },
      JOB_DATA,
      'job-1'
    );

    expect(refFindFirst.mock.calls[0][0].where).toEqual({
      organizationId: ORG,
      campaignId: 'campaign-1',
      url: 'https://a.example.com/study',
    });
    expect(refCreate).not.toHaveBeenCalled();
    expect(refUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ref-existing' },
        data: expect.objectContaining({ contentHash: 'hash-a' }),
      })
    );
    expect(upsertScoreMock.mock.calls[0][1].sourceRefId).toBe('ref-existing');
  });

  test('reviewLog entry is ADDITIVE alongside existing approve|reject entries', async () => {
    const { runVerifyClaim } = await import('@/lib/evidence/verify-claim-job');
    const priorEntry = { action: 'approve', reviewedBy: 'user-9' };
    const { db, claimUpdateMany } = mockDb(baseClaim(), {
      metadata: { reviewLog: [priorEntry], other: 'kept' },
    });

    await runVerifyClaim(
      { db, retrievers: [mockRetriever([])], scorer: mockScorer() },
      JOB_DATA,
      'job-1'
    );

    const metadata = claimUpdateMany.mock.calls[0][0].data.metadata;
    expect(metadata.other).toBe('kept');
    expect(metadata.reviewLog).toHaveLength(2);
    expect(metadata.reviewLog[0]).toEqual(priorEntry);
    expect(metadata.reviewLog[1].action).toBe('evidence-verification');
  });

  test('a failing retriever is logged and skipped, not fatal', async () => {
    const { runVerifyClaim } = await import('@/lib/evidence/verify-claim-job');
    const { db } = mockDb(baseClaim());
    const broken = mockRetriever([], {
      id: 'apify',
      search: jest.fn().mockRejectedValue(new Error('provider down')),
    });
    const working = mockRetriever([fixtureSource()]);

    const result = await runVerifyClaim(
      { db, retrievers: [broken, working], scorer: mockScorer() },
      JOB_DATA,
      'job-1'
    );

    expect(result.status).toBe('completed');
    expect(result.sourcesRetrieved).toBe(1);
  });
});

describe('queueVerifyClaim / registerVerifyClaimHandler', () => {
  test('enqueues with the evidence:verify-claim type and maxAttempts=1', async () => {
    const { queueVerifyClaim } =
      await import('@/lib/evidence/verify-claim-job');
    enqueueMock.mockResolvedValue({ id: 'job-1', status: 'pending' });

    const job = await queueVerifyClaim(JOB_DATA);

    expect(enqueueMock).toHaveBeenCalledWith(
      'evidence:verify-claim',
      JOB_DATA,
      expect.objectContaining({ maxAttempts: 1 })
    );
    expect(job.id).toBe('job-1');
  });

  test('registration is idempotent (once-flag)', async () => {
    jest.resetModules();
    const { registerVerifyClaimHandler } =
      await import('@/lib/evidence/verify-claim-job');
    registerVerifyClaimHandler();
    registerVerifyClaimHandler();
    expect(registerHandlerMock).toHaveBeenCalledTimes(1);
    expect(registerHandlerMock.mock.calls[0][0]).toBe('evidence:verify-claim');
  });
});
