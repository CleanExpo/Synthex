#!/usr/bin/env node
/** Read-only freshness inventory. Does NOT change, retimestamp or automatically label documents. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ACTIVE_ENTRYPOINT =
  /^(CLAUDE\.md|DECISIONS\.md|README\.md|docs\/(architecture|governance|context)\/|\.cursor\/rules\/|\.claude\/(rules|skills)\/)/;
export const LEGACY_MODEL =
  /\b(Composer\s*2\.5|Claude\s*(?:3(?:\.\d)?|4(?:\.\d)?)\b|GPT[- ](?:4(?:\.\d)?|5(?:\.\d)?)\b)\b/i;
export const DATED_REFERENCE =
  /\b(?:20(?:23|24|25)|2026)[-\/]\d{2}[-\/]\d{2}\b/;
export function classify(file, content) {
  const active = ACTIVE_ENTRYPOINT.test(file);
  const legacyModel = LEGACY_MODEL.test(content);
  const datedReference = DATED_REFERENCE.test(content);
  // A finding is a review prompt, NOT a factual stale verdict.
  const reason = [];
  if (legacyModel && active)
    reason.push('legacy-model-reference-needs-manual-verification');
  if (active && datedReference) reason.push('dated-active-reference-review');
  if (file === 'docs/STRATEGIC_MARKETING_ARCHITECTURE.md')
    reason.push('historical-marketing-architecture-check-supersession');
  return { active, legacyModel, datedReference, reason };
}
export function summarise(items) {
  const byRoot = {};
  for (const item of items) {
    const key = item.path.startsWith('.')
      ? item.path.split('/')[0]
      : item.path.split('/')[0];
    byRoot[key] = (byRoot[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(byRoot).sort((a, b) => b[1] - a[1]));
}
export function inventory(repo) {
  const raw = execFileSync('git', ['ls-files', '-z', '--', '*.md', '*.mdc'], {
    cwd: repo,
  });
  const names = raw.toString('utf8').split('\0').filter(Boolean);
  const items = [];
  for (const filename of names) {
    if (!filename.endsWith('.md') && !filename.endsWith('.mdc')) continue;
    let data;
    try {
      data = readFileSync(path.join(repo, filename));
    } catch {
      continue;
    } // deleted working-tree item, separately visible via git status
    const content = data.toString('utf8');
    const info = classify(filename, content);
    items.push({
      path: filename,
      bytes: data.length,
      sha256_12: createHash('sha256').update(data).digest('hex').slice(0, 12),
      ...info,
    });
  }
  return items;
}
export function buildReport(items, revision) {
  return {
    schema: 'ug-markdown-inventory/0.1',
    revision,
    generatedAt: new Date().toISOString(),
    warning:
      'Heuristic inventory. Dates or legacy names are not proof of stale guidance. No files modified.',
    counts: {
      trackedReadable: items.length,
      activeEntrypoints: items.filter(x => x.active).length,
      reviewCandidates: items.filter(x => x.reason.length).length,
      byRoot: summarise(items),
    },
    review: items
      .filter(x => x.reason.length)
      .map(({ path, reason, sha256_12 }) => ({ path, reason, sha256_12 })),
  };
}
function main() {
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim();
  const idx = process.argv.indexOf('--out');
  const output = idx >= 0 ? process.argv[idx + 1] : null;
  if (idx >= 0 && !output) throw new Error('--out requires a filepath');
  const report = buildReport(inventory(repo), revision);
  if (output) {
    const filepath = path.resolve(output);
    mkdirSync(path.dirname(filepath), { recursive: true });
    writeFileSync(filepath, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(
    JSON.stringify(
      { counts: report.counts, output: output ? path.resolve(output) : null },
      null,
      2
    )
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
