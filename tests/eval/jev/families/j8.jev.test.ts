/**
 * JEV J8 — Publish safety (hard gate).
 *
 * Drives the real publish-queue engine (lib/publish/publishQueue.ts →
 * runSafetyChecks, claimQueueItemForPublish, reclaimStalePublishingQueueItems,
 * dispatchToPlatform) against an in-memory Prisma fake. Every platform adapter
 * (lib/publish/platformAdapters/*) is replaced by a stub that counts calls and
 * never reaches a network.
 *
 * Grid: 7 platforms x 2 payload kinds x 10 states = 140 cases.
 * Controls: planted publishers (unapproved, double-publish, kill-switch blind,
 * cross-org) run through the SAME scenario detectors; FAIL = caught.
 */
import { classify, recordResults, type JevResult } from '../runner/record';

// ── In-memory Prisma fake (boundary) ─────────────────────────────────────────

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const mockStore: Record<string, Row[]> = {};
// `dead`: the worker process died after the platform call; no write lands.
const mockFaults = { dead: false };

function isOp(v: unknown): v is Record<string, unknown> {
  return (
    !!v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)
  );
}

function cmp(a: unknown): number | string {
  return a instanceof Date ? a.getTime() : (a as number | string);
}

function mockMatches(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'OR') {
      if (!(cond as Where[]).some(w => mockMatches(row, w))) return false;
      continue;
    }
    const v = row[key];
    if (isOp(cond)) {
      for (const [op, arg] of Object.entries(cond)) {
        if (op === 'in' && !(arg as unknown[]).includes(v)) return false;
        if (op === 'notIn' && (arg as unknown[]).includes(v)) return false;
        if (op === 'lte' && !(v != null && cmp(v) <= cmp(arg))) return false;
        if (op === 'lt' && !(v != null && cmp(v) < cmp(arg))) return false;
      }
    } else if ((v ?? null) !== (cond ?? null)) {
      if (!(v instanceof Date && cond instanceof Date)) return false;
      if (v.getTime() !== cond.getTime()) return false;
    }
  }
  return true;
}

function mockApply(row: Row, data: Row): void {
  for (const [k, v] of Object.entries(data)) {
    if (isOp(v) && 'increment' in v)
      row[k] = ((row[k] as number) ?? 0) + (v.increment as number);
    else row[k] = v;
  }
  row.updatedAt = new Date();
}

function mockModel(name: string) {
  const rows = () => (mockStore[name] ??= []);
  const tick = () => new Promise<void>(r => setImmediate(r));
  const clone = <T>(r: T): T => (r ? { ...r } : r);
  return {
    async findMany(a: { where?: Where; take?: number } = {}) {
      await tick();
      return rows()
        .filter(r => mockMatches(r, a.where))
        .slice(0, a.take ?? Infinity)
        .map(clone);
    },
    async findFirst(a: { where?: Where } = {}) {
      await tick();
      return clone(rows().find(r => mockMatches(r, a.where)) ?? null);
    },
    async findUnique(a: { where: Where }) {
      await tick();
      return clone(rows().find(r => mockMatches(r, a.where)) ?? null);
    },
    async count(a: { where?: Where } = {}) {
      await tick();
      return rows().filter(r => mockMatches(r, a.where)).length;
    },
    async update(a: { where: Where; data: Row }) {
      await tick();
      if (mockFaults.dead) throw new Error('simulated worker death');
      const row = rows().find(r => mockMatches(r, a.where));
      if (!row) throw new Error(`${name}.update: no row`);
      mockApply(row, a.data);
      return clone(row);
    },
    // Atomic: filter + write happen in the same tick (a conditional UPDATE).
    async updateMany(a: { where: Where; data: Row }) {
      await tick();
      if (mockFaults.dead) throw new Error('simulated worker death');
      const hit = rows().filter(r => mockMatches(r, a.where));
      hit.forEach(r => mockApply(r, a.data));
      return { count: hit.length };
    },
    async create(a: { data: Row }) {
      await tick();
      const row = { id: `${name}-${rows().length + 1}`, ...a.data };
      rows().push(row);
      return clone(row);
    },
    async createMany(a: { data: Row[] }) {
      await tick();
      a.data.forEach(d => rows().push({ ...d }));
      return { count: a.data.length };
    },
  };
}

jest.mock('@/lib/prisma', () => {
  const db = new Proxy({} as Record<string, unknown>, {
    get: (cache, prop: string) => (cache[prop] ??= mockModel(prop)),
  });
  return { __esModule: true, default: db, prisma: db };
});
jest.mock('@/lib/logger', () => ({
  logger: { info() {}, warn() {}, error() {}, debug() {} },
}));
// Cost ledger is a write-only side effect on the 401 path; never hit a store.
jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: async () => undefined,
}));

// ── Counting platform stubs (no network) ─────────────────────────────────────

interface StubCall {
  platform: string;
  args: Row;
}
const mockCalls: StubCall[] = [];
const mockHooks: { onCall?: (c: StubCall) => void | Promise<void> } = {};

function mockStub(platform: string) {
  return async (args: Row) => {
    const call = { platform, args };
    mockCalls.push(call);
    await mockHooks.onCall?.(call);
    return {
      success: true,
      platformPostId: `${platform}-post-${mockCalls.length}`,
    };
  };
}

jest.mock('@/lib/publish/platformAdapters/instagram', () => ({
  publishToInstagram: mockStub('instagram'),
}));
jest.mock('@/lib/publish/platformAdapters/facebook', () => ({
  publishToFacebook: mockStub('facebook'),
}));
jest.mock('@/lib/publish/platformAdapters/linkedin', () => ({
  publishToLinkedIn: mockStub('linkedin'),
}));
jest.mock('@/lib/publish/platformAdapters/twitter', () => ({
  publishToTwitter: mockStub('twitter'),
}));
jest.mock('@/lib/publish/platformAdapters/threads', () => ({
  publishToThreads: mockStub('threads'),
}));
jest.mock('@/lib/publish/platformAdapters/youtube', () => ({
  publishToYouTube: mockStub('youtube'),
}));
jest.mock('@/lib/publish/platformAdapters/tiktok', () => ({
  publishToTikTok: mockStub('tiktok'),
}));

// ── Synthetic fixtures (org-A, org-B) ────────────────────────────────────────

const PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'threads',
  'tiktok',
  'twitter',
  'youtube',
] as const;
type Platform = (typeof PLATFORMS)[number];
const PAYLOADS = ['slot', 'social-cut'] as const;
type Payload = (typeof PAYLOADS)[number];
const STATES = [
  'approved-once',
  'autonomous-off',
  'crash-retry',
  'cross-org',
  'double-submit',
  'hold-for-review',
  'kill-switch',
  'paused',
  'rerun',
  'unapproved',
] as const;
type State = (typeof STATES)[number];

type Publisher = () => Promise<unknown>;
interface Mods {
  processPublishQueue: Publisher;
  dispatchToPlatform: typeof import('@/lib/publish/publishQueue').dispatchToPlatform;
  runSafetyChecks: typeof import('@/lib/publish/safetyChecks').runSafetyChecks;
  HOLD_FOR_REVIEW: boolean;
  autopilotPostStatus: typeof import('@/lib/autopilot/hold-for-review').autopilotPostStatus;
  manifest: (platforms: string[]) => unknown;
}
let mods: Mods | undefined;
let importError = '';

const PAST = () => new Date(Date.now() - 60_000);

function resetWorld(): void {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockCalls.length = 0;
  mockHooks.onCall = undefined;
  mockFaults.dead = false;
}

function seedOrg(org: string, platform: Platform): void {
  const s = mockStore;
  (s.organization ??= []).push({
    id: org,
    calendarMode: 'live',
    autoPublishPaused: false,
  });
  (s.user ??= []).push({ id: `${org}-user`, organizationId: org });
  (s.subscription ??= []).push({
    id: `${org}-sub`,
    userId: `${org}-user`,
    status: 'active',
  });
  s.aIWeeklyDigest ??= [];
  for (let i = 0; i < 3; i++)
    s.aIWeeklyDigest.push({ id: `${org}-dg-${i}`, userId: `${org}-user` });
  (s.platformConnection ??= []).push({
    id: `${org}-conn-${platform}`,
    organizationId: org,
    platform,
    isActive: true,
    deletedAt: null,
    accessToken: `tok-${org}-${platform}`,
    refreshToken: null,
    encryptionKeyVersion: 1,
    profileId: `${org}-profile`,
    expiresAt: null,
    metadata: null,
  });
  (s.contentCalendar ??= []).push({
    id: `${org}-cal`,
    organizationId: org,
    slots: { weekStart: '2026-10-12', weekEnd: '2026-10-18', slots: [] },
  });
}

/** Add one publishable item for `org` and return its queue row id. */
function seedItem(
  org: string,
  platform: Platform,
  payload: Payload,
  n: number,
  opts: { approved?: boolean; rowStatus?: string; provenance?: boolean } = {}
): string {
  const approved = opts.approved ?? true;
  const s = mockStore;
  let slotId: string;
  if (payload === 'slot') {
    slotId = `${org}-slot-${n}`;
    const cal = s.contentCalendar.find(c => c.id === `${org}-cal`)!;
    (cal.slots as { slots: Row[] }).slots.push({
      id: slotId,
      dayOfWeek: 1,
      scheduledAt: PAST().toISOString(),
      platform,
      captions: [`Synthetic caption ${n} for ${org}`],
      hashtags: [],
      contentType: 'educational',
      status: approved ? 'approved' : 'draft',
      selectedCaption: 0,
      mediaType: platform === 'instagram' ? 'REELS' : undefined,
      mediaUrl: `https://cdn.example.test/${org}/${n}.mp4`,
      video: { url: `https://cdn.example.test/${org}/${n}.mp4` },
      campaignAuthorityManifest: mods!.manifest([...PLATFORMS]),
    });
  } else {
    const assetId = `${org}-asset-${n}`;
    slotId = `social-cut:${assetId}`;
    (s.videoAsset ??= []).push({
      id: assetId,
      url: `https://cdn.example.test/${org}/cut-${n}.mp4`,
      thumbnail: null,
      metadata: {
        source: opts.provenance === false ? 'manual-upload' : 'deriveSocialCut',
        organizationId: org,
        derivation: { caption: { text: `Synthetic cut ${n} for ${org}` } },
        youtube: { title: `Cut ${n}` },
      },
    });
  }
  const id = `${org}-qi-${platform}-${payload}-${n}`;
  (s.publishQueueItem ??= []).push({
    id,
    organizationId: org,
    calendarId: `${org}-cal`,
    slotId,
    platform,
    scheduledAt: PAST(),
    status: opts.rowStatus ?? 'pending',
    attempts: 0,
    nextRetryAt: null,
    lastError: null,
    publishedAt: null,
    updatedAt: PAST(),
  });
  return id;
}

function setOrg(org: string, patch: Row): void {
  Object.assign(mockStore.organization.find(o => o.id === org)!, patch);
}

function rowOf(id: string): Row {
  return mockStore.publishQueueItem.find(r => r.id === id)!;
}

/** Move every stored timestamp back, as if `ms` of wall clock had passed. */
function age(ms: number): void {
  for (const r of mockStore.publishQueueItem ?? [])
    for (const k of ['updatedAt', 'nextRetryAt', 'scheduledAt'])
      if (r[k] instanceof Date) r[k] = new Date((r[k] as Date).getTime() - ms);
}

// ── Scenario detectors ───────────────────────────────────────────────────────
// Each builds a world, runs the publisher under test, and decides by code.

interface Verdict {
  passed: boolean;
  detail: string;
}

const callsTo = (p: string) => mockCalls.filter(c => c.platform === p).length;
const summary = () =>
  `stub calls=${mockCalls.length} [${mockCalls.map(c => c.platform).join(',')}]`;

function expectNone(property: string): Verdict {
  return {
    passed: mockCalls.length === 0,
    detail: `${property}; ${summary()}`,
  };
}

function expectOnce(platform: Platform, id: string, property: string): Verdict {
  const row = rowOf(id);
  const ok =
    mockCalls.length === 1 &&
    callsTo(platform) === 1 &&
    row.status === 'published';
  return {
    passed: ok,
    detail: `${property}; ${summary()}; row=${String(row.status)}`,
  };
}

async function scenario(
  state: State,
  platform: Platform,
  payload: Payload,
  publish: Publisher
): Promise<Verdict> {
  resetWorld();
  seedOrg('org-A', platform);
  const m = mods!;
  switch (state) {
    case 'unapproved': {
      // slot: calendar slot left 'draft'; social-cut: row is pending but the
      // asset carries no deriveSocialCut (Gate-B) provenance.
      seedItem('org-A', platform, payload, 1, {
        approved: false,
        provenance: false,
      });
      await publish();
      return expectNone('unapproved item never reaches the platform');
    }
    case 'approved-once': {
      const id = seedItem('org-A', platform, payload, 1);
      await publish();
      return expectOnce(platform, id, 'approved item published exactly once');
    }
    case 'rerun': {
      const id = seedItem('org-A', platform, payload, 1);
      await publish();
      age(5 * 60 * 60 * 1000);
      await publish();
      return expectOnce(
        platform,
        id,
        'second run after success re-sends nothing'
      );
    }
    case 'double-submit': {
      const id = seedItem('org-A', platform, payload, 1);
      await Promise.all([publish(), publish()]);
      return expectOnce(platform, id, 'two concurrent runs publish once');
    }
    case 'crash-retry': {
      // The worker dies (e.g. function timeout) right after the platform
      // accepted the post, before any status write lands. A later run must
      // not send the same item again.
      seedItem('org-A', platform, payload, 1);
      mockHooks.onCall = () => {
        mockFaults.dead = true;
      };
      let crashed = false;
      try {
        await publish();
      } catch {
        crashed = true;
      }
      // Promise.all rejects early: let the dead run's in-flight writes settle
      // (and fail) before the next worker starts.
      await new Promise(r => setTimeout(r, 20));
      mockFaults.dead = false;
      mockHooks.onCall = undefined;
      age(16 * 60 * 1000);
      await publish();
      return {
        passed: mockCalls.length === 1,
        detail: `worker death after platform success is not re-sent on retry; ${summary()}; first run crashed=${crashed}`,
      };
    }
    case 'paused': {
      seedItem('org-A', platform, payload, 1);
      setOrg('org-A', { autoPublishPaused: true });
      await publish();
      return expectNone('autoPublishPaused org never publishes');
    }
    case 'autonomous-off': {
      seedItem('org-A', platform, payload, 1);
      setOrg('org-A', { calendarMode: 'shadow' });
      await publish();
      return expectNone('autonomous posting off (shadow mode) never publishes');
    }
    case 'hold-for-review': {
      // An autopilot-proposed item: its approval state is whatever
      // autopilotPostStatus('schedule') yields. While HOLD_FOR_REVIEW is true
      // that is 'draft', i.e. an unapproved slot / an unreleased (human-gated)
      // social-cut row.
      const scheduled = m.autopilotPostStatus('schedule') === 'scheduled';
      seedItem('org-A', platform, payload, 1, {
        approved: scheduled,
        rowStatus:
          payload === 'social-cut' && !scheduled
            ? 'queued_human_gated'
            : 'pending',
      });
      await publish();
      const v = expectNone('HOLD_FOR_REVIEW autopilot item never publishes');
      return {
        passed: v.passed && m.HOLD_FOR_REVIEW === true,
        detail: `${v.detail}; HOLD_FOR_REVIEW=${m.HOLD_FOR_REVIEW}`,
      };
    }
    case 'kill-switch': {
      seedItem('org-A', platform, payload, 1);
      seedItem('org-A', platform, payload, 2);
      // Operator flips the org kill switch while the first send is in flight.
      mockHooks.onCall = () => setOrg('org-A', { autoPublishPaused: true });
      await publish();
      return {
        passed: mockCalls.length === 1,
        detail: `kill switch set mid-run stops further sends; ${summary()}`,
      };
    }
    case 'cross-org': {
      // org-A owns an approved item; org-B queues a row pointing at it.
      seedOrg('org-B', platform);
      const a = seedItem('org-A', platform, payload, 1, { rowStatus: 'held' });
      const src = rowOf(a);
      mockStore.publishQueueItem.push({
        ...src,
        id: 'org-B-qi-cross',
        organizationId: 'org-B',
        calendarId: src.calendarId,
        status: 'pending',
      });
      await publish();
      return expectNone("org-B cannot publish org-A's item");
    }
  }
}

// ── Planted publishers (positive controls) ───────────────────────────────────

async function dueItems(): Promise<Row[]> {
  return mockStore.publishQueueItem.filter(
    r => ['pending', 'failed'].includes(r.status as string) && !r.publishedAt
  );
}

async function plantedSend(item: Row): Promise<void> {
  const m = mods!;
  const conn = mockStore.platformConnection.find(
    c =>
      c.platform === item.platform && c.organizationId === item.organizationId
  );
  await m.dispatchToPlatform(
    item.platform as string,
    conn?.accessToken as string,
    'p',
    'planted caption',
    undefined,
    { video: { url: 'https://cdn.example.test/planted.mp4' } }
  );
  item.status = 'published';
  item.publishedAt = new Date();
}

/** Defect: skips the approval gates; only checks the org is live/unpaused. */
const plantedUnapproved: Publisher = async () => {
  for (const item of await dueItems()) {
    const org = mockStore.organization.find(o => o.id === item.organizationId);
    if (org?.calendarMode === 'live' && !org.autoPublishPaused)
      await plantedSend(item);
  }
};

/** Defect: runs the real gates but has no atomic claim (double submit sends twice). */
const plantedDoublePublish: Publisher = async () => {
  for (const item of await dueItems()) {
    const safety = await mods!.runSafetyChecks({
      organizationId: item.organizationId as string,
      calendarId: item.calendarId as string,
      slotId: item.slotId as string,
      platform: item.platform as string,
    });
    if (safety.pass) await plantedSend(item);
  }
};

/** Defect: snapshots the org kill switch once at the start of the run. */
const plantedKillSwitchBlind: Publisher = async () => {
  const items = await dueItems();
  const pausedAtStart = new Set(
    mockStore.organization.filter(o => o.autoPublishPaused).map(o => o.id)
  );
  for (const item of items)
    if (!pausedAtStart.has(item.organizationId as string))
      await plantedSend(item);
};

/** Defect: resolves the slot by calendar id alone, ignoring the item's org. */
const plantedCrossOrg: Publisher = async () => {
  for (const item of await dueItems()) {
    const cal = mockStore.contentCalendar.find(c => c.id === item.calendarId);
    const slot = (cal?.slots as { slots: Row[] } | undefined)?.slots.find(
      s => s.id === item.slotId
    );
    if (slot?.status === 'approved') await plantedSend(item);
  }
};

// ── Run ──────────────────────────────────────────────────────────────────────

const results: JevResult[] = [];
afterAll(() => recordResults('J8', results));

beforeAll(async () => {
  try {
    const q = await import('@/lib/publish/publishQueue');
    const s = await import('@/lib/publish/safetyChecks');
    const h = await import('@/lib/autopilot/hold-for-review');
    const f = await import('@/tests/helpers/campaign-authority-manifest');
    mods = {
      processPublishQueue: q.processPublishQueue,
      dispatchToPlatform: q.dispatchToPlatform,
      runSafetyChecks: s.runSafetyChecks,
      HOLD_FOR_REVIEW: h.HOLD_FOR_REVIEW,
      autopilotPostStatus: h.autopilotPostStatus,
      manifest: platforms =>
        f.buildApprovedCampaignAuthorityManifest({
          platformOutputs: platforms.map(p => ({
            platform: p,
            status: 'approved',
            contentRef: `post-${p}`,
          })),
        }),
    };
  } catch (err) {
    importError =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
});

it('J8 publish-safety grid', async () => {
  for (const platform of PLATFORMS)
    for (const payload of PAYLOADS)
      for (const state of STATES) {
        const id = `J8-${platform}-${payload}-${state}`;
        const route = 'lib/publish/publishQueue.ts#processPublishQueue';
        if (!mods) {
          results.push({
            id,
            family: 'J8',
            kind: 'case',
            state: 'INCONCLUSIVE',
            route,
            detail: `import failed: ${importError}`,
          });
          continue;
        }
        try {
          const v = await scenario(state, platform, payload, () =>
            mods!.processPublishQueue()
          );
          results.push({
            id,
            family: 'J8',
            kind: 'case',
            route,
            ...classify(id, v.passed, v.detail),
          });
        } catch (err) {
          results.push({
            id,
            family: 'J8',
            kind: 'case',
            state: 'INCONCLUSIVE',
            route,
            detail: `scenario threw: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
});

it('J8 positive controls', async () => {
  const controls: [string, State, Publisher][] = [
    ['J8-control-unapproved-publisher', 'unapproved', plantedUnapproved],
    [
      'J8-control-double-publish-on-retry',
      'double-submit',
      plantedDoublePublish,
    ],
    ['J8-control-kill-switch-ignored', 'kill-switch', plantedKillSwitchBlind],
    ['J8-control-cross-org-publisher', 'cross-org', plantedCrossOrg],
  ];
  for (const [id, state, publisher] of controls) {
    if (!mods) {
      results.push({
        id,
        family: 'J8',
        kind: 'control',
        state: 'INCONCLUSIVE',
        detail: `import failed: ${importError}`,
      });
      continue;
    }
    try {
      const v = await scenario(state, 'instagram', 'slot', publisher);
      results.push({
        id,
        family: 'J8',
        kind: 'control',
        state: v.passed ? 'PASS' : 'FAIL',
        detail: `planted defect ${v.passed ? 'NOT caught' : 'caught'}: ${v.detail}`,
      });
    } catch (err) {
      results.push({
        id,
        family: 'J8',
        kind: 'control',
        state: 'INCONCLUSIVE',
        detail: `control threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
});
