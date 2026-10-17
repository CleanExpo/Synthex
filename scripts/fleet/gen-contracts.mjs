#!/usr/bin/env node
/**
 * scripts/fleet/gen-contracts.mjs [--check]
 * Derives one Done contract per phase from policy.json's phase table into
 * scripts/fleet/contracts/<phase>.json (protected). run-phase.mjs feeds the phase's
 * contract into donectl on the phase branch and locks it, so no phase writes its own.
 * --check exits 1 when a derived file differs from the committed one (drift).
 */
import { policy, readJson, writeJson, ROOT, sha256 } from './lib.mjs';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
const pol = policy();
const NODE = process.execPath;
export function derive(ph) {
  return {
    schema: 'synthex-phase-contract/1',
    phase: ph.id,
    slug: ph.slug,
    closes: ph.closes,
    rollback: ph.rollback,
    branch: `feature/fleet-${ph.id.toLowerCase()}-${ph.slug}`,
    criteria: ph.dod.map((cmd, i) => ({
      id: `${ph.id}-C${i + 1}`,
      statement: `${cmd} exits 0 on the integrated tree in a fresh context`,
      recipe: cmd
        .replace(/^node /, '$NODE ')
        .replace(/^npm /, '$NODE_DIR/npm ')
        .replace(/^npx /, '$NODE_DIR/npx '),
      timeout: 3600,
    })),
    cumulative_gate: [
      '$NODE_DIR/npm run type-check',
      '$NODE_DIR/npm run lint',
      '$NODE_DIR/npm test',
      '$NODE_DIR/npx prisma validate',
      '$NODE scripts/fleet/verify-protected.mjs --base origin/main',
    ],
  };
}
const check = process.argv.includes('--check');
let drift = 0;
for (const ph of pol.phases) {
  const f = `scripts/fleet/contracts/${ph.id}.json`;
  const d = derive(ph);
  // $NODE and $NODE_DIR are substituted by run-phase.mjs at use time, so the file is host-independent.
  if (check) {
    if (!existsSync(path.join(ROOT, f))) {
      console.log(`FAIL gen-contracts: ${f} missing`);
      drift++;
      continue;
    }
    const cur = readJson(f);
    if (JSON.stringify(cur) !== JSON.stringify(d)) {
      console.log(`FAIL gen-contracts: ${f} drifts from policy`);
      drift++;
    } else console.log(`PASS gen-contracts: ${f}`);
  } else {
    writeJson(f, d);
    console.log(`wrote ${f}`);
  }
}
if (check) {
  console.log(`gen-contracts: ${pol.phases.length} contracts, ${drift} drift`);
  process.exit(drift ? 1 : 0);
}
