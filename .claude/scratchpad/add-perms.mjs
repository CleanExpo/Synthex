#!/usr/bin/env node
// Adds `permissions: read-all` to each workflow that lacks a top-level permissions block.
// Inserts immediately before the first top-level `jobs:` line.
import { readFileSync, writeFileSync } from 'node:fs';

const files = [
  '.github/workflows/accuracy-gate.yml',
  '.github/workflows/agent-pr-checks.yml',
  '.github/workflows/brand-intelligence-cron.yml',
  '.github/workflows/ci.yml',
  '.github/workflows/client-value-scorecard.yml',
  '.github/workflows/dependency-check.yml',
  '.github/workflows/deploy.yml',
  '.github/workflows/lighthouse.yml',
  '.github/workflows/security.yml',
];

let modified = 0;
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  // Skip if a top-level permissions: block already exists
  if (/^permissions\s*:/m.test(content)) {
    console.log(`SKIP (already has permissions): ${file}`);
    continue;
  }
  // Find first top-level `jobs:` line (no leading whitespace)
  const lines = content.split('\n');
  const jobsIdx = lines.findIndex(l => /^jobs\s*:\s*$/.test(l));
  if (jobsIdx === -1) {
    console.log(`SKIP (no jobs: line found): ${file}`);
    continue;
  }
  // Insert before jobs: line
  lines.splice(
    jobsIdx,
    0,
    '# Default least-privilege permissions; jobs override at job level when needed.',
    'permissions: read-all',
    ''
  );
  writeFileSync(file, lines.join('\n'));
  console.log(`✓ ${file}`);
  modified++;
}
console.log(`\n${modified}/${files.length} workflows updated`);
