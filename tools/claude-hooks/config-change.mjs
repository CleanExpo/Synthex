#!/usr/bin/env node
/**
 * tools/claude-hooks/config-change.mjs — H10 ConfigChange: block mid-session changes to project
 * and local settings and to skill files (hooks reference, "ConfigChange decision control":
 * {"decision":"block"} keeps the new settings out of the running session; policy_settings
 * cannot be blocked and is never matched).
 *
 * Allowed only when SYNTHEX_HOOK_INSTALL=1 is in Claude Code's environment, or when
 * tools/claude-hooks/install.mjs --write has just written exactly this file content (a marker
 * in the temp dir holds the sha256 of what it wrote, valid for 5 minutes).
 * Any internal error exits 1, which with "onFailure":"block" blocks the change.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { emit, projectRoot, readInput } from './lib.mjs';
import { installMarkerPath } from './install.mjs';

const GUARDED = new Set(['project_settings', 'local_settings', 'skills']);

export function decideConfig(input, env = process.env) {
  if (!GUARDED.has(input.source)) return null;
  if (env.SYNTHEX_HOOK_INSTALL === '1') return null;
  const marker = installMarkerPath(projectRoot(input));
  if (
    input.source === 'project_settings' &&
    input.file_path &&
    existsSync(marker)
  ) {
    const m = JSON.parse(readFileSync(marker, 'utf8'));
    const sha = createHash('sha256')
      .update(readFileSync(input.file_path))
      .digest('hex');
    if (m.sha256 === sha && Date.now() - m.ts < 5 * 60 * 1000) return null;
  }
  return `H10 ${input.source} changed mid-session (${input.file_path || 'unknown file'}); settings and skills change only through the reviewed installer (tools/claude-hooks/install.mjs) or with SYNTHEX_HOOK_INSTALL=1`;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const why = decideConfig(readInput());
    if (why) emit({ decision: 'block', reason: why });
    process.exit(0);
  } catch (e) {
    process.stderr.write(`synthex-hooks config-change failed: ${e.message}\n`);
    process.exit(1);
  }
}
