/**
 * SYN-MCP-007b — tasks_* + research_* namespaces, E2E against the SYN-MCP-000
 * Docker sandbox (real Postgres :5499, real Redis :6399, real bullmq).
 *
 * Proves the three 007b acceptance legs live:
 *   1. per-key tools/list with the NEW scopes through the REAL key chain
 *      (mint → sha-256 auth → toolsForScopes): ['tasks'] → 3, ['research'] → 3,
 *      [] → 0, '*' → 22;
 *   2. tasks_enqueue dedupe via the deterministic jobId against REAL bullmq +
 *      sandbox Redis (Linear fetch is fixture-mocked — the thing under proof
 *      is the queue path, not Linear's API), plus cross-org invisibility of
 *      the enqueued job through tasks_list/tasks_get;
 *   3. research_get_evidence_bundle over SEEDED sandbox rows, proving the
 *      read is PURE: claim.evidenceStatus in the DB is byte-identical before
 *      and after the call (bundle-read-no-write).
 *
 * The only substitutions are the Prisma client wiring ('@/lib/prisma' →
 * sandbox client) and the Linear client (recorded fixture) — bullmq and
 * Postgres are REAL sandbox backends.
 */
jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

const mockLinearIssue = jest.fn();
jest.mock('@/lib/linear/client', () => ({
  getLinearClient: () => ({
    issue: (...a: unknown[]) => mockLinearIssue(...a),
  }),
}));

import prisma from '@/lib/prisma';
import { resolveOrgFromBearer } from '@/app/api/mcp/auth';
import { POST } from '@/app/api/admin/mcp-keys/route';
import {
  ALL_MCP_TOOLS,
  executeStudioTool,
  toolsForScopes,
} from '@/lib/services/ai/studio-tools';
import { getQueue, QUEUE_NAMES } from '@/lib/queue/bull-queue';
import {
  assertSandboxDatabaseUrl,
  assertSandboxRedisUrl,
} from './setup/sandbox-guard';

const ADMIN_KEY = 'itest-admin-api-key';
const ORG = 'itest-org'; // the seeded org (owns itest-claim)
const OTHER_ORG = 'itest-org-007b-other';

const ctx = (organizationId: string) => ({
  userId: 'itest-user',
  organizationId,
  initiatedBy: 'mcp' as const,
});

function adminRequest(opts: { body?: unknown } = {}): any {
  return {
    url: 'http://localhost/api/admin/mcp-keys',
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'x-admin-api-key' ? ADMIN_KEY : null,
    },
    cookies: { get: () => undefined },
    json: async () => opts.body,
  };
}

async function mintKey(scopes?: string[]): Promise<string> {
  const res = await POST(
    adminRequest({
      body: {
        organizationId: ORG,
        userId: 'itest-user',
        label: `itest-007b-${scopes?.join('+') ?? 'default'}`,
        ...(scopes ? { scopes } : {}),
      },
    })
  );
  expect(res.status).toBe(201);
  return (await res.json()).key;
}

const LINEAR_ISSUE_FIXTURE = {
  id: 'itest-linear-issue-007b',
  identifier: 'SYN-ITEST-007B',
  title: 'Integration test autonomous issue',
  description: 'Body\n- [ ] itest criterion',
  labels: async () => ({ nodes: [{ id: 'l1', name: 'autonomous' }] }),
  state: Promise.resolve({ id: 's1', name: 'Todo', type: 'unstarted' }),
};

describe('SYN-MCP-007b — tasks_* + research_* (sandbox E2E)', () => {
  assertSandboxDatabaseUrl(process.env.DATABASE_URL);
  assertSandboxRedisUrl(process.env.REDIS_URL);

  beforeAll(() => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    delete process.env.SYNTHEX_MCP_KEYS;
    delete process.env.SYNTHEX_MCP_LEGACY_KEYS;
  });

  beforeEach(() => {
    mockLinearIssue.mockResolvedValue(LINEAR_ISSUE_FIXTURE);
  });

  afterAll(async () => {
    await getQueue(QUEUE_NAMES.AUTONOMOUS_TASKS).obliterate({ force: true });
    await prisma.mcpApiKey.deleteMany({
      where: { label: { startsWith: 'itest-007b-' } },
    });
    await prisma.$disconnect();
  });

  // ── Leg 1: per-key tools/list with the new scopes ─────────────────────────

  it("a ['tasks']-scoped key sees exactly the 3 tasks_* tools", async () => {
    const key = await mintKey(['tasks']);
    const caller = await resolveOrgFromBearer(`Bearer ${key}`);
    expect(caller).not.toBeNull();
    expect(
      toolsForScopes(caller!.scopes)
        .map(t => t.name)
        .sort()
    ).toEqual(['tasks_enqueue', 'tasks_get', 'tasks_list']);
  });

  it("a ['research']-scoped key sees exactly the 3 research_* tools", async () => {
    const key = await mintKey(['research']);
    const caller = await resolveOrgFromBearer(`Bearer ${key}`);
    expect(
      toolsForScopes(caller!.scopes)
        .map(t => t.name)
        .sort()
    ).toEqual([
      'research_fetch',
      'research_get_evidence_bundle',
      'research_search',
    ]);
  });

  it('a zero-scope key sees ZERO tools; a wildcard key sees all 22', async () => {
    const zero = await resolveOrgFromBearer(`Bearer ${await mintKey()}`);
    expect(toolsForScopes(zero!.scopes)).toEqual([]);

    const wild = await resolveOrgFromBearer(`Bearer ${await mintKey(['*'])}`);
    const names = toolsForScopes(wild!.scopes).map(t => t.name);
    expect(names).toHaveLength(22);
    expect(names).toHaveLength(ALL_MCP_TOOLS.length);
    expect(names).toEqual(
      expect.arrayContaining(['tasks_enqueue', 'research_search'])
    );
  });

  // ── Leg 2: tasks_enqueue dedupe on REAL bullmq + org-pinned reads ─────────

  it('tasks_enqueue: first call enqueues, identical second call dedupes (real Redis); job is org-pinned', async () => {
    const first = (await executeStudioTool(
      'tasks_enqueue',
      { issueId: 'SYN-ITEST-007B' },
      ctx(ORG)
    )) as { enqueued: boolean; deduped: boolean; jobId: string };
    expect(first.enqueued).toBe(true);
    expect(first.deduped).toBe(false);
    expect(first.jobId).toMatch(
      /^linear:itest-linear-issue-007b:[0-9a-f]{16}$/
    );

    const second = (await executeStudioTool(
      'tasks_enqueue',
      { issueId: 'SYN-ITEST-007B' },
      ctx(ORG)
    )) as { enqueued: boolean; deduped: boolean; jobId: string };
    expect(second.enqueued).toBe(false);
    expect(second.deduped).toBe(true);
    expect(second.jobId).toBe(first.jobId);

    // Exactly ONE job with the deterministic id on the real queue.
    const queue = getQueue(QUEUE_NAMES.AUTONOMOUS_TASKS);
    const jobs = await queue.getJobs(['waiting', 'delayed', 'prioritized']);
    expect(jobs.filter(j => j?.id === first.jobId)).toHaveLength(1);

    // Same-org read sees it, with the mcp/org-pinned envelope.
    const got = (await executeStudioTool(
      'tasks_get',
      { jobId: first.jobId },
      ctx(ORG)
    )) as { task: { envelope: { source: string; organizationId: string } } };
    expect(got.task.envelope).toMatchObject({
      source: 'mcp',
      organizationId: ORG,
    });

    // Cross-org invisibility: another org's caller sees null / empty.
    await expect(
      executeStudioTool('tasks_get', { jobId: first.jobId }, ctx(OTHER_ORG))
    ).resolves.toEqual({ task: null, error: null });
    const otherList = (await executeStudioTool(
      'tasks_list',
      {},
      ctx(OTHER_ORG)
    )) as { tasks: unknown[]; error: string | null };
    expect(otherList.error).toBeNull();
    expect(otherList.tasks).toEqual([]);

    // Same-org list surfaces the job.
    const list = (await executeStudioTool('tasks_list', {}, ctx(ORG))) as {
      tasks: Array<{ jobId: string }>;
    };
    expect(list.tasks.map(t => t.jobId)).toContain(first.jobId);
  });

  // ── Leg 3: research_get_evidence_bundle is a PURE read over seeded pg ─────

  it('research_get_evidence_bundle materializes seeded score rows WITHOUT writing evidenceStatus', async () => {
    // TEST SETUP (not the tool): pin the claim to an evidence-required type
    // with a known evidenceStatus — other suites in this profile legitimately
    // mutate the shared seeded claim, so pin rather than assume.
    await prisma.marketingAgencyClaim.update({
      where: { id: 'itest-claim' },
      data: { claimType: 'factual', evidenceStatus: 'pending_evidence' },
    });
    // Seed one score row against the seeded claim (idempotent).
    const existing = await prisma.claimEvidenceScore.findFirst({
      where: { claimId: 'itest-claim', sourceRefId: 'itest-source-ref' },
      select: { id: true },
    });
    if (!existing) {
      await prisma.claimEvidenceScore.create({
        data: {
          organizationId: ORG,
          claimId: 'itest-claim',
          sourceRefId: 'itest-source-ref',
          stance: 'supports',
          confidence: 0.9,
          scorer: 'itest-scorer',
          rationale: 'itest rationale',
        },
      });
    }

    const before = await prisma.marketingAgencyClaim.findUnique({
      where: { id: 'itest-claim' },
      select: { evidenceStatus: true, metadata: true },
    });
    expect(before!.evidenceStatus).toBe('pending_evidence');

    const out = (await executeStudioTool(
      'research_get_evidence_bundle',
      { claimId: 'itest-claim' },
      ctx(ORG)
    )) as {
      bundle: { aggregate: { verdict: string }; sources: unknown[] };
      persistedEvidenceStatus: string;
      freshEvidenceStatus: string;
      scoreRowCount: number;
    };
    expect(out.scoreRowCount).toBeGreaterThanOrEqual(1);
    expect(out.bundle.sources.length).toBeGreaterThanOrEqual(1);
    expect(out.persistedEvidenceStatus).toBe('pending_evidence');
    // ONE qualifying domain < minSources 2 → honest 'insufficient' verdict
    // from the PURE evaluator, which MAPS to 'blocked'…
    expect(out.bundle.aggregate.verdict).toBe('insufficient');
    expect(out.freshEvidenceStatus).toBe('blocked');

    // …but ZERO WRITES happen: the DRIFT stays visible — evidenceStatus AND
    // metadata (reviewLog) are byte-identical after the call.
    const after = await prisma.marketingAgencyClaim.findUnique({
      where: { id: 'itest-claim' },
      select: { evidenceStatus: true, metadata: true },
    });
    expect(after!.evidenceStatus).toBe('pending_evidence');
    expect(JSON.stringify(after!.metadata)).toBe(
      JSON.stringify(before!.metadata)
    );
  });

  it('research_get_evidence_bundle: wrong-org claimId → bundle null (no error oracle, no reads leaked)', async () => {
    await expect(
      executeStudioTool(
        'research_get_evidence_bundle',
        { claimId: 'itest-claim' },
        ctx(OTHER_ORG)
      )
    ).resolves.toMatchObject({ bundle: null, persistedEvidenceStatus: null });
  });
});
