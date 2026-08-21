#!/usr/bin/env node
/**
 * route-safety-scan.mjs — Route Safety prevention guard (audit recommendation #1)
 *
 * Deterministic, dependency-light scanner over `app/api/**\/route.ts`. For every
 * route that exports a mutation handler (POST/PUT/PATCH/DELETE) it flags three
 * classes of regression that the audit identified as the highest-risk and most
 * likely to be silently reintroduced:
 *
 *   [A] missing-Zod        — route reads the request body (`.json()`) but has no
 *                            Zod `safeParse(`/`.parse(` anywhere in the file.
 *   [B] missing-ownership  — route performs a Prisma write (update / updateMany /
 *                            delete / deleteMany) but the file contains NO
 *                            ownership / org-scope indicator (see OWNERSHIP_HINTS).
 *                            This is the cross-tenant-IDOR class.
 *   [C] missing-rate-limit — AI / expensive route (see AI_HINTS) with no
 *                            `withRateLimit`.
 *
 * MODES
 *   --baseline   Write ALL current findings to route-safety-baseline.json and
 *                exit 0. Run this once to snapshot today's known backlog.
 *   (default)    Compare current findings against the baseline and exit NON-ZERO
 *                only on findings that are NOT in the baseline — i.e. it fails on
 *                NEW violations a PR introduces, never on the pre-existing
 *                backlog. This is what CI runs.
 *
 * USAGE
 *   node scripts/security/route-safety-scan.mjs --baseline   # snapshot
 *   node scripts/security/route-safety-scan.mjs              # CI / local check
 *   npm run security:scan                                    # alias
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HEURISTICS — deliberately CONSERVATIVE to keep false positives low. This guard
 * exists to PREVENT DRIFT, not to be a complete static analyser. It is allowed to
 * miss subtle violations (false negatives) but should rarely flag safe code:
 *
 *   - File-level text matching only. We do not parse the AST or trace handlers,
 *     so a helper imported from another file counts as "present" if its name or
 *     import appears in this file. We accept that under-reporting.
 *   - [A] only fires when BOTH `.json()` is read AND no Zod parse exists. Routes
 *     that never read a body (e.g. DELETE by URL param) are not flagged.
 *   - [B] treats a wide set of signals as "ownership present" (organizationId,
 *     userId-in-where, a 403 response, an ownership pre-fetch, OR any call into a
 *     service/repository layer that is presumed to enforce scope). Any one signal
 *     clears the route. This intentionally errs toward NOT flagging.
 *   - [C] only fires for routes that look AI/expensive AND read a body / mutate,
 *     and only when `withRateLimit` is absent. Routes already wrapped, or that
 *     reference any rate-limit preset, are cleared.
 *   - A route is identified as a mutation route only if it exports POST/PUT/
 *     PATCH/DELETE (function or const form).
 *
 * A finding is keyed by `route::CATEGORY` so the baseline is order-independent
 * and resilient to line moves. Adding the same class of issue to a NEW route
 * fails CI; the existing backlog (captured in the baseline) does not.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';

const ROOT = process.cwd();
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(__dirname, 'route-safety-baseline.json');
const WRITE_BASELINE = process.argv.includes('--baseline');

// ── Detection patterns ────────────────────────────────────────────────────────

const MUTATION_EXPORT =
  /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b|export\s+const\s+(POST|PUT|PATCH|DELETE)\s*[=:]/;

// Reads request body — triggers the [A] Zod check.
const READS_BODY =
  /\.\s*json\s*\(\s*\)|\.\s*formData\s*\(\s*\)|\.\s*text\s*\(\s*\)/;

// Zod validation present anywhere in the file.
const HAS_ZOD =
  /\.\s*safeParse\s*\(|\.\s*parseAsync\s*\(|\bz\s*\.\s*object\b|\.\s*parse\s*\(/;

// Prisma write operations — triggers the [B] ownership check.
const PRISMA_WRITE =
  /\bprisma\b[\s\S]{0,80}?\.(update|updateMany|delete|deleteMany)\s*\(|\.(update|updateMany|delete|deleteMany)\s*\(\s*\{/;

// Ownership / org-scope indicators. ANY ONE clears the [B] check.
const OWNERSHIP_HINTS = [
  /organizationId/,
  /organisationId/,
  /\borgId\b/,
  /\bworkspaceId\b/,
  /\btenantId\b/,
  /\bteamId\b/,
  // userId / ownerId used in a where-style scope or comparison
  /userId\s*[:=]/,
  /ownerId\s*[:=]/,
  /createdById/,
  /authorId/,
  // explicit ownership pre-fetch + forbid pattern
  /status:\s*403/,
  /\bForbidden\b/,
  /verifyOwnership|assertOwnership|requireOwnership|checkOwnership|ensureOwner/,
  // service / repository layer call presumed to enforce scope
  /Service\s*\.\s*\w+\s*\(/,
  /Repository\s*\.\s*\w+\s*\(/,
  /from\s+['"]@\/lib\/services\//,
  /from\s+['"]@\/lib\/db\//,
  /from\s+['"]@\/lib\/repositories\//,
];

// Rate-limit present anywhere in the file. ANY ONE clears the [C] check.
const RATE_LIMIT_HINTS = [
  /withRateLimit/,
  /rateLimiter/,
  /rateLimit\s*\(/,
  /checkRateLimit/,
  // Every preset exported by '@/lib/rate-limit' (see lib/rate-limit/presets.ts).
  // These must be CALLED WITH THE REQUEST to clear [C] — `preset(req, …)`.
  //
  // Matching the bare name, or an import of it, is not enough and was a real
  // hole: a route that does `import { admin } from '@/lib/rate-limit'` and then
  // never calls it read as rate-limited while doing no rate limiting at all.
  // Verified by planting exactly that file — the scan returned "0 NEW
  // violations" for an OpenRouter route with no limiter. The same hole existed
  // for the older bare-word entries (`/\bwriteDefault\b/` was cleared by the
  // word appearing in a comment), so this tightens the guard rather than
  // trading one gap for another.
  //
  // Deliberately NOT anchored to `return`: a route may assign or await the
  // result. The first argument is matched as ANY identifier followed by a
  // comma, because every preset's signature is
  // (req: NextRequest, handler: () => Promise<NextResponse>) — two arguments.
  // An earlier version listed the parameter names (req|request|_req|
  // nextRequest) and produced a false positive on a correctly-limited route
  // that named its parameter something else, e.g.
  //   export async function POST(incoming: NextRequest) {
  //     return writeDefault(incoming, () => handlePost(incoming));
  //   }
  // Requiring the comma keeps this from matching a bare mention.
  /\b(?:authStrict|authGeneral|admin|billing|aiGeneration|writeDefault|mutation|readDefault)\s*\(\s*[A-Za-z_$][\w$]*\s*,/,
];

// AI / expensive route indicators. If ANY appear, the route is "AI/expensive"
// and subject to the [C] rate-limit requirement.
const AI_HINTS = [
  /openrouter/i,
  /@anthropic/i,
  /anthropic/i,
  /\bopenai\b/i,
  /\bclaude\b/i,
  /\bgpt-/i,
  /generateContent/,
  /generateText/,
  /generateCaption/,
  /generateImage/,
  /generateCompletion/,
  /createCompletion/,
  /chat\.completions/,
  /from\s+['"]@\/lib\/ai\//,
  /from\s+['"]@\/lib\/content-pipeline/,
  /aiClient/,
  /modelRegistry/,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toPosix(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Remove comments before testing for a rate limiter.
 *
 * A commented-out call is not a call. Without this, the single line
 *   // aiGeneration(request)
 * cleared [C] for an unprotected AI route — verified: the scan returned
 * "0 NEW violations" for a POST that fetched openrouter.ai with no limiter.
 * The `[^:]` guard keeps `https://` in a string literal from eating the rest
 * of its line. Any over-stripping can only make this guard fire MORE often,
 * which is the safe direction for a security check.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function matchesAny(content, patterns) {
  return patterns.some(re => re.test(content));
}

function getMutationVerbs(content) {
  const verbs = new Set();
  const re = new RegExp(MUTATION_EXPORT.source, 'g');
  let m;
  while ((m = re.exec(content)) !== null) {
    verbs.add(m[1] || m[2]);
  }
  return [...verbs];
}

/**
 * Analyse one route file. Returns an array of findings:
 *   { route, category, verbs, reason }
 */
function analyseRoute(relPath, content) {
  const verbs = getMutationVerbs(content);
  if (verbs.length === 0) return []; // not a mutation route — out of scope

  const findings = [];
  const route = toPosix(relPath);
  const verbList = verbs.join(',');

  // [A] missing-Zod
  if (READS_BODY.test(content) && !HAS_ZOD.test(content)) {
    findings.push({
      route,
      category: 'A',
      label: 'missing-zod',
      verbs: verbList,
      reason:
        'Reads request body (.json/.formData/.text) but has no Zod safeParse/parse.',
    });
  }

  // [B] missing-ownership (cross-tenant IDOR class)
  if (PRISMA_WRITE.test(content) && !matchesAny(content, OWNERSHIP_HINTS)) {
    findings.push({
      route,
      category: 'B',
      label: 'missing-ownership',
      verbs: verbList,
      reason:
        'Prisma write (update/delete) with no ownership/org-scope indicator in file.',
    });
  }

  // [C] missing-rate-limit (AI / expensive)
  const looksAI = matchesAny(content, AI_HINTS);
  if (looksAI && !matchesAny(stripComments(content), RATE_LIMIT_HINTS)) {
    findings.push({
      route,
      category: 'C',
      label: 'missing-rate-limit',
      verbs: verbList,
      reason:
        'AI/expensive mutation route with no withRateLimit / rate-limit preset.',
    });
  }

  return findings;
}

function keyOf(f) {
  return `${f.route}::${f.category}`;
}

// ── Scan ──────────────────────────────────────────────────────────────────────

function scan() {
  const routes = globSync('app/api/**/route.ts', {
    cwd: ROOT,
    absolute: false,
  }).sort();
  const findings = [];

  for (const rel of routes) {
    let content;
    try {
      content = readFileSync(join(ROOT, rel), 'utf8');
    } catch {
      continue;
    }
    findings.push(...analyseRoute(rel, content));
  }

  findings.sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  return { routes, findings };
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    return new Set((parsed.findings || []).map(keyOf));
  } catch {
    return null;
  }
}

function summarise(findings) {
  const c = { A: 0, B: 0, C: 0 };
  for (const f of findings) c[f.category]++;
  return c;
}

// ── Report ────────────────────────────────────────────────────────────────────

const LABELS = {
  A: '[A] missing-Zod      ',
  B: '[B] missing-ownership',
  C: '[C] missing-rate-limit',
};

function printFindings(title, findings) {
  console.log(`\n${title} (${findings.length}):`);
  if (findings.length === 0) {
    console.log('  (none)');
    return;
  }
  for (const f of findings) {
    console.log(`  ${LABELS[f.category]}  ${f.route}  [${f.verbs}]`);
    console.log(`      ${f.reason}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const { routes, findings } = scan();
  const counts = summarise(findings);

  console.log('Route Safety Scan');
  console.log(`  Routes scanned (app/api/**/route.ts) : ${routes.length}`);
  console.log(`  Total findings                       : ${findings.length}`);
  console.log(`    [A] missing-Zod        : ${counts.A}`);
  console.log(`    [B] missing-ownership  : ${counts.B}`);
  console.log(`    [C] missing-rate-limit : ${counts.C}`);

  if (WRITE_BASELINE) {
    const payload = {
      generatedAt: new Date().toISOString(),
      note: 'Baseline of known route-safety findings. CI fails only on findings NOT listed here. Regenerate with: node scripts/security/route-safety-scan.mjs --baseline',
      counts,
      findings,
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n');
    console.log(
      `\n✅ Baseline written: ${toPosix(BASELINE_PATH.replace(ROOT + '/', ''))}`
    );
    console.log(
      `   ${findings.length} findings snapshotted. CI is now green on these.`
    );
    process.exit(0);
  }

  const baseline = loadBaseline();
  if (baseline === null) {
    console.error('\n❌ No baseline found. Run with --baseline first:');
    console.error('   node scripts/security/route-safety-scan.mjs --baseline');
    process.exit(2);
  }

  const newFindings = findings.filter(f => !baseline.has(keyOf(f)));

  printFindings('NEW violations (not in baseline)', newFindings);

  if (newFindings.length > 0) {
    console.error(
      `\n❌ ${newFindings.length} NEW route-safety violation(s) introduced.`
    );
    console.error(
      '   These are not in scripts/security/route-safety-baseline.json.'
    );
    console.error(
      '   Fix the route, OR — if intentional — regenerate the baseline:'
    );
    console.error(
      '     node scripts/security/route-safety-scan.mjs --baseline'
    );
    console.error('   See docs/security/route-safety-backlog.md for guidance.');
    process.exit(1);
  }

  console.log(
    '\n✅ No NEW route-safety violations. Existing backlog is baselined.'
  );
  process.exit(0);
}

main();
