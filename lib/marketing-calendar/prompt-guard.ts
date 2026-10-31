/**
 * The portfolio content rule, checked on the finished prompt.
 *
 * Each portfolio brand has words it never uses (for Unite Group: the group's
 * own businesses and their industry). Rather than list every stored field a
 * prompt might read, the check runs on the prompt text itself, at the point
 * it goes to the model: whatever field fed it, a forbidden word in the prompt
 * stops the call. Orgs outside the portfolio are never checked.
 */

import {
  PORTFOLIO_BRANDS,
  brandHits,
  type PortfolioBrandProfile,
} from './portfolio-brands';

export class ForbiddenPromptError extends Error {
  readonly code = 'FORBIDDEN_PROMPT';
  constructor(
    readonly orgSlug: string,
    readonly hits: string[]
  ) {
    super(
      `Prompt for ${orgSlug} names words this brand never uses: ${hits.join(', ')}`
    );
    this.name = 'ForbiddenPromptError';
  }
}

export function brandForSlug(
  slug: string | null | undefined
): PortfolioBrandProfile | undefined {
  return slug ? PORTFOLIO_BRANDS.find(b => b.orgSlug === slug) : undefined;
}

/** The brand's forbidden words found in prompt text (see brandHits). */
export function promptHits(text: string, brand: PortfolioBrandProfile) {
  return brandHits(text, brand);
}

/** Throws ForbiddenPromptError when a portfolio brand's prompt names a forbidden word. */
export function assertPromptClean(
  orgSlug: string | null | undefined,
  parts: Array<string | null | undefined>
) {
  const brand = brandForSlug(orgSlug);
  if (!brand) return;
  const hits = promptHits(parts.filter(Boolean).join('\n'), brand);
  if (hits.length > 0) throw new ForbiddenPromptError(brand.orgSlug, hits);
}
