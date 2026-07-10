/**
 * Unit tests for scripts/rescore-legacy-claims.ts (SYN-MCP-006 wiring).
 *
 * Pins:
 *   - candidate selection targets ONLY metadata.migratedLegacyVerified=true
 *     (the SYN-MCP-001 grandfather marker);
 *   - DRY-RUN BY DEFAULT: without execute:true, candidates are listed and
 *     NOTHING is enqueued;
 *   - execute:true enqueues one verify-claim job per candidate with
 *     {claimId, organizationId, userId=createdById} from the trusted DB row.
 */
import { rescoreLegacyClaims } from '../../../scripts/rescore-legacy-claims';

function legacyClaim(id: string) {
  return {
    id,
    organizationId: `org-${id}`,
    createdById: `user-${id}`,
    evidenceStatus: 'verified',
    statement: `Legacy claim ${id}`,
  };
}

function mockDb(claims: ReturnType<typeof legacyClaim>[]) {
  const findMany = jest.fn().mockResolvedValue(claims);
  return {
    db: { marketingAgencyClaim: { findMany } } as never,
    findMany,
  };
}

describe('rescoreLegacyClaims', () => {
  test('queries ONLY grandfathered claims (metadata.migratedLegacyVerified=true)', async () => {
    const { db, findMany } = mockDb([]);
    const enqueueFn = jest.fn();

    await rescoreLegacyClaims(db, { execute: false }, enqueueFn);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          metadata: { path: ['migratedLegacyVerified'], equals: true },
        },
      })
    );
  });

  test('dry-run (default): lists candidates, enqueues NOTHING', async () => {
    const { db } = mockDb([legacyClaim('a'), legacyClaim('b')]);
    const enqueueFn = jest.fn();

    const outcome = await rescoreLegacyClaims(
      db,
      { execute: false },
      enqueueFn
    );

    expect(outcome.dryRun).toBe(true);
    expect(outcome.candidates).toHaveLength(2);
    expect(outcome.enqueued).toBe(0);
    expect(enqueueFn).not.toHaveBeenCalled();
  });

  test('--execute: enqueues one verify-claim job per candidate from trusted row data', async () => {
    const { db } = mockDb([legacyClaim('a'), legacyClaim('b')]);
    const enqueueFn = jest.fn().mockResolvedValue({ id: 'job-x' });

    const outcome = await rescoreLegacyClaims(db, { execute: true }, enqueueFn);

    expect(outcome.dryRun).toBe(false);
    expect(outcome.enqueued).toBe(2);
    expect(enqueueFn).toHaveBeenNthCalledWith(1, {
      claimId: 'a',
      organizationId: 'org-a',
      userId: 'user-a',
    });
    expect(enqueueFn).toHaveBeenNthCalledWith(2, {
      claimId: 'b',
      organizationId: 'org-b',
      userId: 'user-b',
    });
  });

  test('no candidates: execute is a safe no-op', async () => {
    const { db } = mockDb([]);
    const enqueueFn = jest.fn();

    const outcome = await rescoreLegacyClaims(db, { execute: true }, enqueueFn);

    expect(outcome.enqueued).toBe(0);
    expect(enqueueFn).not.toHaveBeenCalled();
  });
});
