#!/usr/bin/env node
/**
 * tools/claude-hooks/check-unit-done.mjs — H12 on Stop, SubagentStop and TaskCompleted.
 *
 * A "UNIT-DONE <unit> <sha> <PASS|FAIL|INCONCLUSIVE>" line is accepted only when the sha is on
 * origin (git fetch, then git branch -r --contains) and the working tree is clean (the
 * hook-written fleet ledger excepted). Text read: last_assistant_message (Stop, SubagentStop),
 * task_subject and task_description (TaskCompleted). No UNIT-DONE line: silent, exit 0.
 *
 * Block forms (hooks reference): Stop/SubagentStop {"decision":"block","reason":...};
 * TaskCompleted exit 2 with the reason on stderr. When stop_hook_active is true the stop is let
 * through with a systemMessage warning instead (anti-loop; the 8-continuation cap is the backstop).
 * A fetch that fails is reported as "cannot verify", never as verified.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { emit, projectRoot, readInput, run } from './lib.mjs';
import { ledgerFile } from './permission-denied.mjs';

const LINE =
  /UNIT-DONE\s+(\S+)\s+([0-9a-f]{7,40})\s+(PASS|FAIL|INCONCLUSIVE)\b/;

export function verifyUnitDone(input, env = process.env) {
  const text =
    input.hook_event_name === 'TaskCompleted'
      ? `${input.task_subject || ''}\n${input.task_description || ''}`
      : String(input.last_assistant_message || '');
  const m = LINE.exec(text);
  if (!m) return null;
  const [, unit, sha] = m;
  const root = projectRoot(input);
  const cwd = input.cwd || root;
  const problems = [];
  if (env.SYNTHEX_HOOKS_NO_FETCH !== '1') {
    const f = run('git', ['fetch', '-q', 'origin'], { cwd, timeout: 30000 });
    if (f.code !== 0)
      problems.push(
        `cannot verify: git fetch origin failed (${(f.stderr || f.error || 'timeout').split('\n')[0]})`
      );
  }
  const c = run('git', ['branch', '-r', '--contains', sha], { cwd });
  if (c.code !== 0 || !c.stdout)
    problems.push(`sha ${sha} is not on any origin branch`);
  const st = run('git', ['status', '--porcelain'], { cwd });
  // --porcelain paths are relative to the repository root, whatever the cwd.
  const top = run('git', ['rev-parse', '--show-toplevel'], { cwd });
  const ledger = path
    .relative(top.code === 0 ? top.stdout : root, ledgerFile(root))
    .split(path.sep)
    .join('/');
  // run() trims stdout, so the first porcelain line can lose its leading status space.
  const file = l => l.trim().replace(/^\S+\s+/, '');
  const dirty = st.stdout
    .split('\n')
    .filter(l => l.trim() && file(l) !== ledger);
  if (st.code !== 0) problems.push('cannot verify: git status failed');
  else if (dirty.length)
    problems.push(
      `working tree not clean (${dirty
        .slice(0, 3)
        .map(file)
        .join(', ')}${dirty.length > 3 ? ', ...' : ''})`
    );
  return problems.length
    ? `H12 UNIT-DONE ${unit} ${sha} not accepted: ${problems.join('; ')}`
    : null;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let input = {};
  try {
    input = readInput();
  } catch (e) {
    process.stderr.write(
      `synthex-hooks check-unit-done: bad input ${e.message}\n`
    );
    process.exit(1);
  }
  const why = verifyUnitDone(input);
  if (!why) process.exit(0);
  if (input.hook_event_name === 'TaskCompleted') {
    process.stderr.write(why + '\n');
    process.exit(2);
  }
  if (input.stop_hook_active)
    emit({ systemMessage: `${why} (stop allowed: stop_hook_active)` });
  else emit({ decision: 'block', reason: why });
  process.exit(0);
}
