/**
 * Canonical UTM builder — lib/utm/build-utm-url.ts
 *
 * Single source of truth for appending UTM parameters to a link. Before this,
 * UTM strings were hand-assembled ad-hoc across email/social output (SYN-493),
 * which risked drift in parameter names and encoding. Every outbound link that
 * needs tagging now flows through `buildUtmUrl`.
 *
 * Read side (leave as-is): `lib/attribution/channels.ts` reads `utm_medium` off
 * an engagement event and buckets it via `classifyChannel` (organic/owned/paid).
 * This builder writes the same `utm_medium` key, so links it produces stay
 * classifiable — an unknown medium simply falls back to `organic`, exactly as
 * the classifier already handles legacy touchpoints.
 *
 * Pure util: no Prisma, no network, no side effects.
 *
 * @task SYN-493
 */

import { z } from 'zod';

/**
 * Canonical UTM parameter set. `source`, `medium`, `campaign` are the standard
 * required trio; `term` and `content` are optional. Kept as plain strings so any
 * campaign taxonomy slots in — the attribution classifier reads `medium` and
 * defaults unknown values to `organic`, so no allow-list is enforced here.
 */
export const utmParamsSchema = z.object({
  source: z.string().min(1),
  medium: z.string().min(1),
  campaign: z.string().min(1),
  term: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
});

export type UtmParams = z.infer<typeof utmParamsSchema>;

/**
 * Append UTM parameters to an absolute URL.
 *
 * - Validates params against `utmParamsSchema` (throws on invalid input).
 * - Preserves any existing query string on `baseUrl` (e.g. `?ref=…`).
 * - Uses the WHATWG URL / URLSearchParams API, so values are encoded exactly
 *   once — no double-encoding.
 * - Optional `term` / `content` are omitted entirely when not supplied.
 *
 * `baseUrl` must be absolute (e.g. `https://synthex.social/refer`).
 */
export function buildUtmUrl(baseUrl: string, params: UtmParams): string {
  const validated = utmParamsSchema.parse(params);

  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', validated.source);
  url.searchParams.set('utm_medium', validated.medium);
  url.searchParams.set('utm_campaign', validated.campaign);
  if (validated.term !== undefined) {
    url.searchParams.set('utm_term', validated.term);
  }
  if (validated.content !== undefined) {
    url.searchParams.set('utm_content', validated.content);
  }

  return url.toString();
}
