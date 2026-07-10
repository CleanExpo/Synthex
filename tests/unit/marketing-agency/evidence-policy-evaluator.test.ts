/**
 * Unit tests for evaluateAndApplyEvidencePolicy (SYN-MCP-006 wiring).
 *
 * Pins the evaluator contract:
 *   - bundle beats v1 in BOTH directions (refuted scores flip a
 *     sourceRef-verified claim to 'disputed'; strong scores verify a
 *     source-less claim);
 *   - 0 score rows → v1 sourceRef-presence fallback truth table, persisted
 *     through the same applyEvidenceVerdict writer (v1-marked bundle);
 *   - insufficient → 'blocked' WRITTEN via the applyEvidenceVerdict path
 *     (bench must_fix `verdict-mapping-conflict`: merged VERDICT_TO_STATUS
 *     maps insufficient→'blocked' — the brief's "untouched on insufficient"
 *     was self-contradictory and the merged code is authoritative);
 *   - rehydration edge cases (must_fix `bundle-rehydration-contract`):
 *     null-url sourceRef rows are skipped + recorded in the persisted
 *     aggregate reasons; null retrievedAt falls back to the score's scoredAt;
 *   - org scoping: a claim outside the org is never evaluated or written.
 */
import type { PrismaClient } from '@prisma/client';
import {
  evaluateAndApplyEvidencePolicy,
  rehydrateScoredSources,
  V1_FALLBACK_POLICY_ID,
  type ScoreRowWithSourceRef,
} from '@/lib/marketing-agency/evidence-policy';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function claimRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'claim-1',
    claimType: 'factual',
    sourceRefId: null,
    evidenceStatus: 'blocked',
    ...overrides,
  };
}

function scoreRow(
  overrides: Partial<ScoreRowWithSourceRef> & {
    sourceRef?: Partial<NonNullable<ScoreRowWithSourceRef['sourceRef']>>;
  } = {}
): ScoreRowWithSourceRef {
  const { sourceRef, ...rest } = overrides;
  return {
    sourceRefId: 'ref-1',
    stance: 'supports',
    confidence: 0.9,
    scorer: 'llm-judge-v1',
    rationale: null,
    scoredAt: new Date('2026-07-01T00:00:00.000Z'),
    ...rest,
    sourceRef: {
      id: 'ref-1',
      url: 'https://a.example.com/study',
      label: 'Study A',
      contentHash: 'hash-a',
      retrievedAt: new Date('2026-07-01T00:00:00.000Z'),
      provider: 'firecrawl',
      excerpt: 'excerpt A',
      ...sourceRef,
    },
  };
}

interface MockDb {
  db: PrismaClient;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  updateMany: jest.Mock;
}

function mockDb(
  claim: Record<string, unknown> | null,
  scores: ScoreRowWithSourceRef[]
): MockDb {
  const findFirst = jest.fn().mockResolvedValue(claim);
  const findMany = jest.fn().mockResolvedValue(scores);
  const updateMany = jest.fn().mockResolvedValue({ count: claim ? 1 : 0 });
  const db = {
    marketingAgencyClaim: { findFirst, updateMany },
    claimEvidenceScore: { findMany },
  } as unknown as PrismaClient;
  return { db, findFirst, findMany, updateMany };
}

const ORG = 'org-1';

// ---------------------------------------------------------------------------
// Bundle beats v1
// ---------------------------------------------------------------------------

describe('evaluateAndApplyEvidencePolicy — bundle beats v1', () => {
  test('sourceRef present (v1 would say verified) but refuted scores → disputed written', async () => {
    const { db, updateMany } = mockDb(
      claimRow({ sourceRefId: 'src-1', evidenceStatus: 'verified' }),
      [scoreRow({ stance: 'refutes', confidence: 0.9 })]
    );

    const result = await evaluateAndApplyEvidencePolicy(db, {
      organizationId: ORG,
      claimId: 'claim-1',
    });

    expect(result.outcome).toBe('bundle');
    expect(result.written).toBe('disputed');
    expect(result.decision?.bundle.aggregate.verdict).toBe('refuted');
    expect(updateMany).toHaveBeenCalledTimes(1);
    const call = updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'claim-1', organizationId: ORG });
    expect(call.data.evidenceStatus).toBe('disputed');
  });

  test('no sourceRef (v1 would say blocked) but 2 supporting distinct-domain scores → verified written', async () => {
    const { db, updateMany } = mockDb(claimRow({ sourceRefId: null }), [
      scoreRow(),
      scoreRow({
        sourceRefId: 'ref-2',
        sourceRef: { id: 'ref-2', url: 'https://b.example.org/report' },
      }),
    ]);

    const result = await evaluateAndApplyEvidencePolicy(db, {
      organizationId: ORG,
      claimId: 'claim-1',
    });

    expect(result.outcome).toBe('bundle');
    expect(result.written).toBe('verified');
    expect(updateMany.mock.calls[0][0].data.evidenceStatus).toBe('verified');
  });

  test('insufficient (1 of 2 required sources) → "blocked" IS WRITTEN via applyEvidenceVerdict', async () => {
    const { db, updateMany } = mockDb(
      claimRow({ sourceRefId: 'src-1', evidenceStatus: 'verified' }),
      [scoreRow()]
    );

    const result = await evaluateAndApplyEvidencePolicy(db, {
      organizationId: ORG,
      claimId: 'claim-1',
    });

    expect(result.outcome).toBe('bundle');
    expect(result.decision?.bundle.aggregate.verdict).toBe('insufficient');
    // must_fix `verdict-mapping-conflict`: merged VERDICT_TO_STATUS is
    // authoritative — insufficient → 'blocked' written (NOT left untouched).
    expect(result.written).toBe('blocked');
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0][0].data.evidenceStatus).toBe('blocked');
  });

  test('not_required claim type with scores → no write (column untouched)', async () => {
    const { db, updateMany } = mockDb(
      claimRow({ claimType: 'subjective', evidenceStatus: 'pending_evidence' }),
      [scoreRow()]
    );

    const result = await evaluateAndApplyEvidencePolicy(db, {
      organizationId: ORG,
      claimId: 'claim-1',
    });

    expect(result.outcome).toBe('bundle');
    expect(result.written).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// v1 fallback (0 score rows)
// ---------------------------------------------------------------------------

describe('evaluateAndApplyEvidencePolicy — v1 fallback truth table (no scores)', () => {
  test.each([
    ['src-1', 'factual', 'verified'],
    [null, 'factual', 'blocked'],
    [null, 'subjective', 'pending_evidence'],
  ])(
    'sourceRefId=%s claimType=%s → %s written via the same writer',
    async (sourceRefId, claimType, expected) => {
      const { db, updateMany } = mockDb(
        claimRow({ sourceRefId, claimType }),
        []
      );

      const result = await evaluateAndApplyEvidencePolicy(db, {
        organizationId: ORG,
        claimId: 'claim-1',
      });

      expect(result.outcome).toBe('v1_fallback');
      expect(result.written).toBe(expected);
      expect(updateMany).toHaveBeenCalledTimes(1);
      const call = updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'claim-1', organizationId: ORG });
      expect(call.data.evidenceStatus).toBe(expected);
      // The persisted aggregate is v1-marked (auditable fallback).
      const aggregate = JSON.parse(call.data.evidenceNotes);
      expect(aggregate.policyId).toBe(V1_FALLBACK_POLICY_ID);
    }
  );
});

// ---------------------------------------------------------------------------
// Rehydration edge cases
// ---------------------------------------------------------------------------

describe('rehydrateScoredSources — bundle rehydration contract', () => {
  test('null-url sourceRef rows are skipped and recorded', () => {
    const { sources, skipped } = rehydrateScoredSources([
      scoreRow(),
      scoreRow({
        sourceRefId: 'ref-null',
        sourceRef: { id: 'ref-null', url: null },
      }),
    ]);
    expect(sources).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toContain('ref-null');
    expect(skipped[0]).toContain('no URL');
  });

  test('null retrievedAt falls back to the score row scoredAt', () => {
    const { sources } = rehydrateScoredSources([
      scoreRow({
        scoredAt: new Date('2026-07-05T12:00:00.000Z'),
        sourceRef: { retrievedAt: null },
      }),
    ]);
    expect(sources[0].retrievedAt).toBe('2026-07-05T12:00:00.000Z');
  });

  test('publishedAt is always null (unknown age) and domain derives from url', () => {
    const { sources } = rehydrateScoredSources([scoreRow()]);
    expect(sources[0].publishedAt).toBeNull();
    expect(sources[0].domain).toBe('a.example.com');
    expect(sources[0].stance).toBe('supports');
    expect(sources[0].confidence).toBe(0.9);
  });

  test('skip reasons are appended to the PERSISTED aggregate', async () => {
    const { db, updateMany } = mockDb(claimRow({ sourceRefId: null }), [
      scoreRow(),
      scoreRow({
        sourceRefId: 'ref-null',
        sourceRef: { id: 'ref-null', url: null },
      }),
    ]);

    await evaluateAndApplyEvidencePolicy(db, {
      organizationId: ORG,
      claimId: 'claim-1',
    });

    // 1 usable source of 2 required → insufficient → 'blocked' written; the
    // aggregate stored on the claim must carry the skip reason.
    const aggregate = JSON.parse(
      updateMany.mock.calls[0][0].data.evidenceNotes
    );
    expect(aggregate.verdict).toBe('insufficient');
    expect(aggregate.reasons.some((r: string) => r.includes('ref-null'))).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// Org scoping
// ---------------------------------------------------------------------------

describe('evaluateAndApplyEvidencePolicy — org scoping', () => {
  test('claim outside the org → not_found, nothing read or written', async () => {
    const { db, findFirst, findMany, updateMany } = mockDb(null, []);

    const result = await evaluateAndApplyEvidencePolicy(db, {
      organizationId: 'other-org',
      claimId: 'claim-1',
    });

    expect(result.outcome).toBe('not_found');
    expect(result.written).toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'claim-1', organizationId: 'other-org' },
      })
    );
    expect(findMany).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  test('score-row read is org-scoped', async () => {
    const { db, findMany } = mockDb(claimRow(), [scoreRow()]);
    await evaluateAndApplyEvidencePolicy(db, {
      organizationId: ORG,
      claimId: 'claim-1',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { claimId: 'claim-1', organizationId: ORG },
      })
    );
  });
});
