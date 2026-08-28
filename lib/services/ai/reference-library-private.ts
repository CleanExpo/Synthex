/**
 * Private reference grounding.
 *
 * Owned but SENSITIVE reference images (real customer job-site photos) must
 * never live in the public repo/site. They sit in a PRIVATE Supabase bucket
 * (`reference-library-private`) described by `_private-manifest.json`. At
 * generation time we mint short-lived SIGNED URLs so fal can fetch them for
 * grounding, and nobody else can.
 *
 * Fails safe: any misconfiguration (no service-role key, no bucket, no
 * manifest) returns [] so generation silently falls back to public/text-only
 * grounding — never an error, never a leak.
 */
import { createClient, type SupabaseClient } from '@/lib/platform/noop-client';
import { logger } from '@/lib/logger';

import { MAX_REFERENCE_MEGAPIXELS } from '@/lib/services/ai/image/registry';

const BUCKET = 'reference-library-private';
const MANIFEST_PATH = '_private-manifest.json';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h — covers a generation, then expires
const MANIFEST_CACHE_MS = 5 * 60 * 1000;

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
interface PrivateManifest {
  version?: number;
  industries?: Record<string, { subjects?: Record<string, PrivateSubject> }>;
}

let client: SupabaseClient | null | undefined;
function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = createClient();
  return client;
}

let manifestCache: { at: number; data: PrivateManifest } | null = null;
async function loadPrivateManifest(
  sb: SupabaseClient
): Promise<PrivateManifest> {
  if (manifestCache && Date.now() - manifestCache.at < MANIFEST_CACHE_MS) {
    return manifestCache.data;
  }
  const { data, error } = await sb.storage.from(BUCKET).download(MANIFEST_PATH);
  if (error || !data) return { industries: {} };
  try {
    const text = await data.text();
    const parsed = JSON.parse(text) as PrivateManifest;
    manifestCache = { at: Date.now(), data: parsed };
    return parsed;
  } catch {
    return { industries: {} };
  }
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
 * Resolve short-lived signed URLs for the owned private images of an industry.
 * Returns [] on any misconfiguration/absence (never throws).
 */
export async function resolvePrivateReferenceUrls(
  industry: string | null | undefined,
  max = 4
): Promise<string[]> {
  if (!industry || max <= 0) return [];
  const sb = getClient();
  if (!sb) return [];
  try {
    const manifest = await loadPrivateManifest(sb);
    const subjects = manifest.industries?.[industry]?.subjects;
    if (!subjects) return [];

    // owned subjects with images, first-declared order
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
    if (paths.length === 0) return [];

    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return [];
    return (data as Array<{ signedUrl?: string }>)
      .map(d => d.signedUrl)
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
  } catch (err) {
    logger.warn('private reference grounding skipped', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
