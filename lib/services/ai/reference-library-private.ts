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
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const BUCKET = 'reference-library-private';
const MANIFEST_PATH = '_private-manifest.json';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h — covers a generation, then expires
const MANIFEST_CACHE_MS = 5 * 60 * 1000;

interface PrivateImage {
  path: string;
  bytes?: number;
  contentHash?: string;
  source?: string;
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client =
    url && key
      ? createClient(url, key, { auth: { persistSession: false } })
      : null;
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
        if (img.path) paths.push(img.path);
        if (paths.length >= max) break;
      }
      if (paths.length >= max) break;
    }
    if (paths.length === 0) return [];

    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return [];
    return data
      .map(d => d.signedUrl)
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
  } catch (err) {
    logger.warn('private reference grounding skipped', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
