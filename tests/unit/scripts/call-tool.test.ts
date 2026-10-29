import { spawnSync } from 'child_process';
import path from 'path';

// SEAM: scripts/mcp/call-tool.mjs exit code and output, run as a child process (node ESM script).
// Catches: writer dedupe/location regressions, the in-memory hook failing to intercept lib/prisma,
// the count check going blind. Misses: behaviour against a real database (DATABASE_URL mode).
const root = path.resolve(__dirname, '../../..');
const run = (...extra: string[]) => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.DATABASE_URL;
  return spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts/mcp/call-tool.mjs'),
      '--tool',
      'performance_get_outcomes',
      '--org',
      'synthetic',
      '--expect-count',
      '4',
      ...extra,
    ],
    { encoding: 'utf8', env, cwd: root, timeout: 120000 }
  );
};

describe('scripts/mcp/call-tool.mjs', () => {
  it('four outcome events with a location id: three calls and one booking (exit 0)', () => {
    const r = run();
    expect(`${r.stdout}${r.stderr}`).toContain('PASS call-tool');
    expect(r.status).toBe(0);
  });

  it('wrong expected count fails with exit 1', () => {
    const r = spawnSync(
      process.execPath,
      [
        path.join(root, 'scripts/mcp/call-tool.mjs'),
        '--tool',
        'performance_get_outcomes',
        '--org',
        'synthetic',
        '--expect-count',
        '5',
      ],
      {
        encoding: 'utf8',
        env: { PATH: process.env.PATH ?? '' },
        cwd: root,
        timeout: 120000,
      }
    );
    expect(r.stdout).toContain('FAIL call-tool');
    expect(r.status).toBe(1);
  });

  it('--control (control: planted failure is caught): replayed call without dedupe reports 5 != 4', () => {
    const r = run('--control');
    expect(r.stdout).toContain('5 != 4');
    expect(r.status).toBe(0);
  });
});
