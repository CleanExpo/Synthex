/**
 * lib/landing-page — public entry point.
 *
 * SYN-838 foundation primitives for per-suburb landing-page generation
 * on disasterrecovery.com.au. Pure deterministic builder + gating
 * validators. AI-copy generation and cross-repo deploy are out of
 * scope here (separate tickets after CEO/auth sign-off).
 *
 * @see SYN-838 (parent: SYN-834 epic)
 * @see lib/landing-page/README.md
 */

export {
  AI_AS_ACTOR_REGEX,
  CATEGORY_CLAIM_REGEX,
  DR_SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABEL,
} from './types';

export type {
  BrandIdentity,
  BuildLandingPageInput,
  BuildLandingPageOptions,
  BuildLandingPageResult,
  DrServiceCategory,
  ValidationFinding,
} from './types';

export { buildDeterministicCopy } from './template';
export { buildLandingPageJsonLd } from './jsonld-builder';
export { validateLandingPageCopy } from './validators';
export { buildLandingPage } from './page-builder';
