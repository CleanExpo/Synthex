/**
 * Private reference grounding.
 *
 * Owned but SENSITIVE reference images (real customer job-site photos) must
 * never live in the public repo/site. They sit in a PRIVATE Supabase bucket
 * (`reference-library-private`) described by `_private-manifest.json`. At
 * generation time we mint short-lived SIGNED URLs so fal can fetch them for
 * grounding, and nobody else can.
 *
 * NOT PROVISIONED: the repo has no private storage helper (the only real
 * one, lib/storage/platform-storage, writes under public/, which would leak
 * these photos). Until a private store exists, resolution reports the
 * reference-library-private bucket as unavailable (logged with the reason)
 * and returns [] — the result callers already handle by falling back to
 * public/text-only grounding. Never an error, never a leak.
 */
import { logger } from '@/lib/logger';
import { tableUnavailable } from '@/lib/api/not-provisioned';

import { MAX_REFERENCE_MEGAPIXELS } from '@/lib/services/ai/image/registry';

const BUCKET = 'reference-library-private';

interface PrivateImage {
  path: string;
  bytes?: number;
  contentHash?: string;
  source?: string;
  /**
   * Pixel dimensions. OPTIONAL in the data and REQUIRED to be sent: fal bills
   * these photos as input megapixels, so an image whose size is unrecorded
   * cannot be shown to fit `MAX_REFERENCE_MEGAPIXELS` and is excluded rather
   * than assumed to fit (SYN-1115 release review, pass 6).
   */
  width?: number;
  height?: number;
}
interface PrivateSubject {
  rights: string;
  label?: string;
  images?: PrivateImage[];
}
export interface PrivateManifest {
  version?: number;
  industries?: Record<string, { subjects?: Record<string, PrivateSubject> }>;
}

/**
 * Is this private image PROVABLY within the megapixel bound its price assumes?
 *
 * These photos are appended to the same fal requests as the public ones and
 * billed as input megapixels, but the public ceiling never covered them — the
 * private manifest records `bytes`, not pixels. A 16 MP customer photo was
 * therefore sent while being priced at the 4 MP bound.
 *
 * Unrecorded dimensions are treated as a REFUSAL, not a pass. The point of the
 * bound is that the price is a consequence of something the code enforces;
 * letting an unmeasured image through would put the assumption straight back.
 * Public references still ground the run, so this degrades quality rather than
 * breaking generation — and if a subject ends up with no references at all, the
 * caller's existing no-coverage path blocks it, which is the correct
 * fail-closed outcome (SYN-1115 release review, pass 6).
 */
function withinPricedBound(img: PrivateImage): boolean {
  const { width, height } = img;
  if (typeof width !== 'number' || typeof height !== 'number') {
    logger.warn(
      'private reference excluded: dimensions not recorded, so it cannot be proven within the priced bound',
      { path: img.path, boundMegapixels: MAX_REFERENCE_MEGAPIXELS }
    );
    return false;
  }
  const megapixels = (width * height) / (1024 * 1024);
  if (megapixels > MAX_REFERENCE_MEGAPIXELS) {
    logger.warn(
      'private reference excluded: above the priced megapixel bound',
      {
        path: img.path,
        megapixels: Math.round(megapixels * 100) / 100,
        boundMegapixels: MAX_REFERENCE_MEGAPIXELS,
      }
    );
    return false;
  }
  return true;
}

/**
 * Paths of the owned private images of an industry that may be sent, in
 * first-declared order, capped at `max` and filtered by the priced bound.
 */
export function selectPrivatePaths(
  manifest: PrivateManifest,
  industry: string,
  max: number
): string[] {
  const subjects = manifest.industries?.[industry]?.subjects;
  if (!subjects) return [];

  const paths: string[] = [];
  for (const subject of Object.values(subjects)) {
    if (subject.rights !== 'owned' || !subject.images?.length) continue;
    for (const img of subject.images) {
      if (!img.path) continue;
      if (!withinPricedBound(img)) continue;
      paths.push(img.path);
      if (paths.length >= max) break;
    }
    if (paths.length >= max) break;
  }
  return paths;
}

/**
 * Resolve short-lived signed URLs for the owned private images of an industry.
 * The private bucket is not provisioned, so this logs the unavailable reason
 * and returns [] (never throws, never signs or leaks anything).
 */
export async function resolvePrivateReferenceUrls(
  industry: string | null | undefined,
  max = 4
): Promise<string[]> {
  if (!industry || max <= 0) return [];
  logger.warn('private reference grounding unavailable', {
    industry,
    ...tableUnavailable(BUCKET),
  });
  return [];
}
