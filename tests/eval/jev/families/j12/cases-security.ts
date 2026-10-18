/**
 * J12 golden regressions — security, auth, tenancy and billing helpers.
 * Each case cites its fixing commit and re-asserts the fixed behaviour at HEAD.
 */
import jwt from 'jsonwebtoken';
import { createMockNextRequest } from '../../../../helpers/mock-request';
import { db } from './db';
import {
  load,
  throws,
  verdict,
  withEnv,
  type GoldenCase,
  type Verdict,
} from './harness';

type Fn<A extends unknown[] = unknown[], R = unknown> = (...a: A) => R;

// ── Shared assertions (also driven by the planted-regression controls) ─────

/** SYN-862: all five HTML-sensitive characters are entity-escaped. */
export function assertEscapeHtml(
  escapeHtml: Fn<[string | undefined], string>
): Verdict {
  return verdict([
    [
      'script',
      escapeHtml('<script>alert(1)</script>'),
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    ],
    ['five chars', escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;'],
    ['ampersand', escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry'],
    ['undefined', escapeHtml(undefined), ''],
  ]);
}

/** SYN-995 / SYN-858 class: private, loopback and metadata IP literals throw. */
export function assertSsrfGuard(
  validate: Fn<[string], void>,
  urls: string[]
): Promise<Verdict> {
  return (async () => {
    const checks: [string, unknown, unknown][] = [];
    for (const u of urls)
      checks.push([
        `blocks ${u}`,
        (await throws(() => validate(u))) !== null,
        true,
      ]);
    checks.push([
      'allows public https',
      await throws(() => validate('https://example.com/a?b=1')),
      null,
    ]);
    return verdict(checks);
  })();
}

const ORG_A = 'org-A';
const ORG_B = 'org-B';

export const securityCases: GoldenCase[] = [
  {
    slug: 'email-escape-html',
    sha: 'ae6e2739',
    property: 'escapeHtml entity-escapes < > & " \' (SYN-862 email XSS)',
    target: 'lib/email.ts',
    run: () =>
      assertEscapeHtml(
        load<{ escapeHtml: Fn<[string | undefined], string> }>('@/lib/email')
          .escapeHtml
      ),
  },
  {
    slug: 'strip-html-script-case-bypass',
    sha: 'ae6e2739',
    property:
      'stripHtmlToText removes <SCRIPT>/<ScRiPt> blocks and nested-tag bypasses (SYN-863)',
    target: 'lib/strip-html-text.ts',
    run: () => {
      const { stripHtmlToText } = load<{
        stripHtmlToText: Fn<[string], string>;
      }>('@/lib/strip-html-text');
      const nested = stripHtmlToText(
        'safe<scr<scr<script>PAYLOAD</script>ipt></script>ipt>fine'
      );
      return verdict([
        ['upper', stripHtmlToText('a<SCRIPT>alert(1)</SCRIPT>b'), 'a b'],
        ['mixed', stripHtmlToText('a<ScRiPt>alert(1)</ScRiPt>b'), 'a b'],
        [
          'trailing ws close',
          stripHtmlToText('a<script>alert(1)</script >b'),
          'a b',
        ],
        ['nested leaves no <script', /<\/?script\b/i.test(nested), false],
      ]);
    },
  },
  {
    slug: 'sanitize-html-url-schemes',
    sha: 'ae8dd09e',
    property:
      'sanitizeHtml strips data: img src and protocol-relative href, forces rel=noopener on _blank',
    target: 'lib/sanitize.ts',
    run: () => {
      const { sanitizeHtml } = load<{ sanitizeHtml: Fn<[string], string> }>(
        '@/lib/sanitize'
      );
      const blank = sanitizeHtml(
        '<a href="https://example.com" target="_blank">link</a>'
      );
      return verdict([
        [
          'data: img',
          sanitizeHtml(
            '<img src="data:image/png;base64,iVBORw0KGgo=" alt="x">'
          ).includes('data:'),
          false,
        ],
        [
          '//evil href',
          sanitizeHtml('<a href="//evil.com">click</a>').includes('//evil.com'),
          false,
        ],
        [
          'onerror removed',
          sanitizeHtml(
            '<img src="https://x.test/a.png" onerror="alert(1)">'
          ).includes('onerror'),
          false,
        ],
        ['rel noopener', blank.includes('rel="noopener noreferrer"'), true],
      ]);
    },
  },
  {
    slug: 'ssrf-private-ipv4',
    sha: 'dea7c1d8',
    property:
      'validateExternalUrl blocks localhost, RFC1918 and 169.254 metadata, file: and ftp:',
    target: 'lib/security/validate-url.ts',
    run: () =>
      assertSsrfGuard(
        load<{ validateExternalUrl: Fn<[string], void> }>(
          '@/lib/security/validate-url'
        ).validateExternalUrl,
        [
          'http://localhost:3000/',
          'http://127.0.0.1/',
          'http://10.0.0.5/',
          'http://192.168.1.1/',
          'http://172.16.0.1/',
          'http://169.254.169.254/latest/meta-data/',
          'file:///etc/passwd',
          'ftp://example.com/x',
        ]
      ),
  },
  {
    slug: 'ssrf-ipv6-loopback',
    sha: '99bd4f75',
    property:
      'validateExternalUrl blocks the bracketed IPv6 loopback http://[::1]/',
    target: 'lib/security/validate-url.ts',
    run: () =>
      assertSsrfGuard(
        load<{ validateExternalUrl: Fn<[string], void> }>(
          '@/lib/security/validate-url'
        ).validateExternalUrl,
        ['http://[::1]/admin']
      ),
  },
  {
    slug: 'ssrf-ipv4-mapped-ipv6',
    sha: 'cadaa9a6',
    property:
      'validateExternalUrl decodes IPv4-mapped IPv6 so [::ffff:169.254.169.254] cannot reach metadata (SYN-995)',
    target: 'lib/security/validate-url.ts',
    run: () =>
      assertSsrfGuard(
        load<{ validateExternalUrl: Fn<[string], void> }>(
          '@/lib/security/validate-url'
        ).validateExternalUrl,
        [
          'http://[::ffff:169.254.169.254]/latest/meta-data',
          'http://[::ffff:a9fe:a9fe]/',
          'http://[::ffff:127.0.0.1]/',
        ]
      ),
  },
  {
    slug: 'service-token-source-allowlist',
    sha: 'abf824ca',
    property:
      'validateServiceToken refuses a valid token without an allowlisted X-Source-App (SYN-1119)',
    target: 'lib/security/service-token-validator.ts',
    run: () =>
      withEnv({ SYNTHEX_SERVICE_TOKEN: 'j12-service-token-value' }, () => {
        const { validateServiceToken } = load<{
          validateServiceToken: Fn<
            [unknown],
            { valid: boolean; sourceApp?: string; error?: string }
          >;
        }>('@/lib/security/service-token-validator');
        const req = (h: Record<string, string>) =>
          validateServiceToken(createMockNextRequest({ headers: h }));
        const T = 'j12-service-token-value';
        const other = req({
          'x-service-token': T,
          'x-source-app': 'some-other-product',
        });
        return verdict([
          [
            'allowlisted',
            req({ 'x-service-token': T, 'x-source-app': 'restoreassist' })
              .valid,
            true,
          ],
          ['unknown source refused', other.valid, false],
          ['no source attributed on refusal', other.sourceApp, undefined],
          [
            'missing source refused',
            req({ 'x-service-token': T }).valid,
            false,
          ],
          [
            'wrong token refused',
            req({ 'x-service-token': 'wrong', 'x-source-app': 'restoreassist' })
              .valid,
            false,
          ],
        ]);
      }),
  },
  {
    slug: 'api-security-body-not-consumed',
    sha: '0a03c02b',
    property:
      'APISecurityChecker body-size check leaves the request body readable for the route',
    target: 'lib/security/api-security-checker.ts',
    run: async () => {
      const { APISecurityChecker } = load<{
        APISecurityChecker: {
          check: Fn<[unknown, object], Promise<{ allowed: boolean }>>;
        };
      }>('@/lib/security/api-security-checker');
      const payload = JSON.stringify({ hello: 'world' });
      const oneShot = () => {
        let read = false;
        const guard = () => {
          if (read)
            throw new TypeError('Body is unusable: Body has already been read');
          read = true;
        };
        return {
          text: async () => (guard(), payload),
          json: async () => (guard(), JSON.parse(payload)),
        };
      };
      const original = oneShot();
      const request = {
        method: 'POST',
        url: 'https://example.com/api/test',
        headers: new Headers(),
        ip: '127.0.0.1',
        nextUrl: { pathname: '/api/test' },
        body: {},
        text: original.text,
        json: original.json,
        clone: () => oneShot(),
      };
      const result = await APISecurityChecker.check(request, {
        requireAuth: false,
        requireHTTPS: false,
        maxBodySize: 1_048_576,
      });
      let body: unknown;
      const err = await throws(async () => {
        body = await request.json();
      });
      return verdict([
        ['allowed', result.allowed, true],
        ['route can still read body', err, null],
        ['body intact', body, { hello: 'world' }],
      ]);
    },
  },
  {
    slug: 'pkce-state-single-use',
    sha: '2089dbf7',
    property:
      'retrievePKCEState rejects a state whose atomic consume deleted 0 rows (replay)',
    target: 'lib/auth/pkce.ts',
    run: () =>
      withEnv(
        {
          UPSTASH_REDIS_REST_URL: undefined,
          UPSTASH_REDIS_REST_TOKEN: undefined,
        },
        async () => {
          const { retrievePKCEState } = load<{
            retrievePKCEState: Fn<[string], Promise<unknown>>;
          }>('@/lib/auth/pkce');
          const state = 'a'.repeat(64);
          const now = Date.now();
          const record = {
            state,
            codeVerifier: 'b'.repeat(64),
            provider: 'google',
            redirectUri: 'http://localhost:3000/callback',
            linkToUserId: null,
            createdAt: new Date(now),
            expiresAt: new Date(now + 10 * 60 * 1000),
          };
          db.reset({
            'oAuthPKCEState.findUnique': () => record,
            'oAuthPKCEState.deleteMany': () => ({ count: 0 }),
          });
          const replay = await retrievePKCEState(state);
          db.reset({
            'oAuthPKCEState.findUnique': () => record,
            'oAuthPKCEState.deleteMany': () => ({ count: 1 }),
          });
          const first = (await retrievePKCEState(state)) as {
            codeVerifier?: string;
          } | null;
          return verdict([
            ['replay rejected', replay, null],
            ['first use returns verifier', first?.codeVerifier, 'b'.repeat(64)],
          ]);
        }
      ),
  },
  {
    slug: 'credential-intake-rejects-foreign-jwt',
    sha: '367b39f0',
    property:
      'verifyCredentialIntakeToken rejects a JWT signed with the same secret but not of type credential_intake',
    target: 'lib/credential-intake/tokens.ts',
    run: async () => {
      const { verifyCredentialIntakeToken, createCredentialIntakeToken } =
        load<{
          verifyCredentialIntakeToken: Fn<
            [string],
            { organizationId?: string }
          >;
          createCredentialIntakeToken: Fn<[object], string>;
        }>('@/lib/credential-intake/tokens');
      const foreign = jwt.sign(
        { type: 'different', organizationId: ORG_A },
        process.env.JWT_SECRET as string
      );
      const good = createCredentialIntakeToken({
        organizationId: ORG_A,
        providers: ['facebook'],
        createdByUserId: 'user-A',
      });
      return verdict([
        [
          'foreign rejected',
          await throws(() => verifyCredentialIntakeToken(foreign)),
          'Invalid credential intake token',
        ],
        [
          'own token round-trips',
          verifyCredentialIntakeToken(good).organizationId,
          ORG_A,
        ],
      ]);
    },
  },
  {
    slug: 'encryption-key-mismatch-surfaced',
    sha: '564a9e99',
    property:
      'a token encrypted under a different key is reported keyMismatch, not silently treated as missing',
    target: 'lib/platform-connections/token-readiness.ts',
    run: () =>
      withEnv(
        {
          FIELD_ENCRYPTION_KEY:
            'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        },
        () => {
          const { encryptField } = load<{
            encryptField: Fn<[string], string | null>;
          }>('@/lib/security/field-encryption');
          const { resolvePlatformAccessToken } = load<{
            resolvePlatformAccessToken: Fn<
              [string | null],
              { ok: boolean; keyMismatch?: boolean; accessToken?: string }
            >;
          }>('@/lib/platform-connections/token-readiness');
          const stored = encryptField('synthetic-oauth-token-org-A');
          process.env.FIELD_ENCRYPTION_KEY =
            'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
          const r = resolvePlatformAccessToken(stored);
          const missing = resolvePlatformAccessToken(null);
          return verdict([
            ['ok', r.ok, false],
            ['keyMismatch', r.keyMismatch, true],
            ['no token leaked', r.accessToken, undefined],
            ['missing is not mismatch', missing.keyMismatch, undefined],
          ]);
        }
      ),
  },
  {
    slug: 'encryption-keys-missing-required',
    sha: '564a9e99',
    property:
      'validateEncryptionKeys reports a missing FIELD_ENCRYPTION_KEY as a required failure',
    target: 'lib/security/encryption-keys.ts',
    run: () =>
      withEnv(
        {
          FIELD_ENCRYPTION_KEY: undefined,
          ENCRYPTION_KEY_V1:
            'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          ENCRYPTION_KEY: 'a-strong-legacy-encryption-key-value',
        },
        () => {
          const { validateEncryptionKeys } = load<{
            validateEncryptionKeys: Fn<
              [],
              { ok: boolean; failedRequired: string[] }
            >;
          }>('@/lib/security/encryption-keys');
          const report = validateEncryptionKeys();
          return verdict([
            ['ok', report.ok, false],
            [
              'names FIELD_ENCRYPTION_KEY',
              report.failedRequired.includes('FIELD_ENCRYPTION_KEY'),
              true,
            ],
          ]);
        }
      ),
  },
  {
    slug: 'org-id-scope-legacy-rows',
    sha: '29f87353',
    property:
      'orgIdScope matches the organisation id and the legacy user-as-org id, never collapsing to one',
    target: 'lib/auth/org-id-scope.ts',
    run: () => {
      const { orgIdScope } = load<{
        orgIdScope: Fn<[string, string], { OR: unknown[] }>;
      }>('@/lib/auth/org-id-scope');
      return verdict([
        [
          'both ids',
          orgIdScope(ORG_A, 'user-A'),
          { OR: [{ orgId: ORG_A }, { orgId: 'user-A' }] },
        ],
        ['same id keeps two arms', orgIdScope(ORG_A, ORG_A).OR.length, 2],
      ]);
    },
  },
  {
    slug: 'issuer-rank-never-above-self',
    sha: 'd30c21f5',
    property:
      'requireIssuerOutranks: only an owner grants owner; nobody grants above their own rank (SYN-1108)',
    target: 'lib/auth/rbac/issuer-rank.ts',
    run: () => {
      const { requireIssuerOutranks, rankOfRole } = load<{
        requireIssuerOutranks: Fn<[string, unknown], boolean>;
        rankOfRole: Fn<[unknown], number>;
      }>('@/lib/auth/rbac/issuer-rank');
      return verdict([
        ['admin→owner', requireIssuerOutranks('admin', 'owner'), false],
        ['editor→admin', requireIssuerOutranks('editor', 'admin'), false],
        ['owner→owner', requireIssuerOutranks('owner', 'owner'), true],
        [
          'editor→wildcard custom role',
          requireIssuerOutranks('editor', {
            name: 'Custom',
            permissions: ['*'],
          }),
          false,
        ],
        ['unknown role fails closed', rankOfRole('superadmin'), 0],
      ]);
    },
  },
  {
    slug: 'issuer-rank-inactive-ownership',
    sha: 'bb5343ca',
    property:
      'resolveIssuerRole only counts an ACTIVE BusinessOwnership as owner rank',
    target: 'lib/auth/rbac/issuer-rank.ts',
    run: async () => {
      const { resolveIssuerRole } = load<{
        resolveIssuerRole: Fn<[string, string, unknown], Promise<string>>;
      }>('@/lib/auth/rbac/issuer-rank');
      const seen: unknown[] = [];
      const fakeDb = {
        businessOwnership: {
          findFirst: async (args: { where: { isActive?: boolean } }) => {
            seen.push(args.where);
            return args.where.isActive === true ? null : { id: 'own-inactive' };
          },
        },
        teamMember: { findUnique: async () => null },
        userRole: { findMany: async () => [] },
      };
      const role = await resolveIssuerRole('user-A', ORG_A, fakeDb);
      return verdict([
        ['inactive ownership is not owner', role === 'owner', false],
      ]);
    },
  },
  {
    slug: 'effective-query-filter-revoked-owner',
    sha: '1def51f6',
    property:
      'getEffectiveQueryFilter fails closed to own rows (never {}) when a revoked owner has no home org (SYN-1112 F3)',
    target: 'lib/multi-business/business-scope.ts',
    run: async () => {
      const { getEffectiveQueryFilter } = load<{
        getEffectiveQueryFilter: Fn<[string], Promise<unknown>>;
      }>('@/lib/multi-business/business-scope');
      db.reset({
        'user.findUnique': () => ({
          isMultiBusinessOwner: true,
          activeOrganizationId: ORG_B,
          organizationId: null,
        }),
        'businessOwnership.findUnique': () => null,
      });
      const revoked = await getEffectiveQueryFilter('user-A');
      db.reset({
        'user.findUnique': () => ({
          isMultiBusinessOwner: true,
          activeOrganizationId: ORG_B,
          organizationId: ORG_A,
        }),
        'businessOwnership.findUnique': () => null,
      });
      const notMine = await getEffectiveQueryFilter('user-A');
      return verdict([
        ['revoked owner → own rows', revoked, { userId: 'user-A' }],
        ['unowned active org → home org', notMine, { organizationId: ORG_A }],
      ]);
    },
  },
  {
    slug: 'effective-org-reverifies-ownership',
    sha: '98800dbd',
    property:
      'getEffectiveOrganizationId ignores an activeOrganizationId the owner holds no active BusinessOwnership for (SYN-1104)',
    target: 'lib/multi-business/business-scope.ts',
    run: async () => {
      const { getEffectiveOrganizationId } = load<{
        getEffectiveOrganizationId: Fn<[string], Promise<string | null>>;
      }>('@/lib/multi-business/business-scope');
      db.reset({
        'user.findUnique': () => ({
          isMultiBusinessOwner: true,
          activeOrganizationId: ORG_B,
          organizationId: ORG_A,
        }),
        'businessOwnership.findUnique': () => null,
        'organization.findUnique': () => ({ status: 'active' }),
      });
      const org = await getEffectiveOrganizationId('user-A');
      return verdict([['not the unowned org-B', org === ORG_B, false]]);
    },
  },
  {
    slug: 'plan-access-scale-full',
    sha: '3910ade3',
    property:
      'the scale plan ranks as full access (professional and business gates pass)',
    target: 'lib/billing/plan-access.ts',
    run: () => {
      const m = load<{
        hasProfessionalAccess: Fn<[string], boolean>;
        hasBusinessAccess: Fn<[string], boolean>;
        hasPlanAccess: Fn<[string, string], boolean>;
      }>('@/lib/billing/plan-access');
      return verdict([
        ['scale professional', m.hasProfessionalAccess('scale'), true],
        ['scale business', m.hasBusinessAccess('scale'), true],
        ['growth < scale', m.hasPlanAccess('growth', 'scale'), false],
      ]);
    },
  },
  {
    slug: 'entitled-plan-status-gated',
    sha: 'ff108db0',
    property:
      'entitledPlan fails a paid plan closed to free when the subscription is past_due/unpaid/incomplete (SYN-1105)',
    target: 'lib/billing/plan-access.ts',
    run: () => {
      const { entitledPlan } = load<{
        entitledPlan: Fn<[string | null, string | null], string>;
      }>('@/lib/billing/plan-access');
      return verdict([
        ['active pro', entitledPlan('pro', 'active'), 'pro'],
        ['past_due', entitledPlan('pro', 'past_due'), 'free'],
        ['unpaid', entitledPlan('business', 'unpaid'), 'free'],
        ['incomplete', entitledPlan('pro', 'incomplete'), 'free'],
        ['null status', entitledPlan('pro', null), 'free'],
      ]);
    },
  },
  {
    slug: 'full-access-owner-admin',
    sha: 'a000c796',
    property:
      'isFullAccessUser grants owner/admin, denies a normal member and null',
    target: 'lib/billing/plan-access.ts',
    run: () => {
      const { isFullAccessUser } = load<{
        isFullAccessUser: Fn<[unknown], boolean>;
      }>('@/lib/billing/plan-access');
      return verdict([
        [
          'owner email (OWNER_EMAILS)',
          isFullAccessUser({ email: process.env.OWNER_EMAILS?.split(',')[0] }),
          true,
        ],
        [
          'admin role',
          isFullAccessUser({
            email: 'a@org-a.test',
            preferences: { role: 'admin' },
          }),
          true,
        ],
        [
          'member',
          isFullAccessUser({
            email: 'm@org-a.test',
            preferences: { role: 'member' },
          }),
          false,
        ],
        ['null', isFullAccessUser(null), false],
      ]);
    },
  },
  {
    slug: 'stripe-invoice-payment-succeeded',
    sha: '82aa5820',
    property:
      'Stripe invoice.payment_succeeded maps to billing.payment_succeeded by exact name; invoice.upcoming is not mapped',
    target: 'lib/webhooks/webhook-handler.ts',
    run: () => {
      const { WebhookHandler } = load<{ WebhookHandler: new () => unknown }>(
        '@/lib/webhooks/webhook-handler'
      );
      const h = new WebhookHandler() as {
        parseEventType: Fn<[string, object], string | null>;
      };
      return assertStripeMapping(type =>
        h.parseEventType('stripe', { type, data: { object: {} } })
      );
    },
  },
];

/** 82aa5820: exact Stripe event-name mapping (driven by a control too). */
export function assertStripeMapping(
  parse: (type: string) => string | null
): Verdict {
  return verdict([
    [
      'invoice.payment_succeeded',
      parse('invoice.payment_succeeded'),
      'billing.payment_succeeded',
    ],
    [
      'invoice.payment_failed',
      parse('invoice.payment_failed'),
      'billing.payment_failed',
    ],
    ['invoice.paid', parse('invoice.paid'), 'billing.payment_succeeded'],
    ['invoice.upcoming', parse('invoice.upcoming'), null],
    ['invoice.finalized', parse('invoice.finalized'), null],
  ]);
}
