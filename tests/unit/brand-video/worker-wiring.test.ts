/**
 * @jest-environment node
 */
/**
 * Brand Video worker wiring — SYN-1145.
 *
 * The worker is an ESM entrypoint that runs main() on import, so it cannot be
 * imported here (see worker-semantics.test.ts). Its behaviour is proven by
 * running it against a stub; these assertions pin the wiring that the
 * founder's 22/11/2026 ruling restored, so a later change cannot quietly
 * switch it off again:
 *
 *  - no exit-at-startup stub for the removed client;
 *  - client and bucket come from lib/brand-video/connection.ts (bucket default
 *    'brand-video', not the old 'brand-videos' that does not exist);
 *  - the preflight runs before the queue is read;
 *  - the workflow schedule is on, with a preflight step before the render.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const worker = fs.readFileSync(
  path.join(ROOT, 'scripts/brand-video-worker.ts'),
  'utf8'
);
const workflow = fs.readFileSync(
  path.join(ROOT, '.github/workflows/brand-video-render.yml'),
  'utf8'
);

describe('Brand Video worker wiring', () => {
  it('no longer exits at startup through the removed-client stub', () => {
    expect(worker).not.toMatch(/requires the removed Supabase client/);
    expect(worker).not.toMatch(/function getSupabase\(/);
  });

  it('takes its client and bucket from lib/brand-video/connection', () => {
    expect(worker).toMatch(/from '@\/lib\/brand-video\/connection'/);
    expect(worker).toMatch(/createBrandVideoClient\(/);
    expect(worker).not.toMatch(/'brand-videos'/);
    expect(worker).not.toMatch(/process\.env\.BRAND_VIDEO_BUCKET/);
  });

  it('runs the preflight before the first queue read', () => {
    const main = worker.slice(worker.indexOf('async function main('));
    const preflightAt = main.indexOf('runBrandVideoPreflight(');
    const claimAt = main.indexOf('claimJob(');
    expect(preflightAt).toBeGreaterThan(-1);
    expect(claimAt).toBeGreaterThan(preflightAt);
    expect(main.indexOf('brandVideoPreflightPassed(')).toBeLessThan(claimAt);
  });

  it('writes output only through the redacting logger', () => {
    // A direct console or stdout write would bypass redaction of row fields
    // and provider errors in this public repository's Actions log.
    expect(worker).toMatch(/createBrandVideoLogger\(/);
    expect(worker).not.toMatch(/console\.(log|error|warn|info)\(/);
    expect(worker).not.toMatch(/process\.(stdout|stderr)\.write\(/);
  });

  it('records final status through setJobStatus, never a bare update', () => {
    // setJobStatus requires exactly one changed row (job-status.test.ts).
    expect(worker).toMatch(/setJobStatus\(supabase, job\.id/);
    expect(worker).not.toMatch(/\.update\(/);
  });

  it('resolves the voice id after the preflight-only exit, not at import', () => {
    const main = worker.slice(worker.indexOf('async function main('));
    const beforeMain = worker.slice(0, worker.indexOf('async function main('));
    expect(beforeMain).not.toMatch(/resolveElevenLabsVoiceId\(\)/);
    const preflightOnly = main.indexOf("includes('--preflight')");
    const voice = main.indexOf('resolveElevenLabsVoiceId()');
    expect(preflightOnly).toBeGreaterThan(-1);
    expect(voice).toBeGreaterThan(preflightOnly);
    expect(main.indexOf('claimJob(')).toBeGreaterThan(voice);
  });

  it('keeps the shared client retired outside the worker path', () => {
    // Only the worker may import the reinstated connection module.
    const importers = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return importers(p);
        return /\.(ts|tsx)$/.test(e.name) &&
          fs.readFileSync(p, 'utf8').includes('lib/brand-video/connection')
          ? [path.relative(ROOT, p)]
          : [];
      });
    const found = ['app', 'lib', 'scripts', 'components']
      .flatMap(d => importers(path.join(ROOT, d)))
      .sort();
    expect(found).toEqual(['scripts/brand-video-worker.ts']);
  });

  it('has the workflow schedule switched on', () => {
    expect(workflow).toMatch(/^ {2}schedule:\s*$/m);
    expect(workflow).toMatch(/^ {4}- cron: '\*\/5 \* \* \* \*'\s*$/m);
  });

  it('runs a preflight step before the render step', () => {
    const preflightStep = workflow.indexOf('brand-video-worker.ts --preflight');
    const renderStep = workflow.indexOf('brand-video-worker.ts --loop');
    expect(preflightStep).toBeGreaterThan(-1);
    expect(renderStep).toBeGreaterThan(preflightStep);
  });
});
