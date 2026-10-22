/**
 * JEV sweep G1 — invite-only sign-up.
 *
 * SEAM: every account- or organisation-creating entry point, called with its
 * real handler against the in-memory Prisma fake (lib/fake-db.ts):
 *   POST /api/auth/signup            (body invite code)
 *   POST /api/auth/unified {signup}   (no invite handling: must refuse)
 *   POST /api/organizations           (self-provisioned org, invite evidence in the store)
 *   POST /api/onboarding/review       (auto-created org, invite evidence in the store)
 *   lib/auth/signInFlow handleOAuthLogin (Google and GitHub first login)
 * The founder's rule is the oracle: account creation without a valid unused
 * invite is refused unless NEXT_PUBLIC_INVITE_ONLY_MODE is exactly 'false'.
 * Outcome is read from the store (a user or organisation row written), not
 * from status codes or call counts.
 * Boundaries mocked: Prisma, bcrypt (hash cost), rate limiters (pass-through),
 * the welcome-email service, the API security checker's session lookup.
 * Misses: the three OAuth callback routes themselves (Google, GitHub,
 * /api/auth/callback/[platform]) — recorded INCONCLUSIVE per mode, their
 * shared first-login rule is driven through signInFlow; /api/invite/accept
 * joins an existing org and creates no account.
 *
 * Criteria:
 *  G1.C1a mode 'true', no valid unused invite -> nothing created.
 *  G1.C1b mode neither 'true' nor 'false' (unset, '', 'TRUE', '0', '1', junk),
 *         no valid unused invite -> nothing created.
 *  G1.C2  mode 'false' with no code, or a valid unused invite in any mode,
 *         on a door that accepts invites -> created (the door is not shut by
 *         accident; this keeps the oracle honest).
 */
import { NextResponse } from 'next/server';
import { invokeHandler, loadRouteModule } from '../runner/route-harness';
import { generateToken } from '@/lib/auth/jwt-utils';
import { Sink, disarmed, quietConsole, cutNetwork } from './lib/sink';
import { resetDb, table } from './lib/fake-db';

jest.mock('@/lib/prisma', () => require('./lib/fake-db').prismaModule());
jest.mock('@/lib/rate-limit', () =>
  require('./lib/passthrough-limiter').limiterModule()
);
jest.mock('@/lib/middleware/api-rate-limit', () =>
  require('./lib/passthrough-limiter').limiterModule()
);
jest.mock('@/lib/logger', () => ({
  logger: { info() {}, warn() {}, error() {}, debug() {} },
}));
jest.mock('bcryptjs', () => {
  const b = {
    hash: async () => 'hashed-password',
    compare: async () => false,
    genSalt: async () => 'salt',
  };
  return { __esModule: true, default: b, ...b };
});
jest.mock('@/lib/email/index', () => {
  const ok = new Proxy({}, { get: () => async () => ({ success: true }) });
  return { __esModule: true, email: ok, default: ok, emailQueue: ok };
});
// Session boundary for /api/organizations: the signed-in user comes from a header.
jest.mock('@/lib/security/api-security-checker', () => {
  const { NextResponse: R } = require('next/server');
  return {
    APISecurityChecker: {
      check: async (req: { headers: Headers }) => {
        const userId = req.headers.get('x-sweep-user');
        return userId
          ? { allowed: true, context: { userId } }
          : { allowed: false, error: 'Authentication required', context: {} };
      },
      createSecureResponse: (body: unknown, status: number) =>
        R.json(body, { status }),
    },
    DEFAULT_POLICIES: new Proxy({}, { get: (_t, p) => p }),
  };
});
// Control seams: the real gate functions, wrapped so a control can plant a defect.
jest.mock('@/lib/auth/invite-mode', () => {
  const actual = jest.requireActual('@/lib/auth/invite-mode');
  return {
    ...actual,
    isInviteOnlyMode: () =>
      (globalThis as { __g1Plant?: Set<string> }).__g1Plant?.has('mode-off')
        ? false
        : actual.isInviteOnlyMode(),
  };
});
jest.mock('@/lib/auth/invite-gate', () => {
  const actual = jest.requireActual('@/lib/auth/invite-gate');
  const plant = (k: string) =>
    (globalThis as { __g1Plant?: Set<string> }).__g1Plant?.has(k);
  return {
    ...actual,
    hasSelfProvisionEvidence: async (...a: unknown[]) =>
      plant('evidence-on') ? true : actual.hasSelfProvisionEvidence(...a),
    hasInviteEvidence: async (...a: unknown[]) =>
      plant('evidence-on') ? true : actual.hasInviteEvidence(...a),
  };
});

const G = globalThis as { __g1Plant?: Set<string> };
const plant = (...keys: string[]) => (G.__g1Plant = new Set(keys));

const MODES: (string | undefined)[] = [
  undefined,
  '',
  'true',
  'TRUE',
  'false',
  '0',
  '1',
  'yes-please',
];
const modeLabel = (m: string | undefined) =>
  m === undefined ? 'unset' : JSON.stringify(m);
const NOW = Date.now();
const DAY = 86_400_000;
const VALID_CODE = 'SYN-VALID-0001';

const EMAILS = [
  'new.user@example.test',
  'New.User@Example.Test',
  'new.user+invite@example.test',
  'ops@sub.example.test',
  'a@b.co',
  'first.last-name@example-mail.test',
];

/** Invite code shapes sent in a request body (signup-style doors). */
const BODY_CODES: {
  name: string;
  code?: string;
  valid: boolean;
  row?: Record<string, unknown>;
}[] = [
  { name: 'none', valid: false },
  { name: 'empty', code: '', valid: false },
  {
    name: 'valid',
    code: VALID_CODE,
    valid: true,
    row: {
      useCount: 0,
      maxUses: 1,
      isActive: true,
      expiresAt: new Date(NOW + 30 * DAY),
      email: null,
    },
  },
  {
    name: 'used',
    code: 'SYN-USED-0001',
    valid: false,
    row: {
      useCount: 1,
      maxUses: 1,
      isActive: true,
      expiresAt: new Date(NOW + 30 * DAY),
      email: null,
    },
  },
  {
    name: 'expired',
    code: 'SYN-EXPIRED-0001',
    valid: false,
    row: {
      useCount: 0,
      maxUses: 1,
      isActive: true,
      expiresAt: new Date(NOW - DAY),
      email: null,
    },
  },
  {
    name: 'deactivated',
    code: 'SYN-OFF-0001',
    valid: false,
    row: {
      useCount: 0,
      maxUses: 1,
      isActive: false,
      expiresAt: null,
      email: null,
    },
  },
  {
    name: 'other-email',
    code: 'SYN-LOCKED-0001',
    valid: false,
    row: {
      useCount: 0,
      maxUses: 1,
      isActive: true,
      expiresAt: null,
      email: 'someone.else@example.test',
    },
  },
  { name: 'wrong-format-short', code: 'abc', valid: false },
  { name: 'wrong-format-digits', code: '000000', valid: false },
  { name: 'wrong-format-prefix', code: 'SYN-', valid: false },
  { name: 'wrong-format-case', code: VALID_CODE.toLowerCase(), valid: false },
  { name: 'wrong-format-space', code: ` ${VALID_CODE} `, valid: false },
  { name: 'injection-sql', code: "' OR '1'='1' --", valid: false },
  { name: 'injection-nosql', code: '{"$ne":null}', valid: false },
  { name: 'injection-html', code: '<script>alert(1)</script>', valid: false },
  { name: 'injection-path', code: '../../../etc/passwd', valid: false },
  { name: 'injection-null-byte', code: `${VALID_CODE}\u0000`, valid: false },
  { name: 'injection-like', code: 'SYN-%', valid: false },
  { name: 'injection-crlf', code: 'SYN\r\nX-Injected: 1', valid: false },
  { name: 'unicode-lookalike', code: 'SYN-VАLID-0001', valid: false },
  { name: 'unicode-cjk', code: '招待コード', valid: false },
  { name: 'unicode-emoji', code: '🎟️🎟️🎟️', valid: false },
  { name: 'unicode-zero-width', code: 'SYN-VALID​-0001', valid: false },
  { name: 'long-256', code: 'A'.repeat(256), valid: false },
  { name: 'long-4096', code: 'B'.repeat(4096), valid: false },
  { name: 'long-65536', code: 'C'.repeat(65536), valid: false },
];

/** Invite evidence held in the store for an existing user (org and OAuth doors). */
const STORE_EVIDENCE: {
  name: string;
  valid: boolean;
  seed: (email: string, userId: string) => void;
}[] = [
  { name: 'none', valid: false, seed: () => undefined },
  {
    name: 'code-for-email',
    valid: true,
    seed: email =>
      table('inviteCode').push({
        id: 'ic-1',
        code: 'SYN-E-1',
        email,
        isActive: true,
        useCount: 0,
        maxUses: 1,
        expiresAt: new Date(NOW + 30 * DAY),
        usedBy: null,
      }),
  },
  {
    name: 'code-redeemed-by-self',
    valid: true,
    seed: (_e, userId) =>
      table('inviteCode').push({
        id: 'ic-1',
        code: 'SYN-E-1',
        email: null,
        isActive: false,
        useCount: 1,
        maxUses: 1,
        expiresAt: null,
        usedBy: userId,
      }),
  },
  {
    name: 'code-used-by-other',
    valid: false,
    seed: () =>
      table('inviteCode').push({
        id: 'ic-1',
        code: 'SYN-E-1',
        email: null,
        isActive: false,
        useCount: 1,
        maxUses: 1,
        expiresAt: null,
        usedBy: 'someone-else',
      }),
  },
  {
    name: 'code-for-email-expired',
    valid: false,
    seed: email =>
      table('inviteCode').push({
        id: 'ic-1',
        code: 'SYN-E-1',
        email,
        isActive: true,
        useCount: 0,
        maxUses: 1,
        expiresAt: new Date(NOW - DAY),
        usedBy: null,
      }),
  },
  {
    name: 'code-for-email-exhausted',
    valid: false,
    seed: email =>
      table('inviteCode').push({
        id: 'ic-1',
        code: 'SYN-E-1',
        email,
        isActive: true,
        useCount: 1,
        maxUses: 1,
        expiresAt: null,
        usedBy: 'someone-else',
      }),
  },
  {
    name: 'code-for-email-deactivated',
    valid: false,
    seed: email =>
      table('inviteCode').push({
        id: 'ic-1',
        code: 'SYN-E-1',
        email,
        isActive: false,
        useCount: 0,
        maxUses: 1,
        expiresAt: null,
        usedBy: null,
      }),
  },
  {
    name: 'code-for-other-email',
    valid: false,
    seed: () =>
      table('inviteCode').push({
        id: 'ic-1',
        code: 'SYN-E-1',
        email: 'someone.else@example.test',
        isActive: true,
        useCount: 0,
        maxUses: 1,
        expiresAt: null,
        usedBy: null,
      }),
  },
  {
    name: 'team-invite-recent',
    valid: true,
    seed: email =>
      table('teamInvitation').push({
        id: 'ti-1',
        email,
        status: 'sent',
        sentAt: new Date(NOW - DAY),
        organizationId: null,
      }),
  },
  {
    name: 'team-invite-stale',
    valid: false,
    seed: email =>
      table('teamInvitation').push({
        id: 'ti-1',
        email,
        status: 'sent',
        sentAt: new Date(NOW - 60 * DAY),
        organizationId: null,
      }),
  },
  {
    name: 'team-invite-revoked',
    valid: false,
    seed: email =>
      table('teamInvitation').push({
        id: 'ti-1',
        email,
        status: 'revoked',
        sentAt: new Date(NOW - DAY),
        organizationId: null,
      }),
  },
];

function setMode(m: string | undefined) {
  if (m === undefined) delete process.env.NEXT_PUBLIC_INVITE_ONLY_MODE;
  else process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = m;
}

/**
 * The criterion a (mode, invite) pair measures, or null when the founder's rule
 * says nothing about it: a door with no invite handling given a valid code
 * outside 'false' mode, and a bad code supplied while the gate is off
 * (rejecting a bad code is allowed either way).
 */
function criterion(
  mode: string | undefined,
  validInvite: boolean,
  inviteDoor: boolean,
  codeSupplied = false
): string | null {
  if (mode === 'false') {
    if (validInvite) return inviteDoor ? 'G1.C2' : null;
    return codeSupplied ? null : 'G1.C2';
  }
  if (validInvite) return inviteDoor ? 'G1.C2' : null;
  return mode === 'true' ? 'G1.C1a' : 'G1.C1b';
}

const accountFor = (email: string) =>
  table('user').some(
    u => String(u.email).toLowerCase() === email.toLowerCase()
  );

type Door = {
  name: string;
  route: string;
  /** Run the door for this email; true when the store now holds the new account/org. */
  run: (email: string) => Promise<{ created: boolean; detail: string }>;
};

const sink = new Sink('G1');
const mods: Record<string, { mod?: Record<string, unknown>; error?: string }> =
  {};
let signInFlow:
  | {
      handleOAuthLogin: (
        p: string,
        profile: Record<string, unknown>
      ) => Promise<{ success: boolean; error?: string }>;
    }
  | undefined;
let signInError = '';

beforeAll(async () => {
  quietConsole();
  cutNetwork();
  for (const f of [
    'app/api/auth/signup/route.ts',
    'app/api/auth/unified/route.ts',
    'app/api/organizations/route.ts',
    'app/api/onboarding/review/route.ts',
  ])
    mods[f] = loadRouteModule(f);
  try {
    signInFlow = (await import('@/lib/auth/signInFlow')).signInFlow as never;
  } catch (err) {
    signInError = String(err).slice(0, 200);
  }
});
beforeEach(() => {
  quietConsole();
  cutNetwork();
  G.__g1Plant = new Set();
});
afterAll(() => {
  setMode(undefined);
  sink.write();
});

async function callRoute(
  file: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  const m = mods[file];
  if (!m.mod) return { status: null, json: null, error: m.error };
  return invokeHandler(m.mod, file, 'POST', {
    body: body as object,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function bodyDoor(
  name: string,
  file: string,
  bodyFor: (email: string, code?: string) => unknown
) {
  return (code: (typeof BODY_CODES)[number]): Door => ({
    name: `${name}[code=${code.name}]`,
    route: file,
    run: async email => {
      resetDb();
      if (code.row)
        table('inviteCode').push({
          id: 'ic-1',
          code: code.code,
          usedBy: null,
          ...code.row,
        });
      const res = await callRoute(file, bodyFor(email, code.code));
      if (res.status === null)
        return { created: false, detail: `harness: ${res.error}` };
      return { created: accountFor(email), detail: `status ${res.status}` };
    },
  });
}

const signupDoor = bodyDoor(
  'signup',
  'app/api/auth/signup/route.ts',
  (email, code) => ({
    name: 'Sweep User',
    email,
    password: 'Sweep-Passw0rd!x',
    ...(code === undefined ? {} : { inviteCode: code }),
  })
);
const unifiedDoor = bodyDoor(
  'unified',
  'app/api/auth/unified/route.ts',
  (email, code) => ({
    action: 'signup',
    email,
    password: 'Sweep-Passw0rd!x',
    name: 'Sweep User',
    ...(code === undefined ? {} : { inviteCode: code }),
  })
);

function storeDoor(
  name: string,
  route: string,
  act: (
    email: string,
    userId: string
  ) => Promise<{ status: number | null; detail: string }>,
  creates: 'org' | 'user'
) {
  return (ev: (typeof STORE_EVIDENCE)[number]): Door => ({
    name: `${name}[evidence=${ev.name}]`,
    route,
    run: async email => {
      resetDb();
      const userId = 'user-sweep-1';
      if (creates === 'org')
        table('user').push({
          id: userId,
          email,
          name: 'Sweep User',
          organizationId: null,
        });
      ev.seed(email, userId);
      const r = await act(email, userId);
      if (r.status === null)
        return { created: false, detail: `harness: ${r.detail}` };
      const created =
        creates === 'org'
          ? table('organization').length > 0
          : accountFor(email);
      return { created, detail: r.detail };
    },
  });
}

const orgDoor = storeDoor(
  'organizations',
  'app/api/organizations/route.ts',
  async (_e, userId) => {
    const res = await callRoute(
      'app/api/organizations/route.ts',
      { name: 'Sweep Org' },
      { 'x-sweep-user': userId }
    );
    return {
      status: res.status,
      detail: res.status === null ? String(res.error) : `status ${res.status}`,
    };
  },
  'org'
);
const onboardingDoor = storeDoor(
  'onboarding-review',
  'app/api/onboarding/review/route.ts',
  async (email, userId) => {
    const token = generateToken({ userId, email });
    const res = await callRoute(
      'app/api/onboarding/review/route.ts',
      { businessName: 'Sweep Business' },
      { authorization: `Bearer ${token}` }
    );
    return {
      status: res.status,
      detail: res.status === null ? String(res.error) : `status ${res.status}`,
    };
  },
  'org'
);
const oauthDoor = (provider: 'google' | 'github') =>
  storeDoor(
    `oauth-${provider}`,
    'lib/auth/signInFlow.ts#handleOAuthLogin',
    async email => {
      if (!signInFlow)
        return { status: null, detail: `import failed: ${signInError}` };
      try {
        const r = await signInFlow.handleOAuthLogin(provider, {
          id: `${provider}-sub-1`,
          email,
          name: 'Sweep User',
          emailVerified: true,
        });
        return {
          status: r.success ? 200 : 403,
          detail: r.success ? 'success' : `refused: ${r.error}`,
        };
      } catch (err) {
        return { status: null, detail: `threw: ${String(err).slice(0, 120)}` };
      }
    },
    'user'
  );

const UNDRIVEN = [
  'app/api/auth/oauth/google/callback/route.ts',
  'app/api/auth/oauth/github/callback/route.ts',
  'app/api/auth/callback/[platform]/route.ts',
];

it('G1 cases', async () => {
  const doors: [Door, boolean, boolean, boolean][] = [];
  for (const c of BODY_CODES) {
    const supplied = c.code !== undefined;
    doors.push([signupDoor(c), c.valid, true, supplied]);
    doors.push([unifiedDoor(c), c.valid, false, supplied]);
  }
  for (const ev of STORE_EVIDENCE) {
    doors.push([orgDoor(ev), ev.valid, true, false]);
    doors.push([onboardingDoor(ev), ev.valid, true, false]);
    // A first OAuth login has no account yet, so it cannot have redeemed a code itself.
    if (ev.name === 'code-redeemed-by-self') continue;
    doors.push([oauthDoor('google')(ev), ev.valid, true, false]);
    doors.push([oauthDoor('github')(ev), ev.valid, true, false]);
  }
  for (const mode of MODES) {
    setMode(mode);
    for (const [door, valid, inviteDoor, supplied] of doors) {
      const crit = criterion(mode, valid, inviteDoor, supplied);
      if (!crit) continue;
      for (const email of EMAILS) {
        const out = await door.run(email);
        const expectCreate = crit === 'G1.C2';
        const harnessFail = out.detail.startsWith('harness:');
        sink.verdict(
          crit,
          harnessFail ? null : out.created === expectCreate,
          `${door.name} mode=${modeLabel(mode)} invite=${valid ? 'valid' : 'invalid'} email=${email} -> ${out.created ? 'CREATED' : 'not created'} (${out.detail})`,
          door.route
        );
      }
    }
  }
  for (const file of UNDRIVEN)
    for (const mode of MODES)
      sink.verdict(
        criterion(mode, false, true)!,
        null,
        `${file} mode=${modeLabel(mode)}: OAuth callback route not driven (provider token exchange needs the network); its first-login rule is measured through signInFlow`,
        file
      );
});

it('G1 planted controls', async () => {
  setMode('true');
  const email = 'planted@example.test';
  const none = STORE_EVIDENCE[0];

  // C01: invite mode default flipped (the gate reads OFF although the flag is 'true').
  plant(...(disarmed('G1-C01') ? [] : ['mode-off']));
  let o = await orgDoor(none).run(email);
  sink.control(
    'G1-C01',
    'G1.C1a',
    o.created,
    `organizations, mode 'true', no invite, mode-off planted -> ${o.created ? 'CREATED' : 'refused'} (${o.detail})`
  );

  // C02: self-provision evidence check bypassed.
  plant(...(disarmed('G1-C02') ? [] : ['evidence-on']));
  o = await onboardingDoor(none).run(email);
  sink.control(
    'G1-C02',
    'G1.C1a',
    o.created,
    `onboarding-review, mode 'true', no invite, evidence bypass planted -> ${o.created ? 'CREATED' : 'refused'} (${o.detail})`
  );

  // C03: OAuth first-login invite evidence bypassed.
  plant(...(disarmed('G1-C03') ? [] : ['evidence-on']));
  o = await oauthDoor('google')(none).run(email);
  sink.control(
    'G1-C03',
    'G1.C1a',
    o.created,
    `oauth-google, mode 'true', no invite, evidence bypass planted -> ${o.created ? 'CREATED' : 'refused'} (${o.detail})`
  );

  // C04: a planted signup handler that ignores the invite code entirely.
  plant();
  resetDb();
  const planted = disarmed('G1-C04')
    ? async () =>
        NextResponse.json({ error: 'invite required' }, { status: 403 })
    : async () => {
        table('user').push({ id: 'u-planted', email });
        return NextResponse.json({ ok: true }, { status: 201 });
      };
  const res = await invokeHandler(
    { POST: planted },
    'app/api/planted/signup/route.ts',
    'POST',
    { body: { email } }
  );
  sink.control(
    'G1-C04',
    'G1.C1a',
    accountFor(email),
    `planted signup handler -> status ${res.status}, ${accountFor(email) ? 'CREATED' : 'refused'}`
  );
  plant();
});
