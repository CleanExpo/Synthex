#!/usr/bin/env node
/**
 * scripts/fleet/fanout.mjs — Cloudroom fan-out (FD-1). One child thread per unit, each in its
 * own sandbox, each on its own git branch fleet-unit/<phase>/<unit>. The orchestrator never
 * trusts a child's report: it fetches the branch, runs the guard over the changed files, scans
 * the diff for secrets and re-runs the gate on the integrated tree (fabel-evidence-standard).
 *
 * Exports: spawnUnit, waitForUnits, unitPrompt. CLI: --phase P<n> --units <units.json> [--concurrency 8]
 */
import { policy, run, ROOT, ledgerAppend, tryGit, isMain } from './lib.mjs';
import { readFileSync } from 'node:fs';
const pol = policy();

export function unitPrompt({ phase, unit, branch, phaseBranch }) {
  return [
    `You are a BUILDER in the Synthex fleet, phase ${phase}, unit ${unit.id}. Role rules (scripts/fleet/policy.json roles.builder): edit only inside this sandbox; run npm scripts and tests; never install packages, never run gh, never touch a protected path (scripts/fleet/policy.json protected_paths), never read or write .env* or secret stores, never publish, never spend.`,
    `Spec: docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md. Decisions: DECISIONS.md. Evidence rule: .claude/rules/fabel-evidence-standard.md (tag every claim; your "tests pass" is UNCONFIRMED until the orchestrator re-runs it).`,
    `SETUP (your sandbox is separate from the orchestrator's; share work only through Git): export PATH=$HOME/node22/bin:$PATH if that directory exists, else install Node 22 into $HOME/node22 from nodejs.org for your architecture. Then: test -d /code/Synthex/.git || git clone https://github.com/CleanExpo/Synthex.git /code/Synthex; cd /code/Synthex; git fetch origin; git checkout -q -B ${phaseBranch} origin/${phaseBranch}; npm ci --legacy-peer-deps; npx prisma generate. Work only inside /code/Synthex.`,
    `TASK: ${unit.task}`,
    unit.inputs?.length
      ? `FILES IN SCOPE (at most ${pol.fanout.files_per_builder}): ${unit.inputs.join(', ')}`
      : '',
    `PROVING COMMAND (must exit 0 before you finish): ${unit.proving_command}`,
    `METHOD (skill .claude/skills/tdd-jev/SKILL.md; read it first): red before green — write the failing test at the public seam first, then the minimal change; no tautological or implementation-coupled tests; no workarounds or one-off hacks that bypass an established process (fix the convention instead); on a second attempt start by building a tight feedback loop that goes red on the exact failure, redact every secret from anything you quote, and never claim PASS without the proving command's own exit 0.`,
    `Also run: npm run type-check && npm run lint && npm test -- --findRelatedTests <changed files> (or the full suite if quick).`,
    `GIT: commit on branch ${branch} (create it from your current HEAD: git checkout -B ${branch}) with committer "Synthex Fleet <fleet@synthex.local>" (git -c user.name='Synthex Fleet' -c user.email=fleet@synthex.local commit ...). Commit message ends with trailers:\nFleet-Role: builder\nFleet-Unit: ${unit.id}\nThen push: git push -u origin ${branch}. Do NOT open a PR, do NOT push to ${phaseBranch} or main.`,
    `FINISH: your final message must be exactly one line: UNIT-DONE ${unit.id} <full commit sha> <state> where state is PASS, FAIL or INCONCLUSIVE (INCONCLUSIVE when the proving command could not run). Never claim PASS without the proving command's exit 0 in your transcript. If you cannot complete after two honest attempts, report FAIL with one line of cause.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function spawnUnit({ phase, unit, phaseBranch, model }) {
  const branch = `fleet-unit/${phase.toLowerCase()}/${unit.id}`;
  const prompt = unitPrompt({ phase, unit, branch, phaseBranch });
  const r = run(
    'room-cli',
    [
      'thread',
      'spawn',
      '--provider',
      'claude-code',
      '--model',
      model || pol.models.builder,
      '--title',
      `fleet ${phase} ${unit.id}`,
      '--prompt',
      prompt,
    ],
    { timeout: 120000 }
  );
  let id = null;
  try {
    id = JSON.parse(r.stdout.trim().split('\n').pop()).id;
  } catch {}
  ledgerAppend({
    kind: 'unit',
    phase,
    unit: unit.id,
    thread: id,
    branch,
    state: id ? 'STARTED' : 'INCONCLUSIVE',
    detail: id ? undefined : (r.stderr || r.stdout).slice(0, 200),
  });
  return { id, branch, unit };
}

export function pollUnit(threadId) {
  const r = run('room-cli', ['thread', 'output', threadId], { timeout: 60000 });
  const text = r.stdout + r.stderr;
  const m =
    /UNIT-DONE\s+(\S+)\s+([0-9a-f]{7,40})\s+(PASS|FAIL|INCONCLUSIVE)/.exec(
      text
    );
  const list = run('room-cli', ['thread', 'list'], { timeout: 60000 });
  let status = null;
  try {
    const j = JSON.parse(list.stdout);
    const c = (j.children || []).find(x => x.id === threadId);
    status = c ? c.status || c.state || null : null;
  } catch {}
  if (m) return { done: true, unit: m[1], sha: m[2], state: m[3], status };
  if (
    status &&
    /(finished|completed|done|stopped|archived|error|failed)/i.test(
      String(status)
    )
  )
    return {
      done: true,
      unit: null,
      sha: null,
      state: 'INCONCLUSIVE',
      status,
      detail: 'thread ended without UNIT-DONE line',
    };
  return { done: false, status };
}

export async function waitForUnits(
  started,
  { intervalMs = 60000, timeoutMs = 3 * 3600 * 1000 } = {}
) {
  const t0 = Date.now();
  const results = {};
  while (
    Object.keys(results).length < started.length &&
    Date.now() - t0 < timeoutMs
  ) {
    for (const s of started) {
      if (results[s.unit.id] || !s.id) continue;
      const p = pollUnit(s.id);
      if (p.done) {
        results[s.unit.id] = { ...p, branch: s.branch, thread: s.id };
        ledgerAppend({
          kind: 'unit',
          phase: s.phase,
          unit: s.unit.id,
          thread: s.id,
          state: p.state,
          sha: p.sha,
        });
      }
    }
    for (const s of started)
      if (!s.id && !results[s.unit.id])
        results[s.unit.id] = {
          done: true,
          state: 'INCONCLUSIVE',
          detail: 'spawn failed',
        };
    if (Object.keys(results).length < started.length)
      await new Promise(r => setTimeout(r, intervalMs));
  }
  for (const s of started)
    if (!results[s.unit.id])
      results[s.unit.id] = {
        done: false,
        state: 'INCONCLUSIVE',
        detail: 'timeout',
      };
  return results;
}

if (isMain(import.meta.url)) {
  const a = process.argv.slice(2);
  const opt = (k, d) => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : d;
  };
  const phase = opt('--phase');
  const units = JSON.parse(readFileSync(opt('--units'), 'utf8'));
  const ph = pol.phases.find(p => p.id === phase);
  if (!ph) {
    console.error('unknown phase');
    process.exit(2);
  }
  const phaseBranch = `feature/fleet-${ph.id.toLowerCase()}-${ph.slug}`;
  const conc = Number(opt('--concurrency', pol.fanout.concurrency));
  const started = [];
  for (let i = 0; i < units.length; i += conc) {
    const batch = units
      .slice(i, i + conc)
      .map(u => ({ ...spawnUnit({ phase, unit: u, phaseBranch }), phase }));
    started.push(...batch);
    const res = await waitForUnits(batch);
    console.log(JSON.stringify(res));
  }
}
