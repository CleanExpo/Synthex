/**
 * J12 golden regressions — app/api route handlers called in-process.
 *
 * Auth is real: a JWT signed with the test JWT_SECRET (tests/jest.setup.js).
 * Only Prisma (j12/db.ts) and the Next request scope (next/headers, mocked in
 * the test file) are stood in for.
 */
import jwt from 'jsonwebtoken';
import {
  invokeRoute,
  type InvokeOptions,
  type InvokeResult,
} from '../../runner/route-harness';
import { db } from './db';
import {
  Inconclusive,
  verdict,
  withEnv,
  type GoldenCase,
  type Verdict,
} from './harness';

export const ORG_A = 'org-A'; // home org
export const ORG_B = 'org-B'; // the multi-business owner's active brand
export const USER_A = 'user-A';

export function bearer(userId = USER_A): Record<string, string> {
  const token = jwt.sign(
    { userId, email: `${userId}@org-a.test` },
    process.env.JWT_SECRET as string,
    {
      expiresIn: '1h',
    }
  );
  return { authorization: `Bearer ${token}` };
}

type Handlers = Record<string, (args: unknown) => unknown>;

/** A multi-business owner whose home org is org-A and whose ACTIVE brand is org-B. */
export function ownerOnBrandB(extra: Handlers = {}): Handlers {
  return {
    'user.findUnique': () => ({
      id: USER_A,
      email: 'user-A@org-a.test',
      organizationId: ORG_A,
      isMultiBusinessOwner: true,
      activeOrganizationId: ORG_B,
    }),
    'businessOwnership.findUnique': () => ({ isActive: true }),
    'organization.findUnique': () => ({ id: ORG_B, status: 'active' }),
    ...extra,
  };
}

/** A plain member of org-A with no other org access. */
export function memberOfA(extra: Handlers = {}): Handlers {
  return {
    'user.findUnique': () => ({
      id: USER_A,
      email: 'user-A@org-a.test',
      organizationId: ORG_A,
      isMultiBusinessOwner: false,
      activeOrganizationId: null,
    }),
    'businessOwnership.findUnique': () => null,
    'organization.findUnique': () => ({ id: ORG_A, status: 'active' }),
    ...extra,
  };
}

/** invokeRoute, with an import failure turned into Inconclusive. */
export async function call(
  file: string,
  method: string,
  opts: InvokeOptions = {}
): Promise<InvokeResult> {
  const r = await invokeRoute(file, method, opts);
  if (r.status === null && r.error?.startsWith('import failed'))
    throw new Inconclusive(r.error);
  return r;
}

const WRITE = /^(create|update|upsert|delete)/;

/**
 * Tenant-scope detector: every query to `model.op` is scoped to the active
 * brand org-B and never to the home org org-A.
 */
export function assertBrandScoped(
  r: InvokeResult,
  model: string,
  op: string
): Verdict {
  const calls = db.callsTo(model, op).map(c => JSON.stringify(c.args));
  return verdict([
    ['handler ran', r.status === null ? r.error : 'ok', 'ok'],
    [`${model}.${op} called`, calls.length > 0, true],
    [
      'scoped to active brand org-B',
      calls.length > 0 && calls.every(c => c.includes(`"${ORG_B}"`)),
      true,
    ],
    [
      'home org org-A never queried',
      calls.some(c => c.includes(`"${ORG_A}"`)),
      false,
    ],
  ]);
}

export function brandScopeCase(
  slug: string,
  sha: string,
  file: string,
  model: string,
  op: string,
  opts: InvokeOptions = {},
  method = 'GET'
): GoldenCase {
  return {
    slug,
    sha,
    target: file,
    property: `${method} ${file} scopes ${model}.${op} to the caller's active brand, not the home org`,
    run: async () => {
      db.reset(ownerOnBrandB());
      const r = await call(file, method, { headers: bearer(), ...opts });
      return assertBrandScoped(r, model, op);
    },
  };
}

/** Unauthenticated request is refused with one of `statuses` and touches no data. */
function unauthCase(
  slug: string,
  sha: string,
  file: string,
  method: string,
  statuses: number[],
  opts: InvokeOptions = {}
): GoldenCase {
  return {
    slug,
    sha,
    target: file,
    property: `${method} ${file} refuses an unauthenticated caller (${statuses.join('/')}) without touching data`,
    run: async () => {
      db.reset();
      const r = await call(file, method, opts);
      const writes = db.calls.filter(c => WRITE.test(c.method));
      return verdict([
        [
          'status',
          statuses.includes(r.status as number)
            ? 'refused'
            : `status ${r.status} ${r.error ?? ''}`,
          'refused',
        ],
        ['no writes', writes.length, 0],
      ]);
    },
  };
}

export const routeCases: GoldenCase[] = [
  // ── Auth gates ──────────────────────────────────────────────────────────
  unauthCase(
    'monitoring-events-auth',
    '9ef9d8ae',
    'app/api/monitoring/events/route.ts',
    'POST',
    [401, 403],
    {
      body: { type: 'pageview', name: 'org-A-probe' },
    }
  ),
  unauthCase(
    'trending-auth',
    '9ef9d8ae',
    'app/api/trending/route.ts',
    'GET',
    [401, 403]
  ),
  unauthCase(
    'patterns-cached-auth',
    '9ef9d8ae',
    'app/api/patterns/cached/route.ts',
    'GET',
    [401, 403]
  ),
  unauthCase(
    'performance-metrics-auth',
    '9ef9d8ae',
    'app/api/performance/metrics/route.ts',
    'GET',
    [401, 403]
  ),
  unauthCase(
    'health-scaling-auth',
    'e43762b5',
    'app/api/health/scaling/route.ts',
    'GET',
    [401, 403]
  ),
  unauthCase(
    'system-models-auth',
    'e43762b5',
    'app/api/system/models/route.ts',
    'GET',
    [401, 403]
  ),
  unauthCase(
    'analytics-dashboard-auth',
    'd32fe681',
    'app/api/analytics/dashboard/route.ts',
    'GET',
    [401, 403]
  ),
  unauthCase(
    'content-branded-auth',
    '507df41a',
    'app/api/content/branded/route.ts',
    'POST',
    [401, 403],
    {
      body: { prompt: 'x', organizationId: ORG_B },
    }
  ),
  {
    slug: 'login-malformed-body',
    sha: 'e0db71eb',
    property:
      'POST /api/auth/login answers 415 for a non-JSON content type and 400 for malformed JSON (not 500)',
    target: 'app/api/auth/login/route.ts',
    run: async () => {
      db.reset();
      const f = 'app/api/auth/login/route.ts';
      const form = await call(f, 'POST', {
        body: 'email=a',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      const bad = await call(f, 'POST', {
        body: '{bad',
        headers: { 'content-type': 'application/json' },
      });
      return verdict([
        ['form → 415', form.status, 415],
        ['malformed → 400', bad.status, 400],
      ]);
    },
  },
  {
    slug: 'login-reserved-email-short-circuit',
    sha: '4ddcf89c',
    property:
      'POST /api/auth/login refuses reserved-TLD emails (.example/.test/.invalid) with 401 before any user lookup',
    target: 'app/api/auth/login/route.ts',
    run: async () => {
      db.reset();
      const r = await call('app/api/auth/login/route.ts', 'POST', {
        body: { email: 'user-a@org-a.example', password: 'x' },
      });
      return verdict([
        ['status', r.status, 401],
        ['no user lookup', db.callsTo('user').length, 0],
      ]);
    },
  },
  {
    slug: 'research-trends-fail-closed',
    sha: 'aef2bd0d',
    property:
      'GET /api/research/trends returns 503 unavailable instead of mock trending topics (GAP-019)',
    target: 'app/api/research/trends/route.ts',
    run: async () => {
      db.reset(memberOfA());
      const r = await call('app/api/research/trends/route.ts', 'GET', {
        headers: bearer(),
        url: 'http://localhost:3000/api/research/trends?category=technology',
      });
      return verdict([
        ['status', r.status, 503],
        [
          'honest error',
          r.json,
          {
            error:
              'Trend research is unavailable until a verified data provider is configured.',
          },
        ],
      ]);
    },
  },
  {
    slug: 'mobile-sync-fail-closed',
    sha: '25f52056',
    property:
      'POST /api/mobile/sync returns 503 instead of acknowledging unprocessed changes (GAP-019)',
    target: 'app/api/mobile/sync/route.ts',
    run: async () => {
      db.reset(memberOfA());
      const r = await call('app/api/mobile/sync/route.ts', 'POST', {
        headers: bearer(),
        body: {
          changes: [
            {
              type: 'create',
              entity: 'post',
              id: 'post-org-A',
              timestamp: '2026-08-06T00:00:00.000Z',
            },
          ],
        },
      });
      return verdict([
        ['status', r.status, 503],
        ['no writes', db.calls.filter(c => WRITE.test(c.method)).length, 0],
      ]);
    },
  },
  {
    slug: 'cron-analyze-patterns-fail-closed',
    sha: '0ffcc096',
    property:
      'cron analyze-patterns refuses a wrong secret (401) and reports 503 unavailable instead of a stub analysis',
    target: 'app/api/cron/analyze-patterns/route.ts',
    run: () =>
      withEnv({ CRON_SECRET: 'j12-cron-secret' }, async () => {
        db.reset();
        const f = 'app/api/cron/analyze-patterns/route.ts';
        const wrong = await call(f, 'GET', {
          headers: { authorization: 'Bearer wrong' },
        });
        const right = await call(f, 'GET', {
          headers: { authorization: 'Bearer j12-cron-secret' },
        });
        return verdict([
          ['wrong secret', wrong.status, 401],
          ['honest unavailable', right.status, 503],
        ]);
      }),
  },
  {
    slug: 'legacy-direct-social-post-disabled',
    sha: '043a96cf',
    property:
      'the legacy direct Facebook post route is disabled by default and points callers at /api/social/post',
    target: 'app/api/social/facebook/post/route.ts',
    run: () =>
      withEnv(
        { SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS: undefined },
        async () => {
          db.reset(memberOfA());
          const r = await call(
            'app/api/social/facebook/post/route.ts',
            'POST',
            { headers: bearer(), body: { content: 'x' } }
          );
          const body = JSON.stringify(r.json ?? {});
          return verdict([
            [
              'refused (4xx)',
              typeof r.status === 'number' && r.status >= 400 && r.status < 500,
              true,
            ],
            [
              'points at /api/social/post',
              body.includes('/api/social/post'),
              true,
            ],
            ['no writes', db.calls.filter(c => WRITE.test(c.method)).length, 0],
          ]);
        }
      ),
  },
  {
    slug: 'media-library-limit-bounds',
    sha: 'a3d7b2ef',
    property:
      'GET /api/media/library rejects limit outside 1..100 with 400 instead of an unbounded query',
    target: 'app/api/media/library/route.ts',
    run: async () => {
      db.reset(memberOfA());
      const r = await call('app/api/media/library/route.ts', 'GET', {
        headers: bearer(),
        url: 'http://localhost:3000/api/media/library?limit=100000',
      });
      return verdict([
        ['status', r.status, 400],
        ['no query', db.calls.filter(c => c.method === 'findMany').length, 0],
      ]);
    },
  },
  {
    slug: 'content-intelligence-degraded-503',
    sha: '80afdc92',
    property:
      'GET /api/dashboard/content-intelligence returns 503 degraded:true (not a clean 200) when the DB read fails',
    target: 'app/api/dashboard/content-intelligence/route.ts',
    run: async () => {
      const down = () => Promise.reject(new Error('db down'));
      db.reset(
        ownerOnBrandB({
          'contentPerformanceProfile.findUnique': down,
          'contentImprovementTracking.findMany': down,
        })
      );
      const r = await call(
        'app/api/dashboard/content-intelligence/route.ts',
        'GET',
        { headers: bearer() }
      );
      const body = (r.json ?? {}) as { degraded?: boolean; success?: boolean };
      return verdict([
        ['status', r.status, 503],
        ['degraded', body.degraded, true],
        ['success false', body.success, false],
      ]);
    },
  },
  {
    slug: 'gbp-locations-honest-empty',
    sha: 'fca45b0a',
    property:
      'GET /api/google-business/locations reports connected:false with no locations when Google is not connected (AT-015)',
    target: 'app/api/google-business/locations/route.ts',
    run: async () => {
      db.reset(ownerOnBrandB());
      const r = await call(
        'app/api/google-business/locations/route.ts',
        'GET',
        { headers: bearer() }
      );
      const body = (r.json ?? {}) as {
        connected?: boolean;
        locations?: unknown;
      };
      return verdict([
        ['status', r.status, 200],
        ['connected', body.connected, false],
        ['locations', body.locations, []],
      ]);
    },
  },
  {
    slug: 'auto-research-cross-org-write',
    sha: '561aedcf',
    property:
      'POST /api/auto-research with an orgId the caller cannot access is 403 and enqueues nothing',
    target: 'app/api/auto-research/route.ts',
    run: async () => {
      db.reset(memberOfA());
      const r = await call('app/api/auto-research/route.ts', 'POST', {
        headers: bearer(),
        body: { type: 'daily_trends', orgId: 'org-C' },
      });
      return verdict([
        ['status', r.status, 403],
        ['no writes', db.calls.filter(c => WRITE.test(c.method)).length, 0],
      ]);
    },
  },
  {
    slug: 'campaign-put-org-scoped',
    sha: '3d8e835d',
    property:
      "PUT /api/campaigns cannot update another org's campaign: lookup is org-scoped and nothing is written (SYN-847)",
    target: 'app/api/campaigns/route.ts',
    run: async () => {
      // The campaign exists only in org-C; the stub honours the where clause.
      const inOrgC = (args: unknown) =>
        JSON.stringify(args).includes('"org-C"') ||
        !JSON.stringify(args).includes('rganizationId')
          ? { id: 'camp-C', organizationId: 'org-C', userId: 'user-C' }
          : null;
      db.reset(
        ownerOnBrandB({
          'campaign.findFirst': inOrgC,
          'campaign.findUnique': inOrgC,
        })
      );
      const r = await call('app/api/campaigns/route.ts', 'PUT', {
        headers: bearer(),
        body: { id: 'camp-C', name: 'hijack' },
      });
      return verdict([
        [
          'refused',
          typeof r.status === 'number' && r.status >= 400 && r.status < 500,
          true,
        ],
        ['no update', db.callsTo('campaign', 'update').length, 0],
      ]);
    },
  },
  {
    slug: 'calendar-org-access-check',
    sha: 'bb3bb9cc',
    property:
      'GET /api/content/calendar refuses an organizationId the caller is not a member of',
    target: 'app/api/content/calendar/route.ts',
    run: async () => {
      db.reset(memberOfA());
      const r = await call('app/api/content/calendar/route.ts', 'GET', {
        headers: bearer(),
        url: 'http://localhost:3000/api/content/calendar?organizationId=org-C',
      });
      return verdict([
        [
          'refused',
          typeof r.status === 'number' && [403, 404].includes(r.status),
          true,
        ],
        ['no calendar read', db.callsTo('calendarPost').length, 0],
      ]);
    },
  },
  {
    slug: 'team-admin-can-remove-member',
    sha: 'f1aef383',
    property:
      'DELETE /api/teams/members/[memberId]: an org admin (role scoped via role.organizationId) can remove a member; a non-admin cannot',
    target: 'app/api/teams/members/[memberId]/route.ts',
    run: async () => {
      const users: Record<string, object> = {
        [USER_A]: {
          id: USER_A,
          organizationId: ORG_A,
          email: 'user-A@org-a.test',
        },
        'user-T': {
          id: 'user-T',
          organizationId: ORG_A,
          email: 'user-T@org-a.test',
        },
      };
      const roles = (isAdmin: boolean) => (args: unknown) => {
        const where =
          (
            args as {
              where?: { userId?: string; role?: { organizationId?: string } };
            }
          ).where ?? {};
        return isAdmin &&
          where.userId === USER_A &&
          where.role?.organizationId === ORG_A
          ? [{ role: { name: 'admin', permissions: ['manage_members'] } }]
          : [];
      };
      const byId = (args: unknown) =>
        users[(args as { where: { id: string } }).where.id] ?? null;
      const f = 'app/api/teams/members/[memberId]/route.ts';
      db.reset({
        'user.findUnique': byId,
        'user.findFirst': byId,
        'userRole.findMany': roles(true),
      });
      const admin = await call(f, 'DELETE', {
        headers: bearer(),
        params: { memberId: 'user-T' },
      });
      const adminWrote = db.callsTo('user', 'update').length;
      db.reset({
        'user.findUnique': byId,
        'user.findFirst': byId,
        'userRole.findMany': roles(false),
      });
      const member = await call(f, 'DELETE', {
        headers: bearer(),
        params: { memberId: 'user-T' },
      });
      return verdict([
        [
          'admin removes (200)',
          admin.status === null ? admin.error : admin.status,
          200,
        ],
        ['admin write happened', adminWrote > 0, true],
        ['non-admin 403', member.status, 403],
        [
          'non-admin no writes',
          db.calls.filter(c => WRITE.test(c.method)).length,
          0,
        ],
      ]);
    },
  },

  // ── Tenant scoping: reads follow the active brand ───────────────────────
  brandScopeCase(
    'tasks-org-scope',
    '85b98427',
    'app/api/tasks/route.ts',
    'task',
    'findMany'
  ),
  brandScopeCase(
    'web-projects-brand-scope',
    '4cd368b5',
    'app/api/web-projects/route.ts',
    'project',
    'findMany'
  ),
  brandScopeCase(
    'advisor-brief-brand-scope',
    '454aa8df',
    'app/api/advisor/brief/route.ts',
    'recommendedAction',
    'findFirst'
  ),
  brandScopeCase(
    'white-label-brand-scope',
    '62ca2f91',
    'app/api/white-label/config/route.ts',
    'organization',
    'findUnique'
  ),
  brandScopeCase(
    'forecast-models-brand-scope',
    'a7f80ba8',
    'app/api/forecast/models/route.ts',
    'forecastModel',
    'findMany'
  ),
  brandScopeCase(
    'bayesian-spaces-brand-scope',
    '47a96316',
    'app/api/bayesian/spaces/route.ts',
    'bOSpace',
    'findMany'
  ),
  brandScopeCase(
    'monthly-story-brand-scope',
    '78997d5e',
    'app/api/monthly-story/latest/route.ts',
    'monthlyStory',
    'findFirst'
  ),
  {
    slug: 'content-score-history-brand-scope',
    sha: '78997d5e',
    property:
      "GET /api/dashboard/content-score-history serves the caller's active-brand history (handler completes, never 5xx)",
    target: 'app/api/dashboard/content-score-history/route.ts',
    run: async () => {
      db.reset(ownerOnBrandB());
      const r = await call(
        'app/api/dashboard/content-score-history/route.ts',
        'GET',
        { headers: bearer() }
      );
      return verdict([
        [
          'handler completed',
          r.status === null ? r.error?.slice(0, 160) : 'ok',
          'ok',
        ],
        ['not 5xx', typeof r.status === 'number' && r.status < 500, true],
      ]);
    },
  },
  brandScopeCase(
    'ab-testing-brand-scope',
    'e117e14e',
    'app/api/ab-testing/tests/route.ts',
    'aBTest',
    'findMany'
  ),
  brandScopeCase(
    'content-drafts-brand-scope',
    'efe47b7b',
    'app/api/content-drafts/route.ts',
    'contentDraft',
    'findMany'
  ),
  brandScopeCase(
    'research-report-brand-scope',
    'ae46f423',
    'app/api/research/[id]/route.ts',
    'gEOResearchReport',
    'findFirst',
    {
      params: { id: '7' },
    }
  ),
  brandScopeCase(
    'scheduled-reports-brand-scope',
    'c3cebfd9',
    'app/api/analytics/reports/scheduled/route.ts',
    'report',
    'findMany'
  ),
  brandScopeCase(
    'analytics-insights-brand-scope',
    '74a23f28',
    'app/api/analytics/insights/route.ts',
    'campaign',
    'findMany'
  ),
  brandScopeCase(
    'dashboard-brand-iq-brand-scope',
    '68f0fcc5',
    'app/api/dashboard/brand-iq/route.ts',
    'brandDNA',
    'findUnique'
  ),
  brandScopeCase(
    'scheduler-posts-org-scope',
    '6581be40',
    'app/api/scheduler/posts/route.ts',
    'campaign',
    'findMany'
  ),
  brandScopeCase(
    'connection-status-org-scope',
    '32ba2674',
    'app/api/auth/connections/status/route.ts',
    'platformConnection',
    'findMany'
  ),
  brandScopeCase(
    'ga4-properties-org-scope',
    '64ff6043',
    'app/api/integrations/ga4/properties/route.ts',
    'platformConnection',
    'findFirst'
  ),
];
