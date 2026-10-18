#!/usr/bin/env node
/**
 * tools/claude-hooks/install.mjs — merge synthex-hooks into .claude/settings.json.
 *
 *   node tools/claude-hooks/install.mjs --print [--forcing]   print the merged settings, write nothing
 *   node tools/claude-hooks/install.mjs --write --core        write existing settings + "core"
 *   node tools/claude-hooks/install.mjs --write --forcing     also "forcing"; refused unless
 *                                                             SYNTHEX_FOUNDER_STOP_HOOK_APPROVED=1
 *
 * Existing hooks and groups are kept exactly as they are; pack groups are appended, minus any
 * handler already registered for the same event and matcher (a second run is a no-op). The only file
 * this writes is <project>/.claude/settings.json, a protected path (plus the H10 marker in the temp
 * dir that lets config-change.mjs accept exactly that content mid-session); commit it with
 * Fleet-Role: orchestrator and Protected-Change trailers (policy protected_exemptions).
 * Exit 0 ok, 2 usage, 3 refused.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

/** H10: temp-dir marker naming the sha256 of the settings content this installer wrote. */
export function installMarkerPath(root) {
  const id = createHash('sha256')
    .update(path.resolve(root))
    .digest('hex')
    .slice(0, 16);
  return path.join(tmpdir(), `synthex-hook-install-${id}.json`);
}

export function mergeHooks(existing = {}, add = {}) {
  const out = JSON.parse(JSON.stringify(existing));
  for (const [event, groups] of Object.entries(add)) {
    const list = (out[event] = out[event] || []);
    for (const g of groups) {
      // Existing groups are never edited; a handler already registered for this event and
      // matcher is not added again, so a second run is a no-op.
      const have = list
        .filter(x => (x.matcher || '') === (g.matcher || ''))
        .flatMap(x => x.hooks.map(stable));
      const hooks = g.hooks.filter(h => !have.includes(stable(h)));
      if (hooks.length) list.push(JSON.parse(JSON.stringify({ ...g, hooks })));
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
    writeFileSync(
      installMarkerPath(root),
      JSON.stringify({
        sha256: createHash('sha256').update(out).digest('hex'),
        ts: Date.now(),
      })
    );
    writeFileSync(path.join(root, '.claude/settings.json'), out);
    process.stderr.write(`wrote ${path.join(root, '.claude/settings.json')}\n`);
  }
}
