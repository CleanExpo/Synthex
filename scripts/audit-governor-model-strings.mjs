#!/usr/bin/env node
/**
 * SYN-1196 — hardcoded-model-string audit.
 *
 * Criterion: "Model registry live; zero hardcoded model strings in runner
 * paths." This script is the code audit that makes that checkable rather than
 * asserted.
 *
 * SCOPE IS DELIBERATELY NARROW AND EXPLICIT. The repo-wide baseline measured
 * on 2026-09-07 is much larger than the Governor path, and pretending
 * otherwise would make a green run mean nothing. The default scope is
 * lib/ai/governor — the path SYN-1196 Phase 1 actually built — and `--scope`
 * widens it as later phases bring more runners under the Governor. Run
 * `--scope lib/ai` to see the honest wider number.
 *
 * Verdict is the EXIT CODE, never stdout text:
 *   0 = no hardcoded model strings in scope
 *   1 = violations found (each printed with file:line)
 *   2 = the audit could not run (bad scope, unreadable file)
 *
 * Detection works on STRING LITERALS ONLY, after comments are stripped. A
 * comment that names a model is documentation; a string literal that names one
 * is a hardcode. That distinction is the difference between this script being
 * useful and it being noise nobody can keep green.
 *
 * `--selftest` is the positive control: it plants a known violation in a temp
 * file and fails unless the audit catches it. A scanner that has never been
 * observed returning non-zero proves nothing about a clean result — an empty
 * finding list from a broken matcher looks exactly like a clean tree.
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SELF = fileURLToPath(import.meta.url);

/**
 * Shapes that identify a provider model id. Kept as id SHAPES rather than a
 * list of known model names, so a model released after this file was written
 * is still caught.
 */
const MODEL_ID_PATTERNS = [
  /^claude-[a-z0-9.-]+$/i, // claude-sonnet-5, claude-opus-4-6
  /^gpt-[a-z0-9.-]+$/i, // gpt-4-o, gpt-5.5
  /^o[0-9]+(-[a-z0-9.-]+)?$/i, // o1, o3-mini
  /^gemini-[a-z0-9.-]+$/i, // gemini-2.5-flash
  /^text-embedding-[a-z0-9.-]+$/i,
  // OpenRouter-style vendor-prefixed slugs: anthropic/claude-…, google/gemini-…
  /^(anthropic|openai|google|deepseek|meta-llama|mistralai|qwen|x-ai)\/[a-z0-9._-]+$/i,
];

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'coverage',
  '.claude',
]);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/** Remove // line comments and block comments so documentation is not scanned. */
function stripComments(source) {
  let out = '';
  let i = 0;
  let state = 'code'; // code | line | block | single | double | tick
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (state === 'code') {
      if (c === '/' && next === '/') {
        state = 'line';
        i += 2;
        continue;
      }
      if (c === '/' && next === '*') {
        state = 'block';
        i += 2;
        continue;
      }
      if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') state = 'tick';
      out += c;
      i += 1;
      continue;
    }
    if (state === 'line') {
      if (c === '\n') {
        state = 'code';
        out += c;
      }
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (c === '*' && next === '/') {
        state = 'code';
        i += 2;
        continue;
      }
      // Preserve newlines so reported line numbers stay accurate.
      if (c === '\n') out += c;
      i += 1;
      continue;
    }
    // Inside a string literal.
    out += c;
    if (c === '\\') {
      if (next !== undefined) out += next;
      i += 2;
      continue;
    }
    if (
      (state === 'single' && c === "'") ||
      (state === 'double' && c === '"') ||
      (state === 'tick' && c === '`')
    ) {
      state = 'code';
    }
    i += 1;
  }
  return out;
}

const STRING_LITERAL = /'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\$]*)`/g;

function scanSource(source) {
  const stripped = stripComments(source);
  const lines = stripped.split('\n');
  const findings = [];
  lines.forEach((line, index) => {
    STRING_LITERAL.lastIndex = 0;
    let match;
    while ((match = STRING_LITERAL.exec(line)) !== null) {
      const value = match[1] ?? match[2] ?? match[3];
      if (!value) continue;
      if (MODEL_ID_PATTERNS.some(p => p.test(value))) {
        findings.push({ line: index + 1, value });
      }
    }
  });
  return findings;
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (CODE_EXT.has(extname(full))) acc.push(full);
  }
  return acc;
}

function audit(scopePath) {
  const abs = resolve(REPO_ROOT, scopePath);
  let st;
  try {
    st = statSync(abs);
  } catch {
    console.error(`AUDIT ERROR: scope not found: ${scopePath}`);
    return { error: true, files: 0, findings: [] };
  }
  const files = st.isDirectory() ? walk(abs) : [abs];
  const findings = [];
  let scanned = 0;
  for (const file of files) {
    // The audit names model-id shapes itself; scanning it would always fail.
    if (resolve(file) === SELF) continue;
    scanned += 1;
    const hits = scanSource(readFileSync(file, 'utf8'));
    for (const hit of hits) {
      findings.push({ file: relative(REPO_ROOT, file), ...hit });
    }
  }
  return { error: false, files: scanned, findings };
}

function selftest() {
  const dir = mkdtempSync(join(tmpdir(), 'syn1196-audit-'));
  try {
    // Positive control — a real hardcode in a string literal MUST be caught.
    const planted = join(dir, 'planted.ts');
    writeFileSync(
      planted,
      "export const m = 'claude-sonnet-5';\nexport const n = 'anthropic/claude-opus-4-6';\n"
    );
    const positive = scanSource(readFileSync(planted, 'utf8'));
    // Negative control — a model named only in a COMMENT must NOT be caught,
    // otherwise the audit is unkeepable and will be disabled by whoever
    // inherits it.
    const commented = join(dir, 'commented.ts');
    writeFileSync(
      commented,
      '// routes to claude-sonnet-5 by default\n/* gpt-4-o was the old pick */\nexport const x = 1;\n'
    );
    const negative = scanSource(readFileSync(commented, 'utf8'));

    const results = [
      {
        name: 'positive control: literal model id is detected',
        ok: positive.length === 2,
        got: `${positive.length} findings`,
      },
      {
        name: 'negative control: model id in a comment is ignored',
        ok: negative.length === 0,
        got: `${negative.length} findings`,
      },
    ];
    for (const r of results) {
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.got})`);
    }
    return results.every(r => r.ok) ? 0 : 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- CLI --------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.includes('--selftest')) {
  process.exit(selftest());
}

const scopeIndex = args.indexOf('--scope');
const scope =
  scopeIndex !== -1 && args[scopeIndex + 1]
    ? args[scopeIndex + 1]
    : join('lib', 'ai', 'governor');

const { error, files, findings } = audit(scope);
if (error) process.exit(2);

console.log(
  `SYN-1196 model-string audit — scope: ${scope}  files scanned: ${files}`
);
if (findings.length === 0) {
  console.log('CLEAN: 0 hardcoded model strings');
  process.exit(0);
}
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  ${f.value}`);
}
console.log(`VIOLATIONS: ${findings.length}`);
process.exit(1);
