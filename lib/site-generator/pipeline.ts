/**
 * GBP → site pipeline: fetch a normalised BusinessProfile, then generate the
 * site section. A thin orchestration over a {@link ProfileFetcher} and
 * {@link generateSite} so the end-to-end "source → live site" flow is one call.
 *
 * The real Google Places / Outscraper fetch plugs in as a ProfileFetcher
 * implementation; nothing here changes when it does.
 */

import { generateSite } from './builder';
import { generateSiteWithCopy } from './copywriter';
import type { CopyWriter, GenerateWithCopyOptions } from './copywriter';
import { applyStarter, inferStarter } from './industry-starters';
import type { ProfileFetcher } from './profile-fetcher';
import type {
  BusinessProfile,
  GenerateSiteInput,
  GenerateSiteOptions,
  GenerateSiteResult,
} from './types';

export interface GenerateFromSourceResult {
  /** The normalised profile the fetcher produced. */
  profile: BusinessProfile;
  /** The generated, validated site section. */
  result: GenerateSiteResult;
}

export async function generateSiteFromSource(
  fetcher: ProfileFetcher,
  query: string,
  brand: GenerateSiteInput['brand'],
  opts: GenerateSiteOptions & { serviceSlug?: string } = {}
): Promise<GenerateFromSourceResult> {
  const profile = await fetcher.fetch(query);
  const { serviceSlug, ...genOpts } = opts;
  const result = generateSite({ brand, profile, serviceSlug }, genOpts);
  return { profile, result };
}

export interface GenerateFromGbpOptions extends GenerateWithCopyOptions {
  /** Target service slug (defaults to the profile's first service). */
  serviceSlug?: string;
  /** Skip industry-starter gap-fill (default: fill when a starter matches). */
  skipStarter?: boolean;
}

/**
 * The full "GBP → live site" capstone in one call: fetch a profile, fill its
 * gaps from an inferred industry starter (GBP has no FAQs), then generate the
 * site with LLM copy gated by every validator (falling back to deterministic
 * copy if the model can't comply). This is the end-to-end pipeline the Phase 3
 * spec targets — the fetcher and copywriter are injected, so it is cred-free
 * and unit-testable; real GBP + a real LLM drop in without touching this file.
 *
 * Starter inference scans every service (GBP's primary category is often niche,
 * e.g. 'Drainage Service', while a secondary — 'Plumber' — is the industry).
 * `applyStarter` only fills empty services/faqs, so the business's real GBP
 * services always win; the starter contributes the missing FAQ scaffolds.
 */
export async function generateSiteFromGbp(
  fetcher: ProfileFetcher,
  copywriter: CopyWriter,
  query: string,
  brand: GenerateSiteInput['brand'],
  opts: GenerateFromGbpOptions = {}
): Promise<GenerateFromSourceResult> {
  const { serviceSlug, skipStarter = false, ...genOpts } = opts;
  let profile = await fetcher.fetch(query);

  if (!skipStarter) {
    const starter = profile.services
      .map(s => inferStarter(s.label))
      .find(Boolean);
    if (starter) profile = applyStarter(profile, starter);
  }

  const result = await generateSiteWithCopy(
    copywriter,
    { brand, profile, serviceSlug },
    genOpts
  );
  return { profile, result };
}
