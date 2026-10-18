#!/usr/bin/env node
/**
 * tools/claude-hooks/guard-pretooluse.mjs — PreToolUse guard for Bash, Read and the file-writing tools.
 *
 * Deterministic policy, no model call. Every decision comes from scripts/fleet/guard.mjs
 * evaluate() with scripts/fleet/policy.json, plus the session-wide denials below that hold for
 * every role. Denies with the documented form (hooks reference, "PreToolUse decision control"):
 *   {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",
 *    "permissionDecisionReason":"..."}}
 * and exit 0. Allowed calls print nothing: silence never approves, the normal permission flow runs.
 * Any internal error exits 1, which with "onFailure":"block" blocks the call (fail closed).
 *
 * Role: SYNTHEX_FLEET_ROLE (default builder). An orchestrator writes a protected path only when
 * SYNTHEX_PROTECTED_CHANGE carries the reason (policy protected_exemptions.orchestrator_protected_change).
 *
 * Supersedes .claude/hooks/pre-bash-validate.py, whose {"permission":"deny"} output is not a
 * documented PreToolUse field and so never denied anything.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { emit, projectRoot, readInput, run } from './lib.mjs';

const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const ENV_PLACEHOLDERS = /(^|\/)\.env\.(example|sample|template)$/;
const ENV_FILE = /(^|\/)\.env(\.[^/\s]*)?$/;
const SECRET_STORE =
  /(^|\/)\.(ssh|aws|hermes|gnupg)\/|(^|\/)\.config\/gh\/|id_(rsa|ed25519)|(^|\/)\.(netrc|npmrc|pgpass)$/;

// Denied for every role, before the policy evaluator runs. Tested against the command with
// quoted strings blanked, so a commit message that mentions a flag is not read as the flag.
const SESSION_DENY = [
  [
    /\bgit\b[^;&|\n]*\bpush\b[^;&|\n]*(\s--force(-with-lease|-if-includes)?\b|\s-[a-zA-Z]*f\b|\s\+\S+)/,
    'force push (git push --force, -f, --force-with-lease or +refspec)',
  ],
  [/--no-verify\b/, '--no-verify skips the repository hooks'],
  [
    /\bgit\b[^;&|\n]*\bcommit\b[^;&|\n]*\s-[a-zA-Z]*n\b/,
    'git commit -n skips the repository hooks',
  ],
  [
    /\b(HUSKY|LEFTHOOK)=0\b|core\.hooksPath/,
    'disabling the git hooks (HUSKY=0, LEFTHOOK=0, core.hooksPath)',
  ],
  [
    /\bgh\s+pr\s+merge\b/,
    'gh pr merge outside scripts/fleet/merge-phase.mjs (FD-3)',
  ],
  [
    /\bprisma\s+(db\s+push|migrate\s+deploy)\b/,
    'prisma db push / migrate deploy mutates a database',
  ],
  [/PR_RELEASE_GATE_HUMAN_OVERRIDE/, 'release-gate override variable'],
  [
    /(^|[;&|(\s])(printenv|export\s+-p|declare\s+-x)\b|(^|[;&|(]\s*)env\s*($|[;&|>])/,
    'printing the environment exposes secrets',
  ],
  [
    /\bgh\s+auth\s+token\b|\bvercel\s+env\s+pull\b|\bsecurity\s+find-(generic|internet)-password\b/,
    'printing a credential',
  ],
  [
    /\b(echo|printf)\b[^;&|\n]*\$\{?[A-Za-z_]*(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)[A-Za-z_]*/i,
    'printing a secret-named variable',
  ],
];

const deny = reason =>
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `synthex-hooks guard: ${reason}`,
    },
  });

/** Shell-word split with quote handling; returns segments of unquoted words. */
export function segments(cmd) {
  const segs = [[]];
  let word = null;
  let q = null;
  const push = () => {
    if (word !== null) segs[segs.length - 1].push(word);
    word = null;
  };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) {
      if (c === q) q = null;
      else if (c === '\\' && q === '"' && i + 1 < cmd.length)
        word = (word ?? '') + cmd[++i];
      else word = (word ?? '') + c;
      continue;
    }
    if (c === '"' || c === "'") {
      q = c;
      word = word ?? '';
    } else if (c === '\\' && i + 1 < cmd.length) word = (word ?? '') + cmd[++i];
    else if (/\s/.test(c) && c !== '\n') push();
    else if (
      c === ';' ||
      c === '&' ||
      c === '|' ||
      c === '\n' ||
      c === '(' ||
      c === ')'
    ) {
      push();
      if (segs[segs.length - 1].length) segs.push([]);
    } else if (c === '>' || c === '<') {
      push();
      let op = c;
      while (cmd[i + 1] === '>' || cmd[i + 1] === '|' || cmd[i + 1] === '&')
        op += cmd[++i];
      segs[segs.length - 1].push(op);
    } else word = (word ?? '') + c;
  }
  push();
  return segs.filter(s => s.length);
}

/** Files a Bash command names as write targets (best effort; integration re-checks every diff). */
export function bashWriteTargets(cmd) {
  const out = [];
  for (const seg of segments(cmd)) {
    for (let i = 0; i < seg.length; i++) {
      const t = seg[i];
      if (
        /^\d*>/.test(t) &&
        !/&$/.test(t) &&
        seg[i + 1] &&
        !/^&/.test(seg[i + 1])
      )
        out.push(seg[i + 1]);
    }
    let words = seg.filter(
      (w, i) => !/^\d*[<>]/.test(w) && !/^\d*[<>]/.test(seg[i - 1] || '')
    );
    while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]))
      words = words.slice(1);
    if (words[0] === 'sudo') words = words.slice(1);
    const [bin, ...rest] = words;
    if (!bin) continue;
    const name = path.basename(bin);
    const args = rest.filter(a => !a.startsWith('-'));
    if (
      [
        'rm',
        'mv',
        'touch',
        'tee',
        'truncate',
        'chmod',
        'chown',
        'unlink',
        'rmdir',
        'shred',
      ].includes(name)
    )
      out.push(
        ...(name === 'chmod' || name === 'chown' ? args.slice(1) : args)
      );
    else if (['cp', 'install', 'ln', 'rsync'].includes(name) && args.length)
      out.push(args[args.length - 1]);
    else if (
      (name === 'sed' || name === 'perl') &&
      rest.some(a => /^(--in-place|-[a-z]*i)/.test(a))
    )
      out.push(...args.slice(1)); // first operand is the script (inline or -e/-f)
    else if (name === 'git' && ['rm', 'restore', 'mv'].includes(rest[0]))
      out.push(...args.slice(1));
    else if (name === 'git' && rest[0] === 'checkout' && rest.includes('--'))
      out.push(...rest.slice(rest.indexOf('--') + 1));
  }
  return out.filter(p => p && p !== '/dev/null' && !p.startsWith('/dev/'));
}

function repoPath(file, cwd, root) {
  const abs = path.resolve(cwd, file.replace(/\\/g, '/'));
  const top = run('git', ['rev-parse', '--show-toplevel'], {
    cwd: existsSync(cwd) ? cwd : root,
  });
  for (const base of [top.code === 0 ? top.stdout : null, root].filter(
    Boolean
  )) {
    const rel = path.relative(base, abs);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel))
      return rel.split(path.sep).join('/');
  }
  return abs.split(path.sep).join('/');
}

export async function decide(input, env = process.env) {
  const root = projectRoot(input);
  const cwd = input.cwd || root;
  const pol = JSON.parse(
    readFileSync(path.join(root, 'scripts/fleet/policy.json'), 'utf8')
  );
  const { evaluate } = await import(
    pathToFileURL(path.join(root, 'scripts/fleet/guard.mjs')).href
  );
  const role = env.SYNTHEX_FLEET_ROLE || 'builder';
  const protectedChange =
    role === 'orchestrator' && Boolean(env.SYNTHEX_PROTECTED_CHANGE);
  const tool = input.tool_name;
  const ti = input.tool_input || {};

  const checkFile = (file, kind) => {
    const p = repoPath(file, cwd, root);
    if (ENV_FILE.test(p) && !ENV_PLACEHOLDERS.test(p))
      return `${kind} of secrets file ${p}`;
    if (SECRET_STORE.test(p)) return `${kind} of home secret store ${p}`;
    if (kind === 'read') return null;
    const r = evaluate(
      { kind: 'write', path: p, role, protected_change: protectedChange },
      pol
    );
    return r.decision === 'deny' ? `${r.reason} (role ${role})` : null;
  };

  if (tool === 'Read')
    return ti.file_path ? checkFile(ti.file_path, 'read') : null;
  if (FILE_TOOLS.has(tool)) {
    const file = ti.file_path || ti.notebook_path;
    return file ? checkFile(file, 'write') : 'file tool call without a path';
  }
  if (tool === 'Bash') {
    const cmd = String(ti.command || '');
    const bare = cmd.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, '""');
    for (const [re, why] of SESSION_DENY) if (re.test(bare)) return why;
    for (const seg of segments(cmd))
      for (const w of seg)
        if (
          !w.startsWith('-') &&
          (ENV_FILE.test(w) || /[=:]\.env(\.|$)/.test(w)) &&
          !ENV_PLACEHOLDERS.test(w)
        )
          return `command names secrets file ${w}`;
        else if (SECRET_STORE.test(w))
          return `command names home secret store ${w}`;
    const r = evaluate({ kind: 'shell', command: cmd, role }, pol);
    if (r.decision === 'deny') return `${r.reason} (role ${role})`;
    for (const t of bashWriteTargets(cmd)) {
      const why = checkFile(t, 'write');
      if (why) return `${why} via Bash`;
    }
  }
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const why = await decide(readInput());
    if (why) deny(why);
    process.exit(0);
  } catch (e) {
    process.stderr.write(
      `synthex-hooks guard failed: ${e && e.message ? e.message : e}\n`
    );
    process.exit(1);
  }
}
