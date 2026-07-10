/**
 * GBP → site pipeline: fetch a normalised BusinessProfile, then generate the
 * site section. A thin orchestration over a {@link ProfileFetcher} and
 * {@link generateSite} so the end-to-end "source → live site" flow is one call.
 *
 * The real Google Places / Outscraper fetch plugs in as a ProfileFetcher
 * implementation; nothing here changes when it does.
 */

import { generateSite } from './builder';
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
