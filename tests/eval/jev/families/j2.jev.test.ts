/**
 * JEV J2 — Honest status on reads (180 cases, hard gate).
 *
 * Property: with a valid authenticated org-A user and a failing data layer, a
 * GET read route answers with an error status or available:false, never a 2xx
 * with empty data ([] / {} / {data:[]} / {data:null} / zeros).
 *
 * Auth is real: a JWT signed with the test JWT_SECRET (tests/jest.setup.js).
 * The data layer fails at the lib/prisma boundary (j2/failing-prisma.ts);
 * lib/platform/noop-client is not mocked and throws on use as shipped. Network
 * is cut by stubbing fetch, so no live service is reached.
 *
 * Controls are planted route files written to out/j2-controls/ and run through
 * the same invokeRoute + judge pipeline as the cases; caught means FAIL.
 */
import fs from 'fs';
import path from 'path';
import { classify, recordResults, type JevResult } from '../runner/record';
import { invokeRoute, type InvokeResult } from '../runner/route-harness';
import { generateToken } from '@/lib/auth/jwt-utils';
import { judgeRead } from './j2/detector';
import { J2_CASE_COUNT, selectRoutes, type J2Route } from './j2/select';
import { J2_ORG_ID, J2_USER_ID, dbRejects } from './j2/failing-prisma';

jest.mock('@/lib/prisma', () =>
  require('./j2/failing-prisma').failingPrismaModule()
);

const FAMILY = 'J2';
const HANDLER_TIMEOUT_MS = 10_000;
const ROOT = path.join(__dirname, '../../../..');
const CONTROL_DIR = 'tests/eval/jev/out/j2-controls';
const results: JevResult[] = [];
afterAll(() => recordResults(FAMILY, results));

let token = '';
beforeAll(() => {
  token = generateToken({ userId: J2_USER_ID, email: 'member@org-a.test' });
});
beforeEach(() => {
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const)
    jest.spyOn(console, level).mockImplementation(() => undefined);
  global.fetch = (() =>
    Promise.reject(
      new Error('J2: network disabled')
    )) as unknown as typeof fetch;
});

function paramsFor(file: string): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  for (const m of file.matchAll(/\[{1,2}(\.\.\.)?([^\]]+)\]{1,2}/g)) {
    const value = /org/i.test(m[2]) ? J2_ORG_ID : `org-A-${m[2]}-1`;
    params[m[2]] = m[1] ? [value] : value;
  }
  return params;
}

function urlFor(file: string, params: Record<string, string | string[]>) {
  const route = path
    .dirname(file)
    .replace(/^app/, '')
    .split('/')
    .filter(s => !/^\(.*\)$/.test(s))
    .map(s => {
      const m = /^\[{1,2}(?:\.\.\.)?([^\]]+)\]{1,2}$/.exec(s);
      const v = m ? params[m[1]] : undefined;
      if (v === undefined) return s;
      return Array.isArray(v) ? v.join('/') : v;
    })
    .join('/');
  return `http://localhost:3000${route.startsWith('/') ? '' : '/'}${route}?organizationId=${J2_ORG_ID}&orgId=${J2_ORG_ID}`;
}

async function invokeRead(file: string): Promise<InvokeResult> {
  const params = paramsFor(file);
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<InvokeResult>(resolve => {
    timer = setTimeout(
      () =>
        resolve({
          status: null,
          json: null,
          error: `no response within ${HANDLER_TIMEOUT_MS}ms`,
        }),
      HANDLER_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([
      invokeRoute(file, 'GET', {
        headers: { authorization: `Bearer ${token}` },
        params,
        url: urlFor(file, params),
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** The one judgement every case and control goes through. */
function judge(
  r: InvokeResult
):
  | { verdict: 'honest' | 'dishonest'; detail: string }
  | { inconclusive: string } {
  if (r.status === null)
    return { inconclusive: r.error ?? 'no response status' };
  if (r.error && r.status >= 200 && r.status <= 299)
    return { inconclusive: `status ${r.status}, ${r.error}` };
  const v = judgeRead(r.status, r.json);
  return { verdict: v.honest ? 'honest' : 'dishonest', detail: v.detail };
}

const routes: J2Route[] = selectRoutes();

it(`selects exactly ${J2_CASE_COUNT} routes with unique ids`, () => {
  expect(routes).toHaveLength(J2_CASE_COUNT);
  expect(new Set(routes.map(r => r.id)).size).toBe(routes.length);
});

describe('J2 cases', () => {
  it.each(routes.map(r => [r.id, r] as const))(
    '%s',
    async (_id, r) => {
      const before = dbRejects();
      const res = await invokeRead(r.file);
      const reached = dbRejects() > before;
      let j = judge(res);
      // A 400/401/403 before any data call means the failing read never ran.
      if (
        !reached &&
        res.status !== null &&
        [400, 401, 403].includes(res.status)
      )
        j = {
          inconclusive: `status ${res.status} before any data-layer call (read not exercised)`,
        };
      const route = r.route;
      if ('inconclusive' in j) {
        results.push({
          id: r.id,
          family: FAMILY,
          kind: 'case',
          state: 'INCONCLUSIVE',
          route,
          detail: j.inconclusive.slice(0, 300),
        });
        return;
      }
      results.push({
        id: r.id,
        family: FAMILY,
        kind: 'case',
        route,
        ...classify(
          r.id,
          j.verdict === 'honest',
          `${r.noop ? 'noop-client; ' : ''}${j.detail}`
        ),
      });
    },
    HANDLER_TIMEOUT_MS + 5_000
  );
});

// Planted read handlers. Each reads through the failing lib/prisma boundary.
const PLANTS: Record<string, string> = {
  'swallow-empty-array': `
    try { return NextResponse.json(await prisma.post.findMany({ where: { organizationId: 'org-A' } })); }
    catch { return NextResponse.json([]); }`,
  'swallow-data-null': `
    try { return NextResponse.json({ data: await prisma.post.findFirst({ where: { organizationId: 'org-A' } }) }); }
    catch { return NextResponse.json({ data: null }); }`,
  'swallow-zeroed-metrics': `
    try { return NextResponse.json({ success: true, metrics: { totalPosts: await prisma.post.count(), impressions: 0 } }); }
    catch { return NextResponse.json({ success: true, period: '30d', metrics: { totalPosts: 0, impressions: 0, engagementRate: 0, followers: 0 }, topPosts: [] }); }`,
  'swallow-paginated-empty': `
    try { return NextResponse.json({ data: await prisma.post.findMany(), pagination: { page: 1, limit: 20, total: await prisma.post.count() } }); }
    catch { return NextResponse.json({ data: [], pagination: { page: 1, limit: 20, total: 0 } }); }`,
};
// Honest twin: proves the detector passes an honest error answer.
const HONEST = `
    try { return NextResponse.json({ data: await prisma.post.findMany() }); }
    catch { return NextResponse.json({ error: 'Database unavailable' }, { status: 503 }); }`;

function plant(name: string, body: string): string {
  const file = `${CONTROL_DIR}/${name}/route.ts`;
  fs.mkdirSync(path.join(ROOT, path.dirname(file)), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, file),
    `import { NextResponse } from 'next/server';\nimport { prisma } from '@/lib/prisma';\n` +
      `export async function GET() {${body}\n}\n`
  );
  return file;
}

describe('J2 controls', () => {
  it.each(Object.keys(PLANTS).sort())('J2-CTRL-%s', async name => {
    const id = `J2-CTRL-${name}`;
    const j = judge(await invokeRead(plant(name, PLANTS[name])));
    results.push({
      id,
      family: FAMILY,
      kind: 'control',
      state:
        'inconclusive' in j
          ? 'INCONCLUSIVE'
          : j.verdict === 'dishonest'
            ? 'FAIL'
            : 'PASS',
      route: `/${CONTROL_DIR}/${name}`,
      detail: 'inconclusive' in j ? j.inconclusive : j.detail,
    });
    expect('verdict' in j && j.verdict).toBe('dishonest');
  });

  it('honest twin (503 with error body) is not flagged', async () => {
    const j = judge(await invokeRead(plant('honest-503', HONEST)));
    expect('verdict' in j && j.verdict).toBe('honest');
  });
});
