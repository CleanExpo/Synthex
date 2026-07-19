/**
 * §15.9 ALWAYS-HUMAN-GATED INVARIANT — SYN-1075.
 *
 * The core safety guarantee of the nexus-viral publish path:
 *
 *   No path may create OR transition a youtube/tiktok publish_queue row into
 *   pending/publishing EXCEPT the human release route.
 *
 * This is enforced by two source-level guards that fail if a future change
 * quietly re-arms an automated publish:
 *
 *   (1) `AUTO_PUBLISH_PLATFORMS` (which feeds `seedPublishQueue`, the only
 *       automated producer of `pending` rows from approved calendar slots)
 *       MUST NOT contain 'youtube' or 'tiktok'. If it did, gated video cuts
 *       would be seeded straight to `pending` and bypass the human gate.
 *       (The behavioural companion — `seedPublishQueue` skips youtube/tiktok
 *       slots — lives in __tests__/publish/publishQueue.test.ts.)
 *
 *   (2) The ONLY production file that transitions a `queued_human_gated` row
 *       into `pending` is the human release route. Any other file that both
 *       references `queued_human_gated` and writes `status: 'pending'` is an
 *       ungated auto-publish and fails this test.
 */

// ── Behavioural mocks (SYN-1094 N1) ───────────────────────────────────────────
// The grep tests above are defence-in-depth. The REAL guarantee is behavioural:
// the queue's due-fetch `where` filters `status IN ('pending','failed')`, so a
// `queued_human_gated` row is invisible to `processPublishQueue` and can never be
// dispatched. These mocks let the behavioural describe block at the bottom of the
// file exercise that fetch with a mocked prisma. They do NOT affect the fs-based
// grep tests above (which import nothing that is mocked here). jest.mock is
// hoisted, so declaring these here is equivalent to top-of-file.
//
// NOTE: jest.worktree.cjs sets resetMocks:true — mock IMPLEMENTATIONS are wiped
// before each test, so they are (re)applied in the behavioural block's beforeEach.
const mockPublishQueueItem = {
  findMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
};
const mockRunSafetyChecks = jest.fn();
const mockBehaviouralLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { publishQueueItem: mockPublishQueueItem },
}));
jest.mock('@/lib/logger', () => ({ logger: mockBehaviouralLogger }));
jest.mock('@/lib/publish/safetyChecks', () => ({
  __esModule: true,
  runSafetyChecks: (...args: unknown[]) => mockRunSafetyChecks(...args),
}));

import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { processPublishQueue } from '@/lib/publish/publishQueue';

const ROOT = process.cwd();
const SCAN_DIRS = ['lib', 'app', 'components', 'hooks'];
const RELEASE_ROUTE = path
  .join('app', 'api', 'publish-queue', 'release', 'route.ts')
  .replace(/\\/g, '/');

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (
      entry === 'node_modules' ||
      entry === '__tests__' ||
      entry === 'tests'
    ) {
      continue;
    }
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.|\.spec\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = SCAN_DIRS.flatMap(d => walk(path.join(ROOT, d)));

describe('§15.9 invariant — AUTO_PUBLISH_PLATFORMS excludes video platforms', () => {
  it('never contains youtube or tiktok', () => {
    const src = readFileSync(
      path.join(ROOT, 'lib', 'publish', 'publishQueue.ts'),
      'utf8'
    );

    // Isolate the AUTO_PUBLISH_PLATFORMS Set literal.
    const match = src.match(
      /AUTO_PUBLISH_PLATFORMS\s*=\s*new Set\(\[([\s\S]*?)\]\)/
    );
    expect(match).not.toBeNull();
    const setBody = match![1];

    expect(setBody).not.toMatch(/['"]youtube['"]/);
    expect(setBody).not.toMatch(/['"]tiktok['"]/);
    // Sanity: the caption-only platforms are still present.
    expect(setBody).toMatch(/['"]instagram['"]/);
  });
});

describe('§15.9 invariant — only the release route transitions gated→pending', () => {
  it('scanned a non-trivial number of source files', () => {
    // Guards against a broken walk silently passing the test below.
    expect(sourceFiles.length).toBeGreaterThan(50);
  });

  it('no automated path transitions queued_human_gated into pending', () => {
    const offenders = sourceFiles.filter(file => {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('queued_human_gated')) return false;
      // A TRANSITION is an update/updateMany on the publish_queue that writes a
      // pending/publishing status. `deriveSocialCut` (social-derivation.ts) is
      // NOT flagged: it only *creates* a gated row (`publishQueueItem.create`)
      // and its `status: 'pending'` write is on a `videoAsset`, not the queue.
      const updatesQueue = /publishQueueItem\.(update|updateMany)\b/.test(src);
      const writesPending = /status:\s*['"](pending|publishing)['"]/.test(src);
      return updatesQueue && writesPending;
    });

    const normalised = offenders.map(f =>
      path.relative(ROOT, f).replace(/\\/g, '/')
    );

    // The human release route is the sole permitted transition site.
    expect(normalised).toEqual([RELEASE_ROUTE]);
  });
});

// ── §15.9 invariant — BEHAVIOURAL: the due-fetch never selects a gated row ─────
// SYN-1094 N1: the grep tripwires above are defence-in-depth. The ACTUAL runtime
// guarantee is that `processPublishQueue`'s due-fetch `where` filters
// `status IN ('pending','failed')`. A `queued_human_gated` row is therefore
// invisible to the processor — it is never fetched, never claimed, never
// dispatched to a platform adapter. These tests prove that behaviourally against
// a mocked prisma (see lib/publish/publishQueue.ts `processPublishQueue`, the
// `prisma.publishQueueItem.findMany({ where: { OR: [...] } })` due-fetch).

/**
 * Minimal evaluator for the exact due-fetch `where` shape:
 *   { OR: [ { status, scheduledAt: { lte } }, { status, nextRetryAt: { lte } } ] }
 * so the mocked `findMany` genuinely FILTERS a seeded dataset by the real
 * predicate (not a hand-waved return value). Supports `{ lte: Date }` range
 * conditions and scalar equality; unknown shapes fall back to strict equality.
 */
type WhereLeaf = { lte?: Date } | string | null | undefined;
type WhereClause = Record<string, WhereLeaf>;
type DueWhere = { OR?: WhereClause[] } & WhereClause;

function matchesLeaf(rowValue: unknown, cond: WhereLeaf): boolean {
  if (cond !== null && typeof cond === 'object' && 'lte' in cond && cond.lte) {
    const a = rowValue instanceof Date ? rowValue.getTime() : Number(rowValue);
    return a <= cond.lte.getTime();
  }
  return rowValue === cond;
}

function matchesClause(
  row: Record<string, unknown>,
  clause: WhereClause
): boolean {
  return Object.entries(clause).every(([k, cond]) => matchesLeaf(row[k], cond));
}

function matchesWhere(row: Record<string, unknown>, where: DueWhere): boolean {
  if (Array.isArray(where.OR)) {
    return where.OR.some(clause => matchesClause(row, clause));
  }
  return matchesClause(row, where);
}

describe('§15.9 invariant — due-fetch is blind to queued_human_gated rows', () => {
  const NOW = Date.now();
  const past = (ms: number) => new Date(NOW - ms);
  const future = (ms: number) => new Date(NOW + ms);

  // A representative mix of queue rows, all past-due by their timestamps. Only
  // `pending` and retry-ready `failed` rows are legitimately due; the gated row
  // and a not-yet-retryable failed row must be excluded by the where clause.
  const SEED = [
    {
      id: 'qi-pending-due',
      status: 'pending',
      platform: 'instagram',
      scheduledAt: past(60_000),
      nextRetryAt: null,
      publishedAt: null,
    },
    {
      id: 'qi-failed-retry-ready',
      status: 'failed',
      platform: 'facebook',
      scheduledAt: past(60_000),
      nextRetryAt: past(1_000),
      publishedAt: null,
    },
    {
      id: 'qi-gated-youtube',
      status: 'queued_human_gated',
      platform: 'youtube',
      scheduledAt: past(60_000),
      nextRetryAt: null,
      publishedAt: null,
    },
    {
      id: 'qi-gated-tiktok',
      status: 'queued_human_gated',
      platform: 'tiktok',
      scheduledAt: past(60_000),
      nextRetryAt: null,
      publishedAt: null,
    },
    {
      id: 'qi-failed-not-ready',
      status: 'failed',
      platform: 'linkedin',
      scheduledAt: past(60_000),
      nextRetryAt: future(60_000), // backoff not yet elapsed
    },
  ];

  beforeEach(() => {
    // resetMocks:true wiped implementations — re-apply them here.
    // Safety gates fail-closed to a HOLD so each processed item resolves via a
    // single publishQueueItem.update WITHOUT reaching a platform adapter, token
    // decryption, or calendar lookup. That keeps this test focused on the
    // due-fetch selection, not the downstream publish machinery.
    mockRunSafetyChecks.mockResolvedValue({
      pass: false,
      failedGate: 'shadow_mode',
      reason: 'held for test',
    });
    mockPublishQueueItem.update.mockResolvedValue({});
    // updateMany backs the start-of-pass stale reclaim (where.status==='publishing',
    // no id) → nothing stale (count 0); and the per-item atomic claim (where.id)
    // → count 1. A held item never reaches the claim, but keep the discriminator.
    mockPublishQueueItem.updateMany.mockImplementation(
      (args: { where?: { id?: string } }) =>
        Promise.resolve({ count: args?.where?.id ? 1 : 0 })
    );
    // The mocked findMany applies the REAL where predicate to the seeded rows.
    mockPublishQueueItem.findMany.mockImplementation(
      (args: { where: DueWhere }) =>
        Promise.resolve(SEED.filter(row => matchesWhere(row, args.where)))
    );
  });

  it('the due-fetch where clause selects only pending + failed, never queued_human_gated', async () => {
    mockPublishQueueItem.findMany.mockResolvedValue([]); // no processing needed

    await processPublishQueue();

    // Capture the where the processor actually asked the DB for.
    const call = mockPublishQueueItem.findMany.mock.calls[0][0] as {
      where: DueWhere;
    };
    const statuses = (call.where.OR ?? []).map(c => c.status);

    expect(statuses).toEqual(expect.arrayContaining(['pending', 'failed']));
    expect(statuses).not.toContain('queued_human_gated');
    // Belt-and-braces: the gated status must not appear anywhere in the where.
    expect(JSON.stringify(call.where)).not.toContain('queued_human_gated');
  });

  it('a queued_human_gated row is filtered out — never processed, claimed, or updated', async () => {
    const result = await processPublishQueue();

    // Only the two legitimately-due rows (pending + retry-ready failed) are
    // processed; the two gated rows and the not-yet-retryable failed row are
    // invisible to the due-fetch.
    expect(result.processed).toBe(2);

    // Whatever the processor touched, it never touched a gated row: no
    // update/updateMany may reference a gated row id.
    const gatedIds = ['qi-gated-youtube', 'qi-gated-tiktok'];
    const touchedIds = [
      ...mockPublishQueueItem.update.mock.calls,
      ...mockPublishQueueItem.updateMany.mock.calls,
    ]
      .map(([arg]: [{ where?: { id?: string } }]) => arg?.where?.id)
      .filter(Boolean);
    for (const gid of gatedIds) {
      expect(touchedIds).not.toContain(gid);
    }
  });

  it('only pending and retry-eligible failed rows are returned by the fetch', async () => {
    // Directly assert the filtered set the processor received: the pending-due
    // row and the retry-ready failed row — and nothing else (no gated rows, no
    // failed row whose backoff has not elapsed).
    let fetched: Array<{ id: string; status: string }> = [];
    mockPublishQueueItem.findMany.mockImplementation(
      (args: { where: DueWhere }) => {
        fetched = SEED.filter(row => matchesWhere(row, args.where));
        return Promise.resolve(fetched);
      }
    );

    await processPublishQueue();

    expect(fetched.map(r => r.id).sort()).toEqual([
      'qi-failed-retry-ready',
      'qi-pending-due',
    ]);
    // No returned row is gated, and every returned row is pending or failed.
    for (const row of fetched) {
      expect(row.status).not.toBe('queued_human_gated');
      expect(['pending', 'failed']).toContain(row.status);
    }
  });
});
