/**
 * J12 golden regressions — plans, OAuth/social platforms, RBAC and the
 * remaining route fixes.
 */
import { db } from './db';
import { load, throws, verdict, withEnv, type GoldenCase } from './harness';
import {
  bearer,
  brandScopeCase,
  call,
  memberOfA,
  ownerOnBrandB,
  ORG_A,
  ORG_B,
  USER_A,
} from './cases-routes';

type Fn<A extends unknown[] = unknown[], R = unknown> = (...a: A) => R;
const WRITE = /^(create|update|upsert|delete)/;

export const platformCases: GoldenCase[] = [
  {
    slug: 'marketing-agent-legacy-tier-aliases',
    sha: '45efabf1',
    property:
      'getMarketingAgentLimitForPlan honours business/custom/enterprise aliases instead of free-tier 0',
    target: 'lib/marketing-agency/agent/tier-gate.ts',
    run: () => {
      const { getMarketingAgentLimitForPlan: f } = load<{
        getMarketingAgentLimitForPlan: Fn<[string], number>;
      }>('@/lib/marketing-agency/agent/tier-gate');
      return verdict([
        ['business', f('business'), 3],
        ['enterprise', f('enterprise'), -1],
        ['ENTERPRISE', f('ENTERPRISE'), -1],
        ['free', f('free'), 0],
      ]);
    },
  },
  {
    slug: 'geo-limits-enterprise-unlimited',
    sha: '8fc808c9',
    property:
      'GEO feature limits give enterprise orgs unlimited (-1), not the free-tier fallback',
    target: 'lib/geo/feature-limits.ts',
    run: () => {
      const m = load<{
        getFeatureLimit: Fn<[string, string], number>;
        isFeatureAvailable: Fn<[string, string], boolean>;
      }>('@/lib/geo/feature-limits');
      return verdict([
        ['geoAnalyses', m.getFeatureLimit('enterprise', 'geoAnalyses'), -1],
        [
          'researchReports',
          m.getFeatureLimit('enterprise', 'researchReports'),
          -1,
        ],
        ['available', m.isFeatureAvailable('enterprise', 'geoAnalyses'), true],
      ]);
    },
  },
  {
    slug: 'x-oauth-authorize-endpoint',
    sha: '4da41538',
    property:
      'the X OAuth2 provider builds its authorize URL on x.com, not legacy twitter.com',
    target: 'lib/oauth/providers/twitter.ts',
    run: () =>
      withEnv(
        {
          TWITTER_CLIENT_ID: 'j12-client-id',
          TWITTER_CLIENT_SECRET: 'j12-client-secret',
        },
        () => {
          const { TwitterOAuthProvider } = load<{
            TwitterOAuthProvider: new () => {
              getAuthorizationUrl: Fn<[string], string>;
            };
          }>('@/lib/oauth/providers/twitter');
          const url = new TwitterOAuthProvider().getAuthorizationUrl(
            'state-org-A'
          );
          return verdict([
            [
              'host + path',
              url.split('?')[0],
              'https://x.com/i/oauth2/authorize',
            ],
            [
              'PKCE S256',
              new URL(url).searchParams.get('code_challenge_method'),
              'S256',
            ],
          ]);
        }
      ),
  },
  {
    slug: 'stripe-addon-price-no-entitlement',
    sha: 'd9db60c2',
    property:
      'getProductByBasePriceId never resolves an add-on tierPriceId to a paid plan (SYN-1107 fail closed)',
    target: 'lib/stripe/config.ts',
    run: () => {
      const m = load<{
        PRODUCTS: Record<string, { priceId: string; tierPriceId?: string }>;
        getProductByBasePriceId: Fn<[string], { priceId: string } | undefined>;
      }>('@/lib/stripe/config');
      const ent = m.PRODUCTS.enterprise;
      return verdict([
        ['has add-on price', typeof ent?.tierPriceId, 'string'],
        [
          'add-on resolves to nothing',
          m.getProductByBasePriceId(String(ent?.tierPriceId)),
          undefined,
        ],
        [
          'base resolves',
          m.getProductByBasePriceId(String(ent?.priceId))?.priceId,
          ent?.priceId,
        ],
      ]);
    },
  },
  {
    slug: 'api-key-gate-platform-env',
    sha: 'c3217c38',
    property:
      'resolveApiKeyConfigured is true when a platform AI key is set, without a per-user DB lookup (SYN-153)',
    target: 'lib/ai/resolve-api-key-status.ts',
    run: () =>
      withEnv({ OPENROUTER_API_KEY: 'sk-or-j12-synthetic' }, async () => {
        const { resolveApiKeyConfigured } = load<{
          resolveApiKeyConfigured: Fn<[string], Promise<boolean>>;
        }>('@/lib/ai/resolve-api-key-status');
        db.reset();
        const ok = await resolveApiKeyConfigured(USER_A);
        return verdict([
          ['configured', ok, true],
          ['no user lookup', db.callsTo('user').length, 0],
        ]);
      }),
  },
  {
    slug: 'x-oauth2-refresh-not-secret',
    sha: '87309921',
    property:
      'buildTwitterPlatformCredentials maps an OAuth 2.0 refresh token as refreshToken, never as a 1.0a accessSecret',
    target: 'lib/social/twitter-oauth-credentials.ts',
    run: () => {
      const m = load<{
        buildTwitterPlatformCredentials: Fn<
          [object],
          { oauthVersion: string; refreshToken?: string; accessSecret?: string }
        >;
        resolveTwitterOAuthVersion: Fn<[object, Date | null], string>;
      }>('@/lib/social/twitter-oauth-credentials');
      const c = m.buildTwitterPlatformCredentials({
        accessToken: 'access-2',
        refreshTokenDecrypted: 'refresh-2',
        expiresAt: new Date('2026-08-05T12:00:00Z'),
        metadata: { tokenType: 'bearer' },
      });
      return verdict([
        ['version', c.oauthVersion, '2.0'],
        ['refreshToken', c.refreshToken, 'refresh-2'],
        ['no accessSecret', c.accessSecret, undefined],
        ['legacy stays 1.0a', m.resolveTwitterOAuthVersion({}, null), '1.0a'],
      ]);
    },
  },
  {
    slug: 'rbac-reserved-role-names',
    sha: 'ecbca69b',
    property:
      'RoleManager.createRole refuses the reserved names owner/admin (any case) and creates nothing (SYN-1109)',
    target: 'lib/auth/rbac/role-manager.ts',
    run: async () => {
      const { RoleManager } = load<{
        RoleManager: {
          createRole: Fn<[string, object, string], Promise<unknown>>;
        };
      }>('@/lib/auth/rbac/role-manager');
      db.reset();
      const owner = await throws(() =>
        RoleManager.createRole(
          ORG_A,
          { name: 'Owner', permissions: [] },
          USER_A
        )
      );
      const admin = await throws(() =>
        RoleManager.createRole(
          ORG_A,
          { name: ' admin ', permissions: [] },
          USER_A
        )
      );
      return verdict([
        [
          'Owner refused',
          owner !== null && /reserved role name/i.test(owner),
          true,
        ],
        [
          ' admin refused',
          admin !== null && /reserved role name/i.test(admin),
          true,
        ],
        ['no role created', db.callsTo('role', 'create').length, 0],
      ]);
    },
  },
  {
    slug: 'rbac-wildcard-delegation-contained',
    sha: '2e185f25',
    property:
      'canDelegatePermissions: *:manage cannot grant * or other actions; malformed permissions fail closed (SYN-1112)',
    target: 'lib/auth/rbac/permission-engine.ts',
    run: () => {
      const { canDelegatePermissions: c } = load<{
        canDelegatePermissions: Fn<[string[], string[]], boolean>;
      }>('@/lib/auth/rbac/permission-engine');
      return verdict([
        [
          '*:manage → billing:manage',
          c(['*:manage'], ['billing:manage']),
          true,
        ],
        [
          '*:manage → billing:update',
          c(['*:manage'], ['billing:update']),
          false,
        ],
        ['*:manage → *', c(['*:manage'], ['*']), false],
        ['malformed', c(['*'], ['constructor:read']), false],
      ]);
    },
  },
  {
    slug: 'teams-last-admin-guard',
    sha: 'e81263d3',
    property:
      'DELETE /api/teams/members/[memberId] refuses to remove the last admin of an org (409, no write)',
    target: 'app/api/teams/members/[memberId]/route.ts',
    run: async () => {
      const ADMIN_ROLE = {
        id: 'role-admin',
        name: 'admin',
        permissions: ['manage_members'],
      };
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
          name: 'T',
        },
      };
      const byId = (args: unknown) =>
        users[(args as { where: { id: string } }).where?.id] ?? users['user-T'];
      // Both the caller and the target are admins; no OTHER admin exists.
      const roles = (args: unknown) => {
        const where = (args as { where?: Record<string, unknown> }).where ?? {};
        if (where.roleId) return [];
        return [
          { userId: where.userId, roleId: ADMIN_ROLE.id, role: ADMIN_ROLE },
        ];
      };
      db.reset({
        'user.findUnique': byId,
        'user.findFirst': byId,
        'userRole.findMany': roles,
        'role.findFirst': () => ADMIN_ROLE,
      });
      const r = await call(
        'app/api/teams/members/[memberId]/route.ts',
        'DELETE',
        {
          headers: bearer(),
          params: { memberId: 'user-T' },
        }
      );
      return verdict([
        ['status', r.status, 409],
        ['no writes', db.calls.filter(c => WRITE.test(c.method)).length, 0],
      ]);
    },
  },
  {
    slug: 'autopilot-enable-seeds-next-run',
    sha: '76602c49',
    property:
      'PATCH /api/autopilot/config {enabled:true} seeds nextRunAt so the daily cron picks the org up (dead toggle)',
    target: 'app/api/autopilot/config/route.ts',
    run: async () => {
      db.reset(ownerOnBrandB());
      const before = Date.now();
      const r = await call('app/api/autopilot/config/route.ts', 'PATCH', {
        headers: bearer(),
        body: { enabled: true },
      });
      const w = db.calls.find(
        c => c.model === 'autopilotConfig' && WRITE.test(c.method)
      );
      const json = JSON.stringify(w?.args ?? {});
      const m = /"nextRunAt":"([^"]+)"/.exec(json);
      const next = m ? Date.parse(m[1]) : NaN;
      return verdict([
        ['status', r.status, 200],
        ['config written for org-B', json.includes(`"${ORG_B}"`), true],
        [
          'nextRunAt in the future',
          Number.isFinite(next) && next > before,
          true,
        ],
      ]);
    },
  },
  {
    slug: 'command-centre-pending-autopilot-only',
    sha: '28f87f3b',
    property:
      "GET /api/command-centre/stats counts Pending Review as autopilot-sourced drafts of the caller's org",
    target: 'app/api/command-centre/stats/route.ts',
    run: async () => {
      db.reset(ownerOnBrandB());
      const r = await call('app/api/command-centre/stats/route.ts', 'GET', {
        headers: bearer(),
      });
      const pending = db
        .callsTo('post', 'count')
        .map(c => JSON.stringify(c.args))
        .filter(s => s.includes('"source"') && s.includes('"autopilot"'));
      return verdict([
        ['status', r.status, 200],
        ['autopilot-scoped draft count', pending.length > 0, true],
        [
          'scoped to org-B',
          pending.length > 0 &&
            pending.every(
              s => s.includes(`"${ORG_B}"`) && s.includes('"draft"')
            ),
          true,
        ],
      ]);
    },
  },
  {
    slug: 'login-email-case-insensitive',
    sha: '38d88aa6',
    property:
      'POST /api/auth/login looks the user up case-insensitively (mode: insensitive), matching signup (SYN-872)',
    target: 'app/api/auth/login/route.ts',
    run: async () => {
      db.reset();
      const r = await call('app/api/auth/login/route.ts', 'POST', {
        body: { email: 'User-A@Org-A.com', password: 'x' },
      });
      const where = JSON.stringify(
        db.callsTo('user', 'findFirst')[0]?.args ?? {}
      );
      return verdict([
        ['unknown user refused', r.status, 401],
        [
          'insensitive lookup',
          where.includes('"mode":"insensitive"') &&
            where.includes('User-A@Org-A.com'),
          true,
        ],
      ]);
    },
  },
  {
    slug: 'linkedin-no-retired-v2-me',
    sha: '7cf01c5b',
    property:
      'LinkedInService posts as urn:li:person:<OpenID sub> via /v2/userinfo, never calling the retired /v2/me',
    target: 'lib/social/linkedin-service.ts',
    run: async () => {
      const { LinkedInService } = load<{
        LinkedInService: new () => {
          initialize: Fn<[object]>;
          createPost: Fn<[object], Promise<{ success: boolean }>>;
        };
      }>('@/lib/social/linkedin-service');
      const calls: string[] = [];
      let author: string | undefined;
      const saved = global.fetch;
      // LinkedIn API stand-in (external boundary).
      global.fetch = (async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        calls.push(url);
        if (url.includes('/v2/me'))
          return {
            ok: false,
            status: 403,
            headers: new Headers(),
            text: async () => '{}',
            json: async () => ({}),
          };
        if (url.endsWith('/v2/userinfo'))
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({ sub: 'subOrgA42' }),
          };
        if (url.endsWith('/v2/ugcPosts')) {
          author = JSON.parse(String(init?.body)).author;
          return {
            ok: true,
            status: 201,
            headers: new Headers({ 'x-restli-id': 'urn:li:share:1' }),
            json: async () => ({ id: 'urn:li:share:1' }),
          };
        }
        throw new Error(`unexpected fetch ${url}`);
      }) as unknown as typeof fetch;
      try {
        const s = new LinkedInService();
        s.initialize({
          accessToken: 'access-token',
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        });
        const res = await s.createPost({ text: 'hi from org-A' });
        return verdict([
          ['success', res.success, true],
          ['author from userinfo sub', author, 'urn:li:person:subOrgA42'],
          ['never /v2/me', calls.some(u => u.includes('/v2/me')), false],
        ]);
      } finally {
        global.fetch = saved;
      }
    },
  },
  {
    slug: 'season-brief-sample-windows',
    sha: 'c1a11c12',
    property:
      'getSampleSeasonWindows returns labelled sample-* windows that have not ended, soonest first (SYN-1218)',
    target: 'lib/seasonal/sample-season-windows.ts',
    run: () => {
      const { getSampleSeasonWindows } = load<{
        getSampleSeasonWindows: Fn<
          [Date, number?],
          { id: string; windowStart: string; windowEnd: string }[]
        >;
      }>('@/lib/seasonal/sample-season-windows');
      const now = new Date(2026, 9, 17);
      const w = getSampleSeasonWindows(now, 4);
      const starts = w.map(x => Date.parse(x.windowStart));
      return verdict([
        ['4 windows', w.length, 4],
        ['labelled sample', w.every(x => x.id.startsWith('sample-')), true],
        [
          'none ended',
          w.every(
            x => Date.parse(x.windowEnd) >= new Date(2026, 9, 17).getTime()
          ),
          true,
        ],
        ['sorted', starts.every((s, i) => i === 0 || s >= starts[i - 1]), true],
      ]);
    },
  },
  {
    slug: 'calendar-optimal-times-team-tz',
    sha: 'ee85dee1',
    property:
      "CalendarService.getOptimalTimes suggests optimal hours in the team's timezone, not the server's",
    target: 'lib/content/calendar-service.ts',
    run: async () => {
      const { CalendarService } = load<{
        CalendarService: new (
          org: string,
          tz: string
        ) => {
          getOptimalTimes: Fn<
            [string, Date, number],
            Promise<{ suggestedTime: Date }[]>
          >;
        };
      }>('@/lib/content/calendar-service');
      db.reset();
      const hour = (d: Date) =>
        Number(
          new Intl.DateTimeFormat('en-US', {
            timeZone: 'Australia/Sydney',
            hour: '2-digit',
            hourCycle: 'h23',
          }).format(d)
        );
      const s = await new CalendarService(
        ORG_A,
        'Australia/Sydney'
      ).getOptimalTimes('twitter', new Date('2026-06-15T05:00:00Z'), 10);
      return verdict([
        ['has suggestions', s.length > 0, true],
        [
          'Sydney optimal twitter hours',
          s.every(x =>
            [9, 12, 15, 18].includes(hour(new Date(x.suggestedTime)))
          ),
          true,
        ],
      ]);
    },
  },
  brandScopeCase(
    'personalisation-status-brand-scope',
    '78997d5e',
    'app/api/dashboard/personalisation-status/route.ts',
    'contentPerformanceProfile',
    'findUnique'
  ),
  brandScopeCase(
    'content-intelligence-brand-scope',
    '68f0fcc5',
    'app/api/dashboard/content-intelligence/route.ts',
    'contentPerformanceProfile',
    'findUnique'
  ),
  {
    slug: 'placeholder-social-token-blocked',
    sha: '8ca6223e',
    property:
      'resolvePlatformAccessToken treats PENDING_OAUTH / TODO / blank placeholders as not ready, never as a usable token',
    target: 'lib/platform-connections/token-readiness.ts',
    run: () => {
      const m = load<{
        resolvePlatformAccessToken: Fn<
          [string | null],
          { ok: boolean; accessToken?: string }
        >;
        isPlaceholderPlatformToken: Fn<[string | null], boolean>;
      }>('@/lib/platform-connections/token-readiness');
      return verdict([
        [
          'PENDING_OAUTH not ok',
          m.resolvePlatformAccessToken('PENDING_OAUTH').ok,
          false,
        ],
        [
          'PENDING_ token not returned',
          m.resolvePlatformAccessToken('PENDING_X').accessToken,
          undefined,
        ],
        ['todo placeholder', m.isPlaceholderPlatformToken(' todo '), true],
        ['blank placeholder', m.isPlaceholderPlatformToken(''), true],
        [
          'real token is not a placeholder',
          m.isPlaceholderPlatformToken('EAAB-synthetic-org-A-token'),
          false,
        ],
      ]);
    },
  },
  {
    slug: 'integrations-org-override-revoked',
    sha: '461370a5',
    property:
      'GET /api/integrations?organizationId=<org> is 403 for a caller whose ownership of that org is revoked (isActive:false)',
    target: 'app/api/integrations/route.ts',
    run: async () => {
      const revoked = () => ({
        id: 'own-revoked',
        ownerId: USER_A,
        organizationId: 'org-C',
        isActive: false,
      });
      db.reset(
        memberOfA({
          'businessOwnership.findFirst': revoked,
          'businessOwnership.findUnique': revoked,
        })
      );
      const r = await call('app/api/integrations/route.ts', 'GET', {
        headers: bearer(),
        url: 'http://localhost:3000/api/integrations?organizationId=org-C',
      });
      return verdict([
        ['status', r.status, 403],
        [
          'no org-C connection read',
          db.callsTo('platformConnection').length,
          0,
        ],
      ]);
    },
  },
];
