/**
 * Real Images Only — the "everywhere" enforcement guard
 * (docs/superpowers/specs/2026-07-12-real-images-only-design.md, Part C).
 *
 * Static guard: walks lib/, app/, scripts/ source files and fails the suite
 * if any file OUTSIDE the grounded service layer contains a direct call to a
 * raw image-generation provider endpoint. The gate exists so "get it out of
 * anywhere and everywhere" stays true permanently, not just at the moment of
 * the original sweep — every future PR re-runs this check.
 *
 * Allowed without exception (the grounded service layer itself):
 *   - lib/services/ai/image-generation.ts
 *   - lib/services/ai/image/providers/**
 *
 * Sanctioned exceptions register (spec Part C) — the ONLY other files this
 * guard may skip, each carrying a one-line justification below. Adding an
 * entry here without a matching entry in the spec's register defeats the
 * mandate; don't do it to make a red run go green.
 *
 * This is a grep-based guard, not a full structural analyzer (same
 * disclaimer as tests/unit/automation/rules-engine-image-contract.test.ts):
 * it catches the naive/common case — a literal provider URL or model id in
 * source — not every possible obfuscation (e.g. a URL assembled at runtime
 * from unrelated string fragments).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = process.cwd();
const SCAN_ROOTS = ['lib', 'app', 'scripts'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.py']);
const MAX_FILE_BYTES = 1024 * 1024; // 1MB — fast guard only, skip anything bigger

// Directories never worth descending into for this guard. Deliberately does
// NOT include a bare "tests" name — app/api/ab-testing/tests/ is a real
// Next.js API route ("tests" the resource), not a test suite; skipping it
// would blind the guard to real product code. Jest suites live under the
// top-level tests/ and __tests__/ dirs, both handled below (repo-root
// tests/ is outside SCAN_ROOTS entirely; __tests__/ is skipped by name).
const SKIP_DIR_NAMES = new Set(['node_modules', '.next', '__tests__']);

function isSkippedDir(name: string): boolean {
  if (SKIP_DIR_NAMES.has(name)) return true;
  if (name.startsWith('.')) return true; // .git, .claude/archived, etc.
  return false;
}

function isSkippedFile(name: string): boolean {
  const ext = path.extname(name);
  if (!SCAN_EXTENSIONS.has(ext)) return true;
  if (name.includes('.test.') || name.includes('.spec.')) return true;
  if (name.startsWith('test_')) return true; // pytest convention
  return false;
}

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

const ALLOWED_EXACT_FILES = new Set<string>([
  // The grounded service itself — the one place direct provider calls are
  // meant to live (Part A: shouldGround gate, block-on-no-coverage, escape
  // hatch, deprecated-provider enforcement all live here).
  'lib/services/ai/image-generation.ts',
]);

const ALLOWED_DIR_PREFIXES: string[] = [
  // Provider adapters called ONLY by the service above.
  'lib/services/ai/image/providers/',
];

// Sanctioned exceptions register (spec Part C, numbered list). Each entry
// names the file and quotes the register's own justification.
const SANCTIONED_EXCEPTIONS: Record<string, string> = {
  'lib/video/drift-canary.ts':
    'spec Part C exception 1 — "monitoring smoke gen, isolated canary org"',
  'app/api/demo/image/route.ts':
    'spec Part C exception 2 — "public demo via explicit escape hatch (flagged to founder)"; ' +
    'rerouted through generateImage() with useReferences:false (the audited escape hatch, ' +
    'Part A item 5) — a concurrent lane may still be adjusting this route, but the exception ' +
    'itself is spec-sanctioned regardless of implementation state, so it stays allowlisted here.',
  'app/api/demo/analyze/route.ts':
    'SANCTIONED (spec 2026-07-12): same public lead-gen demo family as demo/image — ' +
    'Picsum stock placeholder for arbitrary prospect businesses; founder decision pending.',
};

function isAllowed(relPath: string): boolean {
  if (ALLOWED_EXACT_FILES.has(relPath)) return true;
  if (ALLOWED_DIR_PREFIXES.some(prefix => relPath.startsWith(prefix)))
    return true;
  if (relPath in SANCTIONED_EXCEPTIONS) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Walker
// ---------------------------------------------------------------------------

function listSourceFiles(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (isSkippedDir(entry.name)) continue;
      out.push(...listSourceFiles(path.join(dir, entry.name)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (isSkippedFile(entry.name)) continue;
    out.push(path.join(dir, entry.name));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Detection patterns
// ---------------------------------------------------------------------------

interface PatternHit {
  label: string;
  detail: string;
}

// Strip comments before scanning so documentation that merely MENTIONS a
// banned pattern (e.g. a header comment explaining "this replaced the old
// direct Gemini 'nano-banana' adapter") doesn't false-positive as if it were
// live code. Block comments only (`/* ... */`, and Python `#` full-line
// comments) — deliberately NOT stripping JS/TS `//` line comments, since a
// naive strip breaks on URLs containing `//` (e.g. `// see https://...`)
// and the false positive this guards against lives in a block comment.
function stripComments(content: string, ext: string): string {
  if (ext === '.py') {
    return content.replace(/^[ \t]*#.*$/gm, '');
  }
  return content.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Bare Gemini image-model id, e.g. 'gemini-2.5-flash-image' or
// 'gemini-3-pro-image-preview'. Deliberately requires the WHOLE quoted
// literal to be the model token (not merely a substring of a longer
// sentence) — see scanGemini() for why.
const GEMINI_IMAGE_MODEL_TOKEN =
  /^gemini-[\d.]+-?(?:flash|pro)?-image(?:-preview)?$/i;
const QUOTED_LITERAL_RE = /['"`]([^'"`]{3,80})['"`]/g;
// The REST call shape every Gemini generateContent call uses:
// `.../models/<model-id>:generateContent` (or `:streamGenerateContent`).
// Matching this directly catches the id even when it's interpolated into a
// URL template literal rather than standing alone as its own quoted token.
const GEMINI_MODEL_URL_RE =
  /\/models\/(gemini[\w.-]*):(?:stream)?[Gg]enerateContent/;

function scanGemini(content: string): PatternHit | null {
  if (/nano-banana/i.test(content)) {
    return { label: 'gemini-nano-banana', detail: '"nano-banana" literal' };
  }

  const hasGenerateContent = /\bgenerateContent\b/.test(content);
  const hasResponseModalitiesImage =
    /responseModalities/.test(content) && /\bIMAGE\b/.test(content);

  if (hasGenerateContent && hasResponseModalitiesImage) {
    return {
      label: 'gemini-generateContent',
      detail: 'generateContent() call with responseModalities including IMAGE',
    };
  }

  const urlMatch = GEMINI_MODEL_URL_RE.exec(content);
  if (urlMatch && GEMINI_IMAGE_MODEL_TOKEN.test(urlMatch[1])) {
    return {
      label: 'gemini-model-literal',
      detail: `Gemini image model literal "${urlMatch[1]}" in a .../models/<id>:generateContent URL`,
    };
  }

  // Bare model-id literal only counts as a hit when the same file also
  // shows evidence of an actual outbound call (generateContent, or the
  // generativelanguage.googleapis.com host). Without that, a hit here would
  // false-positive on pure data/catalog files — e.g. the image model
  // registry (lib/services/ai/image/registry.ts) declares
  // `id: 'gemini-2.5-flash-image'` as DATA the grounded service reads; it
  // never calls a provider itself. Requiring call evidence keeps that file
  // (and similar data-only files) green while still catching a file that
  // pins the model id and fetches it directly (real example found in the
  // current tree: scripts/generate-ccw-real-product-creatives.ts, which
  // trips this via multiple independent signals).
  const hasCallEvidence =
    hasGenerateContent || /generativelanguage\.googleapis\.com/.test(content);
  if (hasCallEvidence) {
    QUOTED_LITERAL_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = QUOTED_LITERAL_RE.exec(content))) {
      if (GEMINI_IMAGE_MODEL_TOKEN.test(match[1])) {
        return {
          label: 'gemini-model-literal',
          detail: `Gemini image model literal "${match[1]}" alongside a direct call`,
        };
      }
    }
  }

  return null;
}

function scanContent(content: string): PatternHit[] {
  const hits: PatternHit[] = [];

  if (
    /\/v1\/images\/generations/.test(content) ||
    /\bimages\.generate\s*\(/.test(content)
  ) {
    hits.push({
      label: 'openai-images',
      detail: 'OpenAI /v1/images/generations or images.generate() call',
    });
  }

  if (/api\.stability\.ai/.test(content)) {
    hits.push({ label: 'stability', detail: 'api.stability.ai endpoint' });
  }

  if (/(?:queue\.)?fal\.run\/fal-ai\/flux/.test(content)) {
    hits.push({
      label: 'fal-flux',
      detail:
        'fal.run/fal-ai/flux (or queue.fal.run/fal-ai/flux) endpoint literal',
    });
  }

  if (/picsum\.photos/.test(content)) {
    hits.push({
      label: 'picsum',
      detail: 'picsum.photos stock-photo fallback',
    });
  }

  const geminiHit = scanGemini(content);
  if (geminiHit) hits.push(geminiHit);

  return hits;
}

// Entry point used by both the real-tree walk and the self-tests below, so
// the self-tests exercise exactly the same code path (comment-stripping
// included) as the live scan.
function scanFile(content: string, ext: string): PatternHit[] {
  return scanContent(stripComments(content, ext));
}

interface Violation {
  file: string;
  hits: PatternHit[];
}

function findViolations(): Violation[] {
  const violations: Violation[] = [];

  for (const root of SCAN_ROOTS) {
    const absRoot = path.join(REPO_ROOT, root);
    for (const absFile of listSourceFiles(absRoot)) {
      const relPath = path
        .relative(REPO_ROOT, absFile)
        .split(path.sep)
        .join('/');
      if (isAllowed(relPath)) continue;

      let size: number;
      try {
        size = fs.statSync(absFile).size;
      } catch {
        continue;
      }
      if (size > MAX_FILE_BYTES) continue;

      const content = fs.readFileSync(absFile, 'utf8');
      const hits = scanFile(content, path.extname(absFile));
      if (hits.length > 0) violations.push({ file: relPath, hits });
    }
  }

  return violations;
}

const FAILURE_HEADLINE =
  'Direct image-generation call outside lib/services/ai — route through ' +
  'generateImage() (Real Images Only mandate, spec 2026-07-12)';

function formatFailureMessage(violations: Violation[]): string {
  const fileList = violations
    .map(v => `  - ${v.file}: ${v.hits.map(h => h.detail).join('; ')}`)
    .join('\n');
  return `${FAILURE_HEADLINE}\n\nOffending file(s):\n${fileList}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('static guard — no direct image-generation API calls outside the grounded service', () => {
  it('lib/, app/, scripts/ contain no direct image-generation API usage outside the sanctioned layer', () => {
    const violations = findViolations();
    if (violations.length > 0) {
      // Fail loudly with the exact, greppable headline the mandate requires,
      // plus every offending file so the finding is actionable without
      // re-running the scan by hand.
      throw new Error(formatFailureMessage(violations));
    }
    expect(violations).toEqual([]);
  });

  describe('self-test — the scanner catches realistic violations (no files planted on disk)', () => {
    it('catches a raw OpenAI images/generations call', () => {
      const fixture = `
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
        });
      `;
      expect(scanFile(fixture, '.ts').map(h => h.label)).toContain(
        'openai-images'
      );
    });

    it('catches the OpenAI SDK images.generate() call shape', () => {
      const fixture = `const result = await openai.images.generate({ prompt });`;
      expect(scanFile(fixture, '.ts').map(h => h.label)).toContain(
        'openai-images'
      );
    });

    it('catches a raw Stability AI endpoint', () => {
      const fixture = `const STABILITY_API_BASE = 'https://api.stability.ai/v2beta';`;
      expect(scanFile(fixture, '.ts').map(h => h.label)).toContain('stability');
    });

    it('catches a raw fal.run flux endpoint literal', () => {
      const fixture = `const url = \`https://fal.run/fal-ai/flux-pro\`;`;
      expect(scanFile(fixture, '.ts').map(h => h.label)).toContain('fal-flux');
    });

    it('catches a raw queue.fal.run flux endpoint literal', () => {
      const fixture = `const url = 'https://queue.fal.run/fal-ai/flux-pro/requests';`;
      expect(scanFile(fixture, '.ts').map(h => h.label)).toContain('fal-flux');
    });

    it('catches a Picsum stock-photo fallback', () => {
      const fixture = 'return `https://picsum.photos/seed/${seed}/800/600`;';
      expect(scanFile(fixture, '.ts').map(h => h.label)).toContain('picsum');
    });

    it('catches Gemini generateContent() called with responseModalities including IMAGE', () => {
      const fixture = `
        await fetch(url + ':generateContent', {
          body: JSON.stringify({
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
          }),
        });
      `;
      expect(scanFile(fixture, '.ts').map(h => h.label)).toContain(
        'gemini-generateContent'
      );
    });

    it('catches a Gemini image-model id interpolated into a .../models/<id>:generateContent URL', () => {
      // Real shape from scripts/generate-ccw-real-product-creatives.ts.
      const fixture = `
        const url = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=\${apiKey}\`;
      `;
      expect(scanFile(fixture, '.ts').map(h => h.label)).toContain(
        'gemini-model-literal'
      );
    });

    it('catches a bare Gemini image-model literal assignment alongside call evidence elsewhere in the file', () => {
      // Real shape from scripts/generate-ccw-real-product-creatives.ts:
      // `return { provider: 'google', model: 'gemini-3-pro-image-preview' };`
      const fixture = `
        await fetch(url + ':generateContent');
        function result() {
          return { provider: 'google', model: 'gemini-3-pro-image-preview' };
        }
      `;
      expect(scanFile(fixture, '.ts').map(h => h.label)).toContain(
        'gemini-model-literal'
      );
    });

    it('catches a "nano-banana" literal used as a live value', () => {
      const fixture = `const legacyProvider = 'nano-banana';`;
      expect(scanFile(fixture, '.ts').map(h => h.label)).toContain(
        'gemini-nano-banana'
      );
    });

    it('does NOT flag a bare Gemini model-id literal with no call evidence in the file (data/catalog files)', () => {
      const fixture = `export const IMAGE_MODELS = [{ id: 'gemini-2.5-flash-image', provider: 'gemini' }];`;
      expect(scanFile(fixture, '.ts')).toEqual([]);
    });

    it('does NOT flag a text-only Gemini generateContent call (no image modality, no image model)', () => {
      const fixture = `
        await fetch(
          \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${apiKey}\`,
          { body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
        );
      `;
      expect(scanFile(fixture, '.ts')).toEqual([]);
    });

    it('does NOT flag a prose sentence that merely mentions a model name, with no call evidence', () => {
      const fixture =
        "detail: 'Google Nano Banana Pro / gemini-3-pro-image-preview backgrounds composited unchanged.'";
      expect(scanFile(fixture, '.ts')).toEqual([]);
    });

    it('does NOT flag a banned-pattern name mentioned only inside a block comment (regression: scripts/brand-video-worker.ts header doc)', () => {
      const fixture = `
        /**
         * Images — generated via the shared generateImage() service. This
         * replaced the old direct Gemini "nano-banana" adapter and the
         * arbitrary IMAGE_API_URL override.
         */
        export async function renderBeat() {}
      `;
      expect(scanFile(fixture, '.ts')).toEqual([]);
    });

    it('still catches a live violation sitting right next to an unrelated block comment', () => {
      const fixture = `
        /** Some unrelated docs. */
        const legacyProvider = 'nano-banana';
      `;
      expect(scanFile(fixture, '.ts').map(h => h.label)).toContain(
        'gemini-nano-banana'
      );
    });

    it('strips Python # comments the same way (regression coverage for .py files)', () => {
      const fixture = `
# uses picsum.photos as a documentation example only
def noop():
    pass
      `;
      expect(scanFile(fixture, '.py')).toEqual([]);
    });

    it('produces the required failure headline naming the offending file', () => {
      const message = formatFailureMessage([
        {
          file: 'scripts/example.ts',
          hits: [
            {
              label: 'openai-images',
              detail: 'OpenAI images/generations call',
            },
          ],
        },
      ]);
      expect(message).toContain('scripts/example.ts');
      expect(message).toContain(
        'Direct image-generation call outside lib/services/ai — route through ' +
          'generateImage() (Real Images Only mandate, spec 2026-07-12)'
      );
    });
  });

  describe('self-test — the allowlist', () => {
    it('exempts the grounded service file itself', () => {
      expect(isAllowed('lib/services/ai/image-generation.ts')).toBe(true);
    });

    it('exempts provider adapters under lib/services/ai/image/providers/', () => {
      expect(isAllowed('lib/services/ai/image/providers/flux-fal.ts')).toBe(
        true
      );
    });

    it('exempts each sanctioned exception and nothing else', () => {
      expect(isAllowed('lib/video/drift-canary.ts')).toBe(true);
      expect(isAllowed('app/api/demo/image/route.ts')).toBe(true);
      expect(isAllowed('app/api/demo/analyze/route.ts')).toBe(true);
      expect(isAllowed('scripts/generate-ccw-real-product-creatives.ts')).toBe(
        false
      );
    });
  });
});
