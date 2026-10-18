#!/usr/bin/env node
/**
 * tools/claude-hooks/install.mjs — merge synthex-hooks into .claude/settings.json.
 *
 *   node tools/claude-hooks/install.mjs --print [--forcing]   print the merged settings, write nothing
 *   node tools/claude-hooks/install.mjs --write --core        write existing settings + "core"
 *   node tools/claude-hooks/install.mjs --write --forcing     also "forcing"; refused unless
 *                                                             SYNTHEX_FOUNDER_STOP_HOOK_APPROVED=1
 *
 * Existing hooks are kept in place; a matcher group already present (same matcher, same handlers)
 * is not added twice, and a handler already in a same-matcher group is not repeated. The only file
 * this ever writes is <project>/.claude/settings.json, a protected path: commit it with
 * Fleet-Role: orchestrator and Protected-Change trailers (policy protected_exemptions).
 * Exit 0 ok, 2 usage, 3 refused.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOOKS_DIR, projectRoot } from './lib.mjs';

const stable = v =>
  Array.isArray(v)
    ? `[${v.map(stable).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v)
          .sort()
          .map(k => `${JSON.stringify(k)}:${stable(v[k])}`)
          .join(',')}}`
      : JSON.stringify(v);

export function mergeHooks(existing = {}, add = {}) {
  const out = JSON.parse(JSON.stringify(existing));
  for (const [event, groups] of Object.entries(add)) {
    const list = (out[event] = out[event] || []);
    for (const g of groups) {
      if (list.some(x => stable(x) === stable(g))) continue;
      const same = list.find(x => (x.matcher || '') === (g.matcher || ''));
      if (same) {
        for (const h of g.hooks)
          if (!same.hooks.some(x => stable(x) === stable(h)))
            same.hooks.push(h);
      } else list.push(JSON.parse(JSON.stringify(g)));
    }
  }
  return out;
}

export function merged(root, { forcing = false } = {}) {
  const settings = JSON.parse(
    readFileSync(path.join(root, '.claude/settings.json'), 'utf8')
  );
  const pack = JSON.parse(
    readFileSync(path.join(HOOKS_DIR, 'hooks.settings.json'), 'utf8')
  );
  let hooks = mergeHooks(settings.hooks, pack.core);
  if (forcing) hooks = mergeHooks(hooks, pack.forcing);
  return { ...settings, hooks };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const a = new Set(process.argv.slice(2));
  const root = projectRoot();
  const forcing = a.has('--forcing');
  if (
    a.has('--print') === a.has('--write') ||
    (a.has('--write') && !a.has('--core') && !forcing)
  ) {
    process.stderr.write(
      'usage: install.mjs --print [--forcing] | --write --core | --write --forcing\n'
    );
    process.exit(2);
  }
  if (
    a.has('--write') &&
    forcing &&
    process.env.SYNTHEX_FOUNDER_STOP_HOOK_APPROVED !== '1'
  ) {
    process.stderr.write(
      "refused: the forcing Stop hook needs the founder's explicit Bash permission rule; set SYNTHEX_FOUNDER_STOP_HOOK_APPROVED=1 only after that approval exists (README, Founder gate)\n"
    );
    process.exit(3);
  }
  const out = JSON.stringify(merged(root, { forcing }), null, 2) + '\n';
  if (a.has('--print')) process.stdout.write(out);
  else {
    writeFileSync(path.join(root, '.claude/settings.json'), out);
    process.stderr.write(`wrote ${path.join(root, '.claude/settings.json')}\n`);
  }
}
