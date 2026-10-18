/**
 * J7 — Local outcome loop (script part). Not a hard gate; expected red until P6.
 *
 * Property per case: a synthetic local-business signal (call, booking, review,
 * rank drift, listing drift) fed TWICE (replay) through its intended entry point
 * produces exactly one MarketingAgencyOutcomeEvent write that carries
 *   - an eventType for that signal kind,
 *   - attribution (signalId plus campaign/opportunity/metadata.attribution),
 *   - the business's location id (data.locationId or data.metadata.locationId),
 *   - the business's organizationId (and nothing written for another org),
 * and that performance_get_outcomes, run for that org, returns the event.
 *
 * Entry points (today's code): calls + bookings → POST /api/leads (HMAC-signed
 * ingest); reviews → GET /api/cron/gbp-monitor; rank drift → GET
 * /api/cron/rank-snapshot; listing drift → GET /api/google-business/nap-audit.
 *
 * Mocked boundaries only: prisma (writes captured), Google SDK wrappers
 * (business-profile, google-auth, search-console), AI provider, Sentry, and the
 * session-auth helpers for the user route. Route and service code runs for real.
 * 40 synthetic businesses org-A-01..org-A-40; org-B is a bystander that must
 * never receive a write.
 */
import { createHmac } from 'crypto';
import { classify, recordResults, type JevResult } from '../runner/record';
import { invokeRoute, type InvokeResult } from '../runner/route-harness';

// ---------------------------------------------------------------------------
// Boundary mocks. Plain functions (not jest.fn) because jest.jev.cjs sets
// resetMocks; every mock delegates to mockWorld at call time.
// ---------------------------------------------------------------------------

type Fixture = (args: unknown) => unknown;
interface CapturedWrite {
  model: string;
  method: string;
  args: Record<string, unknown>;
}
interface OutcomeRow extends Record<string, unknown> {
  id: string;
  organizationId: string;
  recordedAt: Date;
}

const mockWorld = {
  fixtures: new Map<string, Fixture>(),
  writes: [] as CapturedWrite[],
  outcomes: [] as OutcomeRow[],
  seq: 0,
  sessionOrg: null as string | null,
};

const FIXED_DATE = new Date('2026-10-01T00:00:00.000Z');
const WRITE_METHODS = new Set([
  'create',
  'createMany',
  'upsert',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

function mockPrismaCall(model: string, method: string, args: unknown): unknown {
  const a = (args ?? {}) as Record<string, unknown>;
  const fixture = mockWorld.fixtures.get(`${model}.${method}`);
  if (WRITE_METHODS.has(method)) {
    mockWorld.writes.push({ model, method, args: a });
    if (fixture) return fixture(a);
    const id = `${model}-${++mockWorld.seq}`;
    if (method.endsWith('Many')) return { count: 1 };
    const data = (a.data ?? a.create ?? {}) as Record<string, unknown>;
    if (model === 'marketingAgencyOutcomeEvent' && method === 'create') {
      const row: OutcomeRow = {
        campaignId: null,
        opportunityId: null,
        status: 'observed',
        outcomeMetric: null,
        observedValue: null,
        confidence: null,
        notes: null,
        ...data,
        id,
        organizationId: String(data.organizationId),
        recordedAt: (data.recordedAt as Date | undefined) ?? FIXED_DATE,
      };
      mockWorld.outcomes.push(row);
      return row;
    }
    return { id, stage: 'new', occurredAt: FIXED_DATE, ...data };
  }
  if (model === 'marketingAgencyOutcomeEvent' && method === 'findMany') {
    const where = (a.where ?? {}) as Record<string, unknown>;
    return mockWorld.outcomes
      .filter(r =>
        Object.entries(where).every(([k, v]) => v === undefined || r[k] === v)
      )
      .slice(0, (a.take as number | undefined) ?? 20);
  }
  if (fixture) return fixture(a);
  if (method === 'findMany' || method === 'groupBy') return [];
  if (method === 'count') return 0;
  if (method === 'aggregate') return { _sum: {}, _avg: {}, _count: 0 };
  return null;
}

jest.mock('@/lib/prisma', () => {
  const models = new Map<string, unknown>();
  const client: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === '__esModule') return false;
        if (prop === 'then') return undefined;
        if (prop === '$transaction')
          return async (arg: unknown) =>
            typeof arg === 'function'
              ? (arg as (tx: unknown) => unknown)(client)
              : Promise.all(arg as unknown[]);
        if (prop.startsWith('$')) return async () => undefined;
        if (!models.has(prop))
          models.set(
            prop,
            new Proxy(
              {},
              {
                get: (_m, method: string) => async (args: unknown) =>
                  mockPrismaCall(prop, method, args),
              }
            )
          );
        return models.get(prop);
      },
    }
  );
  return { __esModule: true, default: client, prisma: client };
});

jest.mock('@/lib/google/business-profile', () => {
  const stars: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return {
    __esModule: true,
    getInsights: async (...args: unknown[]) =>
      mockPrismaCall('$google', 'getInsights', args),
    getReviews: async (...args: unknown[]) =>
      mockPrismaCall('$google', 'getReviews', args),
    starRatingToNumber: (r: string) => stars[r] ?? 0,
  };
});
jest.mock('@/lib/google/google-auth', () => ({
  __esModule: true,
  findOAuthConnection: async (orgId: string) => `conn-${orgId}`,
}));
jest.mock('@/lib/google/search-console', () => ({
  __esModule: true,
  getSearchAnalytics: async (...args: unknown[]) =>
    mockPrismaCall('$google', 'getSearchAnalytics', args),
}));
jest.mock('@/lib/ai/providers', () => ({
  __esModule: true,
  getAIProvider: () => {
    throw new Error('AI provider not available in JEV J7');
  },
}));
jest.mock('@/lib/observability/sentry-server', () => ({
  __esModule: true,
  captureServerException: () => undefined,
  captureServerMessage: () => undefined,
  isSentryServerEnabled: () => false,
}));
jest.mock('@/lib/auth/jwt-utils', () => {
  const { NextResponse } = jest.requireActual('next/server');
  return {
    __esModule: true,
    getUserIdFromRequestOrCookies: async () =>
      mockWorld.sessionOrg ? `user-${mockWorld.sessionOrg}` : null,
    unauthorizedResponse: () =>
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
});
jest.mock('@/lib/multi-business/business-scope', () => ({
  __esModule: true,
  getEffectiveOrganizationId: async () => mockWorld.sessionOrg,
}));

// ---------------------------------------------------------------------------
// Synthetic businesses and signals
// ---------------------------------------------------------------------------

type Kind = 'call' | 'booking' | 'review' | 'rank' | 'listing';

interface Business {
  n: string; // 01..40
  orgId: string;
  locationId: string;
  gbpLocationName: string;
  name: string;
  ip: string;
}

const BYSTANDER_ORG = 'org-B';
const HMAC_SECRET = 'jev-j7-synthetic-hmac';
const CRON_SECRET = 'jev-j7-synthetic-cron';

const BUSINESSES: Business[] = Array.from({ length: 40 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    n,
    orgId: `org-A-${n}`,
    locationId: `loc-A-${n}`,
    gbpLocationName: `locations/9000${n}`,
    name: `Synthetic Plumbing ${n}`,
    ip: `203.0.113.${i + 1}`,
  };
});

/** Fourth signal kind: rank drift for businesses 01-20, listing drift for 21-40. */
function kindsFor(b: Business): Kind[] {
  return ['call', 'booking', 'review', Number(b.n) <= 20 ? 'rank' : 'listing'];
}

const EVENT_TYPE: Record<Kind, RegExp> = {
  call: /call/i,
  booking: /book/i,
  review: /review/i,
  rank: /rank/i,
  listing: /listing|nap/i,
};

interface Delivery {
  route?: string;
  /** null when the entry point could not run (import/handler throw). */
  status: number | null;
  error?: string;
}

type Deliver = (b: Business, kind: Kind) => Promise<Delivery>;

function resetWorld(): void {
  mockWorld.fixtures.clear();
  mockWorld.writes = [];
  mockWorld.outcomes = [];
  mockWorld.seq = 0;
  mockWorld.sessionOrg = null;
}

function fixture(key: string, fn: Fixture): void {
  mockWorld.fixtures.set(key, fn);
}

/** Let fire-and-forget work started by a handler settle before reading writes. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));
}

function asDelivery(route: string, r: InvokeResult): Delivery {
  return { route, status: r.status, error: r.error };
}

/** Seed the mocked world for one business + signal kind (the "real world" view). */
function seed(b: Business, kind: Kind): void {
  fixture('organization.findUnique', () => ({
    id: b.orgId,
    name: kind === 'listing' ? `${b.name} Pty Ltd` : b.name,
    website: `https://plumbing-${b.n}.example`,
  }));
  fixture('marketingAgencySignal.findUnique', a => {
    const key = (a as { where?: { organizationId_externalId?: object } }).where
      ?.organizationId_externalId as
      | { organizationId: string; externalId: string }
      | undefined;
    return key ? { id: `sig-${key.externalId}`, campaignId: null } : null;
  });
  const location = {
    id: b.locationId,
    organizationId: b.orgId,
    connectionId: `conn-${b.orgId}`,
    locationId: b.gbpLocationName,
    locationName: b.name,
    phone: `+61 7 5555 00${b.n}`,
    website: `https://plumbing-${b.n}.example`,
  };
  fixture('gBPLocation.findMany', () => [location]);
  fixture('gBPLocation.findFirst', () => location);
  fixture('brandDNA.findUnique', () => ({
    businessName: b.name,
    sourceUrl: `https://plumbing-${b.n}.example`,
  }));
  fixture('$google.getInsights', () => ({
    searchViews: 100,
    mapsViews: 50,
    websiteClicks: 10,
    phoneClicks: 4,
    directionClicks: 2,
  }));
  fixture('$google.getReviews', () => ({
    averageRating: 4.5,
    totalReviewCount: 12,
    reviews: [
      {
        name: `accounts/1/${b.gbpLocationName}/reviews/rev-${b.n}`,
        starRating: 'FIVE',
        comment: 'Fixed the leak same day.',
        createTime: '2026-10-01T00:00:00.000Z',
        reviewer: { displayName: 'Synthetic Reviewer' },
      },
    ],
  }));
  const keyword = `emergency plumber ${b.n}`;
  fixture('keywordTarget.groupBy', () => [{ organizationId: b.orgId }]);
  fixture('gSCProperty.findFirst', () => ({
    siteUrl: `https://plumbing-${b.n}.example/`,
  }));
  fixture('keywordTarget.findMany', () => [
    {
      id: `kt-${b.n}`,
      organizationId: b.orgId,
      keyword,
      isActive: true,
      targetPosition: 3,
    },
  ]);
  fixture('keywordRankSnapshot.findFirst', () => ({
    position: 14,
    snapshotDate: FIXED_DATE,
  }));
  fixture('$google.getSearchAnalytics', () => ({
    rows: [
      {
        keys: [keyword],
        position: 4.2,
        impressions: 300,
        clicks: 9,
        ctr: 0.03,
      },
    ],
  }));
}

/** The intended entry point for each signal kind in today's code. */
const realDeliver: Deliver = async (b, kind) => {
  if (kind === 'call' || kind === 'booking') {
    const route = 'app/api/leads/route.ts';
    const body = JSON.stringify({
      organizationId: b.orgId,
      contactMethod: kind === 'call' ? 'phone_call' : 'booking',
      source: 'google',
      medium: 'organic',
      campaign: `gbp-${b.n}`,
      occurredAt: '2026-10-01T00:00:00.000Z',
      capturedFrom: kind === 'call' ? 'twilio' : 'booking-widget',
      rawPayload: {
        externalId: `${kind}-${b.n}`,
        locationId: b.locationId,
        gbpLocation: b.gbpLocationName,
      },
    });
    const sig = createHmac('sha256', HMAC_SECRET).update(body).digest('hex');
    return asDelivery(
      route,
      await invokeRoute(route, 'POST', {
        body,
        headers: {
          'x-synthex-signature': `sha256=${sig}`,
          'x-forwarded-for': b.ip,
        },
      })
    );
  }
  if (kind === 'review' || kind === 'rank') {
    const route =
      kind === 'review'
        ? 'app/api/cron/gbp-monitor/route.ts'
        : 'app/api/cron/rank-snapshot/route.ts';
    return asDelivery(
      route,
      await invokeRoute(route, 'GET', {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    );
  }
  const route = 'app/api/google-business/nap-audit/route.ts';
  mockWorld.sessionOrg = b.orgId;
  return asDelivery(route, await invokeRoute(route, 'GET'));
};

// ---------------------------------------------------------------------------
// The detector — shared by cases and controls.
// ---------------------------------------------------------------------------

interface Verdict {
  state: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  detail: string;
  route?: string;
}

function locationOf(data: Record<string, unknown>): unknown {
  const meta = (data.metadata ?? {}) as Record<string, unknown>;
  return data.locationId ?? meta.locationId;
}

function hasAttribution(data: Record<string, unknown>): boolean {
  const meta = (data.metadata ?? {}) as Record<string, unknown>;
  return (
    typeof data.signalId === 'string' &&
    data.signalId.length > 0 &&
    Boolean(data.campaignId || data.opportunityId || meta.attribution)
  );
}

function writeSummary(): string {
  const counts = new Map<string, number>();
  for (const w of mockWorld.writes) {
    const k = `${w.model}.${w.method}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return (
    [...counts.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, c]) => `${k}x${c}`)
      .join(',') || 'none'
  );
}

async function detect(
  b: Business,
  kind: Kind,
  deliver: Deliver
): Promise<Verdict> {
  resetWorld();
  seed(b, kind);
  let route: string | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const d = await deliver(b, kind);
    await settle();
    route = d.route;
    if (d.status === null)
      return {
        state: 'INCONCLUSIVE',
        route,
        detail: `delivery ${attempt}: ${d.error}`,
      };
    if (d.status < 200 || d.status >= 300)
      return {
        state: 'FAIL',
        route,
        detail: `delivery ${attempt} status ${d.status}`,
      };
  }

  const outcomeWrites = mockWorld.writes.filter(
    w => w.model === 'marketingAgencyOutcomeEvent'
  );
  const writes = `writes[${writeSummary()}]`;
  const foreign = outcomeWrites.filter(w => {
    const data = (w.args.data ?? w.args.create ?? {}) as Record<
      string,
      unknown
    >;
    return data.organizationId !== b.orgId;
  });
  if (foreign.length > 0)
    return {
      state: 'FAIL',
      route,
      detail: `outcome written for another org (${foreign
        .map(w =>
          String((w.args.data as Record<string, unknown>)?.organizationId)
        )
        .join(',')}) ${writes}`,
    };

  const matching = mockWorld.outcomes.filter(
    r =>
      r.organizationId === b.orgId &&
      EVENT_TYPE[kind].test(String(r.eventType ?? ''))
  );
  if (matching.length === 0)
    return {
      state: 'FAIL',
      route,
      detail: `no ${kind} outcome event after 2 deliveries ${writes}`,
    };
  if (matching.length > 1)
    return {
      state: 'FAIL',
      route,
      detail: `replay double-counted: ${matching.length} ${kind} outcome events ${writes}`,
    };
  const ev = matching[0];
  if (locationOf(ev) !== b.locationId)
    return {
      state: 'FAIL',
      route,
      detail: `outcome event location id ${String(locationOf(ev))} != ${b.locationId}`,
    };
  if (!hasAttribution(ev))
    return {
      state: 'FAIL',
      route,
      detail:
        'outcome event has no attribution (signalId + campaign/opportunity/metadata.attribution)',
    };

  let tools: typeof import('@/lib/services/ai/studio-tools/performance-tools');
  try {
    tools = require('@/lib/services/ai/studio-tools/performance-tools');
  } catch (err) {
    return {
      state: 'INCONCLUSIVE',
      route,
      detail: `performance-tools import failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const tool = tools.PERFORMANCE_TOOLS.find(
    t => t.name === 'performance_get_outcomes'
  );
  if (!tool)
    return { state: 'FAIL', route, detail: 'performance_get_outcomes missing' };
  let read: { events: { id: string }[] };
  try {
    read = (await tool.execute({ limit: 100 }, {
      organizationId: b.orgId,
    } as never)) as { events: { id: string }[] };
  } catch (err) {
    return {
      state: 'INCONCLUSIVE',
      route,
      detail: `performance_get_outcomes threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!read.events.some(e => e.id === ev.id))
    return {
      state: 'FAIL',
      route,
      detail: `performance_get_outcomes(${b.orgId}) does not return event ${ev.id}`,
    };
  return {
    state: 'PASS',
    route,
    detail: `${String(ev.eventType)} event ${ev.id} at ${b.locationId}, read back`,
  };
}

// ---------------------------------------------------------------------------
// Planted writers for the controls. They write through the real service
// function recordMarketingAgencyOutcome (the only outcome writer in lib/).
// ---------------------------------------------------------------------------

type Writer = (b: Business, kind: Kind, delivery: number) => Promise<void>;

let deliveryCount = 0;
function plantedDeliver(writer: Writer): Deliver {
  return async (b, kind) => {
    deliveryCount++;
    try {
      await writer(b, kind, deliveryCount);
      return { route: 'planted', status: 200 };
    } catch (err) {
      return {
        route: 'planted',
        status: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
}

async function writeOutcome(
  b: Business,
  kind: Kind,
  opts: { orgId?: string; locationId?: string | null; dedupe: boolean }
): Promise<void> {
  const { recordMarketingAgencyOutcome } =
    require('@/lib/marketing-agency/intelligence/signal-persistence') as typeof import('@/lib/marketing-agency/intelligence/signal-persistence');
  const orgId = opts.orgId ?? b.orgId;
  const externalId = `${kind}-${b.n}`;
  if (
    opts.dedupe &&
    mockWorld.outcomes.some(
      r =>
        r.organizationId === orgId &&
        (r.metadata as Record<string, unknown>)?.externalId === externalId
    )
  )
    return;
  await recordMarketingAgencyOutcome({
    organizationId: orgId,
    signalExternalId: externalId,
    eventType: `local_${kind}`,
    metadata: {
      externalId,
      attribution: { source: 'google', medium: 'organic' },
      ...(opts.locationId === null
        ? {}
        : { locationId: opts.locationId ?? b.locationId }),
    },
    recordedAt: FIXED_DATE,
  });
}

const referenceWriter: Writer = (b, kind) =>
  writeOutcome(b, kind, { dedupe: true });

const CONTROLS: { id: string; plant: string; writer: Writer }[] = [
  {
    id: 'J7-control-drops-location-id',
    plant: 'writer omits locationId',
    writer: (b, kind) =>
      writeOutcome(b, kind, { locationId: null, dedupe: true }),
  },
  {
    id: 'J7-control-wrong-org',
    plant: `writer records the outcome under ${BYSTANDER_ORG}`,
    writer: (b, kind) =>
      writeOutcome(b, kind, { orgId: BYSTANDER_ORG, dedupe: true }),
  },
  {
    id: 'J7-control-replay-double-count',
    plant: 'writer records a replayed call twice',
    writer: (b, kind) => writeOutcome(b, kind, { dedupe: false }),
  },
];

// ---------------------------------------------------------------------------

const results: JevResult[] = [];
afterAll(() => recordResults('J7', results));

const savedEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  'LEAD_CAPTURE_HMAC_SECRET',
  'CRON_SECRET',
  'CRON_SECRET_GBP_MONITOR',
  'CRON_SECRET_RANK_SNAPSHOT',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'REDIS_URL',
  'REDIS_TOKEN',
];
beforeAll(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.LEAD_CAPTURE_HMAC_SECRET = HMAC_SECRET;
  process.env.CRON_SECRET = CRON_SECRET;
  delete process.env.CRON_SECRET_GBP_MONITOR;
  delete process.env.CRON_SECRET_RANK_SNAPSHOT;
  for (const k of ENV_KEYS.slice(4)) delete process.env[k];
});
afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

it('J7 controls: the detector catches every planted writer', async () => {
  const probe = BUSINESSES[0];
  // A correct writer must pass, or the detector is over-strict and its
  // catches prove nothing: controls then cannot be FAIL.
  const reference = await detect(
    probe,
    'call',
    plantedDeliver(referenceWriter)
  );
  for (const c of CONTROLS) {
    const v = await detect(probe, 'call', plantedDeliver(c.writer));
    results.push({
      id: c.id,
      family: 'J7',
      kind: 'control',
      route: 'planted',
      state: reference.state === 'PASS' ? v.state : 'INCONCLUSIVE',
      detail:
        reference.state === 'PASS'
          ? `${c.plant}: ${v.detail}`
          : `reference writer did not pass (${reference.state}: ${reference.detail})`,
    });
  }
});

it('J7 cases: local signals become attributed, located outcome events', async () => {
  for (const b of BUSINESSES) {
    for (const kind of kindsFor(b)) {
      const id = `J7-${kind}-b${b.n}`;
      const v = await detect(b, kind, realDeliver);
      results.push(
        v.state === 'INCONCLUSIVE'
          ? {
              id,
              family: 'J7',
              kind: 'case',
              state: 'INCONCLUSIVE',
              route: v.route,
              detail: v.detail,
            }
          : {
              id,
              family: 'J7',
              kind: 'case',
              route: v.route,
              ...classify(id, v.state === 'PASS', v.detail),
            }
      );
    }
  }
  expect(results.filter(r => r.kind === 'case')).toHaveLength(160);
}, 300000);
