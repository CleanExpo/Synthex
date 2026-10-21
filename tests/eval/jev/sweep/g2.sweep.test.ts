/**
 * JEV sweep G2 — unsubscribe honoured.
 *
 * SEAM: the real route handlers, loaded once each:
 *   GET/POST /api/newsletter/unsubscribe  (RFC 8058 one-click and the form)
 *   GET /api/cron/drip-day3, /api/cron/drip-day7, /api/cron/welcome-sequence
 *   POST /api/newsletter/subscribe        (newsletter welcome send)
 * Boundaries mocked: the `resend` package (lib/fake-resend.ts: the audience
 * of contacts, the only suppression store on main, plus a recorder of every
 * email sent with its headers), Prisma (lib/fake-db.ts), rate limiters
 * (pass-through), the logger. Requests are real NextRequest objects so form
 * and multipart bodies parse as they would in Next.
 * Catches: an unsubscribe answered as success without being recorded, a
 * marketing send to an unsubscribed or unknown-status address, a marketing
 * email without List-Unsubscribe / List-Unsubscribe-Post.
 * Misses: suppression stores other than the Resend audience and the user's
 * preferences flags seeded here (a fix that reads a new table needs that
 * table seeded too), SendGrid webhooks, HEAD (no HEAD export: INCONCLUSIVE).
 *
 * Criteria:
 *  G2.C1 unsubscribe x method x content type x email x store: a success answer
 *        (2xx, or a redirect to /unsubscribed without ?error) only when the
 *        store now records the address as unsubscribed.
 *  G2.C2 send path x subscriber state x store x address: no marketing email
 *        reaches an address unless the store confirms it subscribed.
 *  G2.C3 every marketing email sent carries List-Unsubscribe and
 *        List-Unsubscribe-Post: List-Unsubscribe=One-Click.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  invokeHandler,
  loadRouteModule,
  type InvokeResult,
} from '../runner/route-harness';
import { Sink, disarmed, quietConsole, cutNetwork } from './lib/sink';
import { resetDb, table, db } from './lib/fake-db';
import { resend, resetResend, sentTo, type SentEmail } from './lib/fake-resend';

jest.mock('resend', () => require('./lib/fake-resend').resendModule());
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

const CRON = 'sweep-cron-not-a-secret';
const AUDIENCE = 'aud-sweep';
const DAY = 86_400_000;
const UNSUB = 'app/api/newsletter/unsubscribe/route.ts';
const SUB = 'app/api/newsletter/subscribe/route.ts';
const FILES = [
  UNSUB,
  SUB,
  'app/api/cron/drip-day3/route.ts',
  'app/api/cron/drip-day7/route.ts',
  'app/api/cron/welcome-sequence/route.ts',
];

type Store = 'configured' | 'configured-no-contact' | 'unset' | 'erroring';

function setStore(
  store: Store,
  contact?: { email: string; unsubscribed: boolean }
) {
  resetResend(store === 'erroring' ? 'error' : 'ok');
  if (store === 'unset') delete process.env.RESEND_AUDIENCE_ID;
  else process.env.RESEND_AUDIENCE_ID = AUDIENCE;
  if (contact && store !== 'configured-no-contact')
    resend.contacts.set(contact.email.trim().toLowerCase(), { ...contact });
}

const recorded = (email: string) =>
  resend.contacts.get(email.trim().toLowerCase())?.unsubscribed === true;

/** Did the answer tell the user they are unsubscribed? */
function claimsSuccess(r: InvokeResult): boolean {
  if (r.status === null) return false;
  if (r.status >= 200 && r.status < 300) return true;
  if (r.status >= 300 && r.status < 400) {
    const loc = r.headers?.location ?? '';
    try {
      const u = new URL(loc, 'http://localhost:3000');
      return u.pathname === '/unsubscribed' && !u.searchParams.has('error');
    } catch {
      return false;
    }
  }
  return false;
}

const UNSUB_EMAILS = [
  'reader@example.test',
  'Reader@Example.Test',
  'reader+news@example.test',
  'first.last@sub.example.test',
  ' reader@example.test ',
  '',
  'not-an-email',
  'reader@',
  '<script>@x.test',
  "reader'--@example.test",
  `${'a'.repeat(300)}@example.test`,
  'ünï@exämple.test',
];

const BOUNDARY = '----sweep-boundary';
const BODIES: Record<
  string,
  (email: string) => { body?: string; type?: string; query: boolean }
> = {
  json: e => ({
    body: JSON.stringify({ email: e }),
    type: 'application/json',
    query: false,
  }),
  'json+query': e => ({
    body: JSON.stringify({ email: e }),
    type: 'application/json',
    query: true,
  }),
  'form-one-click': () => ({
    body: 'List-Unsubscribe=One-Click',
    type: 'application/x-www-form-urlencoded',
    query: true,
  }),
  'form-email': e => ({
    body: `email=${encodeURIComponent(e)}`,
    type: 'application/x-www-form-urlencoded',
    query: false,
  }),
  multipart: e => ({
    body: `--${BOUNDARY}\r\nContent-Disposition: form-data; name="List-Unsubscribe"\r\n\r\nOne-Click\r\n--${BOUNDARY}\r\nContent-Disposition: form-data; name="email"\r\n\r\n${e}\r\n--${BOUNDARY}--\r\n`,
    type: `multipart/form-data; boundary=${BOUNDARY}`,
    query: true,
  }),
  empty: () => ({ body: '', type: 'application/json', query: true }),
  malformed: () => ({
    body: '{"email": ',
    type: 'application/json',
    query: true,
  }),
};

function unsubRequest(
  method: string,
  email: string,
  kind?: string
): NextRequest {
  const shape = kind ? BODIES[kind](email) : { query: true };
  const url = `http://localhost:3000/api/newsletter/unsubscribe${shape.query ? `?email=${encodeURIComponent(email)}` : ''}`;
  const headers: Record<string, string> = {};
  if ('type' in shape && shape.type) headers['content-type'] = shape.type;
  return new NextRequest(url, {
    method,
    headers,
    ...(method === 'POST'
      ? { body: 'body' in shape ? shape.body : undefined }
      : {}),
  });
}

const mods: Record<string, { mod?: Record<string, unknown>; error?: string }> =
  {};
const sink = new Sink('G2');

beforeAll(() => {
  process.env.CRON_SECRET = CRON;
  for (const f of FILES) mods[f] = loadRouteModule(f);
});
beforeEach(() => {
  quietConsole();
  cutNetwork();
});
afterAll(() => {
  delete process.env.RESEND_AUDIENCE_ID;
  sink.write();
});

async function call(
  file: string,
  method: string,
  request: NextRequest
): Promise<InvokeResult> {
  const m = mods[file];
  if (!m.mod) return { status: null, json: null, error: m.error };
  const r = await invokeHandler(m.mod, file, method, { request });
  // Fire-and-forget sends (newsletter welcome) settle on later ticks.
  for (let i = 0; i < 5; i++) await new Promise(res => setImmediate(res));
  return r;
}

async function judgeUnsubscribe(
  handler: (req: NextRequest) => Promise<InvokeResult>,
  method: string,
  email: string,
  kind: string | undefined,
  store: Store
) {
  setStore(
    store,
    email.trim() ? { email: email.trim(), unsubscribed: false } : undefined
  );
  const r = await handler(unsubRequest(method, email, kind));
  if (r.status === null)
    return { passed: null, detail: r.error ?? 'no status' };
  const claimed = claimsSuccess(r);
  const rec = email.trim() ? recorded(email) : false;
  return {
    passed: !claimed || rec,
    detail: `status ${r.status}${r.headers?.location ? ` -> ${r.headers.location}` : ''}; claims success=${claimed}; recorded=${rec}`,
  };
}

it('G2 unsubscribe cases', async () => {
  const stores: Store[] = [
    'configured',
    'configured-no-contact',
    'unset',
    'erroring',
  ];
  const shapes: [string, string | undefined][] = [
    ...Object.keys(BODIES).map(k => ['POST', k] as [string, string]),
    ['GET', undefined],
    ['HEAD', undefined],
  ];
  for (const store of stores)
    for (const [method, kind] of shapes)
      for (const email of UNSUB_EMAILS) {
        const tag = `unsubscribe ${method}${kind ? ` ${kind}` : ''} email=${JSON.stringify(email.slice(0, 40))} store=${store}`;
        const j = await judgeUnsubscribe(
          req => call(UNSUB, method, req),
          method,
          email,
          kind,
          store
        );
        sink.verdict(
          'G2.C1',
          j.passed,
          `${tag}: ${j.detail}`,
          '/api/newsletter/unsubscribe'
        );
      }
});

// ── Marketing sends ──────────────────────────────────────────────────────────

type SubState = 'subscribed' | 'unsubscribed' | 'unknown';
const SEND_EMAILS = [
  'member@example.test',
  'Member@Example.Test',
  'member+tag@example.test',
  'ops@sub.example.test',
  'x@y.co',
  'first.last@example-mail.test',
  'trial.user@restoreassist.example.test',
  'student@carsi.example.test',
  'long.name.with.many.parts@a.b.c.example.test',
  'digits1234@example.test',
];

function seedRecipient(email: string, state: SubState, store: Store) {
  setStore(
    store,
    state === 'unknown'
      ? undefined
      : { email, unsubscribed: state === 'unsubscribed' }
  );
  resetDb();
  return state === 'unsubscribed'
    ? {
        unsubscribed: true,
        emailUnsubscribed: true,
        marketingOptOut: true,
        newsletterUnsubscribed: true,
        marketingEmails: false,
      }
    : {};
}

function midday(daysAgo: number): Date {
  const d = new Date(Date.now() - daysAgo * DAY);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

const cronReq = (path: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${CRON}` },
  });

const SEND_PATHS: Record<
  string,
  (email: string, prefs: Record<string, unknown>) => Promise<InvokeResult>
> = {
  'drip-day3': async (email, prefs) => {
    table('user').push({
      id: 'u1',
      email,
      name: 'Member',
      preferences: prefs,
      createdAt: midday(3),
    });
    return call(
      'app/api/cron/drip-day3/route.ts',
      'GET',
      cronReq('/api/cron/drip-day3')
    );
  },
  'drip-day7': async (email, prefs) => {
    table('user').push({
      id: 'u1',
      email,
      name: 'Member',
      preferences: prefs,
      createdAt: midday(7),
    });
    return call(
      'app/api/cron/drip-day7/route.ts',
      'GET',
      cronReq('/api/cron/drip-day7')
    );
  },
  'welcome-sequence': async (email, prefs) => {
    const p = {
      ...prefs,
      emailSequenceStartedAt: new Date(Date.now() - 4 * DAY).toISOString(),
    };
    table('user').push({ id: 'u1', email, name: 'Member', preferences: p });
    db.queryRaw = () => [{ id: 'u1', email, name: 'Member', preferences: p }];
    return call(
      'app/api/cron/welcome-sequence/route.ts',
      'GET',
      cronReq('/api/cron/welcome-sequence')
    );
  },
  newsletter: async email =>
    call(
      SUB,
      'POST',
      new NextRequest('http://localhost:3000/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    ),
};

/** May this path mail this address? Only when the store is readable and says subscribed. */
function allowed(path: string, state: SubState, store: Store): boolean {
  if (store !== 'configured') return false;
  // Subscribing is the opt-in: a new or already-subscribed address may get the welcome.
  if (path === 'newsletter') return state !== 'unsubscribed';
  return state === 'subscribed';
}

function judgeHeaders(mail: SentEmail): { passed: boolean; detail: string } {
  const lu = mail.headers['list-unsubscribe'];
  const lup = mail.headers['list-unsubscribe-post'];
  const ok =
    Boolean(lu && /<(https?:|mailto:)[^>]+>/.test(lu)) &&
    lup === 'List-Unsubscribe=One-Click';
  return {
    passed: ok,
    detail: `List-Unsubscribe=${lu ?? 'absent'}; List-Unsubscribe-Post=${lup ?? 'absent'}`,
  };
}

it('G2 marketing-send cases', async () => {
  const states: SubState[] = ['subscribed', 'unsubscribed', 'unknown'];
  const stores: Store[] = ['configured', 'unset', 'erroring'];
  for (const [path, run] of Object.entries(SEND_PATHS))
    for (const state of states)
      for (const store of stores)
        for (const email of SEND_EMAILS) {
          const prefs = seedRecipient(email, state, store);
          const r = await run(email, prefs);
          const tag = `${path} state=${state} store=${store} email=${email}`;
          const mails = sentTo(email);
          if (r.status === null && !mails.length) {
            sink.verdict('G2.C2', null, `${tag}: harness: ${r.error}`, path);
            continue;
          }
          const ok = allowed(path, state, store);
          sink.verdict(
            'G2.C2',
            mails.length === 0 || ok,
            `${tag}: status ${r.status}; sent=${mails.length}; may send=${ok}`,
            path
          );
          for (const m of mails) {
            const h = judgeHeaders(m);
            sink.verdict(
              'G2.C3',
              h.passed,
              `${tag}: "${m.subject ?? ''}" ${h.detail}`,
              path
            );
          }
        }
});

it('G2 planted controls', async () => {
  // C01: suppression check bypassed — a sender that mails every user,
  // unsubscribed or not (disarmed: it skips addresses the audience marks
  // unsubscribed).
  {
    const email = 'planted@example.test';
    seedRecipient(email, 'unsubscribed', 'configured');
    const { Resend } = jest.requireMock('resend') as {
      Resend: new () => { emails: { send(a: unknown): Promise<unknown> } };
    };
    const client = new Resend();
    const skip = disarmed('G2-C01') && recorded(email);
    if (!skip)
      await client.emails.send({ to: email, subject: 'planted', headers: {} });
    const mails = sentTo(email);
    sink.control(
      'G2-C01',
      'G2.C2',
      mails.length > 0 && !allowed('drip-day3', 'unsubscribed', 'configured'),
      `planted sender, unsubscribed address: sent=${mails.length}`
    );
  }
  // C02: an unsubscribe handler that answers success without recording.
  {
    const planted = async (req: NextRequest): Promise<InvokeResult> => {
      const email = req.nextUrl.searchParams.get('email') ?? '';
      if (disarmed('G2-C02')) {
        const c = resend.contacts.get(email.toLowerCase());
        if (c) c.unsubscribed = true;
      }
      return invokeHandler(
        {
          GET: async () =>
            NextResponse.json({ message: 'Unsubscribed successfully' }),
        },
        'planted',
        'GET',
        { request: req }
      );
    };
    const j = await judgeUnsubscribe(
      planted,
      'GET',
      'reader@example.test',
      undefined,
      'configured'
    );
    sink.control(
      'G2-C02',
      'G2.C1',
      j.passed === false,
      `planted fake-success unsubscribe: ${j.detail}`
    );
  }
  // C03: a marketing email with List-Unsubscribe but no List-Unsubscribe-Post.
  {
    const headers: Record<string, string> = {
      'list-unsubscribe':
        '<https://synthex.social/api/newsletter/unsubscribe?email=a%40b.co>',
    };
    if (disarmed('G2-C03'))
      headers['list-unsubscribe-post'] = 'List-Unsubscribe=One-Click';
    const h = judgeHeaders({ to: ['a@b.co'], subject: 'planted', headers });
    sink.control('G2-C03', 'G2.C3', !h.passed, `planted headers: ${h.detail}`);
  }
});
