#!/usr/bin/env node
/**
 * tools/claude-hooks/guard-pretooluse.mjs — PreToolUse guard for every tool (matcher "*").
 *
 * Deterministic policy, no model call. Decisions come from scripts/fleet/guard.mjs evaluate()
 * with scripts/fleet/policy.json, plus the checks H3-H9 and H13 of
 * docs/research/2026-10-18-next-level.md section (d). Each deny reason starts with its check id.
 *
 * H1: denies only with the documented form (hooks reference, "PreToolUse decision control"):
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
import {
  emit,
  findSecret,
  haltFiles,
  projectRoot,
  readInput,
  run,
} from './lib.mjs';

const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead']);
const ENV_PLACEHOLDERS = /(^|\/)\.env\.(example|sample|template)$/;
const ENV_FILE = /(^|\/)\.env(\.[^/\s]*)?$/;
const SECRET_STORE =
  /(^|\/)\.(ssh|aws|hermes|gnupg)\/|(^|\/)\.config\/gh\/|id_(rsa|ed25519)|(^|\/)\.(netrc|npmrc|pgpass)$/;
const FLOORS = /(^|\/)floors\.json$/;
const PUSH_BRANCH = /^(fleet-unit\/.+|fix\/.+|feature\/fleet-p.+)$/;
const LOCAL_DB_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|host\.docker\.internal)$/;
// H9: commands that only read. Anything else under a halt is denied.
const READ_ONLY_BIN = new Set([
  'ls',
  'cat',
  'head',
  'tail',
  'grep',
  'rg',
  'wc',
  'jq',
  'pwd',
  'echo',
  'stat',
  'file',
  'du',
  'df',
  'date',
  'which',
  'tree',
  'diff',
  'sort',
  'uniq',
  'cut',
]);
const READ_ONLY_GIT = new Set([
  'status',
  'log',
  'show',
  'diff',
  'rev-parse',
  'ls-tree',
  'ls-files',
  'ls-remote',
  'branch',
  'cat-file',
  'blame',
  'describe',
  'fetch',
]);

// Denied for every role, before the policy evaluator runs. Tested against the command with
// quoted strings and heredoc bodies blanked, so a commit message that mentions a flag is not
// read as the flag.
const SESSION_DENY = [
  [/--no-verify\b/, 'H4 --no-verify skips the repository hooks'],
  [
    /\bgit\b[^;&|\n]*\bcommit\b[^;&|\n]*\s-[a-zA-Z]*n\b/,
    'H4 git commit -n skips the repository hooks',
  ],
  [
    /\b(HUSKY|LEFTHOOK)=0\b|core\.hooksPath/,
    'H4 disabling the git hooks (HUSKY=0, LEFTHOOK=0, core.hooksPath)',
  ],
  [
    /\bgh\s+pr\s+merge\b/,
    'H4 gh pr merge outside scripts/fleet/merge-phase.mjs (FD-3)',
  ],
  [
    /\bprisma\s+(db\s+push|migrate\s+(deploy|reset))\b/,
    'H7 prisma db push / migrate deploy / migrate reset mutates a database',
  ],
  [
    /\bsupabase\s+(db\s+(push|reset)|migration\s+repair)\b/,
    'H7 supabase db push / reset mutates a database',
  ],
  [
    /\bvercel\b[^;&|\n]*(\s--prod\b|\s(deploy|promote|rollback|env|alias|domains|secrets)\b)/,
    'H7 vercel production verb (deploy, --prod, env, promote, alias)',
  ],
  [/PR_RELEASE_GATE_HUMAN_OVERRIDE/, 'H4 release-gate override variable'],
  [
    /(^|[;&|(\s])(printenv|export\s+-p|declare\s+-x)\b|(^|[;&|(]\s*)env\s*($|[;&|>])/,
    'H6 printing the environment exposes secrets',
  ],
  [
    /\bgh\s+auth\s+token\b|\bsecurity\s+find-(generic|internet)-password\b/,
    'H6 printing a credential',
  ],
  [
    /\b(echo|printf)\b[^;&|\n]*\$\{?[A-Za-z_]*(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)[A-Za-z_]*/i,
    'H6 printing a secret-named variable',
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

/** Split off heredoc bodies: returns the command without them, and the bodies. */
export function splitHeredocs(cmd) {
  const bodies = [];
  const re =
    /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[^\n]*\n([\s\S]*?)(?:\n[ \t]*\2[ \t]*(?=\n|$)|$)/g;
  const rest = cmd.replace(re, (m, q, tag, body) => {
    bodies.push(body);
    return m.slice(0, m.indexOf('\n'));
  });
  return { rest, bodies };
}

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
      while (
        cmd[i + 1] === '>' ||
        cmd[i + 1] === '|' ||
        cmd[i + 1] === '&' ||
        cmd[i + 1] === '<'
      )
        op += cmd[++i];
      segs[segs.length - 1].push(op);
    } else word = (word ?? '') + c;
  }
  push();
  return segs.filter(s => s.length);
}

/** Words of a segment after leading VAR=value assignments and sudo; also returns the assignments. */
function command(seg) {
  let words = seg.filter(
    (w, i) => !/^\d*[<>]/.test(w) && !/^\d*[<>]/.test(seg[i - 1] || '')
  );
  const assigns = {};
  while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) {
    const [k, ...v] = words[0].split('=');
    assigns[k] = v.join('=');
    words = words.slice(1);
  }
  if (words[0] === 'sudo' || words[0] === 'env') words = words.slice(1);
  while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) {
    const [k, ...v] = words[0].split('=');
    assigns[k] = v.join('=');
    words = words.slice(1);
  }
  return { words, assigns };
}

/** git words split into global options (-C, -c) and the subcommand with its arguments. */
function gitParts(words) {
  const cfg = {};
  let i = 1;
  while (i < words.length && words[i].startsWith('-')) {
    if (words[i] === '-c' && words[i + 1]) {
      const [k, ...v] = words[i + 1].split('=');
      cfg[k.toLowerCase()] = v.join('=');
      i += 2;
    } else if (
      words[i] === '-C' ||
      words[i] === '--git-dir' ||
      words[i] === '--work-tree'
    )
      i += 2;
    else i += 1;
  }
  return { cfg, sub: words[i], args: words.slice(i + 1) };
}

/** Files a Bash command names as write targets (best effort; integration re-checks every diff). */
export function bashWriteTargets(cmd) {
  const out = [];
  for (const seg of segments(splitHeredocs(cmd).rest)) {
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
    const { words } = command(seg);
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
    else if (name === 'git') {
      const g = gitParts(words);
      if (['rm', 'restore', 'mv'].includes(g.sub))
        out.push(...g.args.filter(a => !a.startsWith('-')));
      else if (g.sub === 'checkout' && g.args.includes('--'))
        out.push(...g.args.slice(g.args.indexOf('--') + 1));
    }
  }
  return out.filter(p => p && p !== '/dev/null' && !p.startsWith('/dev/'));
}

/** H4: a git push may only update fleet-unit/**, fix/** or feature/fleet-p*; never force, delete, main or tags. */
export function checkPush(g, cwd) {
  const flags = g.args.filter(a => a.startsWith('-'));
  if (
    flags.some(
      f =>
        /^--(force|force-with-lease|force-if-includes)\b/.test(f) ||
        /^-[a-zA-Z]*f/.test(f)
    )
  )
    return 'H4 force push (git push --force, -f, --force-with-lease)';
  if (
    flags.some(f =>
      /^(-d|--delete|--prune|--mirror|--all|--tags|--follow-tags)$/.test(f)
    )
  )
    return 'H4 git push with --delete, --prune, --mirror, --all or --tags';
  const pos = g.args.filter(a => !a.startsWith('-'));
  const refspecs = pos.slice(1);
  if (!refspecs.length) {
    const head = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
    if (head.code !== 0)
      return 'H4 cannot read the current branch for a bare git push';
    refspecs.push(head.stdout);
  }
  for (const spec of refspecs) {
    if (spec.startsWith('+')) return `H4 force push via +refspec ${spec}`;
    const parts = spec.split(':');
    if (parts.length === 2 && parts[0] === '')
      return `H4 remote delete via refspec ${spec}`;
    let dst = parts.length === 2 ? parts[1] : parts[0];
    if (dst === 'HEAD') {
      const head = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
      dst = head.code === 0 ? head.stdout : 'HEAD';
    }
    if (/^refs\/tags\/|^v?\d+\.\d+/.test(dst)) return `H4 tag push ${spec}`;
    dst = dst.replace(/^refs\/heads\//, '');
    if (!PUSH_BRANCH.test(dst))
      return `H4 push target ${dst} is not fleet-unit/**, fix/** or feature/fleet-p*`;
  }
  return null;
}

/** H5: committer is the policy committer and the message carries a Fleet-Role trailer. */
export function checkCommit(g, assigns, heredocs, cwd, pol, env) {
  const cfg = key => {
    const r = run('git', ['config', '--get', key], { cwd });
    return r.code === 0 ? r.stdout : '';
  };
  const name =
    assigns.GIT_COMMITTER_NAME ??
    g.cfg['user.name'] ??
    env.GIT_COMMITTER_NAME ??
    cfg('user.name');
  const email =
    assigns.GIT_COMMITTER_EMAIL ??
    g.cfg['user.email'] ??
    env.GIT_COMMITTER_EMAIL ??
    cfg('user.email');
  const want = pol.committer || {
    name: 'Synthex Fleet',
    email: 'fleet@synthex.local',
  };
  if (name !== want.name || email !== want.email)
    return `H5 committer must be ${want.name} <${want.email}>, is ${name || '(unset)'} <${email || '(unset)'}>`;
  const trailer = new RegExp(
    `(^|\\n|["'\\s])${want.trailer || 'Fleet-Role'}:\\s*[a-z-]+`
  );
  const msgs = [];
  for (let i = 0; i < g.args.length; i++) {
    const a = g.args[i];
    if (
      (a === '-m' ||
        /^-[a-zA-Z]+m$/.test(a) ||
        a === '--message' ||
        a === '--trailer') &&
      g.args[i + 1] !== undefined
    )
      msgs.push(g.args[++i]);
    else if (/^(-m|--message=|--trailer=)/.test(a))
      msgs.push(a.replace(/^(-m|--message=|--trailer=)/, ''));
    else if ((a === '-F' || a === '--file') && g.args[i + 1] !== undefined) {
      const f = g.args[++i];
      if (f === '-') msgs.push(...heredocs);
      else {
        try {
          msgs.push(readFileSync(path.resolve(cwd, f), 'utf8'));
        } catch {
          return `H5 cannot read commit message file ${f}`;
        }
      }
    }
  }
  if (
    g.args.includes('--no-edit') ||
    (g.args.includes('--amend') && !msgs.length)
  ) {
    const r = run('git', ['log', '-1', '--format=%B'], { cwd });
    msgs.push(r.code === 0 ? r.stdout : '');
  }
  if (!msgs.length)
    return 'H5 commit message must be given with -m or -F so the Fleet-Role trailer can be checked';
  if (!trailer.test('\n' + msgs.join('\n')))
    return `H5 commit message has no ${want.trailer || 'Fleet-Role'}: trailer`;
  return null;
}

/** H8: every numeric floor in the old JSON stays present and not lower in the new JSON. */
export function floorsLowered(oldText, newText) {
  let oldJ;
  let newJ;
  try {
    oldJ = JSON.parse(oldText);
  } catch {
    return null; // no readable baseline: nothing to lower
  }
  try {
    newJ = JSON.parse(newText);
  } catch {
    return 'H8 new floors.json is not valid JSON, so the ratchet cannot be checked';
  }
  const flat = (o, p = '', acc = {}) => {
    if (typeof o === 'number') acc[p] = o;
    else if (o && typeof o === 'object')
      for (const [k, v] of Object.entries(o)) flat(v, p ? `${p}.${k}` : k, acc);
    return acc;
  };
  const a = flat(oldJ);
  const b = flat(newJ);
  for (const [k, v] of Object.entries(a)) {
    if (!(k in b)) return `H8 floor ${k} (${v}) removed`;
    if (b[k] < v) return `H8 floor ${k} lowered from ${v} to ${b[k]}`;
  }
  return null;
}

function applyEdits(cur, ti) {
  const edits = Array.isArray(ti.edits) ? ti.edits : [ti];
  let text = cur;
  for (const e of edits) {
    if (typeof e.old_string !== 'string') continue;
    text = e.replace_all
      ? text.split(e.old_string).join(e.new_string ?? '')
      : text.replace(e.old_string, () => e.new_string ?? '');
  }
  return text;
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
      return { rel: rel.split(path.sep).join('/'), abs };
  }
  return { rel: abs.split(path.sep).join('/'), abs };
}

function newContent(ti) {
  if (typeof ti.content === 'string') return ti.content;
  if (typeof ti.new_source === 'string') return ti.new_source;
  if (Array.isArray(ti.edits))
    return ti.edits.map(e => e.new_string ?? '').join('\n');
  return typeof ti.new_string === 'string' ? ti.new_string : '';
}

export async function decide(input, env = process.env) {
  const root = projectRoot(input);
  const cwd = input.cwd && existsSync(input.cwd) ? input.cwd : root;
  const pol = JSON.parse(
    readFileSync(path.join(root, 'scripts/fleet/policy.json'), 'utf8')
  );
  const { evaluate } = await import(
    pathToFileURL(path.join(root, 'scripts/fleet/guard.mjs')).href
  );
  const role = env.SYNTHEX_FLEET_ROLE || 'builder';
  const protectedChange =
    role === 'orchestrator' && Boolean(env.SYNTHEX_PROTECTED_CHANGE);
  const tool = String(input.tool_name || '');
  const ti = input.tool_input || {};
  const halted = haltFiles(root, pol);

  const checkFile = (file, kind) => {
    const { rel } = repoPath(file, cwd, root);
    if (ENV_FILE.test(rel) && !ENV_PLACEHOLDERS.test(rel))
      return `H6 ${kind} of secrets file ${rel}`;
    if (SECRET_STORE.test(rel)) return `H6 ${kind} of home secret store ${rel}`;
    if (kind === 'read') return null;
    const r = evaluate(
      { kind: 'write', path: rel, role, protected_change: protectedChange },
      pol
    );
    return r.decision === 'deny' ? `H3 ${r.reason} (role ${role})` : null;
  };

  // H13: builders hold no untrusted-content channel (spec D6 role split).
  if (
    env.SYNTHEX_FLEET_ROLE === 'builder' &&
    (/^(WebFetch|WebSearch)$/.test(tool) ||
      /^mcp__.*(fetch|scrape|crawl|search|browser|navigate)/i.test(tool))
  )
    return `H13 role builder holds no web channel (${tool}); a reader fetches and returns JSON`;

  if (READ_TOOLS.has(tool)) {
    const f = ti.file_path || ti.path;
    return tool === 'Read' && f ? checkFile(f, 'read') : null;
  }
  if (halted.length && tool !== 'Bash')
    return `H9 fleet halted (${halted.join(', ')}): only reads are allowed`;

  if (FILE_TOOLS.has(tool)) {
    const file = ti.file_path || ti.notebook_path;
    if (!file) return 'file tool call without a path';
    const why = checkFile(file, 'write');
    if (why) return why;
    const secret = findSecret(newContent(ti));
    if (secret) return `H6 new content holds a secret pattern (${secret})`;
    const { rel, abs } = repoPath(file, cwd, root);
    if (FLOORS.test(rel)) {
      const cur = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
      const next =
        tool === 'Write' ? String(ti.content ?? '') : applyEdits(cur, ti);
      const low = cur ? floorsLowered(cur, next) : null;
      if (low) return low;
    }
    return null;
  }

  if (tool === 'Bash') {
    const cmd = String(ti.command || '');
    const { rest, bodies } = splitHeredocs(cmd);
    const bare = rest.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, '""');
    const segs = segments(rest);
    if (halted.length) {
      for (const seg of segs) {
        const { words } = command(seg);
        const bin = path.basename(words[0] || '');
        const ok =
          READ_ONLY_BIN.has(bin) ||
          (bin === 'git' && READ_ONLY_GIT.has(gitParts(words).sub));
        if (!ok || seg.some(w => /^\d*>/.test(w)))
          return `H9 fleet halted (${halted.join(', ')}): only read-only commands are allowed`;
      }
    }
    for (const [re, why] of SESSION_DENY) if (re.test(bare)) return why;
    const secret = findSecret(cmd);
    if (secret) return `H6 command holds a secret pattern (${secret})`;
    for (const seg of segs) {
      const { words, assigns } = command(seg);
      for (const w of seg)
        if (
          !w.startsWith('-') &&
          (ENV_FILE.test(w) || /[=:]\.env(\.|$)/.test(w)) &&
          !ENV_PLACEHOLDERS.test(w)
        )
          return `H6 command names secrets file ${w}`;
        else if (SECRET_STORE.test(w))
          return `H6 command names home secret store ${w}`;
      for (const k of ['DATABASE_URL', 'DIRECT_URL'])
        if (assigns[k] !== undefined) {
          let host = '';
          try {
            host = new URL(assigns[k]).hostname;
          } catch {
            host = '';
          }
          if (!LOCAL_DB_HOST.test(host))
            return `H7 non-local ${k} (${host || 'unparseable'})`;
        }
      if (path.basename(words[0] || '') === 'git') {
        const g = gitParts(words);
        if (g.sub === 'push') {
          const why = checkPush(g, cwd);
          if (why) return why;
        }
        if (g.sub === 'commit') {
          const why = checkCommit(g, assigns, bodies, cwd, pol, env);
          if (why) return why;
        }
      }
    }
    const r = evaluate({ kind: 'shell', command: rest, role }, pol);
    if (r.decision === 'deny') return `${r.reason} (role ${role})`;
    for (const t of bashWriteTargets(cmd)) {
      if (FLOORS.test(t))
        return `H8 floors.json changed through Bash cannot be ratchet-checked; use Edit or Write`;
      const why = checkFile(t, 'write');
      if (why) return `${why} via Bash`;
    }
    return null;
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
