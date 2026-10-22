/**
 * Search-engine sitemap "ping" client — retired.
 *
 * Both anonymous sitemap ping endpoints are gone:
 *  - Google deprecated its sitemap ping on 26/06/2023; requests return 404
 *    (https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping).
 *  - Bing removed anonymous sitemap submission on 13/05/2022; requests
 *    return 410 (https://blogs.bing.com/webmaster/may-2022/Spring-cleaning-Removed-Bing-anonymous-sitemap-submission).
 * Live probe 22/10/2026: Google 404, Bing 410.
 *
 * Sitemap discovery now goes through:
 *  - Google Search Console sitemaps.submit (`lib/google/search-console.ts`),
 *  - IndexNow (`lib/indexnow`), and
 *  - Bing Webmaster SubmitFeed (`lib/bing-webmaster`).
 *
 * These functions keep their shape so existing callers compile, but they
 * send nothing and say so: every result is `pinged: false, retired: true`.
 * A retired ping must never look like a successful one.
 *
 * @see SYN-840 (parent: SYN-834 epic)
 */

import type { PingResult, PingTarget } from './types';

export const SITEMAP_DISCOVERY_ROUTES =
  'Google Search Console sitemaps.submit (lib/google/search-console.ts), ' +
  'IndexNow (lib/indexnow) and Bing Webmaster SubmitFeed (lib/bing-webmaster)';

const RETIRED_SINCE: Record<PingTarget, string> = {
  google: 'Google retired its sitemap ping endpoint (404 since 2023)',
  bing: 'Bing removed anonymous sitemap ping (410 since 2022)',
};

/**
 * Report that the sitemap ping for `target` is retired. Sends no request;
 * the sitemap URL and fetch option are accepted for caller compatibility.
 */
export async function pingSearchEngine(
  target: PingTarget,
  _sitemapUrl: string,
  _opts: { fetchImpl?: typeof fetch } = {}
): Promise<PingResult> {
  return {
    target,
    pinged: false,
    retired: true,
    reason: `${RETIRED_SINCE[target]}; not sent. Use ${SITEMAP_DISCOVERY_ROUTES}.`,
    attemptedAt: new Date().toISOString(),
  };
}

/**
 * Report one retired result per target (Google + Bing by default). Sends no
 * request. `fetchImpl` is accepted for caller compatibility and ignored.
 */
export async function pingAllSearchEngines(
  sitemapUrl: string,
  opts: { fetchImpl?: typeof fetch; targets?: readonly PingTarget[] } = {}
): Promise<PingResult[]> {
  const targets = opts.targets ?? (['google', 'bing'] as const);
  return Promise.all(targets.map(t => pingSearchEngine(t, sitemapUrl)));
}
