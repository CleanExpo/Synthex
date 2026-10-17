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
import { policy, isProtected } from './lib.mjs';
import { readFileSync } from 'node:fs';

export function evaluate(action, pol = policy()) {
  const role = action.role || 'builder';
  const deny = reason => ({ decision: 'deny', reason, action });
  const allow = reason => ({ decision: 'allow', reason, action });
  if (!action || typeof action !== 'object' || !action.kind)
    return { decision: 'deny', reason: 'malformed action', action };
  switch (action.kind) {
    case 'write':
    case 'edit':
    case 'delete': {
      if (!action.path) return deny('write without path');
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
      const cmd = String(action.command || '');
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

if (import.meta.url === `file://${process.argv[1]}`) {
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
