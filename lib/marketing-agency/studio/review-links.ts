/**
 * Fresh review links for the studio board, signed each time the board is
 * read. A link saved when a draft was loaded expires (35 days for CCW), and
 * nothing re-signed it, so a person had to re-run the loader. The draft keeps
 * the durable reference (metadata.storageBucket + storagePath); this signs
 * from that.
 *
 * Only review copies in an allowed bucket, under the client's own folder,
 * are signed: a draft row can never be used to sign another client's file.
 * A link that cannot be made is reported on the card, never shown as a
 * player that will not play.
 */

/** Long enough for one review session; the board signs again on reload. */
export const STUDIO_REVIEW_LINK_TTL_SECONDS = 6 * 60 * 60;

/** Private buckets that hold client review copies. */
export const STUDIO_REVIEW_BUCKETS: readonly string[] = ['media-uploads'];

export type SignUrls = (
  bucket: string,
  paths: string[],
  ttlSeconds: number
) => Promise<string[]>;

interface DraftWithVideo {
  clientSlug?: string | null;
  videoUrl?: string | null;
  metadata?: unknown;
}

export type WithReviewLink<T> = T & { videoError?: string };

function storedCopy(
  draft: DraftWithVideo,
  clientSlug: string
): { bucket: string; path: string } | 'not-stored' | 'not-allowed' {
  const meta =
    draft.metadata && typeof draft.metadata === 'object'
      ? (draft.metadata as Record<string, unknown>)
      : {};
  const bucket = meta.storageBucket;
  const path = meta.storagePath;
  if (typeof bucket !== 'string' && typeof path !== 'string') {
    return 'not-stored';
  }
  if (
    typeof bucket !== 'string' ||
    typeof path !== 'string' ||
    !STUDIO_REVIEW_BUCKETS.includes(bucket) ||
    !path.startsWith(`${clientSlug}/`) ||
    path.split('/').some(part => part === '' || part === '.' || part === '..')
  ) {
    return 'not-allowed';
  }
  return { bucket, path };
}

/**
 * Replace each stored review copy's videoUrl with a link signed now. Drafts
 * with no stored copy keep their videoUrl unchanged.
 */
export async function withFreshReviewLinks<T extends DraftWithVideo>(
  drafts: T[],
  clientSlug: string,
  signUrls: SignUrls,
  onSignError?: (bucket: string, error: unknown) => void
): Promise<Array<WithReviewLink<T>>> {
  const out: Array<WithReviewLink<T>> = drafts.map(d => ({ ...d }));
  const byBucket = new Map<string, Array<{ index: number; path: string }>>();

  out.forEach((draft, index) => {
    const copy = storedCopy(draft, clientSlug);
    if (copy === 'not-stored') return;
    if (copy === 'not-allowed') {
      draft.videoUrl = null;
      draft.videoError =
        'This video is stored outside the review area, so it cannot be shown.';
      return;
    }
    const list = byBucket.get(copy.bucket) ?? [];
    list.push({ index, path: copy.path });
    byBucket.set(copy.bucket, list);
  });

  for (const [bucket, items] of byBucket) {
    try {
      const urls = await signUrls(
        bucket,
        items.map(item => item.path),
        STUDIO_REVIEW_LINK_TTL_SECONDS
      );
      if (urls.length !== items.length) {
        throw new Error(`signed ${urls.length} of ${items.length} links`);
      }
      items.forEach((item, n) => {
        out[item.index].videoUrl = urls[n];
      });
    } catch (error) {
      onSignError?.(bucket, error);
      for (const item of items) {
        out[item.index].videoUrl = null;
        out[item.index].videoError =
          'The video link could not be created just now. Reload the page to try again.';
      }
    }
  }
  return out;
}
