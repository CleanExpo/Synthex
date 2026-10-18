#!/usr/bin/env node
/**
 * tools/claude-hooks/selftest.mjs — planted positive controls for every synthex-hooks command check.
 *
 * Builds a throwaway fixture project in the temp dir (a git repo with a local bare origin and copies
 * of scripts/fleet/{guard,lib}.mjs and policy.json), then feeds recorded hook input to each hook
 * as Claude Code would. Every planted forbidden act must be denied BY THE CHECK THAT OWNS IT (the
 * reason must start with its id), every benign act must be allowed. It never touches the real
 * repository: the halt file, ledger rows and settings writes all land in the fixture.
 *
 * Prints one PASS/FAIL line per act and exits 0 only when every line is PASS; 1 when any act is
 * FAIL; 2 (INCONCLUSIVE) when the fixture could not be built.
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOOKS_DIR } from './lib.mjs';
import { policyHookProblems, versionOk } from './context-sessionstart.mjs';

const REPO = path.resolve(HOOKS_DIR, '..', '..');
// Planted secrets are assembled at run time so no scanner sees a key-shaped literal in source.
const STRIPE_LIVE = ['sk', 'live', 'Zx9'.repeat(8)].join('_');
const PEM = ['-----BEGIN', 'RSA PRIVATE KEY-----'].join(' ');

/** H1: the only deny forms Claude Code honours on PreToolUse. */
export function validDeny(res) {
  if (res.code === 2) return true;
  if (res.code !== 0 || !res.stdout.trim()) return false;
  let o;
  try {
    o = JSON.parse(res.stdout);
  } catch {
    return false;
  }
  const h = o.hookSpecificOutput;
  return Boolean(
    h &&
    h.hookEventName === 'PreToolUse' &&
    h.permissionDecision === 'deny' &&
    typeof h.permissionDecisionReason === 'string' &&
    !('permission' in o)
  );
}
const reasonOf = res => {
  try {
    const o = JSON.parse(res.stdout);
    return (
      (o.hookSpecificOutput && o.hookSpecificOutput.permissionDecisionReason) ||
      o.reason ||
      o.systemMessage ||
      ''
    );
  } catch {
    return res.stderr;
  }
};

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (r.status !== 0)
    throw new Error(`${cmd} ${args.join(' ')}: ${r.stderr || r.error}`);
  return r.stdout.trim();
}

export function buildFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'synthex-hooks-selftest-'));
  const proj = path.join(dir, 'proj');
  const origin = path.join(dir, 'origin.git');
  mkdirSync(path.join(proj, 'scripts', 'fleet'), { recursive: true });
  for (const f of ['guard.mjs', 'lib.mjs', 'policy.json'])
    copyFileSync(
      path.join(REPO, 'scripts', 'fleet', f),
      path.join(proj, 'scripts', 'fleet', f)
    );
  mkdirSync(path.join(proj, '.claude'));
  writeFileSync(
    path.join(proj, '.claude', 'settings.json'),
    JSON.stringify({ hooks: {} }, null, 2) + '\n'
  );
  mkdirSync(path.join(proj, 'proposals', 'P1', 'tests', 'eval', 'jev'), {
    recursive: true,
  });
  writeFileSync(
    path.join(proj, 'proposals', 'P1', 'tests', 'eval', 'jev', 'floors.json'),
    JSON.stringify(
      {
        schema: 'jev-floors/1',
        families: { J1: { floor: 0.939 }, J2: { floor: 0.8 } },
      },
      null,
      2
    ) + '\n'
  );
  mkdirSync(path.join(proj, 'lib'));
  writeFileSync(path.join(proj, 'lib', 'utils.ts'), 'export const a = 1;\n');
  mkdirSync(path.join(proj, 'release-receipts', 'halt'), { recursive: true });
  writeFileSync(path.join(proj, 'release-receipts', 'halt', '.gitkeep'), '');
  // Tracked, as on main: H11 appends to it and H12 must still call the tree clean.
  mkdirSync(path.join(proj, 'release-receipts', 'ledger'), { recursive: true });
  writeFileSync(
    path.join(proj, 'release-receipts', 'ledger', 'fleet.jsonl'),
    ''
  );
  sh('git', ['init', '-q', '--bare', origin], dir);
  sh('git', ['init', '-q', '-b', 'fleet-unit/selftest'], proj);
  sh('git', ['config', 'user.name', 'Synthex Fleet'], proj);
  sh('git', ['config', 'user.email', 'fleet@synthex.local'], proj);
  sh('git', ['config', 'commit.gpgsign', 'false'], proj);
  sh('git', ['add', '-A'], proj);
  sh(
    'git',
    [
      'commit',
      '-q',
      '--no-verify',
      '-m',
      'fixture',
      '-m',
      'Fleet-Role: builder',
    ],
    proj
  );
  sh('git', ['remote', 'add', 'origin', origin], proj);
  sh('git', ['push', '-q', 'origin', 'fleet-unit/selftest'], proj);
  sh('git', ['fetch', '-q', 'origin'], proj);
  return { dir, proj, pushed: sh('git', ['rev-parse', 'HEAD'], proj) };
}

function hook(fx, script, input, env = {}) {
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !/^(SYNTHEX_|GIT_COMMITTER_|GIT_AUTHOR_)/.test(k)
    )
  );
  const r = spawnSync(process.execPath, [path.join(HOOKS_DIR, script)], {
    cwd: fx.proj,
    input: JSON.stringify({
      session_id: 'selftest',
      cwd: fx.proj,
      transcript_path: '/dev/null',
      ...input,
    }),
    encoding: 'utf8',
    env: { ...clean, CLAUDE_PROJECT_DIR: fx.proj, ...env },
    timeout: 60000,
  });
  return {
    code: r.status === null ? 124 : r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

export function runSelftest() {
  const fx = buildFixture();
  const results = [];
  const record = (id, label, ok, detail = '') =>
    results.push({ id, label, ok, detail });
  const abs = f => path.join(fx.proj, f);
  const pre = (tool, tool_input, env) =>
    hook(
      fx,
      'guard-pretooluse.mjs',
      {
        hook_event_name: 'PreToolUse',
        tool_name: tool,
        tool_input,
        tool_use_id: 't',
      },
      env
    );
  // Planted forbidden act: denied in the documented form, by the check that owns it.
  const denies = (id, label, tool, ti, env) => {
    const r = pre(tool, ti, env);
    const why = reasonOf(r);
    record(
      id,
      `deny ${label}`,
      validDeny(r) && why.includes(`guard: ${id}`),
      why || `exit ${r.code} ${r.stderr}`
    );
  };
  const allows = (id, label, tool, ti, env) => {
    const r = pre(tool, ti, env);
    record(
      id,
      `allow ${label}`,
      r.code === 0 && r.stdout === '',
      reasonOf(r) || r.stderr
    );
  };
  const bash = command => ({ command });
  const orch = { SYNTHEX_FLEET_ROLE: 'orchestrator' };

  // H1: the legacy {"permission":"deny"} shape is not a deny; the documented shape is.
  record(
    'H1',
    'reject {"permission":"deny"} as a deny form',
    !validDeny({ code: 0, stdout: '{"permission":"deny","reason":"x"}' })
  );
  record(
    'H1',
    'accept hookSpecificOutput.permissionDecision deny',
    validDeny({
      code: 0,
      stdout: JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'x',
        },
      }),
    })
  );
  record('H1', 'accept exit 2', validDeny({ code: 2, stdout: '' }));

  // H2: version floor and onFailure on policy hooks (SessionStart reports, never blocks).
  record(
    'H2',
    'version 2.1.294 is below the floor',
    versionOk('2.1.294 (Claude Code)') === false
  );
  record(
    'H2',
    'version 2.1.295 meets the floor',
    versionOk('2.1.295 (Claude Code)') === true && versionOk('2.2.0') === true
  );
  const noBlock = {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'node', args: ['g.mjs'] }],
        },
      ],
    },
  };
  record(
    'H2',
    'settings fixture with no onFailure fails',
    policyHookProblems(noBlock).length === 1
  );
  noBlock.hooks.PreToolUse[0].hooks[0].onFailure = 'block';
  record(
    'H2',
    'settings fixture with onFailure block passes',
    policyHookProblems(noBlock).length === 0
  );
  const ss = hook(
    fx,
    'context-sessionstart.mjs',
    { hook_event_name: 'SessionStart', source: 'startup' },
    {
      SYNTHEX_HOOKS_GH: '/bin/false',
      SYNTHEX_HOOKS_NO_FETCH: '1',
      SYNTHEX_HOOKS_CLAUDE_VERSION: '2.1.200',
    }
  );
  record(
    'H2',
    'SessionStart warns below the floor and does not block',
    ss.code === 0 &&
      /WARNING Claude Code 2\.1\.200 is below 2\.1\.295/.test(ss.stdout) &&
      !/"decision"/.test(ss.stdout)
  );

  // H3: protected paths, including Bash redirects.
  denies('H3', 'builder Write CLAUDE.md', 'Write', {
    file_path: abs('CLAUDE.md'),
    content: 'x',
  });
  denies(
    'H3',
    'echo x > scripts/jev/check-ratchet.mjs',
    'Bash',
    bash('echo x > scripts/jev/check-ratchet.mjs')
  );
  denies(
    'H3',
    'cp into .github/workflows',
    'Bash',
    bash('cp a.yml .github/workflows/ci.yml')
  );
  denies(
    'H3',
    'orchestrator Edit .claude/settings.json without a reason',
    'Edit',
    {
      file_path: abs('.claude/settings.json'),
      old_string: '{',
      new_string: '{',
    },
    orch
  );
  allows('H3', 'builder Edit lib/utils.ts', 'Edit', {
    file_path: abs('lib/utils.ts'),
    old_string: '1',
    new_string: '2',
  });
  allows(
    'H3',
    'orchestrator protected change with SYNTHEX_PROTECTED_CHANGE',
    'Edit',
    {
      file_path: abs('.claude/settings.json'),
      old_string: '{',
      new_string: '{',
    },
    { ...orch, SYNTHEX_PROTECTED_CHANGE: 'selftest' }
  );

  // H4: push targets and flags (orchestrator, the role that may push).
  denies(
    'H4',
    'git push origin HEAD:main',
    'Bash',
    bash('git push origin HEAD:main'),
    orch
  );
  denies(
    'H4',
    'git push --force',
    'Bash',
    bash('git push --force origin fleet-unit/selftest'),
    orch
  );
  denies(
    'H4',
    'git push -f',
    'Bash',
    bash('git push -f origin fleet-unit/selftest'),
    orch
  );
  denies(
    'H4',
    'git push --force-with-lease',
    'Bash',
    bash('git push --force-with-lease origin fleet-unit/selftest'),
    orch
  );
  denies(
    'H4',
    'git push +refspec',
    'Bash',
    bash('git push origin +fleet-unit/selftest'),
    orch
  );
  denies(
    'H4',
    'git push --no-verify',
    'Bash',
    bash('git push --no-verify origin fleet-unit/selftest'),
    orch
  );
  denies(
    'H4',
    'tag delete :refs/tags/v1',
    'Bash',
    bash('git push origin :refs/tags/v1'),
    orch
  );
  denies(
    'H4',
    'branch delete --delete',
    'Bash',
    bash('git push origin --delete fix/old'),
    orch
  );
  denies(
    'H4',
    'push to release/x',
    'Bash',
    bash('git push origin release/x'),
    orch
  );
  denies('H4', 'gh pr merge', 'Bash', bash('gh pr merge 12 --merge'), orch);
  allows(
    'H4',
    'git push -u origin fleet-unit/selftest',
    'Bash',
    bash('git push -u origin fleet-unit/selftest'),
    orch
  );
  allows(
    'H4',
    'git push origin feature/fleet-p0-containment',
    'Bash',
    bash('git push origin feature/fleet-p0-containment'),
    orch
  );
  allows(
    'H4',
    'git push origin fix/typo',
    'Bash',
    bash('git push origin fix/typo'),
    orch
  );

  // H5: committer and Fleet-Role trailer.
  denies('H5', 'commit with no trailer', 'Bash', bash('git commit -m "add x"'));
  denies(
    'H5',
    'commit by another committer',
    'Bash',
    bash(
      'git -c user.name=Someone -c user.email=a@b.c commit -m "x" -m "Fleet-Role: builder"'
    )
  );
  denies(
    'H5',
    'commit with the editor (message unverifiable)',
    'Bash',
    bash('git commit')
  );
  allows(
    'H5',
    'commit -m with Fleet-Role trailer',
    'Bash',
    bash('git commit -m "add x" -m "Fleet-Role: builder"')
  );
  allows(
    'H5',
    'commit -F - heredoc with trailer',
    'Bash',
    bash("git commit -F - <<'EOF'\nadd x\n\nFleet-Role: builder\nEOF")
  );

  // H6: secrets in new content, .env access, printing secrets.
  denies('H6', 'Write with a planted Stripe live key', 'Write', {
    file_path: abs('lib/pay.ts'),
    content: `const k = '${STRIPE_LIVE}';\n`,
  });
  denies('H6', 'Edit adding a private key block', 'Edit', {
    file_path: abs('lib/utils.ts'),
    old_string: '1',
    new_string: PEM,
  });
  denies(
    'H6',
    'Bash heredoc writing a live key',
    'Bash',
    bash(`cat > lib/k.ts <<EOF\n${STRIPE_LIVE}\nEOF`)
  );
  denies('H6', 'cat .env.local', 'Bash', bash('cat .env.local'));
  denies('H6', 'Read .env', 'Read', { file_path: abs('.env') });
  denies('H6', 'printenv', 'Bash', bash('printenv'));
  allows('H6', 'Read .env.example', 'Read', { file_path: abs('.env.example') });
  allows('H6', 'Write ordinary code', 'Write', {
    file_path: abs('lib/new.ts'),
    content: 'export const sk = "sk_test_placeholder";\n',
  });

  // H7: production data and deploy verbs.
  denies(
    'H7',
    'prisma migrate deploy',
    'Bash',
    bash('npx prisma migrate deploy'),
    orch
  );
  denies('H7', 'prisma db push', 'Bash', bash('npx prisma db push'), orch);
  denies('H7', 'supabase db push', 'Bash', bash('supabase db push'), orch);
  denies('H7', 'vercel --prod', 'Bash', bash('vercel --prod'), orch);
  denies(
    'H7',
    'vercel env pull',
    'Bash',
    bash('vercel env pull .env.local'),
    orch
  );
  denies(
    'H7',
    'non-local DATABASE_URL',
    'Bash',
    bash(
      'DATABASE_URL=postgres://u:pw@db.example.com:5432/app npm run db:check'
    ),
    orch
  );
  allows(
    'H7',
    'local DATABASE_URL',
    'Bash',
    bash('DATABASE_URL=postgres://u:pw@localhost:5432/app npm test'),
    orch
  );

  // H8: floors never lowered.
  const floors = abs('proposals/P1/tests/eval/jev/floors.json');
  denies('H8', 'lower J1 from 0.939 to 0.9', 'Edit', {
    file_path: floors,
    old_string: '0.939',
    new_string: '0.9',
  });
  denies('H8', 'remove J2 by Write', 'Write', {
    file_path: floors,
    content: JSON.stringify({
      schema: 'jev-floors/1',
      families: { J1: { floor: 0.939 } },
    }),
  });
  denies(
    'H8',
    'floors.json through sed -i',
    'Bash',
    bash('sed -i s/0.939/0.9/ proposals/P1/tests/eval/jev/floors.json')
  );
  allows('H8', 'raise J1 to 0.95', 'Edit', {
    file_path: floors,
    old_string: '0.939',
    new_string: '0.95',
  });

  // H9: halt STOP means reads only.
  const stop = abs('release-receipts/halt/STOP');
  writeFileSync(stop, 'selftest\n');
  denies('H9', 'Write while STOP exists', 'Write', {
    file_path: abs('lib/x.ts'),
    content: 'x',
  });
  denies('H9', 'npm test while STOP exists', 'Bash', bash('npm test'));
  denies(
    'H9',
    'echo > file while STOP exists',
    'Bash',
    bash('echo x > lib/y.ts')
  );
  allows('H9', 'Read while STOP exists', 'Read', {
    file_path: abs('lib/utils.ts'),
  });
  allows(
    'H9',
    'git status while STOP exists',
    'Bash',
    bash('git status --short')
  );
  rmSync(stop);
  allows('H9', 'Write after STOP is removed', 'Write', {
    file_path: abs('lib/x.ts'),
    content: 'x',
  });

  // H10: ConfigChange.
  const cc = (source, env, file = abs('.claude/settings.json')) =>
    hook(
      fx,
      'config-change.mjs',
      { hook_event_name: 'ConfigChange', source, file_path: file },
      env
    );
  const blocked = r =>
    r.code === 0 &&
    /"decision":"block"/.test(r.stdout) &&
    reasonOf(r).startsWith('H10');
  record(
    'H10',
    'block project_settings edit mid-session',
    blocked(cc('project_settings'))
  );
  record(
    'H10',
    'block local_settings edit mid-session',
    blocked(cc('local_settings', {}, abs('.claude/settings.local.json')))
  );
  record(
    'H10',
    'block skills edit mid-session',
    blocked(cc('skills', {}, abs('.claude/skills/x/SKILL.md')))
  );
  record(
    'H10',
    'allow with SYNTHEX_HOOK_INSTALL=1',
    cc('project_settings', { SYNTHEX_HOOK_INSTALL: '1' }).stdout === ''
  );
  record(
    'H10',
    'allow user_settings (not guarded)',
    cc('user_settings', {}, '/tmp/user-settings.json').stdout === ''
  );
  const inst = spawnSync(
    process.execPath,
    [path.join(HOOKS_DIR, 'install.mjs'), '--write', '--core'],
    { encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: fx.proj } }
  );
  record(
    'H10',
    'allow the content install.mjs --write just wrote',
    inst.status === 0 && cc('project_settings').stdout === ''
  );
  writeFileSync(
    abs('.claude/settings.json'),
    readFileSync(abs('.claude/settings.json'), 'utf8').replace(
      '"hooks"',
      '"hooks" '
    ) + ' '
  );
  record(
    'H10',
    'block a later hand edit of the installed file',
    blocked(cc('project_settings'))
  );
  sh('git', ['checkout', '-q', '--', '.claude/settings.json'], fx.proj);

  // H11: PermissionDenied rows land in the fixture ledger, secrets redacted.
  const ledger = abs('release-receipts/ledger/fleet.jsonl');
  const planted = [
    {
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /tmp/build' },
      reason: '[Irreversible Local Destruction]',
    },
    {
      tool_name: 'Bash',
      tool_input: { command: `curl -H "Authorization: ${STRIPE_LIVE}" x` },
      reason: '[Data Exfiltration]',
    },
  ];
  const codes = planted.map(
    p =>
      hook(fx, 'permission-denied.mjs', {
        hook_event_name: 'PermissionDenied',
        tool_use_id: 't',
        permission_mode: 'auto',
        ...p,
      }).code
  );
  const rows = existsSync(ledger)
    ? readFileSync(ledger, 'utf8')
        .trim()
        .split('\n')
        .map(l => JSON.parse(l))
    : [];
  record(
    'H11',
    'every planted denial appears in the ledger',
    codes.every(c => c === 0) &&
      planted.every(p =>
        rows.some(
          r =>
            r.kind === 'permission-denied' &&
            r.reason === p.reason &&
            r.tool === p.tool_name
        )
      )
  );
  record(
    'H11',
    'ledger rows redact secrets',
    !readFileSync(ledger, 'utf8').includes(STRIPE_LIVE)
  );

  // H12: UNIT-DONE sha on origin and a clean tree (the ledger H11 just appended to is the one exception).
  const stopEv = (msg, extra = {}) =>
    hook(fx, 'check-unit-done.mjs', {
      hook_event_name: 'Stop',
      stop_hook_active: false,
      last_assistant_message: msg,
      ...extra,
    });
  const made = 'deadbeef'.repeat(5);
  const isBlock = r =>
    r.code === 0 &&
    /"decision":"block"/.test(r.stdout) &&
    reasonOf(r).startsWith('H12');
  record(
    'H12',
    'block a made-up sha on Stop',
    isBlock(stopEv(`done\nUNIT-DONE u1 ${made} PASS`))
  );
  {
    const r = stopEv(`UNIT-DONE u1 ${fx.pushed} PASS`);
    record(
      'H12',
      'accept a pushed sha with only hook-written ledger rows dirty',
      r.stdout === '',
      r.stdout
    );
  }
  writeFileSync(abs('lib/dirty.ts'), 'x\n');
  record(
    'H12',
    'block a pushed sha with a dirty tree',
    isBlock(stopEv(`UNIT-DONE u1 ${fx.pushed} PASS`))
  );
  rmSync(abs('lib/dirty.ts'));
  const sub = hook(fx, 'check-unit-done.mjs', {
    hook_event_name: 'SubagentStop',
    stop_hook_active: false,
    last_assistant_message: `UNIT-DONE u1 ${made} PASS`,
  });
  record('H12', 'block a made-up sha on SubagentStop', isBlock(sub));
  const task = hook(fx, 'check-unit-done.mjs', {
    hook_event_name: 'TaskCompleted',
    task_id: '1',
    task_subject: `UNIT-DONE u1 ${made} PASS`,
  });
  record(
    'H12',
    'block a made-up sha on TaskCompleted (exit 2)',
    task.code === 2 && task.stderr.startsWith('H12')
  );
  const active = stopEv(`UNIT-DONE u1 ${made} PASS`, {
    stop_hook_active: true,
  });
  record(
    'H12',
    'let the stop through when stop_hook_active (warning only)',
    active.code === 0 &&
      !/"decision"/.test(active.stdout) &&
      /systemMessage/.test(active.stdout)
  );
  record(
    'H12',
    'stay silent with no UNIT-DONE line',
    stopEv('all done').stdout === ''
  );

  // H13: builders hold no web channel.
  denies(
    'H13',
    'builder WebFetch',
    'WebFetch',
    { url: 'https://example.com', prompt: 'x' },
    { SYNTHEX_FLEET_ROLE: 'builder' }
  );
  denies(
    'H13',
    'builder WebSearch',
    'WebSearch',
    { query: 'x' },
    { SYNTHEX_FLEET_ROLE: 'builder' }
  );
  allows(
    'H13',
    'reader WebFetch',
    'WebFetch',
    { url: 'https://example.com', prompt: 'x' },
    { SYNTHEX_FLEET_ROLE: 'reader' }
  );

  // H15: advisory N1 lint after a write.
  const post = (file, content) => {
    mkdirSync(path.dirname(abs(file)), { recursive: true });
    writeFileSync(abs(file), content);
    return hook(fx, 'lint-n1.mjs', {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: abs(file), content },
      tool_response: { success: true },
    });
  };
  const warned = r =>
    r.code === 0 && /H15 N1/.test(r.stdout) && !/"decision"/.test(r.stdout);
  record(
    'H15',
    'warn on an email template with no unsubscribe',
    warned(
      post(
        'content/email/welcome-template.html',
        '<html><body>Hi</body></html>'
      )
    )
  );
  record(
    'H15',
    'quiet on an email template with unsubscribe',
    post(
      'content/email/ok-template.html',
      '<html><body>Hi <a href="{{unsubscribe_url}}">Unsubscribe</a></body></html>'
    ).stdout === ''
  );
  record(
    'H15',
    'warn on a trade ad with no licence number',
    warned(post('campaigns/ads/plumber-ad.md', 'Licensed plumbing, call today'))
  );
  record(
    'H15',
    'quiet on a trade ad with a licence number',
    post('campaigns/ads/plumber-ok.md', 'Plumbing by Acme. Licence No. 123456C')
      .stdout === ''
  );

  rmSync(fx.dir, { recursive: true, force: true });
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let results;
  try {
    results = runSelftest();
  } catch (e) {
    process.stdout.write(
      `INCONCLUSIVE synthex-hooks selftest: fixture failed: ${e.message}\n`
    );
    process.exit(2);
  }
  for (const r of results)
    process.stdout.write(
      `${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.label}${r.ok ? '' : ` [${String(r.detail).replace(/\s+/g, ' ').slice(0, 200)}]`}\n`
    );
  const failed = results.filter(r => !r.ok).length;
  process.stdout.write(
    `Summary: ${results.length - failed} PASS, ${failed} FAIL of ${results.length} planted acts\n`
  );
  process.exit(failed ? 1 : 0);
}
