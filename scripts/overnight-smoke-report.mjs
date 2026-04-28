#!/usr/bin/env node
// Re-generate morning report from existing overnight-smoke-results.jsonl
// without waiting for the in-flight loop to finish.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SCRATCHPAD = resolve(REPO_ROOT, '.claude/scratchpad');
const RESULTS_FILE = resolve(SCRATCHPAD, 'overnight-smoke-results.jsonl');
const CLUSTERS_FILE = resolve(SCRATCHPAD, 'overnight-smoke-clusters.json');
const REPORT_FILE = resolve(SCRATCHPAD, 'morning-task-list.md');
const TARGET = 'https://synthex.social';

const raw = await readFile(RESULTS_FILE, 'utf-8');
const rows = raw
  .trim()
  .split('\n')
  .filter(Boolean)
  .map(l => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  })
  .filter(Boolean);
const fails = rows.filter(r => r.status === 'FAIL');
const meta = rows.find(r => r.layer === 'meta' && r.check === 'started');
const ITERATIONS = meta?.iterations || 100;
const lastIter = Math.max(
  ...rows
    .filter(r => typeof r.iter === 'number' && r.iter > 0)
    .map(r => r.iter),
  0
);
const total = rows.length;
const totalFail = fails.length;
const passRate = total
  ? (((total - totalFail) / total) * 100).toFixed(1)
  : '0.0';

const clusters = new Map();
for (const f of fails) {
  const errSig = (f.error || `httpStatus=${f.httpStatus}` || 'unknown')
    .toString()
    .slice(0, 120);
  const key = `${f.layer}::${f.check}::${errSig}`;
  if (!clusters.has(key))
    clusters.set(key, {
      layer: f.layer,
      check: f.check,
      errorSig: errSig,
      count: 0,
      firstSeen: f.ts,
      sample: f,
      iters: new Set(),
    });
  const c = clusters.get(key);
  c.count++;
  c.iters.add(f.iter);
}
const clusterArr = [...clusters.values()].sort((a, b) => b.count - a.count);
await writeFile(
  CLUSTERS_FILE,
  JSON.stringify(
    clusterArr.map(c => ({ ...c, iters: [...c.iters].sort((a, b) => a - b) })),
    null,
    2
  )
);

function severity(c) {
  const pct = (c.count / lastIter) * 100;
  if (c.layer === 'preflight') return 'P0';
  if (/api\/health$|demo-analyze/i.test(c.check) && pct >= 50) return 'P0';
  if (c.layer === 'L2-hydration' && pct >= 50) return 'P0';
  if (pct >= 50) return 'P1';
  if (pct >= 10) return 'P2';
  return 'P3';
}
for (const c of clusterArr) c.severity = severity(c);

const ranked = { P0: [], P1: [], P2: [], P3: [] };
for (const c of clusterArr) ranked[c.severity].push(c);

const now = new Date().toISOString();
let md = `# Synthex — Overnight Smoke Report\n\n`;
md += `**Generated:** ${now}  \n`;
md += `**Target:** ${TARGET}  \n`;
md += `**Iterations completed:** ${lastIter} / ${ITERATIONS}  \n`;
md += `**Total checks:** ${total}  \n`;
md += `**Failures:** ${totalFail}  \n`;
md += `**Pass rate:** ${passRate}%  \n`;
md += `**Failure clusters:** ${clusterArr.length}\n\n`;

md += `## Layer pass rates (last iteration)\n\n`;
const lastIterRows = rows.filter(r => r.iter === lastIter);
const layerStats = {};
for (const r of lastIterRows) {
  if (!r.layer || r.layer === 'meta') continue;
  layerStats[r.layer] = layerStats[r.layer] || { pass: 0, fail: 0 };
  layerStats[r.layer][r.status === 'PASS' ? 'pass' : 'fail']++;
}
md += `| Layer | Pass | Fail | Rate |\n|---|---|---|---|\n`;
for (const [k, v] of Object.entries(layerStats)) {
  const rate =
    v.pass + v.fail > 0 ? ((v.pass / (v.pass + v.fail)) * 100).toFixed(0) : 0;
  md += `| ${k} | ${v.pass} | ${v.fail} | ${rate}% |\n`;
}
md += `\n`;

md += `## Summary by severity\n\n`;
md += `| Severity | Clusters |\n|---|---|\n`;
for (const sev of ['P0', 'P1', 'P2', 'P3'])
  md += `| ${sev} | ${ranked[sev].length} |\n`;
md += `\n---\n\n`;

if (clusterArr.length === 0) {
  md += `## ✅ All clear\n\nZero failures across ${total} checks. CSP hotfix #122 stable. No regressions.\n`;
} else {
  let n = 0;
  for (const sev of ['P0', 'P1', 'P2', 'P3']) {
    if (ranked[sev].length === 0) continue;
    md += `# ${sev} Issues (${ranked[sev].length})\n\n`;
    for (const c of ranked[sev]) {
      n++;
      const pct = ((c.count / lastIter) * 100).toFixed(1);
      const itersList = [...c.iters].sort((a, b) => a - b);
      md += `## ${sev}-${n} — ${c.check}\n\n`;
      md += `**Layer:** \`${c.layer}\`  \n`;
      md += `**Affected:** ${c.count} of ${lastIter} iterations (**${pct}%**)  \n`;
      md += `**First seen:** ${c.firstSeen}  \n`;
      md += `**Iter range:** ${itersList[0]} → ${itersList[itersList.length - 1]}  \n`;
      md += `**Error signature:**\n\`\`\`\n${c.errorSig}\n\`\`\`\n\n`;
      md += `**Sample row:**\n\`\`\`json\n${JSON.stringify(c.sample, null, 2)}\n\`\`\`\n\n`;
      md += `**Suggested Linear ticket:**\n\`\`\`\nTitle: fix(${c.layer.replace(/^L\d+-/, '')}): ${c.check.replace(/^[A-Z]+ /, '').slice(0, 60)}\nBody:\n- Reproduction: see sample row above\n- Frequency: ${c.count}/${lastIter} iterations (${pct}%)\n- Layer: ${c.layer}\n- Acceptance: cluster passes 100/100 in re-run\n\n🤖 Generated overnight from smoke loop iter ${itersList[0]} at ${c.firstSeen}\n\`\`\`\n\n---\n\n`;
    }
  }
}

await writeFile(REPORT_FILE, md);
console.log(`Report written: ${REPORT_FILE}`);
console.log(`Iterations: ${lastIter}/${ITERATIONS}`);
console.log(`Total checks: ${total}`);
console.log(`Failures: ${totalFail}`);
console.log(
  `Clusters: P0=${ranked.P0.length} P1=${ranked.P1.length} P2=${ranked.P2.length} P3=${ranked.P3.length}`
);
