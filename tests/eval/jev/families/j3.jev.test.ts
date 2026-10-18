/** @jest-environment node */
/**
 * J3 Agent job scripts (spec: "JEV test harness", family J3).
 *
 * 30 synthetic jobs (channel x org x platform), each with one run id, walk
 * brief -> content -> approve (separate approver key) -> publish (platform
 * stub) -> measure over MCP, REST or both. Each step is one case, judged by
 * j3/detector.ts. Only boundaries are mocked: prisma (an in-memory fake that
 * also captures every write as part of the receipt), the AI provider, the
 * video generation service and the platform publish adapters (the stub).
 * The MCP route, its auth, the studio tool registry and the REST handlers are
 * the real code. Expected red until P4 and P7.
 */
import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { classify, recordResults, type JevResult } from '../runner/record';
import { invokeRoute } from '../runner/route-harness';
import {
  buildJobs,
  caseId,
  judgeStep,
  runIdFor,
  STEPS,
  type Job,
  type Step,
  type StepReceipt,
} from './j3/detector';

// ── Boundary fakes ──────────────────────────────────────────────────────────

interface MockKeyRow {
  id: string;
  organizationId: string;
  userId: string;
  label: string;
  scopes: string[];
  expiresAt: null;
  revokedAt: null;
}
const mockDb = {
  keys: new Map<string, MockKeyRow>(),
  writes: [] as unknown[],
  stubCalls: 0,
};
const WRITE_OPS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

function mockPrismaCall(model: string, op: string, args: unknown[]): unknown {
  const a = (args[0] ?? {}) as {
    where?: Record<string, unknown>;
    data?: Record<string, unknown>;
  };
  if (WRITE_OPS.has(op)) {
    // lastUsedAt stamps on the key row are auth bookkeeping, not receipts.
    if (model !== 'mcpApiKey') mockDb.writes.push({ model, op, args });
    return Promise.resolve({ id: `${model}-fake`, ...(a.data ?? {}) });
  }
  if (model === 'mcpApiKey' && op === 'findUnique')
    return Promise.resolve(
      mockDb.keys.get(String(a.where?.keyHash ?? '')) ?? null
    );
  if (model === 'organization' && (op === 'findUnique' || op === 'findFirst'))
    return Promise.resolve({
      id: a.where?.id,
      name: `Synthetic ${String(a.where?.id)}`,
      status: 'active',
      settings: {},
    });
  if (model === 'videoGeneration' && op === 'findFirst')
    return Promise.resolve({
      inputPrompt: `Synthetic rendered clip for ${String(a.where?.organizationId)}`,
      enhancedPrompt: null,
      methodCardId: null,
    });
  if (op === 'findMany' || op === 'groupBy') return Promise.resolve([]);
  if (op === 'count') return Promise.resolve(0);
  if (op === 'aggregate') return Promise.resolve({ _sum: {}, _count: 0 });
  return Promise.resolve(null);
}

function mockPrismaClient(): unknown {
  const client: unknown = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop === 'symbol' || prop === 'then') return undefined;
        if (prop === '$transaction')
          return (arg: unknown) =>
            typeof arg === 'function'
              ? (arg as (c: unknown) => unknown)(client)
              : Promise.all(arg as unknown[]);
        if (prop.startsWith('$')) return () => Promise.resolve(undefined);
        return new Proxy(
          {},
          {
            get: (_m, op) =>
              typeof op === 'string'
                ? (...args: unknown[]) => mockPrismaCall(prop, op, args)
                : undefined,
          }
        );
      },
    }
  );
  return client;
}

function mockStub(platform: string) {
  return () => {
    mockDb.stubCalls += 1;
    return Promise.resolve({
      success: true,
      externalId: `stub-${platform}-${mockDb.stubCalls}`,
    });
  };
}

jest.mock('@/lib/prisma', () => {
  const client = mockPrismaClient();
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/lib/services/ai/video/generation-service', () => ({
  submitGenerativeVideo: () => Promise.reject(new Error('not in J3')),
}));
jest.mock('@/lib/ai/providers', () => ({
  ...jest.requireActual('@/lib/ai/providers'),
  getAIProvider: () => ({
    complete: () =>
      Promise.resolve({
        choices: [{ message: { content: 'Synthetic caption for J3.' } }],
      }),
  }),
}));
jest.mock('@/lib/publish/platformAdapters/facebook', () => ({
  ...jest.requireActual('@/lib/publish/platformAdapters/facebook'),
  publishToFacebook: mockStub('facebook'),
}));
jest.mock('@/lib/publish/platformAdapters/instagram', () => ({
  ...jest.requireActual('@/lib/publish/platformAdapters/instagram'),
  publishToInstagram: mockStub('instagram'),
}));
jest.mock('@/lib/publish/platformAdapters/linkedin', () => ({
  ...jest.requireActual('@/lib/publish/platformAdapters/linkedin'),
  publishToLinkedIn: mockStub('linkedin'),
}));
jest.mock('@/lib/publish/platformAdapters/tiktok', () => ({
  ...jest.requireActual('@/lib/publish/platformAdapters/tiktok'),
  publishToTikTok: mockStub('tiktok'),
}));
jest.mock('@/lib/publish/platformAdapters/youtube', () => ({
  ...jest.requireActual('@/lib/publish/platformAdapters/youtube'),
  publishToYouTube: mockStub('youtube'),
}));

// ── Synthetic principals ────────────────────────────────────────────────────

const rawKey = (user: string) => `j3-fixture-key-${user}`;
const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');

function seedKeys(jobs: Job[]) {
  for (const job of jobs)
    for (const [user, scopes] of [
      [job.generator, ['creative', 'context', 'performance']],
      [job.approver, ['approvals']],
    ] as const)
      mockDb.keys.set(hash(rawKey(user)), {
        id: `key-${user}`,
        organizationId: job.org,
        userId: user,
        label: `J3 ${user}`,
        scopes: [...scopes],
        expiresAt: null,
        revokedAt: null,
      });
}

function held(): boolean {
  return (
    require('@/lib/autopilot/hold-for-review') as { HOLD_FOR_REVIEW: boolean }
  ).HOLD_FOR_REVIEW;
}

function errorText(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

// ── MCP surface ─────────────────────────────────────────────────────────────

const MCP_ROUTE = 'app/api/mcp/[transport]/route.ts';
type McpPost = (req: NextRequest) => Promise<Response>;
let mcpPost: McpPost | undefined;
let mcpImportError: string | undefined;

/**
 * The runner's invokeRoute passes a plain-object request; mcp-handler needs a
 * real web Request (stream body, Headers), so MCP calls go to the same route
 * module's POST with a real NextRequest instead.
 */
async function mcpRpc(
  user: string,
  method: string,
  params: Record<string, unknown> | undefined,
  runId: string
): Promise<{ status: number | null; rpc: any; error?: string }> {
  if (!mcpPost) return { status: null, rpc: null, error: mcpImportError };
  const req = new NextRequest('http://localhost:3000/api/mcp/mcp', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${rawKey(user)}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
      'X-Run-Id': runId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      ...(params ? { params } : {}),
    }),
  });
  let res: Response;
  try {
    res = await mcpPost(req);
  } catch (err) {
    return {
      status: null,
      rpc: null,
      error: `handler threw: ${errorText(err)}`,
    };
  }
  const text = await res.text();
  const frame = text
    .split('\n')
    .find(l => l.startsWith('data: '))
    ?.slice('data: '.length);
  try {
    return { status: res.status, rpc: JSON.parse(frame ?? text) };
  } catch {
    return { status: res.status, rpc: null, error: 'unparseable MCP response' };
  }
}

const MCP_TOOL_FOR: Record<Step, RegExp> = {
  brief: /brief/,
  content: /^draft_caption$/,
  approve: /^approvals_(decide|approve)$/,
  publish: /(^publish|_publish$)/,
  measure: /^performance_get_outcomes$/,
};
const MCP_ARGS: Record<Step, (job: Job) => Record<string, unknown>> = {
  brief: job => ({ objective: `J3 synthetic brief for ${job.org}` }),
  content: job => ({ jobId: `vg-${job.org}`, platform: job.platform }),
  approve: job => ({ itemId: `item-${job.slug}`, decision: 'approve' }),
  publish: job => ({ itemId: `item-${job.slug}`, platform: job.platform }),
  measure: () => ({ limit: 20 }),
};

async function mcpStep(job: Job, step: Step): Promise<StepReceipt> {
  const principal = step === 'approve' ? job.approver : job.generator;
  const base = {
    step,
    surface: 'mcp' as const,
    principal,
    writes: [] as unknown[],
    stubCalls: 0,
    held: held(),
  };
  const list = await mcpRpc(principal, 'tools/list', undefined, job.runId);
  if (list.status === null)
    return {
      ...base,
      via: MCP_ROUTE,
      reached: false,
      status: null,
      body: null,
      inconclusive: list.error,
    };
  const names: string[] = (list.rpc?.result?.tools ?? []).map(
    (t: { name: string }) => t.name
  );
  const tool = names.find(n => MCP_TOOL_FOR[step].test(n));
  if (list.status !== 200 || !tool)
    return {
      ...base,
      via: `mcp tools/list ${MCP_TOOL_FOR[step]}`,
      reached: false,
      status: list.status,
      body: null,
      note:
        list.status !== 200
          ? `tools/list status ${list.status}`
          : `no tool matching ${MCP_TOOL_FOR[step]} for scopes of ${principal} (${names.length} tools)`,
    };

  mockDb.writes = [];
  mockDb.stubCalls = 0;
  const call = await mcpRpc(
    principal,
    'tools/call',
    { name: tool, arguments: MCP_ARGS[step](job), _meta: { runId: job.runId } },
    job.runId
  );
  const result = call.rpc?.result;
  const text: string | undefined = result?.content?.[0]?.text;
  let body: unknown = result?.structuredContent ?? null;
  if (body === null && text)
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  const ok = call.status === 200 && !!result && !result.isError;
  return {
    ...base,
    via: `mcp ${tool}`,
    reached: ok,
    status: call.status,
    body,
    writes: [...mockDb.writes],
    stubCalls: mockDb.stubCalls,
    held: held(),
    inconclusive: call.status === null ? call.error : undefined,
    note: ok
      ? undefined
      : `tools/call error: ${text ?? call.rpc?.error?.message ?? call.error}`,
  };
}

// ── REST surface ────────────────────────────────────────────────────────────

const REST_FOR: Record<
  Step,
  {
    file: string;
    method: string;
    body?: (job: Job) => object;
    params?: (job: Job) => Record<string, string>;
    query?: string;
  }
> = {
  brief: {
    file: 'app/api/marketing/orchestrate/route.ts',
    method: 'POST',
    body: job => ({
      business: {
        slug: job.org.toLowerCase(),
        name: `Synthetic ${job.org}`,
        positioning: 'Synthetic positioning for a J3 fixture',
        audience: ['synthetic audience'],
      },
      objective: `J3 synthetic brief for ${job.platform}`,
    }),
  },
  content: {
    file: 'app/api/content/generate/route.ts',
    method: 'POST',
    body: job => ({
      platform: job.platform === 'youtube' ? 'tiktok' : job.platform,
      topic: `J3 synthetic topic for ${job.org}`,
    }),
  },
  approve: {
    file: 'app/api/approvals/[id]/route.ts',
    method: 'PATCH',
    body: () => ({ status: 'approved' }),
    params: job => ({ id: `appr-${job.slug}` }),
  },
  publish: {
    file: 'app/api/publish-queue/release/route.ts',
    method: 'POST',
    body: job => ({ itemIds: [`item-${job.slug}`], action: 'release' }),
  },
  measure: { file: 'app/api/analytics/route.ts', method: 'GET' },
};

async function restStep(job: Job, step: Step): Promise<StepReceipt> {
  const spec = REST_FOR[step];
  const principal = step === 'approve' ? job.approver : job.generator;
  mockDb.writes = [];
  mockDb.stubCalls = 0;
  const params = spec.params?.(job);
  const r = await invokeRoute(spec.file, spec.method, {
    headers: {
      authorization: `Bearer ${rawKey(principal)}`,
      'x-run-id': job.runId,
    },
    body: spec.body ? { ...spec.body(job), runId: job.runId } : undefined,
    params,
    ...(spec.method === 'GET'
      ? { url: `http://localhost:3000/api/analytics?runId=${job.runId}` }
      : {}),
  });
  const reached = r.status !== null && r.status >= 200 && r.status < 300;
  return {
    step,
    surface: 'rest',
    via: spec.file,
    reached,
    inconclusive: r.status === null ? r.error : undefined,
    status: r.status,
    body: r.json,
    writes: [...mockDb.writes],
    stubCalls: mockDb.stubCalls,
    principal,
    held: held(),
    note: reached
      ? undefined
      : `status ${r.status}${r.json && typeof r.json === 'object' && 'error' in r.json ? ` ${String((r.json as { error: unknown }).error)}` : ''}`,
  };
}

function surfaceFor(job: Job, step: Step): 'mcp' | 'rest' {
  if (job.channel === 'hybrid')
    return step === 'brief' || step === 'content' ? 'mcp' : 'rest';
  return job.channel;
}

// ── Planted jobs for the positive controls ──────────────────────────────────

interface PlantFlaws {
  foreignRunIdAt?: Step;
  selfApprove?: boolean;
  publishWhileHeld?: boolean;
  dropRunIdAt?: Step;
}

/**
 * A planted route handler per step: a fake REST surface that behaves like a
 * finished P7 job unless a flaw is planted. Its Response goes through the
 * same receipt fields and the same judgeStep as the real cases.
 */
async function plantedStep(
  job: Job,
  step: Step,
  flaws: PlantFlaws
): Promise<StepReceipt> {
  const principal =
    step === 'approve' && !flaws.selfApprove ? job.approver : job.generator;
  const isHeld = step === 'publish' && !!flaws.publishWhileHeld;
  mockDb.writes = [];
  mockDb.stubCalls = 0;
  const handler = async (req: Request): Promise<Response> => {
    const sent = req.headers.get('x-run-id') ?? '';
    const runId =
      flaws.foreignRunIdAt === step ? runIdFor('planted-other-job') : sent;
    const echo = flaws.dropRunIdAt === step ? {} : { runId };
    const result: Record<Step, () => Promise<object>> = {
      brief: async () => ({ briefId: `brief-${job.slug}` }),
      content: async () => ({ caption: 'Planted caption' }),
      approve: async () => ({ status: 'approved', approvedBy: principal }),
      publish: async () => {
        // Planted defect: the stub fires whatever the hold state says.
        const sentOut = await mockStub(job.platform)();
        return { status: 'stub_published', externalId: sentOut.externalId };
      },
      measure: async () => ({ events: [], total: 0 }),
    };
    return Response.json({ ...(await result[step]()), ...echo });
  };
  const res = await handler(
    new Request(`http://localhost/planted/${step}`, {
      method: 'POST',
      headers: { 'x-run-id': job.runId },
    })
  );
  return {
    step,
    surface: 'rest',
    via: `planted ${step} handler`,
    reached: res.status >= 200 && res.status < 300,
    status: res.status,
    body: await res.json(),
    writes: [...mockDb.writes],
    stubCalls: mockDb.stubCalls,
    principal,
    held: isHeld,
  };
}

// ── The family ──────────────────────────────────────────────────────────────

const results: JevResult[] = [];
afterAll(() => recordResults('J3', results));

beforeAll(() => {
  try {
    mcpPost = (require(`../../../../${MCP_ROUTE}`) as { POST: McpPost }).POST;
  } catch (err) {
    mcpImportError = `import failed: ${errorText(err)}`;
  }
});

it('J3 cases: 30 jobs x 5 steps', async () => {
  const jobs = buildJobs();
  seedKeys(jobs);
  for (const job of jobs)
    for (const step of STEPS) {
      const id = caseId(job, step);
      let receipt: StepReceipt;
      try {
        receipt =
          surfaceFor(job, step) === 'mcp'
            ? await mcpStep(job, step)
            : await restStep(job, step);
      } catch (err) {
        results.push({
          id,
          family: 'J3',
          kind: 'case',
          state: 'INCONCLUSIVE',
          detail: `step threw: ${errorText(err)}`,
        });
        continue;
      }
      const v = judgeStep(job, receipt);
      const detail = `${receipt.via}: ${v.reasons.join('; ') || 'ok'}`;
      results.push(
        v.verdict === 'INCONCLUSIVE'
          ? {
              id,
              family: 'J3',
              kind: 'case',
              state: 'INCONCLUSIVE',
              route: receipt.via,
              detail,
            }
          : {
              id,
              family: 'J3',
              kind: 'case',
              route: receipt.via,
              ...classify(id, v.verdict === 'PASS', detail),
            }
      );
    }
  expect(results.filter(r => r.kind === 'case')).toHaveLength(150);
});

it('J3 controls: planted defects are caught and the clean job passes', async () => {
  const job: Job = {
    slug: 'planted-orga-instagram',
    org: 'org-A',
    channel: 'rest',
    platform: 'instagram',
    runId: runIdFor('planted-orga-instagram'),
    generator: 'org-A-agent-generator',
    approver: 'org-A-agent-approver',
  };
  const controls: [string, Step, PlantFlaws, string][] = [
    [
      'J3-control-two-run-ids',
      'publish',
      { foreignRunIdAt: 'publish' },
      'run id mismatch',
    ],
    [
      'J3-control-self-approval',
      'approve',
      { selfApprove: true },
      'generator approved its own item',
    ],
    [
      'J3-control-publish-while-held',
      'publish',
      { publishWhileHeld: true },
      'publish fired while held',
    ],
    [
      'J3-control-missing-run-id',
      'measure',
      { dropRunIdAt: 'measure' },
      'receipt carries no run id',
    ],
  ];
  // The clean planted job must pass every step, so a catch below is the planted flaw, not a detector that is always red.
  const clean: string[] = [];
  for (const step of STEPS) {
    const v = judgeStep(job, await plantedStep(job, step, {}));
    if (v.verdict !== 'PASS') clean.push(`${step}: ${v.reasons.join('; ')}`);
  }
  for (const [id, step, flaws, expected] of controls) {
    const v = judgeStep(job, await plantedStep(job, step, flaws));
    const caught =
      clean.length === 0 &&
      v.verdict === 'FAIL' &&
      v.reasons.some(r => r.startsWith(expected));
    results.push({
      id,
      family: 'J3',
      kind: 'control',
      state: caught ? 'FAIL' : 'PASS',
      route: `planted ${step} handler`,
      detail: clean.length
        ? `clean planted job not green: ${clean.join(' | ')}`
        : v.reasons.join('; ') || 'not caught',
    });
  }
  expect(results.filter(r => r.kind === 'control')).toHaveLength(4);
});
