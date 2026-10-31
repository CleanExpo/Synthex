/**
 * Every code path that calls a model for an organisation sets that
 * organisation's prompt scope, so providers can check the request against
 * the brand before anything is sent (lib/ai/prompt-scope.ts).
 *
 * Static guard: a file under lib/ or app/ that calls a model and names an
 * organisation must also set or check the scope, or be listed below with
 * the reason it needs none. It is a grep floor, not a structural analysis:
 * it catches a new entry point written the usual way, not every indirection.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOTS = ['lib', 'app'];

const CALLS_MODEL =
  /getAIProvider\(|modelFetch\(|\.chat\.completions\.create\(|\.messages\.create\(|callAI\(|\.complete\(\{|scoreContent\(|generateContent\(/;
const NAMES_ORG = /\b(organizationId|orgId|clientId)\b/;
const SETS_SCOPE =
  /enterPromptOrg\(|withPromptOrg\(|assertOrgPromptClean\(|assertPromptClean\(|governedCall\b|governedRouteCall\b|routedCall\b/;

/** Files that call a model and name an org but need no scope, with why. */
const NO_SCOPE_NEEDED: Record<string, string> = {
  'lib/ai/content-variations.ts':
    'its model call takes no organisation; organizationId only labels A/B test rows',
  'lib/ai/governor/byok.ts':
    'names getAIProvider in a doc comment only; sends no content',
  'lib/hermes/voice/gate.ts':
    'judges a draft through routedCall keyed by brand slug, not an org id',
};

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name))
      out.push(full);
  }
}

function sourceFiles() {
  const files: string[] = [];
  for (const root of ROOTS) walk(path.join(process.cwd(), root), files);
  return files.map(f =>
    path.relative(process.cwd(), f).split(path.sep).join('/')
  );
}

describe('org-carrying model calls set the prompt scope', () => {
  const files = sourceFiles();

  it('finds the known entry points (the scan is live)', () => {
    expect(files).toContain('app/api/ask-synthex/route.ts');
    expect(files).toContain('lib/calendar/captionGenerator.ts');
  });

  it('every file that calls a model for an organisation sets or checks its scope', () => {
    const unscoped = files.filter(f => {
      if (NO_SCOPE_NEEDED[f]) return false;
      const text = fs.readFileSync(f, 'utf8');
      return (
        CALLS_MODEL.test(text) && NAMES_ORG.test(text) && !SETS_SCOPE.test(text)
      );
    });
    expect(unscoped).toEqual([]);
  });

  it('every listed exception still exists and still calls a model', () => {
    for (const f of Object.keys(NO_SCOPE_NEEDED)) {
      expect(CALLS_MODEL.test(fs.readFileSync(f, 'utf8'))).toBe(true);
    }
  });
});
