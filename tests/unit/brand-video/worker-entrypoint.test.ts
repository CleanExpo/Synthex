/**
 * @jest-environment node
 */
/**
 * Brand Video worker entrypoint, run for real — SYN-1145.
 *
 * worker-wiring.test.ts reads the worker's source, and a source check cannot
 * fail under a behavioural mutant (review round on 55d1d4d2a: wrapping the
 * preflight check in `false &&` left it green). These tests run the real
 * entrypoint in a child process with fetch replaced by a stub
 * (fixtures/stub-supabase.mjs) that answers only a fake project and refuses
 * every other host, and assert on exit code, output and the requests made.
 *
 * Fixture values are built at run time and are obviously fake.
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';

const ROOT = path.resolve(__dirname, '../../..');
const TSX = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs');
const PRELOAD = path.join(__dirname, 'fixtures/stub-supabase.mjs');

const REF = 'fakeentrypointaaaaaa';
const OTHER = 'fakeentrypointbbbbbb';
const URL_A = `https://${REF}.supabase.co`;

function fakeJwt(ref: string): string {
  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ iss: 'supabase', ref, role: 'service_role' })}.entrypointsentinelsig`;
}
const KEY = fakeJwt(REF);
const KEY_OTHER = fakeJwt(OTHER);
const SENTINELS = [REF, OTHER, URL_A, KEY, KEY_OTHER, 'entrypointsentinelsig'];

const BUCKETS = [{ id: 'brand-video', name: 'brand-video', public: true }];

// The worker loads .env.local (override) and .env from the repository root.
// With either present, real values would replace the fake ones; the stub would
// then refuse the real host, but the results would no longer test this code.
const envFile = ['.env', '.env.local'].find(f =>
  fs.existsSync(path.join(ROOT, f))
);
const describeOrSkip = envFile && !process.env.CI ? describe.skip : describe;
if (envFile && process.env.CI) {
  throw new Error(`${envFile} exists at the repository root in CI`);
}

interface Run {
  code: number | null;
  output: string;
  requests: string[];
}

function runWorker(
  args: string[],
  env: Record<string, string>,
  scenario: Record<string, unknown>
): Run {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bv-entry-'));
  const log = path.join(dir, 'requests.txt');
  fs.writeFileSync(log, '');
  try {
    const r = spawnSync(
      process.execPath,
      [TSX, 'scripts/brand-video-worker.ts', ...args],
      {
        cwd: ROOT,
        timeout: 90_000,
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH ?? '/usr/bin:/bin',
          HOME: process.env.HOME ?? dir,
          TMPDIR: dir,
          NODE_OPTIONS: `--import=${pathToFileURL(PRELOAD).href}`,
          STUB_REF: REF,
          STUB_LOG: log,
          STUB_SCENARIO: JSON.stringify(scenario),
          ...env,
        },
      }
    );
    return {
      code: r.status,
      output: `${r.stdout ?? ''}${r.stderr ?? ''}`,
      requests: fs.readFileSync(log, 'utf8').split('\n').filter(Boolean),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function expectNoSentinel(output: string) {
  for (const s of SENTINELS) expect(output).not.toContain(s);
}

const GOOD = {
  NEXT_PUBLIC_SUPABASE_URL: URL_A,
  SUPABASE_URL: URL_A,
  SUPABASE_SERVICE_ROLE_KEY: KEY,
  BRAND_VIDEO_BUCKET: 'brand-video',
};

describeOrSkip('brand-video worker entrypoint (stubbed network)', () => {
  jest.setTimeout(120_000);

  it('stops before the queue when the key belongs to another project', () => {
    const r = runWorker(
      ['--loop'],
      { ...GOOD, SUPABASE_SERVICE_ROLE_KEY: KEY_OTHER },
      { buckets: BUCKETS, queue: [] }
    );
    expect(r.code).toBe(1);
    expect(r.output).toMatch(/same Supabase project: no/);
    expect(r.output).toMatch(/preflight failed\. Nothing was read/);
    // Not one request: no queue read, no storage call.
    expect(r.requests).toEqual([]);
    expectNoSentinel(r.output);
  });

  it('stops before the queue when the bucket is missing', () => {
    const r = runWorker(['--loop'], GOOD, { buckets: [], queue: [] });
    expect(r.code).toBe(1);
    expect(r.output).toMatch(/storage bucket exists: no/);
    expect(r.requests).toEqual(['GET /storage/v1/bucket']);
    expectNoSentinel(r.output);
  });

  it('reads the empty queue after three yes answers and exits 0', () => {
    const r = runWorker(['--loop'], GOOD, { buckets: BUCKETS, queue: [] });
    expect(r.code).toBe(0);
    expect(r.output.match(/: yes$/gm)).toHaveLength(3);
    expect(r.output).toMatch(/No queued jobs\./);
    expect(r.requests).toEqual([
      'GET /storage/v1/bucket',
      'GET /rest/v1/brand_video_jobs',
    ]);
    expectNoSentinel(r.output);
  });

  it('answers --preflight alone, whatever the voice settings, without reading the queue', () => {
    const r = runWorker(
      ['--preflight'],
      { ...GOOD, ELEVENLABS_API_KEY: 'fake-eleven-key' },
      { buckets: BUCKETS, queue: [] }
    );
    expect(r.code).toBe(0);
    expect(r.output.match(/: yes$/gm)).toHaveLength(3);
    expect(r.requests).toEqual(['GET /storage/v1/bucket']);
  });

  const job = {
    id: '00000000-0000-4000-8000-000000000001',
    // Row text the worker did not write, carrying configured values.
    brand: `${URL_A} ${KEY}`,
    style: REF,
    topic: '',
    count: 1,
    status: 'rendering',
    organization_id: null,
    created_by: null,
  };

  it('fails the run when the final status write changes no row', () => {
    const r = runWorker(['--loop'], GOOD, {
      buckets: BUCKETS,
      queue: [job],
      claimed: job,
      statusRows: [],
    });
    expect(r.code).toBe(1);
    expect(r.output).toMatch(/0 rows changed, expected 1/);
    expect(r.output).not.toMatch(/Done:/);
    expectNoSentinel(r.output);
  });

  it('completes the job when the final status write changes its row (control)', () => {
    const r = runWorker([], GOOD, {
      buckets: BUCKETS,
      queue: [job],
      claimed: job,
      statusRows: [{ id: job.id }],
    });
    expect(r.code).toBe(0);
    expect(r.requests).toEqual([
      'GET /storage/v1/bucket',
      'GET /rest/v1/brand_video_jobs',
      'PATCH /rest/v1/brand_video_jobs',
      'PATCH /rest/v1/brand_video_jobs',
    ]);
    expect(r.output).toMatch(/Job 0{8}-/);
    expectNoSentinel(r.output);
  });
});
