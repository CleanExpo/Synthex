#!/usr/bin/env node
/**
 * tools/claude-hooks/context-userprompt.mjs — UserPromptSubmit: inject the goal check Summary line.
 *
 * When scripts/goals/check-report.mjs exists, runs it with --offline (20 s timeout) and injects only
 * its Summary line as additionalContext (hooks reference, "UserPromptSubmit decision control").
 * When the script is absent, prints nothing. When it exists but yields no Summary line (crash,
 * timeout), injects an INCONCLUSIVE line instead, so a failed read never looks like silence.
 * Never blocks the prompt; always exits 0.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { emit, projectRoot, readInput, run } from './lib.mjs';

export function summaryContext(root) {
  const script = path.join(root, 'scripts/goals/check-report.mjs');
  if (!existsSync(script)) return null;
  const r = run(process.execPath, [script, '--offline'], {
    cwd: root,
    timeout: 20000,
  });
  const line = `${r.stdout}\n${r.stderr}`
    .split('\n')
    .find(l => /^\W*Summary\b/i.test(l.trim()));
  if (line)
    return `Goal check (scripts/goals/check-report.mjs --offline): ${line.trim()}`;
  return `Goal check (scripts/goals/check-report.mjs --offline): INCONCLUSIVE, no Summary line (exit ${r.code}${r.code === 124 ? ', timed out or did not start' : ''})`;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const ctx = summaryContext(projectRoot(readInput()));
    if (ctx)
      emit({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: ctx,
        },
      });
  } catch (e) {
    process.stderr.write(`synthex-hooks userprompt: ${e.message}\n`);
  }
  process.exit(0);
}
