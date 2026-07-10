/**
 * LLM copy hook — orchestration.
 *
 * Phase 3 of the AI-Websites product line. Lets an LLM write the site copy
 * while the SAME validator gate (Aid Rule, ACL §18 category claims, schema/copy
 * match, brand forbidden-words) still governs what can ship. The loop is:
 *
 *   1. Ask the CopyWriter for copy.
 *   2. Run it through `generateSite` (which validates).
 *   3. If a block finding survives, re-ask the CopyWriter WITH the violations
 *      (bounded retries), so the model repairs its own non-compliant draft.
 *   4. If it still can't comply — or the writer throws — fall back to the
 *      guaranteed-valid deterministic template.
 *
 * The LLM therefore CANNOT ship copy the deterministic path would have blocked.
 * This file is pure orchestration: no API keys, no network — it takes a
 * `CopyWriter` (real or stub), so it is fully unit-testable. The real
 * Anthropic-backed writer lives in `./llm-copywriter`.
 */

import { generateSite, resolveHeroService } from './builder';
import type {
  BusinessService,
  GenerateSiteInput,
  GenerateSiteOptions,
  GenerateSiteResult,
  SiteBrand,
  SiteCopy,
  ValidationFinding,
} from './types';
import type { BusinessProfile } from './types';

/** Everything a CopyWriter needs to draft (or repair) one site's copy. */
export interface CopyWriterInput {
  profile: BusinessProfile;
  brand: SiteBrand;
  /** The resolved hero service the copy must centre on. */
  heroService: BusinessService;
  /**
   * Block-level findings from the previous attempt. Empty on the first pass;
   * on a repair pass the writer must fix every one of these.
   */
  priorViolations: ValidationFinding[];
}

/** A source of site copy — an LLM, a fixture, or any stub in tests. */
export interface CopyWriter {
  write(input: CopyWriterInput): Promise<SiteCopy>;
}

export interface GenerateWithCopyOptions extends GenerateSiteOptions {
  /**
   * Re-prompt attempts allowed after a block finding before falling back to
   * the deterministic template. Default 2 (so up to 3 LLM calls total).
   */
  maxRepairs?: number;
}

/**
 * Generate a site whose copy comes from `copywriter`, gated by the same
 * validators as the deterministic path. Always resolves to a usable result:
 * a validator-passing LLM draft, or the deterministic fallback.
 */
export async function generateSiteWithCopy(
  copywriter: CopyWriter,
  input: GenerateSiteInput,
  opts: GenerateWithCopyOptions = {}
): Promise<GenerateSiteResult> {
  if (!input.profile.services || input.profile.services.length === 0) {
    throw new Error(
      'generateSiteWithCopy: profile.services must contain at least one service'
    );
  }

  const { maxRepairs = 2, ...genOpts } = opts;
  const heroService = resolveHeroService(input);

  let priorViolations: ValidationFinding[] = [];
  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    let copy: SiteCopy;
    try {
      copy = await copywriter.write({
        profile: input.profile,
        brand: input.brand,
        heroService,
        priorViolations,
      });
    } catch {
      // Writer/provider failed — stop retrying and fall back.
      break;
    }

    const result = generateSite(input, { ...genOpts, copyOverride: copy });
    if (result.ok) return result;

    priorViolations = result.validations.filter(v => v.severity === 'block');
  }

  // Guaranteed-valid deterministic copy (no copyOverride).
  return generateSite(input, genOpts);
}
