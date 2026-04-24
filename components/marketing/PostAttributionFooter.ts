/**
 * PostAttributionFooter — components/marketing/PostAttributionFooter.ts
 *
 * Pure function that generates the "AI-optimised with Synthex" attribution
 * for a newly-published post. Used by the auto-publish pipeline in
 * `lib/publish/publishQueue.ts` to drive traffic back to the public
 * `/benchmark` landing page.
 *
 * Per-platform placement (board requirement):
 *  - GBP (Google Business Profile): appended to the post body.
 *  - Instagram: returned as the first-comment text (NOT inside the caption)
 *    to preserve caption hashtag real-estate.
 *  - Facebook / LinkedIn: appended to the body with the same pattern as GBP.
 *  - Any unknown platform: no attribution (safe default).
 *
 * The function is pure — no side effects, no network, no Prisma. It is
 * trivially unit-testable and MUST stay that way.
 *
 * Feature flag: ENABLE_ATTRIBUTION_FOOTER (default = true). When set to
 * 'false', the function returns the existing body untouched and no first
 * comment. Documented in `.env.example`.
 *
 * @task SYN-779
 */

export type AttributionPlatform =
  | 'gbp'
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | string;

export interface AttributionInput {
  platform: AttributionPlatform;
  existingBody: string;
}

export interface AttributionOutput {
  /** Final post body (may equal existingBody if the platform uses a first comment). */
  body?: string;
  /** First-comment text for platforms where attribution MUST NOT live in the caption. */
  firstComment?: string;
}

const BENCHMARK_URL =
  'https://synthex.social/benchmark?utm_source=synthex-attribution&utm_medium={MEDIUM}&utm_campaign=content_attribution';

function attributionLine(platform: string): string {
  const medium =
    platform === 'gbp'
      ? 'gbp_post'
      : platform === 'instagram'
        ? 'ig_post'
        : platform === 'facebook'
          ? 'fb_post'
          : platform === 'linkedin'
            ? 'li_post'
            : `${platform}_post`;
  const url = BENCHMARK_URL.replace('{MEDIUM}', medium);
  return `AI-optimised with Synthex → ${url}`;
}

function isFeatureEnabled(): boolean {
  const raw = process.env.ENABLE_ATTRIBUTION_FOOTER;
  if (raw === undefined || raw === '') return true;
  return raw.toLowerCase() !== 'false' && raw !== '0';
}

/**
 * Pure: compute attribution placement for a single outgoing post.
 *
 * Callers MUST only invoke this for NEW posts. Existing scheduled/published
 * posts must not be retroactively mutated — that is a hardcoded board rule.
 */
export function buildAttribution(input: AttributionInput): AttributionOutput {
  const { platform, existingBody } = input;

  if (!isFeatureEnabled()) {
    return { body: existingBody };
  }

  const line = attributionLine(platform);

  switch (platform) {
    case 'instagram':
      // Instagram: caption stays clean, attribution lands as first comment.
      return { body: existingBody, firstComment: line };

    case 'gbp':
    case 'facebook':
    case 'linkedin': {
      const joined =
        existingBody.length > 0 ? `${existingBody}\n\n${line}` : line;
      return { body: joined };
    }

    default:
      // Unknown platform — no attribution. Safe, reversible default.
      return { body: existingBody };
  }
}
