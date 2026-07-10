/**
 * Reference-library resolver — single source of truth over
 * public/reference-library/manifest.json. Returns OWNED-ONLY image paths for
 * grounding (creative-director REM-1 / CCW authority-manifest "no fake renders").
 * Returns site-relative paths; the caller resolves them to absolute URLs.
 */
import fs from 'fs';
import path from 'path';
import { detectIndustry } from '@/lib/demo/industry-classifier';
import { logger } from '@/lib/logger';

export interface ManifestImage {
  file: string;
  width: number;
  height: number;
  source: string;
}
export interface ManifestSubject {
  rights?: string;
  label: string;
  images?: ManifestImage[];
}
export interface ManifestIndustry {
  label: string;
  keywords?: string[];
  subjects: Record<string, ManifestSubject>;
}
export interface Manifest {
  version: number;
  industries: Record<string, ManifestIndustry>;
}

export interface ReferenceSubjectSummary {
  key: string;
  label: string;
  count: number;
  rights: string;
}
export interface ReferenceSetSummary {
  industry: string;
  label: string;
  subjects: ReferenceSubjectSummary[];
}
export interface ResolvedReferences {
  industry: string | null;
  subject: string | null;
  imagePaths: string[];
  count: number;
}

const MANIFEST_PATH = path.join(
  process.cwd(),
  'public/reference-library/manifest.json'
);

let cache: Manifest | null = null;
function loadManifest(): Manifest {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
  } catch (error) {
    logger.warn(
      'reference-library: failed to load manifest, falling back to empty',
      {
        error: error instanceof Error ? error.message : String(error),
      }
    );
    cache = { version: 1, industries: {} };
  }
  return cache;
}

function ownedSubjects(
  industry: ManifestIndustry
): Array<[string, ManifestSubject]> {
  return Object.entries(industry.subjects).filter(
    ([, s]) => s.rights === 'owned' && (s.images?.length ?? 0) > 0
  );
}

export function listFromManifest(m: Manifest): ReferenceSetSummary[] {
  return Object.entries(m.industries).map(([industry, data]) => ({
    industry,
    label: data.label,
    subjects: Object.entries(data.subjects).map(([key, s]) => ({
      key,
      label: s.label,
      count: s.images?.length ?? 0,
      rights: s.rights ?? 'unknown',
    })),
  }));
}

export function listReferenceSets(): ReferenceSetSummary[] {
  return listFromManifest(loadManifest());
}

/** Match a prompt to an industry key using the manifest's own keywords,
 *  gated by the coarse classifier so unrelated prompts never ground. */
function autoDetectIndustry(prompt: string, m: Manifest): string | null {
  const t = prompt.toLowerCase();
  // Gate: only attempt for cleaning/restoration prompts.
  if (detectIndustry(prompt) !== 'cleaning & restoration') return null;
  let best: { key: string; hits: number } | null = null;
  for (const [key, data] of Object.entries(m.industries)) {
    const hits = (data.keywords ?? []).filter(k =>
      t.includes(k.toLowerCase())
    ).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { key, hits };
  }
  return best?.key ?? null;
}

export function resolveFromManifest(
  m: Manifest,
  opts: {
    set?: string;
    prompt?: string;
    max?: number;
  }
): ResolvedReferences {
  const empty: ResolvedReferences = {
    industry: null,
    subject: null,
    imagePaths: [],
    count: 0,
  };
  const max = Math.max(0, opts.max ?? 4);

  const industryKey =
    opts.set ?? (opts.prompt ? autoDetectIndustry(opts.prompt, m) : null);
  if (!industryKey) return empty;

  if (!Object.hasOwn(m.industries, industryKey)) return empty;
  const industry = m.industries[industryKey];
  if (!industry) return empty;

  const owned = ownedSubjects(industry);
  if (owned.length === 0) return empty; // rights guard: nothing owned here

  const [subjectKey, subject] = owned[0];
  const imagePaths = (subject.images ?? [])
    .slice(0, max)
    .map(img => `/reference-library/${industryKey}/${img.file}`);

  return {
    industry: industryKey,
    subject: subjectKey,
    imagePaths,
    count: imagePaths.length,
  };
}

export function resolveReferences(opts: {
  set?: string;
  prompt?: string;
  max?: number;
}): ResolvedReferences {
  return resolveFromManifest(loadManifest(), opts);
}
