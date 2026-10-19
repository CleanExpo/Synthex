/**
 * @jest-environment node
 *
 * scripts/api/gen-machine-docs.mjs — the M3 llms.txt index, error-code table
 * and rate-limit table, generated from route source (P3 unit `llms`).
 *
 * The generator runs as a child process against a small fixture tree, so each
 * assertion can fail on a real defect, plus once against this repository to
 * prove the committed docs are current.
 */

import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(ROOT, 'scripts/api/gen-machine-docs.mjs');

function run(args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

function write(root: string, rel: string, text: string) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

const read = (root: string, rel: string) =>
  fs.readFileSync(path.join(root, rel), 'utf8');
// Prettier pads markdown table cells; compare rows with runs of spaces collapsed.
const flat = (text: string) => text.replace(/ {2,}/g, ' ');

function makeFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'machine-docs-test-'));
  write(
    root,
    'lib/rate-limit/presets.ts',
    `function createCategoryLimiter(c: string, w: number, m: number) { return async (_r: unknown, h: () => unknown) => h(); }
export const authStrict = createCategoryLimiter('auth-strict', 60_000, 5);
export const writeDefault = createCategoryLimiter('write-default', 60 * 1000, 30);
export const rateLimiters = { auth: authStrict };
`
  );
  write(
    root,
    'lib/rate-limit/rate-limiter.ts',
    `const DEFAULT_TIER_LIMITS = { free: 100, pro: 500 };
const ENDPOINT_LIMITS = { '/api/gen': { free: 5, pro: 20 }, '/api/unused': { free: 1, pro: 2 } };
export class RateLimiter { constructor(_c: unknown) {} }
export function createRateLimiter(endpoint: string) {
  return new RateLimiter({ windowMs: 60 * 1000, maxRequests: 1 });
}
`
  );
  write(
    root,
    'lib/auth/rate-limit.ts',
    `const DEFAULT_ORG_LIMIT = { limit: 60, windowSeconds: 60 };
const DEFAULT_IP_LIMIT = { limit: 120, windowSeconds: 60 };
`
  );
  write(
    root,
    'lib/api/not-provisioned.ts',
    `/**
 * Honest status for features that are not provisioned.
 */
export const FEATURE_NOT_PROVISIONED = 'FEATURE_NOT_PROVISIONED';
export const NOT_PROVISIONED_STATUS = 501;
export function notProvisionedBody(feature: string) {
  return { error: FEATURE_NOT_PROVISIONED, message: \`\${feature} is off\` };
}
`
  );
  write(
    root,
    'app/api/alpha/route.ts',
    `import { NextResponse } from 'next/server';
import { writeDefault as limitWrites } from '@/lib/middleware/api-rate-limit';
export async function POST(req: Request) {
  return limitWrites(req, async () =>
    NextResponse.json({ error: 'ALPHA_DENIED', message: 'Alpha is denied.' }, { status: 403 })
  );
}
const respond = (body: object, status: number) => NextResponse.json(body, { status });
export async function GET() {
  return respond({ error: 'ALPHA_LATER', message: 'Try later.' }, 202);
}
`
  );
  write(
    root,
    'app/api/(group)/beta/[id]/route.ts',
    `import { NextResponse } from 'next/server';
import { notProvisionedBody, NOT_PROVISIONED_STATUS as STATUS } from '@/lib/api/not-provisioned';
import { rateLimiters } from '@/lib/rate-limit';
export async function GET(req: Request) {
  return rateLimiters.auth(req, async () => NextResponse.json(notProvisionedBody('Beta'), { status: STATUS }));
}
`
  );
  write(
    root,
    'app/api/gen/route.ts',
    `import { NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit/rate-limiter';
const body = { code: 'GAMMA_PENDING', error: 'Gamma is pending' };
export async function POST(req: Request) {
  return withRateLimit(req, async () => NextResponse.json(body));
}
`
  );
  write(
    root,
    'app/api/delta/route.ts',
    `import { NextResponse } from 'next/server';
import { RateLimiter } from '@/lib/rate-limit';
import { checkRateLimit } from '@/lib/auth/rate-limit';
const WINDOW = 60 * 60_000;
const limiter = new RateLimiter({ windowMs: WINDOW, maxRequests: 7 });
export async function GET(req: Request) {
  await checkRateLimit(req, { namespace: 'delta', orgKey: 'o', ipKey: 'i', limits: { ip: { limit: 3, windowSeconds: 3_600 } } });
  return NextResponse.json({ ok: true });
}
`
  );
  write(
    root,
    'app/api/epsilon/route.ts',
    `import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ error: 'Slow down' }, { status: 429 });
}
`
  );
  write(
    root,
    'public/llms.txt',
    '# Fixture\n\n> Hand-written preamble that must survive.\n'
  );
  return root;
}

describe('gen-machine-docs', () => {
  let root: string;

  beforeEach(() => {
    root = makeFixture();
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('committed docs in this repository match the generator (--check)', () => {
    const res = run(['--check']);
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('lists every structured error code with its HTTP status and meaning', () => {
    const md = flat(read(root, 'docs/api/error-codes.md'));
    expect(md).toContain(
      '| `ALPHA_DENIED` | 403 | Alpha is denied. | `/api/alpha` |'
    );
    // Status as a numeric second argument to a response helper.
    expect(md).toContain('| `ALPHA_LATER` | 202 | Try later. | `/api/alpha` |');
    // Code reached through a lib/api helper; status read at the call site
    // from a numeric const imported (and aliased) from that lib/api module;
    // meaning from the helper module doc; route group segment dropped.
    expect(md).toContain(
      '| `FEATURE_NOT_PROVISIONED` | 501 | Honest status for features that are not provisioned. | `/api/beta/[id]` |'
    );
    // `code:` key, body built in a variable: status is honestly unresolved.
    expect(md).toContain(
      '| `GAMMA_PENDING` | unresolved | Gamma is pending | `/api/gen` |'
    );
    expect(md).toMatch(
      /unresolved HTTP status\n\n- `GAMMA_PENDING`: app\/api\/gen\/route\.ts\n/
    );
    // Prose errors are not codes.
    expect(md).not.toContain('Slow down');
    expect(md).toContain('4 codes.');
  });

  it('lists every limiter with limit, window and routes', () => {
    const md = flat(read(root, 'docs/api/rate-limits.md'));
    expect(md).toContain(
      "| writeDefault ('write-default') | preset | 30 | 60 s | 1 |"
    );
    expect(md).toContain(
      "| authStrict ('auth-strict') | preset | 5 | 60 s | 1 |"
    );
    expect(md).toMatch(
      /### writeDefault \('write-default'\)\n\n- `\/api\/alpha`/
    );
    expect(md).toMatch(
      /### authStrict \('auth-strict'\)\n\n- `\/api\/beta\/\[id\]`/
    );
    expect(md).toContain(
      '| withRateLimit (/api/gen override) | tier | free 5, pro 20 | 60 s | 1 |'
    );
    expect(md).toContain('(they never apply): `/api/unused`.');
    expect(md).toContain(
      "| checkRateLimit 'delta' (ip bucket) | org/ip bucket | 3 | 3600 s (1 h) | 1 |"
    );
    expect(md).toContain(
      "| checkRateLimit 'delta' (org bucket, default) | org/ip bucket | 60 | 60 s | 1 |"
    );
    expect(md).toContain(
      '| RateLimiter `limiter` (app/api/delta/route.ts) | route instance | 7 | 3600 s (1 h) | 1 |'
    );
    expect(md).toContain('- `/api/epsilon` (app/api/epsilon/route.ts)');
  });

  it('keeps the llms.txt preamble, names the contract docs by repository path, and stays under 200 lines', () => {
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
    const txt = read(root, 'public/llms.txt');
    expect(
      txt.startsWith(
        '# Fixture\n\n> Hand-written preamble that must survive.\n'
      )
    ).toBe(true);
    expect(txt.match(/<!-- Machine contract: generated/g)).toHaveLength(1);
    expect(txt).toContain('`docs/api/openapi.generated.json`');
    expect(txt).toContain('`docs/api/error-codes.md`');
    expect(txt).toContain('`docs/api/rate-limits.md`');
    // Repository paths, never site-relative links that 404 on synthex.social.
    expect(txt).not.toMatch(/\]\(docs\/api\//);
    expect(txt).toContain('- ALPHA_DENIED: HTTP 403');
    expect(txt.split('\n').length).toBeLessThan(200);
    const real = fs.readFileSync(path.join(ROOT, 'public/llms.txt'), 'utf8');
    expect(real.split('\n').length).toBeLessThan(200);
  });

  it('is deterministic and carries no timestamps', () => {
    const files = [
      'docs/api/error-codes.md',
      'docs/api/rate-limits.md',
      'public/llms.txt',
    ];
    const first = files.map(f => read(root, f));
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
    expect(files.map(f => read(root, f))).toEqual(first);
    for (const text of first.slice(0, 2))
      expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('--check fails on drift from a newly planted error code', () => {
    expect(run(['--check', '--root', root]).status).toBe(0);
    write(
      root,
      'app/api/zeta/route.ts',
      `import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ error: 'ZETA_NEW' }, { status: 409 }); }
`
    );
    const res = run(['--check', '--root', root]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('docs/api/error-codes.md');
  });

  it('--check fails when a limiter value changes', () => {
    const rel = 'lib/rate-limit/presets.ts';
    write(root, rel, read(root, rel).replace('60_000, 5)', '60_000, 6)'));
    expect(run(['--check', '--root', root]).status).toBe(1);
  });

  it('--control passes on a current tree and is inconclusive (exit 1) on a stale one', () => {
    const ok = run(['--control', '--root', root]);
    expect(ok.stdout).toContain('CONTROL PASS');
    expect(ok.status).toBe(0);
    fs.rmSync(path.join(root, 'docs/api/error-codes.md'));
    const stale = run(['--control', '--root', root]);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain('CONTROL INCONCLUSIVE');
  });
});
