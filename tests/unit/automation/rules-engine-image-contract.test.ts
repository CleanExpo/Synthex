/**
 * Contract test — Real Images Only mandate
 * (docs/superpowers/specs/2026-07-12-real-images-only-design.md, Part B
 * "Automation rules engine" bullet).
 *
 * lib/automation/rules-engine.ts declares `generate_image` as a latent
 * ActionType (RA sweep finding: "the action type exists in the automation
 * contract but has no execution path today"). If/when someone wires up an
 * executor, it MUST call the shared, grounded-by-default
 * `generateImage()` (lib/services/ai/image-generation.ts) — an autonomous,
 * unattended image-generation trigger is the highest-slop-risk class per the
 * sweep, so it cannot be allowed to call a provider directly.
 *
 * This is a TODO-guard, not a full structural analyzer: it (1) pins today's
 * reality that no executor exists, so it starts green, and (2) grep-checks
 * any file under lib/automation/ that DOES add a `case 'generate_image':`
 * branch for the required import + call. A sufficiently determined future
 * implementer could dodge the grep (e.g. a dynamic string built at runtime);
 * this test catches the naive/common case — a case branch that fetches a
 * provider endpoint directly — not every possible obfuscation.
 *
 * FUTURE IMPLEMENTER: when you add `case 'generate_image':` to
 * RulesEngine.executeAction() (or any executor under lib/automation/), that
 * same file must `import { generateImage } from '@/lib/services/ai/image-generation'`
 * and actually call `generateImage(...)` from the branch — grounded-by-default,
 * LoRA auto-applied, blocked when the subject has no owned references. Do NOT
 * call OpenAI/Stability/Gemini/fal directly; that reopens the ungrounded,
 * unattended-trigger pathway this mandate closed.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const AUTOMATION_DIR = path.join(process.cwd(), 'lib', 'automation');

function listTsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(full);
    if (!entry.isFile()) return [];
    if (!entry.name.endsWith('.ts')) return [];
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts'))
      return [];
    return [full];
  });
}

// Matches the same `case 'x':` dispatch style every other ActionType already
// uses in RulesEngine.executeAction() (see the switch a few lines above the
// `default:` branch in rules-engine.ts).
const EXECUTOR_CASE = /case\s+['"]generate_image['"]\s*:/;
const IMPORTS_IMAGE_SERVICE =
  /from\s+['"](?:@\/lib\/services\/ai\/image-generation|(?:\.{1,2}\/)+.*services\/ai\/image-generation)['"]/;
const CALLS_GENERATE_IMAGE = /\bgenerateImage\s*\(/;

describe('automation rules engine — generate_image action contract', () => {
  it('declares generate_image as a known action type but has no executor yet (TODO-guard)', () => {
    const rulesEngineSrc = fs.readFileSync(
      path.join(AUTOMATION_DIR, 'rules-engine.ts'),
      'utf8'
    );

    // Still a known ActionType union member...
    expect(rulesEngineSrc).toContain("'generate_image'");
    // ...but executeAction() has no case for it — it falls through to the
    // `default: … 'Unknown action type'` branch. This assertion is designed
    // to fail the moment someone wires one up, which is exactly the signal
    // that the next test's requirement needs to be satisfied.
    expect(rulesEngineSrc).not.toMatch(EXECUTOR_CASE);
  });

  it('routes any future generate_image executor through generateImage() (real images only)', () => {
    const files = listTsFiles(AUTOMATION_DIR);
    const violations: string[] = [];

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      if (!EXECUTOR_CASE.test(src)) continue;

      const relative = path.relative(process.cwd(), file);
      if (!IMPORTS_IMAGE_SERVICE.test(src)) {
        violations.push(
          `${relative}: has a 'generate_image' executor but does not import generateImage from lib/services/ai/image-generation`
        );
      }
      if (!CALLS_GENERATE_IMAGE.test(src)) {
        violations.push(
          `${relative}: has a 'generate_image' executor but never calls generateImage(...)`
        );
      }
    }

    expect(violations).toEqual([]);
  });
});
