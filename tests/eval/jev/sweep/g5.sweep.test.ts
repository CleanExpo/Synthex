/**
 * JEV sweep G5 — an approved post gets published; an unapproved or rejected
 * one never does.
 *
 * SEAM: the real handlers, end to end, against the in-memory Prisma fake:
 *   PATCH /api/approvals/[id]   (approve / reject / request_revision, 1- and 2-step)
 *   GET   /api/cron/publish-scheduled (the scheduler that publishes posts)
 *   plus, for calendar_post, every app/api/cron route whose source reads
 *   calendarPost (found at run time; none on main).
 * The world starts where the publish gate left it: content in
 * 'pending_approval' with a campaign-authority manifest awaiting a human
 * verdict, and an approval request for it. Each case acts on the approval,
 * runs the scheduler, lets time pass (a future slot becomes due) and runs it
 * again. Boundaries mocked: Prisma, the platform services (`@/lib/social`
 * createPlatformService returns a counting stub, no network), rate limiters,
 * logger. Auth is a real JWT (tests/jest.setup.js secret).
 * Catches: approval that never re-queues the content, publishing of rejected,
 * partially approved, revision-requested or stale-approved content, publishing
 * when a gate fails, double publishing.
 * Misses: publishers other than the crons above (e.g. the publish_queue path,
 * which J8 covers), approval flows outside /api/approvals/[id].
 *
 * Criteria:
 *  G5.C1 fully approved, current version, gates clear -> published exactly
 *        once, and not before scheduledAt.
 *  G5.C2 rejected, partially approved, revision requested, or approved on a
 *        stale version -> never published.
 *  G5.C3 fully approved but a gate fails (no connection, autopilot post with
 *        auto-publish paused) -> not published.
 */
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import {
  invokeHandler,
  listRoutes,
  loadRouteModule,
  type InvokeResult,
} from '../runner/route-harness';
import { generateToken } from '@/lib/auth/jwt-utils';
import { Sink, disarmed, quietConsole, cutNetwork } from './lib/sink';
import { resetDb, table } from './lib/fake-db';

jest.mock('@/lib/prisma', () => require('./lib/fake-db').prismaModule());
jest.mock('@/lib/rate-limit', () =>
  require('./lib/passthrough-limiter').limiterModule()
);
jest.mock('@/lib/logger', () => ({
  logger: { info() {}, warn() {}, error() {}, debug() {} },
}));
jest.mock('@/lib/social', () => {
  const PLATFORMS = [
    'twitter',
    'linkedin',
    'instagram',
    'facebook',
    'tiktok',
    'youtube',
    'pinterest',
    'reddit',
    'threads',
  ];
  const calls = ((globalThis as { __g5Calls?: unknown[] }).__g5Calls ??= []);
  return {
    __esModule: true,
    SUPPORTED_PLATFORMS: PLATFORMS,
    isPlatformSupported: (p: string) => PLATFORMS.includes(p),
    createPlatformService: (platform: string) => ({
      createPost: async (post: Record<string, unknown>) => {
        calls.push({ platform, post });
        return {
          success: true,
          id: `${platform}-p${calls.length}`,
          postId: `${platform}-p${calls.length}`,
          url: 'https://example.test/p',
        };
      },
    }),
  };
});

const ROOT = path.join(__dirname, '../../../..');
const CRON = 'sweep-cron-not-a-secret';
const ORG = 'org-A';
const APPROVER = 'approver-1';
const AUTHOR = 'author-1';
const APPROVALS = 'app/api/approvals/[id]/route.ts';
const SCHEDULER = 'app/api/cron/publish-scheduled/route.ts';
const calls = ((
  globalThis as {
    __g5Calls?: { platform: string; post: Record<string, unknown> }[];
  }
).__g5Calls ??= []);

type Content = 'post' | 'calendar_post';
type Outcome =
  | 'approve'
  | 'approve-2-step'
  | 'partial-2-step'
  | 'reject'
  | 'request-revision'
  | 'approve-stale-version';
type When = 'past' | 'now' | 'future';
type Gate = 'clear' | 'no-connection' | 'autopilot-paused';
const OUTCOMES: Outcome[] = [
  'approve',
  'approve-2-step',
  'partial-2-step',
  'reject',
  'request-revision',
  'approve-stale-version',
];
const WHENS: When[] = ['past', 'now', 'future'];
const PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'youtube',
  'tiktok',
];
const GATES: Gate[] = ['clear', 'no-connection', 'autopilot-paused'];

let pendingManifest: (platform: string) => unknown;
const mods: Record<string, { mod?: Record<string, unknown>; error?: string }> =
  {};
let calendarPublishers: string[] = [];

let intendedSchedule = new Date();

const fullyApproved = (o: Outcome) => o === 'approve' || o === 'approve-2-step';

function seedWorld(
  content: Content,
  outcome: Outcome,
  when: When,
  platform: string,
  gate: Gate,
  marker: string
) {
  resetDb();
  calls.length = 0;
  const offset = { past: -3_600_000, now: -1_000, future: 86_400_000 }[when];
  const scheduledAt = new Date(Date.now() + offset);
  intendedSchedule = scheduledAt;
  table('organization').push({
    id: ORG,
    slug: 'org-a',
    name: 'Org A',
    status: 'active',
    calendarMode: 'live',
    autoPublishPaused: gate === 'autopilot-paused',
  });
  table('user').push({
    id: APPROVER,
    email: 'approver@org-a.test',
    name: 'Approver',
    organizationId: ORG,
    isMultiBusinessOwner: false,
    activeOrganizationId: null,
  });
  table('user').push({
    id: AUTHOR,
    email: 'author@org-a.test',
    name: 'Author',
    organizationId: ORG,
    isMultiBusinessOwner: false,
    activeOrganizationId: null,
  });
  if (gate !== 'no-connection')
    table('platformConnection').push({
      id: 'conn-1',
      userId: AUTHOR,
      organizationId: ORG,
      platform,
      isActive: true,
      accessToken: 'tok-synthetic',
      refreshToken: null,
      expiresAt: null,
      profileId: 'profile-1',
      profileName: 'Org A',
    });
  const metadata = {
    source: gate === 'autopilot-paused' ? 'autopilot' : 'manual',
    campaignAuthorityManifest: pendingManifest(platform),
    version: 1,
  };
  if (content === 'post') {
    table('campaign').push({
      id: 'camp-1',
      userId: AUTHOR,
      organizationId: ORG,
      platform,
      settings: {},
      content: {},
    });
    table('post').push({
      id: 'content-1',
      content: `Synthetic approved-post copy ${marker}`,
      platform,
      // Queued and due: the scheduler's authority gate is what parks it in
      // pending_approval (judge() runs the scheduler once before the verdict).
      status: 'scheduled',
      scheduledAt: new Date(Date.now() - 7_200_000),
      publishedAt: null,
      deletedAt: null,
      metadata,
      campaignId: 'camp-1',
      campaign: {
        userId: AUTHOR,
        platform,
        organizationId: ORG,
        settings: {},
        content: {},
      },
    });
  } else {
    table('calendarPost').push({
      id: 'content-1',
      content: `Synthetic calendar copy ${marker}`,
      platforms: [platform],
      status: 'pending_approval',
      scheduledAt,
      publishedAt: null,
      // No scheduler gates calendar posts; record the blocked verdict the way
      // the post scheduler does.
      metadata: {
        ...metadata,
        publishGate: {
          allowed: false,
          blockers: ['campaign_human_approval_missing'],
        },
      },
      organizationId: ORG,
      userId: AUTHOR,
    });
  }
  const twoStep = outcome === 'approve-2-step' || outcome === 'partial-2-step';
  const step = (i: number) => ({
    id: `step-${i}`,
    order: i,
    type: 'approval',
    name: `Step ${i + 1}`,
    status: 'pending',
    assignedTo: [APPROVER],
    comments: [],
    requiredApprovals: 1,
    currentApprovals: 0,
    isOptional: false,
    createdAt: new Date().toISOString(),
  });
  table('approvalRequest').push({
    id: 'apr-1',
    contentType: content,
    contentId: 'content-1',
    organizationId: ORG,
    submittedBy: AUTHOR,
    status: 'pending',
    currentStep: 0,
    steps: twoStep ? [step(0), step(1)] : [step(0)],
    metadata: { platforms: [platform], contentVersion: 1 },
    title: 'Synthetic approval',
    dueDate: null,
    createdAt: new Date(Date.now() - 7_200_000),
    updatedAt: new Date(Date.now() - 7_200_000),
    submitter: { name: 'Author', email: 'author@org-a.test' },
  });
}

async function patch(action: string, comment?: string): Promise<InvokeResult> {
  const m = mods[APPROVALS];
  if (!m.mod) return { status: null, json: null, error: m.error };
  const token = generateToken({
    userId: APPROVER,
    email: 'approver@org-a.test',
  });
  return invokeHandler(m.mod, APPROVALS, 'PATCH', {
    params: { id: 'apr-1' },
    request: new NextRequest('http://localhost:3000/api/approvals/apr-1', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...(comment ? { comment } : {}) }),
    }),
  });
}

async function runPublishers(): Promise<string[]> {
  const notes: string[] = [];
  for (const file of [SCHEDULER, ...calendarPublishers]) {
    const m = mods[file];
    if (!m?.mod) {
      notes.push(`${file}: ${m?.error ?? 'not loaded'}`);
      continue;
    }
    const r = await invokeHandler(m.mod, file, 'GET', {
      request: new NextRequest(
        `http://localhost:3000/${path.dirname(file).replace(/^app\//, '')}`,
        { headers: { authorization: `Bearer ${CRON}` } }
      ),
    });
    notes.push(
      `${path.basename(path.dirname(file))}=${r.status ?? r.error?.slice(0, 60)}`
    );
  }
  return notes;
}

const publishedCount = (marker: string) =>
  calls.filter(c => JSON.stringify(c.post).includes(marker)).length;

/** Act on the approval as the outcome says. Returns the PATCH statuses. */
async function act(outcome: Outcome, content: Content): Promise<string> {
  const s: (number | string | null)[] = [];
  const add = (r: InvokeResult) => {
    const j = r.json as { error?: unknown; message?: unknown } | null;
    s.push(
      r.status === null
        ? `ERR ${r.error?.slice(0, 80)}`
        : r.status >= 400
          ? `${r.status}(${String(j?.message ?? j?.error ?? '').slice(0, 80)})`
          : r.status
    );
  };
  switch (outcome) {
    case 'approve':
      add(await patch('approve'));
      break;
    case 'approve-2-step':
      add(await patch('approve'));
      add(await patch('approve'));
      break;
    case 'partial-2-step':
      add(await patch('approve'));
      break;
    case 'reject':
      add(await patch('reject', 'Off-brand claim'));
      break;
    case 'request-revision':
      add(await patch('request_revision', 'Tighten the copy'));
      break;
    case 'approve-stale-version': {
      add(await patch('approve'));
      // The author edits the content after the verdict: the approval is for v1.
      const t = content === 'post' ? table('post') : table('calendarPost');
      for (const row of t) {
        row.content = `${row.content} (edited after approval)`;
        row.metadata = { ...(row.metadata as object), version: 2 };
        row.updatedAt = new Date(Date.now() + 1_000);
      }
      break;
    }
  }
  return s.join(',');
}

/** Time passes: every slot becomes due. */
function letTimePass() {
  for (const t of ['post', 'calendarPost'])
    for (const row of table(t))
      if (row.scheduledAt instanceof Date)
        row.scheduledAt = new Date(Date.now() - 60_000);
}

interface World {
  content: Content;
  outcome: Outcome;
  when: When;
  platform: string;
  gate: Gate;
}

function expectation(w: World): { criterion: string; publish: boolean } {
  if (!fullyApproved(w.outcome)) return { criterion: 'G5.C2', publish: false };
  if (w.gate !== 'clear') return { criterion: 'G5.C3', publish: false };
  return { criterion: 'G5.C1', publish: true };
}

async function judge(w: World, n: number, actFn: typeof act = act) {
  const marker = `#m${n}`;
  seedWorld(w.content, w.outcome, w.when, w.platform, w.gate, marker);
  // The scheduler meets the unapproved post first and parks it (authority
  // gate -> pending_approval with metadata.publishGate). Then the slot is set
  // to the case's time and the approver acts.
  let pre = 'n/a';
  if (w.content === 'post') {
    await runPublishers();
    const p = table('post')[0];
    pre = String(p?.status);
    if (p) p.scheduledAt = intendedSchedule;
  }
  const blockedFirst = publishedCount(marker);
  calls.length = 0;
  const patches = await actFn(w.outcome, w.content);
  const run1 = await runPublishers();
  const atFirst = publishedCount(marker);
  letTimePass();
  const run2 = await runPublishers();
  const total = publishedCount(marker);
  const e = expectation(w);
  const due = w.when !== 'future';
  const passed =
    blockedFirst === 0 &&
    (e.publish ? total === 1 && atFirst === (due ? 1 : 0) : total === 0);
  const row = (w.content === 'post' ? table('post') : table('calendarPost'))[0];
  const meta = (row?.metadata ?? {}) as {
    history?: { event?: string; blockers?: string[] }[];
    publishGate?: { blockers?: string[] };
  };
  const last = meta.history?.at(-1);
  const trail = `last event=${last?.event ?? '-'}${last?.blockers?.length ? ` [${last.blockers.join(',')}]` : ''}; gate blockers=${(meta.publishGate?.blockers ?? []).join(',') || '-'}`;
  return {
    ...e,
    passed,
    detail: `${w.content} ${w.outcome} ${w.when} ${w.platform} gate=${w.gate}: before approval status=${pre} published=${blockedFirst}; patch=${patches}; run1 ${run1.join(' ')} published=${atFirst}; run2 ${run2.join(' ')} published total=${total}; final status=${String(row?.status)}; ${trail}; expected ${e.publish ? 'publish once' : 'never publish'}`,
  };
}

const sink = new Sink('G5');
let reachable: { ok: boolean; detail: string } = {
  ok: false,
  detail: 'not checked',
};

beforeAll(async () => {
  quietConsole();
  cutNetwork();
  process.env.CRON_SECRET = CRON;
  calendarPublishers = listRoutes()
    .filter(
      r =>
        r.file.startsWith('app/api/cron/') &&
        r.methods.includes('GET') &&
        r.file !== SCHEDULER
    )
    .filter(r =>
      /calendarPost/.test(fs.readFileSync(path.join(ROOT, r.file), 'utf8'))
    )
    .map(r => r.file);
  for (const f of [APPROVALS, SCHEDULER, ...calendarPublishers])
    mods[f] = loadRouteModule(f);
  const helper = await import('@/tests/helpers/campaign-authority-manifest');
  // Ready in every respect except the human verdict: the one blocker a
  // human approval is meant to clear.
  pendingManifest = platform => {
    const m = helper.buildApprovedCampaignAuthorityManifest({
      platformOutputs: [
        { platform, status: 'approved', contentRef: 'content-1' },
      ],
      approval: { status: 'pending', humanApproved: false },
    } as never);
    return {
      ...m,
      evaluation: m.evaluation && { ...m.evaluation, approvalReadiness: 60 },
    };
  };

  // Reach check: an already-approved, due, clear post must publish through
  // this harness. If it does not, no G5.C1 verdict can be trusted.
  seedWorld('post', 'approve', 'past', 'facebook', 'clear', '#reach');
  const p = table('post')[0];
  p.status = 'scheduled';
  p.metadata = {
    source: 'manual',
    campaignAuthorityManifest: helper.buildApprovedCampaignAuthorityManifest({
      platformOutputs: [
        { platform: 'facebook', status: 'approved', contentRef: 'content-1' },
      ],
    }),
    version: 1,
  };
  const notes = await runPublishers();
  reachable = {
    ok: publishedCount('#reach') === 1,
    detail: `reach check: scheduled+approved post published=${publishedCount('#reach')} (${notes.join(' ')}; status=${String(table('post')[0]?.status)})`,
  };
});
beforeEach(() => {
  quietConsole();
  cutNetwork();
});
afterAll(() => sink.write());

it('G5 cases', async () => {
  let n = 0;
  for (const content of ['post', 'calendar_post'] as Content[])
    for (const outcome of OUTCOMES)
      for (const when of WHENS)
        for (const platform of PLATFORMS)
          for (const gate of GATES) {
            const w = { content, outcome, when, platform, gate };
            const j = await judge(w, n++);
            // A publish-expected case is only judged when the harness can publish at all.
            const verdict =
              j.criterion === 'G5.C1' && !reachable.ok && !j.passed
                ? null
                : j.passed;
            sink.verdict(
              j.criterion,
              verdict,
              verdict === null ? `${j.detail}; ${reachable.detail}` : j.detail,
              content === 'post' ? SCHEDULER : 'calendarPost publishers'
            );
          }
});

it('G5 planted controls', async () => {
  const w: World = {
    content: 'post',
    outcome: 'reject',
    when: 'past',
    platform: 'facebook',
    gate: 'clear',
  };
  // C01: a rejection that re-queues the post as approved (status scheduled + approved manifest).
  const requeueOnReject: typeof act = async (outcome, content) => {
    const s = await act(outcome, content);
    if (!disarmed('G5-C01')) plantRequeue();
    return s;
  };
  let j = await judge(w, 900_001, requeueOnReject);
  sink.control('G5-C01', 'G5.C2', !j.passed, j.detail);

  // C02: partial approval of a 2-step chain treated as final.
  j = await judge(
    { ...w, outcome: 'partial-2-step' },
    900_002,
    async (o, c) => {
      const s = await act(o, c);
      if (!disarmed('G5-C02')) plantRequeue();
      return s;
    }
  );
  sink.control('G5-C02', 'G5.C2', !j.passed, j.detail);

  // C03: approval re-queues even though the platform connection is gone, and
  // the scheduler is given a connection-blind stub (gate always passes).
  j = await judge(
    { ...w, outcome: 'approve', gate: 'no-connection' },
    900_003,
    async (o, c) => {
      const s = await act(o, c);
      if (!disarmed('G5-C03')) {
        plantRequeue();
        table('platformConnection').push({
          id: 'conn-planted',
          userId: AUTHOR,
          organizationId: ORG,
          platform: 'facebook',
          isActive: true,
          accessToken: 'tok-synthetic',
          refreshToken: null,
          expiresAt: null,
        });
      }
      return s;
    }
  );
  sink.control('G5-C03', 'G5.C3', !j.passed, j.detail);

  // C04: stale approval honoured (content edited after the verdict still goes out).
  j = await judge(
    { ...w, outcome: 'approve-stale-version' },
    900_004,
    async (o, c) => {
      const s = await act(o, c);
      if (!disarmed('G5-C04')) plantRequeue();
      return s;
    }
  );
  sink.control('G5-C04', 'G5.C2', !j.passed, j.detail);
});

/** The planted defect: put the content straight back on the scheduler with an approved manifest. */
function plantRequeue() {
  const helper = jest.requireActual(
    '@/tests/helpers/campaign-authority-manifest'
  ) as typeof import('@/tests/helpers/campaign-authority-manifest');
  for (const row of table('post')) {
    row.status = 'scheduled';
    row.metadata = {
      ...(row.metadata as object),
      campaignAuthorityManifest: helper.buildApprovedCampaignAuthorityManifest({
        platformOutputs: [
          {
            platform: String(row.platform),
            status: 'approved',
            contentRef: 'content-1',
          },
        ],
      }),
    };
  }
}
