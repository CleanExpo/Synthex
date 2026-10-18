/**
 * @jest-environment node
 *
 * synthex-hooks (tools/claude-hooks): feeds recorded hook-input JSON to each command hook and
 * asserts the exact stdout JSON and exit code, then checks the settings fragment against the
 * hooks reference's per-event support table.
 */

import { spawnSync } from 'child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const HOOKS = join(ROOT, 'tools', 'claude-hooks');

type Result = { code: number; stdout: string; stderr: string };

function runHook(
  script: string,
  input: unknown,
  env: Record<string, string> = {},
  args: string[] = []
): Result {
  const r = spawnSync('node', [join(HOOKS, script), ...args], {
    cwd: ROOT,
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: ROOT,
      SYNTHEX_FLEET_ROLE: '',
      SYNTHEX_PROTECTED_CHANGE: '',
      SYNTHEX_FOUNDER_STOP_HOOK_APPROVED: '',
      ...env,
    },
    timeout: 60000,
  });
  return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

const bash = (command: string) => ({
  session_id: 'abc123',
  transcript_path: '/tmp/transcript.jsonl',
  cwd: ROOT,
  permission_mode: 'default',
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command, description: 'recorded', timeout: 120000 },
  tool_use_id: 'toolu_01',
});
const fileTool = (tool_name: string, file: string) => ({
  session_id: 'abc123',
  cwd: ROOT,
  hook_event_name: 'PreToolUse',
  tool_name,
  tool_input: {
    file_path: join(ROOT, file),
    content: 'x',
    old_string: 'a',
    new_string: 'b',
  },
  tool_use_id: 'toolu_02',
});
const denied = (reason: string) =>
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `synthex-hooks guard: ${reason}`,
    },
  }) + '\n';

describe('guard-pretooluse.mjs', () => {
  it('denies a force push with the documented deny form', () => {
    const r = runHook(
      'guard-pretooluse.mjs',
      bash('git push --force origin main')
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(
      denied(
        'force push (git push --force, -f, --force-with-lease or +refspec)'
      )
    );
  });

  it.each([
    ['git push -f origin x'],
    ['git push --force-with-lease origin x'],
    ['git push origin +main'],
  ])('denies the force push variant %s for the orchestrator too', cmd => {
    const r = runHook('guard-pretooluse.mjs', bash(cmd), {
      SYNTHEX_FLEET_ROLE: 'orchestrator',
    });
    expect(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision).toBe(
      'deny'
    );
  });

  it('denies a protected-path write by a builder', () => {
    const r = runHook('guard-pretooluse.mjs', fileTool('Write', 'CLAUDE.md'));
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(denied('protected path CLAUDE.md (role builder)'));
  });

  it('denies a protected-path write through Bash', () => {
    const r = runHook(
      'guard-pretooluse.mjs',
      bash('echo x > scripts/fleet/policy.json')
    );
    expect(r.stdout).toBe(
      denied('protected path scripts/fleet/policy.json (role builder) via Bash')
    );
  });

  it('allows a benign edit and a benign command with no output', () => {
    for (const input of [
      fileTool('Edit', 'lib/utils.ts'),
      bash('npm test -- tests/unit/x'),
    ]) {
      const r = runHook('guard-pretooluse.mjs', input);
      expect(r).toEqual({ code: 0, stdout: '', stderr: '' });
    }
  });

  it('allows an orchestrator protected change only with a stated reason', () => {
    const input = fileTool('Edit', '.claude/settings.json');
    expect(
      runHook('guard-pretooluse.mjs', input, {
        SYNTHEX_FLEET_ROLE: 'orchestrator',
      }).stdout
    ).toBe(denied('protected path .claude/settings.json (role orchestrator)'));
    expect(
      runHook('guard-pretooluse.mjs', input, {
        SYNTHEX_FLEET_ROLE: 'orchestrator',
        SYNTHEX_PROTECTED_CHANGE: 'install synthex-hooks core',
      }).stdout
    ).toBe('');
  });

  it('denies gh pr merge, --no-verify, prisma db push and secrets for every role', () => {
    const env = { SYNTHEX_FLEET_ROLE: 'orchestrator' };
    expect(
      runHook('guard-pretooluse.mjs', bash('gh pr merge 12 --merge'), env)
        .stdout
    ).toBe(denied('gh pr merge outside scripts/fleet/merge-phase.mjs (FD-3)'));
    expect(
      runHook('guard-pretooluse.mjs', bash('git commit --no-verify -m x'), env)
        .stdout
    ).toBe(denied('--no-verify skips the repository hooks'));
    expect(
      runHook('guard-pretooluse.mjs', bash('npx prisma db push'), env).stdout
    ).toBe(denied('prisma db push / migrate deploy mutates a database'));
    expect(
      runHook('guard-pretooluse.mjs', bash('cat .env.local'), env).stdout
    ).toBe(denied('command names secrets file .env.local'));
    expect(runHook('guard-pretooluse.mjs', bash('printenv'), env).stdout).toBe(
      denied('printing the environment exposes secrets')
    );
    expect(
      runHook('guard-pretooluse.mjs', fileTool('Read', '.env'), env).stdout
    ).toBe(denied('read of secrets file .env'));
  });

  it('lets the builder read the placeholder env example', () => {
    expect(
      runHook('guard-pretooluse.mjs', fileTool('Read', '.env.example')).stdout
    ).toBe('');
  });

  it('fails closed (exit 1) on malformed input so onFailure "block" blocks the call', () => {
    const r = runHook('guard-pretooluse.mjs', '{not json');
    expect(r.code).toBe(1);
    expect(r.stdout).toBe('');
  });
});

describe('context-sessionstart.mjs', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'synthex-hooks-gh-'));
  const ghFail = join(tmp, 'gh-fail');
  const ghOk = join(tmp, 'gh-ok');
  writeFileSync(
    ghFail,
    '#!/bin/sh\necho "error connecting to api.github.com" >&2\nexit 1\n'
  );
  writeFileSync(
    ghOk,
    `#!/bin/sh\necho '[{"number":7,"headRefName":"feature/fleet-p0-containment","title":"P0"},{"number":8,"headRefName":"other","title":"x"}]'\n`
  );
  chmodSync(ghFail, 0o755);
  chmodSync(ghOk, 0o755);
  const ss = (gh: string) => {
    const r = runHook(
      'context-sessionstart.mjs',
      {
        session_id: 'abc123',
        cwd: ROOT,
        hook_event_name: 'SessionStart',
        source: 'startup',
      },
      { SYNTHEX_HOOKS_GH: gh, SYNTHEX_HOOKS_NO_FETCH: '1' }
    );
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe('SessionStart');
    return out.hookSpecificOutput.additionalContext as string;
  };

  it('reports a gh failure as unknown, never as an empty list', () => {
    const ctx = ss(ghFail);
    expect(ctx).toContain(
      '- open feature/fleet-* PRs: unknown (gh failed: error connecting to api.github.com)'
    );
    expect(ctx).not.toMatch(/PRs: none/);
  });

  it('lists only feature/fleet-* PRs when gh answers (positive control)', () => {
    expect(ss(ghOk)).toContain(
      '- open feature/fleet-* PRs: #7 feature/fleet-p0-containment\n'
    );
  });

  it('carries branch, origin/main, receipts, next phase, halt and backlog lines under the cap', () => {
    const ctx = ss(ghFail);
    for (const k of [
      '- branch: ',
      '- origin/main: ',
      '- release receipts on origin/main: ',
      '- next phase: ',
      '- halt files: ',
      '- BACKLOG fleet rows',
    ])
      expect(ctx).toContain(k);
    expect(ctx.length).toBeLessThanOrEqual(5000);
  });
});

describe('context-userprompt.mjs', () => {
  const prompt = {
    session_id: 'abc123',
    hook_event_name: 'UserPromptSubmit',
    prompt: 'next',
  };

  it('injects nothing when scripts/goals/check-report.mjs is absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'synthex-hooks-noreport-'));
    expect(
      runHook('context-userprompt.mjs', prompt, { CLAUDE_PROJECT_DIR: dir })
    ).toEqual({
      code: 0,
      stdout: '',
      stderr: '',
    });
  });

  it('injects only the Summary line when the report exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'synthex-hooks-report-'));
    mkdirSync(join(dir, 'scripts', 'goals'), { recursive: true });
    writeFileSync(
      join(dir, 'scripts', 'goals', 'check-report.mjs'),
      "if (!process.argv.includes('--offline')) process.exit(9);\nprocess.stdout.write('PASS a\\nFAIL b\\nSummary: 1 PASS, 1 FAIL\\n');\n"
    );
    const r = runHook('context-userprompt.mjs', prompt, {
      CLAUDE_PROJECT_DIR: dir,
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext:
            'Goal check (scripts/goals/check-report.mjs --offline): Summary: 1 PASS, 1 FAIL',
        },
      }) + '\n'
    );
  });
});

describe('install.mjs', () => {
  const settings = JSON.parse(
    readFileSync(join(ROOT, '.claude', 'settings.json'), 'utf8')
  );
  const pack = JSON.parse(
    readFileSync(join(HOOKS, 'hooks.settings.json'), 'utf8')
  );
  const tempProject = () => {
    const dir = mkdtempSync(join(tmpdir(), 'synthex-hooks-install-'));
    mkdirSync(join(dir, '.claude'));
    copyFileSync(
      join(ROOT, '.claude', 'settings.json'),
      join(dir, '.claude', 'settings.json')
    );
    return dir;
  };

  it('--print keeps the existing 3 hooks, adds core only, and writes nothing', () => {
    const before = readFileSync(join(ROOT, '.claude', 'settings.json'), 'utf8');
    const r = runHook('install.mjs', '', {}, ['--print']);
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(readFileSync(join(ROOT, '.claude', 'settings.json'), 'utf8')).toBe(
      before
    );
    for (const [event, groups] of Object.entries(
      settings.hooks as Record<string, unknown[]>
    ))
      expect(out.hooks[event].slice(0, groups.length)).toEqual(groups);
    expect(Object.keys(settings.hooks)).toEqual([
      'PreCompact',
      'PreToolUse',
      'PostToolUse',
    ]);
    for (const [event, groups] of Object.entries(
      pack.core as Record<string, unknown[]>
    ))
      for (const g of groups) expect(out.hooks[event]).toContainEqual(g);
    expect(out.hooks.Stop).toBeUndefined();
    const { hooks: _a, ...restOut } = out;
    const { hooks: _b, ...restIn } = settings;
    expect(restOut).toEqual(restIn);
  });

  it('--write --forcing is refused without SYNTHEX_FOUNDER_STOP_HOOK_APPROVED=1', () => {
    const dir = tempProject();
    const before = readFileSync(join(dir, '.claude', 'settings.json'), 'utf8');
    const r = runHook('install.mjs', '', { CLAUDE_PROJECT_DIR: dir }, [
      '--write',
      '--forcing',
    ]);
    expect(r.code).toBe(3);
    expect(r.stderr).toMatch(
      /^refused: the forcing Stop hook needs the founder's explicit Bash permission rule/
    );
    expect(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8')).toBe(
      before
    );
  });

  it('--write --core writes once and is idempotent', () => {
    const dir = tempProject();
    expect(
      runHook('install.mjs', '', { CLAUDE_PROJECT_DIR: dir }, [
        '--write',
        '--core',
      ]).code
    ).toBe(0);
    const first = readFileSync(join(dir, '.claude', 'settings.json'), 'utf8');
    expect(
      runHook('install.mjs', '', { CLAUDE_PROJECT_DIR: dir }, [
        '--write',
        '--core',
      ]).code
    ).toBe(0);
    expect(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8')).toBe(
      first
    );
    expect(JSON.parse(first).hooks.Stop).toBeUndefined();
  });

  it('--write --forcing with the approval adds the Stop hook', () => {
    const dir = tempProject();
    const r = runHook(
      'install.mjs',
      '',
      { CLAUDE_PROJECT_DIR: dir, SYNTHEX_FOUNDER_STOP_HOOK_APPROVED: '1' },
      ['--write', '--forcing']
    );
    expect(r.code).toBe(0);
    expect(
      JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'))
        .hooks.Stop
    ).toEqual(pack.forcing.Stop);
  });
});

describe('hooks.settings.json structure', () => {
  const pack = JSON.parse(
    readFileSync(join(HOOKS, 'hooks.settings.json'), 'utf8')
  );
  // Hooks reference, "Prompt-based hooks": per-event support for each handler type.
  const ALL_FIVE = [
    'PermissionDenied',
    'PostToolBatch',
    'PostToolUse',
    'PostToolUseFailure',
    'PreToolUse',
    'Stop',
    'SubagentStop',
    'TaskCompleted',
    'TaskCreated',
    'TeammateIdle',
    'UserPromptExpansion',
    'UserPromptSubmit',
  ];
  const NO_MODEL = [
    'ConfigChange',
    'CwdChanged',
    'DirectoryAdded',
    'Elicitation',
    'ElicitationResult',
    'FileChanged',
    'InstructionsLoaded',
    'MessageDisplay',
    'Notification',
    'PostCompact',
    'PostModelSwitch',
    'PreCompact',
    'PreModelSwitch',
    'SessionEnd',
    'StopFailure',
    'SubagentStart',
    'WorktreeCreate',
    'WorktreeRemove',
  ];
  const support: Record<string, string[]> = {
    ...Object.fromEntries(
      ALL_FIVE.map(e => [e, ['command', 'http', 'mcp_tool', 'prompt', 'agent']])
    ),
    ...Object.fromEntries(
      NO_MODEL.map(e => [e, ['command', 'http', 'mcp_tool']])
    ),
    PermissionRequest: ['command', 'http', 'mcp_tool', 'prompt'],
    SessionStart: ['command', 'mcp_tool'],
    Setup: ['command', 'mcp_tool'],
  };
  const TOOL_EVENTS = [
    'PreToolUse',
    'PostToolUse',
    'PostToolUseFailure',
    'PermissionRequest',
    'PermissionDenied',
  ];
  type Handler = Record<string, unknown> & { type: string };
  const handlers = (block: Record<string, { hooks: Handler[] }[]>) =>
    Object.entries(block).flatMap(([event, groups]) =>
      groups.flatMap(g => g.hooks.map(h => ({ event, h })))
    );

  it('has exactly the core and forcing blocks, with Stop only in forcing', () => {
    expect(Object.keys(pack).filter(k => !k.startsWith('$'))).toEqual([
      'core',
      'forcing',
    ]);
    expect(Object.keys(pack.forcing)).toEqual(['Stop']);
    expect(pack.core.Stop).toBeUndefined();
  });

  it('uses only documented events and handler types each event supports', () => {
    for (const { event, h } of [
      ...handlers(pack.core),
      ...handlers(pack.forcing),
    ]) {
      expect(support[event]).toBeDefined();
      expect(support[event]).toContain(h.type);
      if (h.if !== undefined) expect(TOOL_EVENTS).toContain(event);
      if (h.type === 'prompt' || h.type === 'agent') {
        expect(String(h.prompt)).toContain('$ARGUMENTS');
        expect(h.onFailure).toBeUndefined();
      }
      if (h.type === 'agent') expect(h.continueOnBlock).toBeUndefined();
      if (h.type === 'command') {
        expect(h.command).toBe('node');
        const script = String((h.args as string[])[0]).replace(
          '${CLAUDE_PROJECT_DIR}',
          ROOT
        );
        expect(readFileSync(script, 'utf8').length).toBeGreaterThan(0);
      }
    }
  });

  it('guards with onFailure block and keeps the forcing Stop hook an agent hook at 120 s', () => {
    const guard = pack.core.PreToolUse[0];
    expect(guard.matcher).toBe('Bash|Read|Write|Edit|MultiEdit|NotebookEdit');
    expect(guard.hooks[0].onFailure).toBe('block');
    const route = pack.core.PreToolUse[1].hooks[0];
    expect(route).toMatchObject({
      type: 'prompt',
      if: 'Edit(/app/api/**/route.ts)',
      continueOnBlock: true,
    });
    expect(pack.forcing.Stop[0].hooks[0]).toMatchObject({
      type: 'agent',
      timeout: 120,
    });
    expect(pack.forcing.Stop[0].hooks[0].prompt).toContain(
      'stop_hook_active is true'
    );
  });
});
