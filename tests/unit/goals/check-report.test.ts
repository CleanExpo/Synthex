/**
 * scripts/goals/check-report.mjs — pure parts (classifiers, fill, template guard).
 *
 * The script is Node ESM; Jest here runs CJS, so each call goes through a child
 * `node --input-type=module` process that imports the module and prints JSON.
 */
import { execFileSync, spawnSync } from 'child_process';
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  appendFileSync,
  rmSync,
  readFileSync,
} from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const SCRIPT = path.resolve(
  __dirname,
  '../../../scripts/goals/check-report.mjs'
);
const GOALS_DIR = path.dirname(SCRIPT);

/** Call an exported function (or read an exported value) of the script; returns JSON. */
function call(fn: string, ...args: unknown[]): any {
  const code = `const m = await import(${JSON.stringify(pathToFileURL(SCRIPT).href)});
const args = JSON.parse(process.argv[1]);
const v = m[${JSON.stringify(fn)}];
process.stdout.write(JSON.stringify(typeof v === 'function' ? v(...args) : v));`;
  const out = execFileSync(
    'node',
    ['--input-type=module', '-e', code, JSON.stringify(args)],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  return JSON.parse(out);
}

const ok = (value: unknown) => ({ ok: true, value });
const bad = (error: string) => ({ ok: false, error });

/**
 * receiptPresence with a fake git that answers like git does under a non-English locale:
 * ls-tree prints the path (present) or nothing (absent) and exits 0; cat-file exits 128 with
 * translated stderr. A detector that regex-matches English stderr cannot read this as absent.
 */
function receiptPresenceWithFakeGit(file: string, tracked: string[]): any {
  const code = `const m = await import(${JSON.stringify(pathToFileURL(SCRIPT).href)});
const [file, tracked] = JSON.parse(process.argv[1]);
const fake = (cmd, args) => {
  if (args[0] === 'ls-tree') {
    const f = args[args.length - 1];
    return { code: 0, stdout: tracked.includes(f) ? f + '\\n' : '', stderr: '' };
  }
  if (args[0] === 'cat-file') {
    const f = String(args[args.length - 1]).split(':').slice(1).join(':');
    return tracked.includes(f)
      ? { code: 0, stdout: '', stderr: '' }
      : { code: 128, stdout: '', stderr: "fatal: Pfad '" + f + "' existiert nicht in 'origin/main'" };
  }
  return { code: 2, stdout: '', stderr: 'unexpected git call' };
};
process.stdout.write(JSON.stringify(m.receiptPresence(file, 'origin/main', fake)));`;
  const out = execFileSync(
    'node',
    ['--input-type=module', '-e', code, JSON.stringify([file, tracked])],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return JSON.parse(out);
}
const IDS = [
  'P-1',
  'P0',
  'P1',
  'P2',
  'P3',
  'P4',
  'P5',
  'P6',
  'P7',
  'P8',
  'P9',
  'P10',
];

describe('check-report state classifiers', () => {
  it('a failed gh read is INCONCLUSIVE, never an empty successful list', () => {
    const failed = call('classifyGhRead', {
      code: 1,
      stdout: '[]',
      stderr: 'HTTP 502',
      timedOut: false,
      spawnError: null,
    });
    expect(failed.ok).toBe(false);
    const empty = call('classifyGhRead', {
      code: 0,
      stdout: '[]',
      stderr: '',
      timedOut: false,
      spawnError: null,
    });
    expect(empty).toEqual({ ok: true, value: [] });
    const g7 = call('classifyG7', {
      run: failed,
      sidecars: null,
      pr: ok({ state: 'OPEN', title: 't' }),
    });
    expect(g7.state).toBe('INCONCLUSIVE');
  });

  it('G1 reports N of 12 and the next missing phase', () => {
    const receipts = IDS.map((id, i) =>
      i === 0
        ? {
            id,
            present: ok(true),
            verify: ok({ head: 'a'.repeat(40), code: 0, tail: '' }),
          }
        : { id, present: ok(false) }
    );
    const r = call('classifyG1', { phases: ok(IDS), receipts, prs: ok([]) });
    expect(r.state).toBe('FAIL');
    expect(r.lines[0]).toContain('1 of 12 receipted (P-1)');
    expect(r.lines[0]).toContain('next: P0');
  });

  it('G3 fails a self-certified review and is INCONCLUSIVE with no receipts', () => {
    const rc = 'abcdef1234567890abcdef1234567890abcdef12';
    const report = {
      verdict: 'PASS',
      head_sha: rc.slice(0, 12),
      blocking_findings: [],
      reviewer_agent: 'openrouter/kimi',
    };
    const one = (rep: object) =>
      call('classifyG3', {
        receipts: ok([
          { id: 'P-1', receipt: ok({ reviewed_commit: rc }), report: ok(rep) },
        ]),
      }).state;
    expect(one(report)).toBe('PASS');
    expect(one({ ...report, reviewer_agent: 'anthropic/claude' })).toBe('FAIL');
    expect(call('classifyG3', { receipts: ok([]) }).state).toBe('INCONCLUSIVE');
  });

  it('G4 counts case-sensitive OPEN rows and refuses an unreadable file', () => {
    const text =
      '| ID | Kind | Text |\n| D-1 | OPEN | a |\n| D-2 | Founder | open later |\n';
    const r = call('classifyG4', { text: ok(text) });
    expect(r.state).toBe('PASS');
    expect(r.lines[0]).toMatch(/^1 OPEN row\(s\): D-1 \(2 rows/);
    expect(call('classifyG4', { text: bad('x') }).state).toBe('INCONCLUSIVE');
  });

  it('G6 and G8 separate FAIL from INCONCLUSIVE and DISABLED', () => {
    const br = (name: string, read: unknown) => ({ name, read });
    expect(
      call('classifyG6', {
        branches: [
          br('a', ok({ sha: 'a'.repeat(40), merged: false })),
          br('b', bad('absent')),
        ],
      }).state
    ).toBe('FAIL');
    expect(
      call('classifyG6', { branches: [br('b', bad('absent'))] }).state
    ).toBe('INCONCLUSIVE');
    expect(
      call('classifyG8', {
        cmds: [{ label: 'x', present: false, reason: 'not on this checkout' }],
      }).state
    ).toBe('DISABLED');
    expect(
      call('classifyG8', {
        cmds: [
          { label: 'x', present: true, run: { code: null, timedOut: true } },
        ],
      }).state
    ).toBe('INCONCLUSIVE');
  });

  it('G1 reads an absent receipt as absent whatever language git speaks', () => {
    const tracked = ['release-receipts/P0.json'];
    expect(
      receiptPresenceWithFakeGit('release-receipts/P0.json', tracked)
    ).toEqual(ok(true));
    expect(
      receiptPresenceWithFakeGit('release-receipts/P5.json', tracked)
    ).toEqual(ok(false));
  });

  it('a fleet summary outranks exit 0 for G8 commands', () => {
    const run = (output: string) => ({ code: 0, tail: '', output });
    expect(
      call(
        'classifyCommand',
        run('check-ledgers: 0 of 2 PASS, 0 FAIL, 0 INCONCLUSIVE, 2 DISABLED')
      ).state
    ).toBe('DISABLED');
    expect(
      call(
        'classifyCommand',
        run('x: 1 of 3 PASS, 1 FAIL, 0 INCONCLUSIVE, 1 DISABLED')
      ).state
    ).toBe('FAIL');
    expect(call('classifyCommand', run('no summary here')).state).toBe('PASS');
    // Any INCONCLUSIVE item leaves the run not fully measured, even beside PASS items.
    expect(
      call(
        'classifyCommand',
        run('x: 1 of 2 PASS, 0 FAIL, 1 INCONCLUSIVE, 0 DISABLED')
      ).state
    ).toBe('INCONCLUSIVE');
    // Some items passed but others were DISABLED: measured, not fully.
    expect(
      call(
        'classifyCommand',
        run('x: 1 of 2 PASS, 0 FAIL, 0 INCONCLUSIVE, 1 DISABLED')
      ).state
    ).toBe('INCONCLUSIVE');
    // A summary that counted zero items checked nothing.
    expect(
      call(
        'classifyCommand',
        run('x: 0 of 0 PASS, 0 FAIL, 0 INCONCLUSIVE, 0 DISABLED')
      ).state
    ).toBe('INCONCLUSIVE');
    // A later all-PASS summary must not hide an earlier nothing-checked or FAIL one.
    expect(
      call(
        'classifyCommand',
        run(
          'first: 0 of 2 PASS, 0 FAIL, 0 INCONCLUSIVE, 2 DISABLED\nlater: 2 of 2 PASS, 0 FAIL, 0 INCONCLUSIVE, 0 DISABLED'
        )
      ).state
    ).toBe('DISABLED');
    expect(
      call(
        'classifyCommand',
        run(
          'a: 0 of 1 PASS, 1 FAIL, 0 INCONCLUSIVE, 0 DISABLED\nb: 0 of 2 PASS, 0 FAIL, 2 INCONCLUSIVE, 0 DISABLED\nc: 3 of 3 PASS, 0 FAIL, 0 INCONCLUSIVE, 0 DISABLED'
        )
      ).state
    ).toBe('FAIL');
    const g8 = call('classifyG8', {
      cmds: [
        { label: 'a', present: true, run: run('ok') },
        {
          label: 'b',
          present: true,
          run: run('b: 0 of 2 PASS, 0 FAIL, 0 INCONCLUSIVE, 2 DISABLED'),
        },
      ],
    });
    expect(g8.state).not.toBe('PASS');
  });

  it('rejects a fifth state', () => {
    expect(() => call('result', 'PASSISH', [])).toThrow();
  });
});

describe('check-report template', () => {
  const tpl = readFileSync(
    path.join(GOALS_DIR, 'check-report.template.md'),
    'utf8'
  );

  it('holds every placeholder and fill is single-pass', () => {
    const keys: string[] = call('PLACEHOLDERS');
    expect(keys).toHaveLength(19);
    for (const k of keys) expect(tpl).toContain(`{{${k}}}`);
    const values = Object.fromEntries(
      keys.map(k => [k, k === 'SUMMARY' ? '{{G1_STATE}}' : 'v'])
    );
    const filled: string = call('fill', tpl, values);
    expect(filled).toContain('**Summary:** {{G1_STATE}}');
    expect(() =>
      call('fill', '{{GENERATED_AT}}', { GENERATED_AT: 'x' })
    ).toThrow();
  });

  it('a changed template copy exits 2 and is never rewritten', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'check-report-test-'));
    try {
      const dir = path.join(tmp, 'scripts', 'goals');
      mkdirSync(dir, { recursive: true });
      for (const f of [
        'check-report.mjs',
        'check-report.template.md',
        'template.lock.json',
      ])
        copyFileSync(path.join(GOALS_DIR, f), path.join(dir, f));
      const copy = path.join(dir, 'check-report.template.md');
      appendFileSync(copy, 'planted\n');
      const before = readFileSync(copy, 'utf8');
      const r = spawnSync(
        'node',
        [path.join(dir, 'check-report.mjs'), '--offline'],
        { encoding: 'utf8' }
      );
      expect(r.status).toBe(2);
      expect(r.stdout).toMatch(
        /^FAIL template changed: [0-9a-f]{64} != [0-9a-f]{64}/
      );
      expect(readFileSync(copy, 'utf8')).toBe(before);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('refuses --out pointing at the template', () => {
    const r = spawnSync(
      'node',
      [
        SCRIPT,
        '--offline',
        '--out',
        path.join(GOALS_DIR, 'check-report.template.md'),
      ],
      {
        encoding: 'utf8',
      }
    );
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('resolves to the template; refused');
  });
});
