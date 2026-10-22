/**
 * JEV sweep G4 (reads) — a read failure never returns 2xx with empty data.
 *
 * SEAM: every authenticated GET read route (app/api/**\/route.ts, picked by
 * the J2 candidate rule) that is NOT in J2's frozen 180
 * (tests/eval/jev/cases/J2/routes.json), each called with generated query
 * shapes and roles while the data layer fails. Reuses J2's boundary
 * (families/j2/failing-prisma.ts: auth reads succeed, every data read
 * rejects) and J2's detector (families/j2/detector.ts judgeRead). Each route
 * module is loaded once (runner/route-harness.ts loadRouteModule) and called
 * through invokeHandler.
 * Catches: 2xx with [] / {} / {data:null} / zeroed metrics / an error dressed
 * as success. Misses: routes whose read is never reached for these inputs
 * (recorded INCONCLUSIVE, never PASS), non-GET reads.
 *
 * Criterion G4.C3: failing data layer -> non-2xx or available:false.
 */
import fs from 'fs';
import path from 'path';
import {
  invokeHandler,
  listRoutes,
  loadRouteModule,
  type InvokeResult,
} from '../runner/route-harness';
import { generateToken } from '@/lib/auth/jwt-utils';
import { declaresUnavailable, judgeRead } from '../families/j2/detector';
import { selectRoutes } from '../families/j2/select';
import {
  J2_DB_ERROR,
  J2_ORG_ID,
  J2_USER_ID,
  dbRejects,
  setJ2Role,
} from '../families/j2/failing-prisma';
import { ownerEmail } from '../families/j2/fixtures';
import { Sink, cutNetwork, disarmed, quietConsole } from './lib/sink';

jest.mock('@/lib/prisma', () =>
  require('../families/j2/failing-prisma').failingPrismaModule()
);

const ROOT = path.join(__dirname, '../../../..');
const TIMEOUT_MS = 5_000;
// Planted route files live inside the tree (gitignored out/), whatever
// --out-dir says: outside the repo they cannot resolve '@/lib/prisma'.
const CONTROL_DIR = 'tests/eval/jev/out/sweep-controls/g4';

// The J2 candidate rule (families/j2/select.ts selectRoutesFromTree), without
// its top-180 cut: authenticated, data-reading GET routes that are not auth
// flows, webhooks, crons, streams or downloads.
const USER_AUTH =
  /APISecurityChecker|getUserIdFromRequestOrCookies|getUserIdFromRequest\b|lib\/auth\/with-auth|lib\/auth\/with-org|requireAuth|authenticateRequest/;
const DATA = /@\/lib\/prisma'|lib\/platform\/noop-client|@\/lib\/services\//;
const EXCLUDED_PATH =
  /\/(auth|oauth|callback|callbacks|webhook|webhooks|cron|stream|sse|events|realtime|pdf|image|download|export|og|redirect)(\/|$)/;

function candidates() {
  const frozen = new Set(selectRoutes().map(r => r.file));
  return listRoutes().filter(r => {
    if (
      !r.methods.includes('GET') ||
      frozen.has(r.file) ||
      EXCLUDED_PATH.test(r.route)
    )
      return false;
    const src = fs.readFileSync(path.join(ROOT, r.file), 'utf8');
    return USER_AUTH.test(src) && !/cron-auth/.test(src) && DATA.test(src);
  });
}

const QUERIES: Record<string, string>[] = [
  {},
  { page: '2', limit: '10' },
  { range: '7d', period: '7d', days: '7' },
  {
    from: '2026-09-01',
    to: '2026-10-01',
    startDate: '2026-09-01',
    endDate: '2026-10-01',
  },
  { status: 'published', platform: 'instagram' },
  { limit: '0', page: '-1', q: "' OR 1=1 --" },
];
const ROLES = ['member', 'owner'] as const;

function paramsFor(file: string): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  for (const m of file.matchAll(/\[{1,2}(\.\.\.)?([^\]]+)\]{1,2}/g)) {
    const value = /org/i.test(m[2]) ? J2_ORG_ID : `org-A-${m[2]}-1`;
    params[m[2]] = m[1] ? [value] : value;
  }
  return params;
}

function urlFor(
  route: string,
  params: Record<string, string | string[]>,
  query: Record<string, string>
) {
  const p = route
    .split('/')
    .map(s => {
      const m = /^\[{1,2}(?:\.\.\.)?([^\]]+)\]{1,2}$/.exec(s);
      const v = m ? params[m[1]] : undefined;
      return v === undefined ? s : Array.isArray(v) ? v.join('/') : v;
    })
    .join('/');
  const search = new URLSearchParams({
    organizationId: J2_ORG_ID,
    orgId: J2_ORG_ID,
    ...query,
  });
  return `http://localhost:3000${p}?${search}`;
}

async function call(
  mod: Record<string, unknown>,
  file: string,
  route: string,
  query: Record<string, string>,
  role: (typeof ROLES)[number]
): Promise<InvokeResult> {
  const params = paramsFor(file);
  const email = role === 'owner' ? ownerEmail() : 'member@org-a.test';
  setJ2Role(role, email);
  const token = generateToken({ userId: J2_USER_ID, email });
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<InvokeResult>(resolve => {
    timer = setTimeout(
      () =>
        resolve({
          status: null,
          json: null,
          error: `no response within ${TIMEOUT_MS}ms`,
        }),
      TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([
      invokeHandler(mod, file, 'GET', {
        headers: { authorization: `Bearer ${token}` },
        params,
        url: urlFor(route, params, query),
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const UNHANDLED_DATA_THROW = new RegExp(
  `^handler threw: [^:]*: (${J2_DB_ERROR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|NOOP_CLIENT_NOT_MIGRATED:)`
);

/** J2's judgement (families/j2.jev.test.ts judge), plus "the read was reached". */
function judge(
  r: InvokeResult,
  reached: boolean
): { passed: boolean | null; detail: string } {
  if (r.status === null && UNHANDLED_DATA_THROW.test(r.error ?? ''))
    return { passed: true, detail: 'unhandled throw -> 500, honest' };
  if (r.status === null)
    return {
      passed: null,
      detail: (r.error ?? 'no response status').slice(0, 200),
    };
  if (r.error && r.status >= 200 && r.status <= 299)
    return { passed: null, detail: `status ${r.status}, ${r.error}` };
  // No data read was attempted, whatever the status: the failing read never
  // ran, so this case measures nothing (INCONCLUSIVE, never PASS).
  if (!reached)
    return {
      passed: null,
      detail: `status ${r.status} before any data-layer call (read not exercised)`,
    };
  // The read failed. G4.C3: non-2xx or available:false, nothing else. A 2xx
  // carrying data (even non-empty fallback data) hides the failure.
  if (r.status < 200 || r.status > 299)
    return { passed: true, detail: `status ${r.status}` };
  if (declaresUnavailable(r.json))
    return { passed: true, detail: `status ${r.status} available:false` };
  const v = judgeRead(r.status, r.json);
  return {
    passed: false,
    detail: (v.honest
      ? `status ${r.status} with data after a failed read: ${v.detail}`
      : v.detail
    ).slice(0, 200),
  };
}

const sink = new Sink('G4', 'reads', 500_000);
beforeEach(() => {
  quietConsole();
  cutNetwork();
});
afterAll(() => sink.write());

it('G4 read-failure cases', async () => {
  for (const r of candidates()) {
    const loaded = loadRouteModule(r.file);
    for (const query of QUERIES)
      for (const role of ROLES) {
        const tag = `${r.route} role=${role} q=${JSON.stringify(query)}`;
        if (!loaded.mod) {
          sink.verdict(
            'G4.C3',
            null,
            `${tag}: ${loaded.error.slice(0, 200)}`,
            r.route
          );
          continue;
        }
        const before = dbRejects();
        const res = await call(loaded.mod, r.file, r.route, query, role);
        const j = judge(res, dbRejects() > before);
        sink.verdict('G4.C3', j.passed, `${tag}: ${j.detail}`, r.route);
      }
  }
});

// Planted read handlers through the same failing boundary; caught = dishonest.
const PLANTS: [string, string][] = [
  [
    'G4-C05',
    `try { return NextResponse.json(await prisma.post.findMany({ where: { organizationId: 'org-A' } })); }
    catch { return NextResponse.json([]); }`,
  ],
  [
    'G4-C06',
    `try { return NextResponse.json({ data: await prisma.post.findFirst() }); }
    catch { return NextResponse.json({ data: null }); }`,
  ],
  [
    'G4-C07',
    `try { return NextResponse.json({ success: true, metrics: { totalPosts: await prisma.post.count() } }); }
    catch { return NextResponse.json({ success: true, metrics: { totalPosts: 0, impressions: 0, engagementRate: 0 } }); }`,
  ],
  [
    'G4-C08',
    `try { return NextResponse.json({ data: await prisma.post.findMany() }); }
    catch { return NextResponse.json({ data: [{ id: 'cached-1', title: 'Fallback post' }] }); }`,
  ],
];
const HONEST = `try { return NextResponse.json({ data: await prisma.post.findMany() }); }
    catch { return NextResponse.json({ error: 'Database unavailable' }, { status: 503 }); }`;

it('G4.C3 judge: an unreached read is never PASS', () => {
  for (const status of [200, 401, 404, 500, 503])
    expect(judge({ status, json: null }, false).passed).toBeNull();
});

it('G4 read planted controls', async () => {
  for (const [id, body] of PLANTS) {
    const file = `${CONTROL_DIR}/${id}/route.ts`;
    fs.mkdirSync(path.join(ROOT, path.dirname(file)), { recursive: true });
    fs.writeFileSync(
      path.join(ROOT, file),
      `import { NextResponse } from 'next/server';\nimport { prisma } from '@/lib/prisma';\n` +
        `export async function GET() {${disarmed(id) ? HONEST : body}\n}\n`
    );
    const loaded = loadRouteModule(file);
    if (!loaded.mod) {
      sink.control(id, 'G4.C3', null, loaded.error);
      continue;
    }
    const before = dbRejects();
    const j = judge(
      await call(loaded.mod, file, `/${id}`, {}, 'member'),
      dbRejects() > before
    );
    sink.control(id, 'G4.C3', j.passed === null ? null : !j.passed, j.detail);
  }
});
