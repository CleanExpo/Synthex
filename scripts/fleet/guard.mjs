#!/usr/bin/env node
/**
 * scripts/fleet/guard.mjs — policy evaluator for planted and real actions.
 *
 * Under the Cloudroom substrate (DECISIONS.md FD-1) there is no PreToolUse hook
 * between a child thread and its own sandbox. Enforcement therefore sits at
 * integration: verify-protected.mjs runs this evaluator over every file a unit
 * changed, and run-phase.mjs runs it over each child's reported tool log before a
 * unit's diff may be integrated. selftest.mjs fires the 12 planted forbidden
 * actions and 3 benign ones through it (spec P0).
 *
 * Usage: node scripts/fleet/guard.mjs --json '{"kind":"write","path":"CLAUDE.md","role":"builder"}'
 *        node scripts/fleet/guard.mjs --file actions.jsonl   (one action per line)
 * Exit 0 = every action allowed, 1 = at least one denied, 2 = malformed.
 */
import { policy, isProtected, isMain } from './lib.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Shell commands as argv segments: split on shell separators and command substitution, then on
// quote-aware whitespace. Each segment's argv0 is reduced to its basename, so /usr/bin/git is git.
export function segments(cmd) {
  return String(cmd)
    .split(/;|&&|\|\||\||&|\n|\$\(|`|\)/)
    .map(seg => {
      const argv = [];
      let cur = '';
      let q = null;
      for (const ch of seg) {
        if (q) {
          if (ch === q) q = null;
          else cur += ch;
        } else if (ch === '"' || ch === "'") q = ch;
        else if (/\s/.test(ch)) {
          if (cur) argv.push(cur);
          cur = '';
        } else cur += ch;
      }
      if (cur) argv.push(cur);
      while (argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0]))
        argv.shift(); // env prefixes
      if (argv.length) argv[0] = argv[0].split('/').pop();
      return argv;
    })
    .filter(a => a.length);
}
// git's global options before the subcommand (-C <dir>, -c <k=v>, --git-dir, --work-tree, ...).
function gitSubcommand(argv) {
  let i = 1;
  while (i < argv.length && argv[i].startsWith('-')) {
    if (
      ['-C', '-c', '--git-dir', '--work-tree', '--namespace'].includes(argv[i])
    )
      i += 2;
    else i += 1;
  }
  return { sub: argv[i], args: argv.slice(i + 1) };
}
const ROLES = [
  'orchestrator',
  'reader',
  'builder',
  'verifier',
  'judge',
  'releaser',
  'scheduler',
  'judge-runner',
];
export function evaluate(action, pol = policy()) {
  const deny = reason => ({ decision: 'deny', reason, action });
  const allow = reason => ({ decision: 'allow', reason, action });
  if (!action || typeof action !== 'object' || !action.kind)
    return { decision: 'deny', reason: 'malformed action', action };
  // Roles are matched case-insensitively and an unknown role is refused, never treated as allowed.
  const role = String(action.role || 'builder').toLowerCase();
  if (!ROLES.includes(role)) return deny(`unknown role ${action.role}`);
  switch (action.kind) {
    case 'write':
    case 'edit':
    case 'delete': {
      if (!action.path) return deny('write without path');
      // Normalise before any glob test: './scripts/fleet/policy.json' or 'lib/../scripts/…' used to
      // miss the protected globs (verifier audit). Absolute or escaping paths are outside the tree.
      const raw = String(action.path).replace(/\\/g, '/');
      const norm = path.posix.normalize(raw).replace(/^(\.\/)+/, '');
      if (
        path.posix.isAbsolute(norm) ||
        norm === '..' ||
        norm.startsWith('../')
      )
        return deny('write outside worktree (absolute or escaping path)');
      action = { ...action, path: norm };
      if (
        role === 'reader' ||
        role === 'verifier' ||
        role === 'judge' ||
        role === 'scheduler'
      )
        return deny(`${role} may not write`);
      if (/(^|\/)\.env(\.|$)/.test(action.path)) return deny('secrets file');
      if (
        /(^|\/)\.(ssh|aws|hermes|config\/gh)\//.test(action.path) ||
        /id_(rsa|ed25519)/.test(action.path)
      )
        return deny('home secret store');
      if (isProtected(action.path, pol)) {
        if (
          role === 'orchestrator' &&
          (action.bootstrap === true || action.protected_change === true)
        )
          return allow('bootstrap exemption (policy absent at base)');
        if (
          role === 'releaser' &&
          /^release-receipts\/P-?\d+\.json$/.test(action.path) &&
          action.via === 'verify-receipt --write'
        )
          return allow('receipt via protected script');
        if (
          /^release-receipts\/(ledger|manifests)\//.test(action.path) &&
          (role === 'orchestrator' || role === 'releaser')
        )
          return allow('ledger row');
        return deny(`protected path ${action.path}`);
      }
      if (action.outside_worktree) return deny('write outside worktree');
      return allow('inside worktree, unprotected');
    }
    case 'shell': {
      // Whitespace-normalised, so 'git  push  --force' cannot slip past a substring rule.
      const cmd = String(action.command || '')
        .replace(/\s+/g, ' ')
        .trim();
      const words = cmd.split(/[\s;&|()]+/).filter(Boolean);
      if (role === 'reader' || role === 'judge')
        return deny(`${role} holds no shell`);
      // The one sanctioned merge path (FD-3): releaser through merge-phase.mjs. Checked before the
      // forbidden-substring loop so the exemption is reachable (independent review r1, B-3).
      if (/\bgh pr merge\b/.test(cmd)) {
        if (role === 'releaser' && action.via === 'merge-phase')
          return allow('gh pr merge via merge-phase (FD-3)');
        return deny('direct gh pr merge');
      }
      for (const f of pol.forbidden_commands)
        if (cmd.includes(f)) return deny(`forbidden command: ${f}`);
      // Argv-level rules: global options, a path to git, long and short flag forms (verifier
      // audit, second pass).
      for (const argv of segments(action.command || '')) {
        if (argv[0] === 'git') {
          const { sub: g, args } = gitSubcommand(argv);
          const flags = args.filter(a => a.startsWith('-'));
          const shortHas = c =>
            flags.some(a => /^-[a-zA-Z]+$/.test(a) && a.includes(c));
          if (g === 'push') {
            if (
              args.some(a => a.startsWith('+') || a.startsWith(':')) ||
              flags.some(a =>
                /^--(force|force-with-lease|force-if-includes|delete|mirror|no-verify)\b/.test(
                  a
                )
              ) ||
              shortHas('f') ||
              shortHas('d')
            )
              return deny('force, delete, mirror or unverified push');
          }
          if (
            g === 'commit' &&
            (flags.includes('--no-verify') || shortHas('n'))
          )
            return deny('commit without hooks (-n/--no-verify)');
          if (g === 'reset' && flags.includes('--hard'))
            return deny('git reset --hard');
          if (
            g === 'branch' &&
            (flags.includes('--delete') || shortHas('D') || shortHas('d'))
          )
            return deny('branch delete');
        }
        if (argv[0] === 'gh') {
          if (argv[1] === 'pr' && argv[2] === 'merge') {
            if (role === 'releaser' && action.via === 'merge-phase')
              return allow('gh pr merge via merge-phase (FD-3)');
            return deny('direct gh pr merge');
          }
          if (
            argv[1] === 'api' &&
            (argv.some(a => /\/pulls\/\d+\/merge\b/.test(a)) ||
              /mergePullRequest|enablePullRequestAutoMerge/i.test(cmd))
          )
            return deny('direct merge through gh api');
        }
      }
      // API and refspec equivalents of the forbidden merge, force-push and branch delete.
      if (/\bgh api\b/.test(cmd) && /\/pulls\/\d+\/merge\b/.test(cmd))
        return deny('direct merge through gh api');
      const pushAt = words.findIndex(
        (w, i) => w === 'push' && words[i - 1] === 'git'
      );
      if (pushAt >= 0) {
        const rest = words.slice(pushAt + 1);
        if (
          rest.some(
            w =>
              w.startsWith('+') ||
              w.startsWith(':') ||
              w.startsWith('--force') ||
              w === '--delete' ||
              w === '--mirror' ||
              (/^-[a-zA-Z]+$/.test(w) && /[fd]/.test(w))
          )
        )
          return deny('force, delete or mirror push');
      }
      if (
        role === 'builder' &&
        /\b(git push|gh |npm publish|vercel)\b/.test(cmd)
      )
        return deny('builder may not push, use gh, publish or deploy');
      if (
        role === 'builder' &&
        /\b(npm|pnpm|yarn)\s+(install|i|add)\b/.test(cmd) &&
        !/\bnpm ci\b/.test(cmd)
      )
        return deny('builder may not install');
      return allow('shell permitted for role');
    }
    case 'mcp': {
      const tool = String(action.tool || '').toLowerCase();
      for (const cls of pol.denied_mcp_tool_classes)
        if (tool.includes(cls)) return deny(`denied MCP tool class: ${cls}`);
      if (role === 'judge') return deny('judge runs no tools');
      return allow('mcp read tool');
    }
    case 'spend': {
      if (role !== 'orchestrator' && role !== 'judge-runner')
        return deny(`${role} may not spend`);
      if (
        typeof action.usd !== 'number' ||
        action.usd > pol.ceilings_usd.per_run
      )
        return deny('spend above per-run ceiling');
      return allow('spend under ceiling');
    }
    case 'publish':
      return deny('no fleet role may publish');
    default:
      return deny(`unknown action kind ${action.kind}`);
  }
}

if (isMain(import.meta.url)) {
  const a = process.argv.slice(2);
  let actions = [];
  const ji = a.indexOf('--json');
  const fi = a.indexOf('--file');
  try {
    if (ji >= 0) actions = [JSON.parse(a[ji + 1])];
    else if (fi >= 0)
      actions = readFileSync(a[fi + 1], 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l));
    else {
      console.error('usage: guard.mjs --json <action> | --file <jsonl>');
      process.exit(2);
    }
  } catch (e) {
    console.error('malformed:', e.message);
    process.exit(2);
  }
  let denied = 0;
  for (const act of actions) {
    const r = evaluate(act);
    if (r.decision === 'deny') denied++;
    console.log(JSON.stringify(r));
  }
  process.exit(denied ? 1 : 0);
}
