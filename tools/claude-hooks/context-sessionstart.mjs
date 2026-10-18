#!/usr/bin/env node
/**
 * tools/claude-hooks/context-sessionstart.mjs — SessionStart: inject the fleet state.
 *
 * Emits {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}
 * (hooks reference, "Add context for Claude"). Read-only: git fetch, git ls-tree, gh pr list.
 * A read that fails is reported as "unknown (...)", never as an empty list. Never blocks;
 * always exits 0. Output stays under ~1500 tokens (hard cap 5000 characters).
 *
 * Test seams: SYNTHEX_HOOKS_GH (gh binary), SYNTHEX_HOOKS_NO_FETCH=1 (skip git fetch).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { emit, projectRoot, readInput, run } from './lib.mjs';

const MAX_CHARS = 5000;

/** Open rows of the fleet block in BACKLOG.md: first cell is the id, last cell the status. */
export function openFleetRows(md, markers) {
  const s = md.indexOf(markers.begin);
  const e = md.indexOf(markers.end);
  if (s < 0 || e < s) return null;
  return md
    .slice(s + markers.begin.length, e)
    .split('\n')
    .filter(l => l.trim().startsWith('|') && !/^\|\s*-/.test(l.trim()))
    .map(l =>
      l
        .split('|')
        .slice(1, -1)
        .map(c => c.trim())
    )
    .filter(c => c.length > 1 && c[c.length - 1].toLowerCase() === 'open')
    .map(c => c.slice(0, 2).concat(c.length > 5 ? [c[5]] : []));
}

export function buildContext(root, env = process.env) {
  const git = args => run('git', args, { cwd: root, timeout: 15000 });
  const lines = [
    'Synthex fleet state (synthex-hooks SessionStart, read-only snapshot):',
  ];
  let pol = null;
  try {
    pol = JSON.parse(
      readFileSync(path.join(root, 'scripts/fleet/policy.json'), 'utf8')
    );
  } catch (e) {
    lines.push(
      `- policy: unknown (scripts/fleet/policy.json unreadable: ${e.message})`
    );
  }

  const br = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  lines.push(
    `- branch: ${br.code === 0 ? br.stdout : `unknown (${br.stderr || br.error})`}`
  );

  let fetchNote = 'fetched now';
  if (env.SYNTHEX_HOOKS_NO_FETCH === '1')
    fetchNote = 'not fetched, last local ref';
  else {
    const f = run('git', ['fetch', '-q', 'origin', 'main'], {
      cwd: root,
      timeout: 15000,
    });
    if (f.code !== 0)
      fetchNote = `fetch failed (${(f.stderr || f.error || 'timeout').split('\n')[0]}), last local ref`;
  }
  const main = git(['rev-parse', 'origin/main']);
  lines.push(
    `- origin/main: ${main.code === 0 ? main.stdout : 'unknown (no origin/main ref)'} (${fetchNote})`
  );

  let receipts = null;
  if (main.code === 0) {
    const ls = git([
      'ls-tree',
      '--name-only',
      'origin/main',
      'release-receipts/',
    ]);
    if (ls.code === 0)
      receipts = ls.stdout
        .split('\n')
        .map(f => path.basename(f))
        .filter(f => /^P-?\d+\.json$/.test(f));
  }
  lines.push(
    `- release receipts on origin/main: ${receipts === null ? 'unknown (ls-tree failed)' : receipts.length ? receipts.join(', ') : 'none present'}`
  );
  if (pol && receipts !== null) {
    const next = pol.phases.find(p => !receipts.includes(`${p.id}.json`));
    lines.push(
      `- next phase: ${next ? `${next.id} ${next.slug} (DoD: ${next.dod.join(' && ')})` : 'none, every phase has a receipt'}`
    );
  } else lines.push('- next phase: unknown');

  const gh = run(
    env.SYNTHEX_HOOKS_GH || 'gh',
    [
      'pr',
      'list',
      '--state',
      'open',
      '--limit',
      '100',
      '--json',
      'number,headRefName,title',
    ],
    {
      cwd: root,
      timeout: 15000,
    }
  );
  let prs;
  try {
    if (gh.code !== 0)
      throw new Error(
        (gh.stderr || gh.error || `exit ${gh.code}`).split('\n')[0]
      );
    const fleet = JSON.parse(gh.stdout).filter(p =>
      String(p.headRefName).startsWith('feature/fleet-')
    );
    prs = fleet.length
      ? fleet.map(p => `#${p.number} ${p.headRefName}`).join(', ')
      : 'none open';
  } catch (e) {
    prs = `unknown (gh failed: ${e.message})`;
  }
  lines.push(`- open feature/fleet-* PRs: ${prs}`);

  const haltDir = path.join(root, pol ? pol.halt_dir : 'release-receipts/halt');
  let halt;
  try {
    const files = existsSync(haltDir)
      ? readdirSync(haltDir).filter(f => f.startsWith('STOP'))
      : [];
    halt = files.length
      ? `HALTED: ${files.join(', ')}`
      : 'none in working tree';
  } catch (e) {
    halt = `unknown (${e.message})`;
  }
  let haltMain = 'unknown';
  if (main.code === 0) {
    const ls = git([
      'ls-tree',
      '--name-only',
      'origin/main',
      `${pol ? pol.halt_dir : 'release-receipts/halt'}/`,
    ]);
    if (ls.code === 0) {
      const f = ls.stdout
        .split('\n')
        .map(x => path.basename(x))
        .filter(x => x.startsWith('STOP'));
      haltMain = f.length ? `HALTED: ${f.join(', ')}` : 'none';
    }
  }
  lines.push(`- halt files: ${halt}; on origin/main: ${haltMain}`);

  let rows = null;
  try {
    rows = openFleetRows(
      readFileSync(path.join(root, 'BACKLOG.md'), 'utf8'),
      pol
        ? pol.backlog_markers
        : { begin: '<!-- fleet:begin -->', end: '<!-- fleet:end -->' }
    );
  } catch {
    rows = null;
  }
  if (rows === null)
    lines.push(
      '- BACKLOG fleet rows: unknown (BACKLOG.md or its fleet markers unreadable)'
    );
  else {
    lines.push(
      `- BACKLOG fleet rows open: ${rows.length}${rows.length ? '; top 5:' : ''}`
    );
    for (const r of rows.slice(0, 5)) lines.push(`  - ${r.join(' | ')}`);
  }
  lines.push(
    '- Build law: spec docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md as amended by ...-amendments.md, DECISIONS.md, scripts/fleet/policy.json. Founder-gated items stay open in DECISIONS.md.'
  );
  const text = lines.join('\n');
  return text.length > MAX_CHARS
    ? text.slice(0, MAX_CHARS - 20) + '\n[...truncated]'
    : text;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let input = {};
  try {
    input = readInput();
  } catch {
    input = {};
  }
  try {
    emit({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: buildContext(projectRoot(input)),
      },
    });
  } catch (e) {
    emit({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `Synthex fleet state: unknown (synthex-hooks SessionStart failed: ${e.message})`,
      },
    });
  }
  process.exit(0);
}
