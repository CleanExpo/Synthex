/**
 * Reference-library resolver — single source of truth over
 * public/reference-library/manifest.json. Returns OWNED-ONLY image paths for
 * grounding (creative-director REM-1 / CCW authority-manifest "no fake renders").
 * Returns site-relative paths; the caller resolves them to absolute URLs.
 */
import { detectIndustry } from '@/lib/demo/industry-classifier';
// The manifest is BUNDLED (imported at build time), NOT read from the
// filesystem. Vercel serverless functions do not include public/ in their
// runtime fs — the CDN serves those assets, but
// `fs.readFileSync(process.cwd()/public/...)` throws ENOENT in the function,
// which silently emptied the reference library in production (grounding no-op).
// Importing the JSON module makes the manifest available in every runtime.
import manifestData from '@/public/reference-library/manifest.json';

export interface ManifestImage {
  file: string;
  width: number;
  height: number;
  source: string;
  imageId?: number;
  position?: number;
  imageSrc?: string;
  contentHash?: string;
}

export type RightsBasis =
  | 'ccw-own-brand'
  | 'ccw-supplier-authorised'
  | 'first-party-photo';

export interface SubjectProvenance {
  source: string;
  vendorKey: string;
  vendorRaw: string;
  sourceUrl?: string;
  ingestedAt: string;
  rightsBasis: RightsBasis;
  rightsAssertionRef?: string;
  rightsNote?: string;
}

export interface ManifestSubject {
  rights?: string;
  label: string;
  images?: ManifestImage[];
  provenance?: SubjectProvenance;
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
  vendor?: string;
  rightsBasis?: string;
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
  vendorKey?: string;
  rightsBasis?: string;
}

let cache: Manifest | null = null;
function loadManifest(): Manifest {
  if (cache) return cache;
  // Bundled import — no filesystem access, so it works identically on Vercel
  // serverless and locally. The manifest is fixed at build time (rebuilt on
  // every deploy), which is the intended behaviour for a curated corpus.
  cache = manifestData as unknown as Manifest;
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
      vendor: s.provenance?.vendorRaw,
      rightsBasis: s.provenance?.rightsBasis,
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

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length >= 3)
  );
}

export function resolveFromManifest(
  m: Manifest,
  opts: { set?: string; prompt?: string; max?: number }
): ResolvedReferences {
  const empty: ResolvedReferences = {
    industry: null,
    subject: null,
    imagePaths: [],
    count: 0,
  };
  const max = Math.max(0, opts.max ?? 4);

  let industryKey: string | null = null;
  let explicitSubject: string | null = null;

  if (opts.set !== undefined) {
    // Explicit-set path: NEVER falls through to prompt auto-detect (empty/malformed fail closed).
    const t = opts.set.trim();
    if (!t) return empty;
    const slash = t.indexOf('/');
    if (slash === -1) {
      industryKey = t;
    } else {
      industryKey = t.slice(0, slash);
      explicitSubject = t.slice(slash + 1);
      if (!industryKey || !explicitSubject) return empty;
    }
  } else {
    industryKey = opts.prompt ? autoDetectIndustry(opts.prompt, m) : null;
  }

  if (!industryKey || !Object.hasOwn(m.industries, industryKey)) return empty;
  const industry = m.industries[industryKey];
  if (!industry) return empty;

  const owned = ownedSubjects(industry);
  if (owned.length === 0) return empty; // rights guard

  let chosen: [string, ManifestSubject] | undefined;
  if (explicitSubject !== null) {
    // Owned-with-images filter enforced by searching `owned`; fail closed otherwise.
    chosen = owned.find(([k]) => k === explicitSubject);
    if (!chosen) return empty;
  } else {
    const promptTokens = opts.prompt
      ? tokenSet(opts.prompt)
      : new Set<string>();
    let best = 0;
    for (const [k, s] of owned) {
      const subjTokens = tokenSet(`${k} ${s.label}`);
      let score = 0;
      for (const tok of promptTokens) if (subjTokens.has(tok)) score++;
      // Strict '>' keeps the FIRST of any tied top scorers (deterministic).
      if (score > best) {
        best = score;
        chosen = [k, s];
      }
    }
    if (best === 0) chosen = owned[0]; // zero-score / no-prompt: today's behaviour
  }

  const [subjectKey, subject] = chosen!;
  const imagePaths = (subject.images ?? [])
    .slice(0, max)
    .map(img => `/reference-library/${industryKey}/${img.file}`);

  return {
    industry: industryKey,
    subject: subjectKey,
    imagePaths,
    count: imagePaths.length,
    vendorKey: subject.provenance?.vendorKey,
    rightsBasis: subject.provenance?.rightsBasis,
  };
}

export function resolveReferences(opts: {
  set?: string;
  prompt?: string;
  max?: number;
}): ResolvedReferences {
  return resolveFromManifest(loadManifest(), opts);
}
