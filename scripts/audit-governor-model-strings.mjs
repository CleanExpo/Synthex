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
 * Detection works on STRING LITERALS ONLY, found by PARSING the file with the
 * TypeScript compiler. A comment that names a model is documentation; a string
 * literal that names one is a hardcode, and that distinction is what makes this
 * script keepable rather than noise nobody can stay green against.
 *
 * IT USES A REAL PARSER BECAUSE A HAND-ROLLED ONE WAS DEFEATED. The first
 * version walked the characters itself, treating any two-slash or slash-star
 * sequence as the start of a comment. A JavaScript REGEX LITERAL containing
 * those characters therefore put the scanner into comment state and hid the
 * rest of the line, so a regex followed by a hardcoded model id on the same
 * line scanned CLEAN. Template literals containing a dollar sign slipped
 * through too. (Independent review, cursor lane, finding
 * P1-AUDIT-COMMENT-STRIP-REGEX-DEFEAT, reproduced by planting exactly that.)
 *
 * The lesson is the general one: "is this text inside a string literal" is
 * decidable by a parser and only approximable by a scanner, so the guard has to
 * ask the parser. Comments are not nodes, so they are excluded structurally
 * rather than by stripping.
 *
 * WHAT THIS AUDIT CAN AND CANNOT DECIDE — read before trusting a CLEAN result.
 *
 * It reads literal-bearing tokens: string literals, template chunks, and regex
 * literals. Within that surface it is exact.
 *
 * It CANNOT see a model id that is CONSTRUCTED rather than written — 'claude-'
 * + 'sonnet-5', ['a','b'].join('-'), String.fromCharCode(...), a template with
 * substitutions. No source-text guard can, because the value does not exist
 * until the program runs. A second independent review round planted exactly
 * these and was right to (P1-AUDIT-REGEX-LITERAL-AND-CONCAT-SMUGGLE); the regex
 * case is now covered, and the constructed case is DOCUMENTED AS OUT OF REACH
 * and asserted as such in --selftest, rather than left as an unstated hole.
 *
 * SO THIS SCRIPT IS NOT THE BOUNDARY, AND MUST NOT BE READ AS ONE. What the
 * SYN-1196 criterion actually requires is that no unregistered model reaches a
 * provider, and that is enforced at RUNTIME by resolveModel() in
 * lib/ai/governor/model.ts: any id absent from the registry is refused with
 * refused_model_unavailable and the refusal is receipted. A constructed id
 * therefore either names a model the registry already lists — in which case it
 * is not a smuggle, it is the model the registry would have chosen — or it is
 * refused before any provider call. tests/unit/ai/governor/
 * governor-model-registry.test.ts proves that with a constructed id.
 *
 * This audit is config-PR discipline and defence in depth: it keeps the source
 * readable and keeps model choices visible in review. Treat a CLEAN result as
 * "nobody wrote a model id down", never as "no unregistered model can run".
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
import ts from 'typescript';

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

/**
 * Every string-literal value in the file, with its line number. Comments never
 * appear: the parser does not make them nodes. Template literals are included
 * (both the no-substitution form and each literal chunk of a substituted one),
 * because a model id can be written in backticks just as easily as in quotes.
 */
function stringLiteralsOf(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    false,
    fileName.endsWith('.tsx') || fileName.endsWith('.jsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS
  );

  const found = [];
  const visit = node => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      // A regex literal carries its own source text, so /some-model-id/.source
      // yields the id without any string literal appearing. Cheap to cover.
      ts.isRegularExpressionLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const pos = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile)
      );
      // A regex literal's `text` keeps its delimiters and flags, so it arrives
      // as "/some-model-id/i" and never matches an anchored id pattern. Strip
      // them. (Caught by the selftest control added for round 2's finding —
      // adding the node type without this produced 0 findings and would have
      // shipped as a fix that fixed nothing.)
      const raw = ts.isRegularExpressionLiteral(node)
        ? node.text.replace(/^\//, '').replace(/\/[a-z]*$/, '')
        : node.text;
      found.push({ line: pos.line + 1, value: raw });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return found;
}

function scanSource(source, fileName = 'input.ts') {
  return stringLiteralsOf(source, fileName).filter(entry =>
    MODEL_ID_PATTERNS.some(p => p.test(entry.value))
  );
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
    const hits = scanSource(readFileSync(file, 'utf8'), file);
    for (const hit of hits) {
      findings.push({ file: relative(REPO_ROOT, file), ...hit });
    }
  }
  return { error: false, files: scanned, findings };
}

function selftest() {
  const dir = mkdtempSync(join(tmpdir(), 'syn1196-audit-'));
  const write = (name, body) => {
    const f = join(dir, name);
    writeFileSync(f, body);
    return scanSource(readFileSync(f, 'utf8'), f);
  };
  try {
    // --- Positive controls: these MUST be caught -------------------------
    const quoted = write(
      'planted.ts',
      "export const m = 'claude-sonnet-5';\nexport const n = 'anthropic/claude-opus-4-6';\n"
    );

    // REGRESSION CONTROL for P1-AUDIT-COMMENT-STRIP-REGEX-DEFEAT (cursor
    // lane, head f8c1257). A regex literal containing slashes used to put the
    // hand-rolled stripper into comment state, hiding a same-line hardcode.
    // The exact shape the reviewer planted is kept here verbatim so the class
    // cannot silently reopen.
    const regexPoison = write(
      'regex-poison.ts',
      "const _re = /https:\\/\\//;\nconst _sneak = 'claude-sonnet-5';\n"
    );
    const regexPoisonSameLine = write(
      'regex-poison-oneline.ts',
      "const _re = /https:\\/\\//; const _sneak = 'claude-sonnet-5';\n"
    );
    const blockPoison = write(
      'block-poison.ts',
      "const _re = /a\\/*b/; const _sneak = 'gpt-4-o';\n"
    );
    // Template literals, including a substituted one (the old string-literal
    // regex excluded anything containing a dollar sign).
    const templated = write(
      'template.ts',
      'const a = `claude-sonnet-5`;\nconst b = `anthropic/claude-opus-4-6${x}`;\n'
    );

    // Regex literals carry their own source text (P1-AUDIT-REGEX-LITERAL-
    // AND-CONCAT-SMUGGLE, round 2).
    const regexSource = write(
      'regex-source.ts',
      'export const m = /claude-sonnet-5/.source;\n'
    );

    // --- Documented limit, asserted rather than left unstated -------------
    // A CONSTRUCTED id is out of reach of any source-text guard. This control
    // exists so the limit is a checked fact that a future editor cannot
    // silently forget, not a paragraph in a header. The runtime boundary that
    // actually covers this case is resolveModel() — see the header.
    const constructed = write(
      'constructed.ts',
      "export const m = 'claude-' + 'sonnet-5';\nexport const n = ['claude', 'sonnet-5'].join('-');\n"
    );

    // --- Negative control: this MUST NOT be caught ------------------------
    // A model named only in a comment is documentation. If the audit flags it,
    // nobody can keep the tree green and the control gets deleted.
    const commented = write(
      'commented.ts',
      '// routes to claude-sonnet-5 by default\n/* gpt-4-o was the old pick */\nexport const x = 1;\n'
    );

    const results = [
      {
        name: 'positive: quoted model id detected',
        ok: quoted.length === 2,
        got: `${quoted.length} findings, want 2`,
      },
      {
        name: 'positive: regex literal does not hide a NEXT-LINE hardcode',
        ok: regexPoison.length === 1,
        got: `${regexPoison.length} findings, want 1`,
      },
      {
        name: 'positive: regex literal does not hide a SAME-LINE hardcode',
        ok: regexPoisonSameLine.length === 1,
        got: `${regexPoisonSameLine.length} findings, want 1`,
      },
      {
        name: 'positive: slash-star inside a regex does not hide a hardcode',
        ok: blockPoison.length === 1,
        got: `${blockPoison.length} findings, want 1`,
      },
      {
        name: 'positive: template literals (incl. substituted) are scanned',
        ok: templated.length === 2,
        got: `${templated.length} findings, want 2`,
      },
      {
        name: 'positive: regex literal carrying a model id is detected',
        ok: regexSource.length === 1,
        got: `${regexSource.length} findings, want 1`,
      },
      {
        name: 'DOCUMENTED LIMIT: constructed ids are NOT statically detectable (runtime resolveModel is the boundary)',
        ok: constructed.length === 0,
        got: `${constructed.length} findings, want 0 by design`,
      },
      {
        name: 'negative: model id in a comment is ignored',
        ok: commented.length === 0,
        got: `${commented.length} findings, want 0`,
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
