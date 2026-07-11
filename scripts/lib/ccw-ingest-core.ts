/**
 * CCW catalogue ingestion — PURE core (no network, no fs). The CLI wrapper
 * (scripts/ingest-ccw-catalogue.ts) does all I/O. Spec:
 * docs/superpowers/specs/2026-07-11-ccw-catalogue-ingest-design.md (v2).
 */
import type {
  Manifest,
  ManifestSubject,
  RightsBasis,
} from '@/lib/services/ai/reference-library';

export interface ShopifyImage {
  id: number;
  position: number;
  src: string;
  width: number;
  height: number;
}
export interface ShopifyProduct {
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  images: ShopifyImage[];
}
export type Route =
  | { industry: string }
  | { skip: 'type-skiplist' | 'unmapped' | 'denylist' };

export const RIGHTS_ASSERTION_REF =
  'spec:2026-07-11-ccw-catalogue-ingest-design.md#3-C1';

/** Committed denylist — removed suppliers can never silently return (§6.7). */
export const EXCLUDED_VENDORS: readonly string[] = [];
export const EXCLUDED_HANDLES: readonly string[] = [];

const OWN_BRAND_VENDOR_KEYS = new Set([
  'carpet cleaners warehouse',
  'razorback',
  'razorback sandia',
]);

export const TYPE_TO_INDUSTRY: Record<string, string> = {
  'DOM EQUIP TRUCKMOUNT ACCESS': 'carpet-cleaning',
  'IMP EQUIP TRUCKMOUNT ACCESS': 'carpet-cleaning',
  'DOM EQUIP ROTARYS & SCRUBBERS': 'carpet-cleaning',
  'IMP EQUIP ROTARYS AND SRUBBERS': 'carpet-cleaning',
  'IMP EQUIP ROTARYS AND SRUBBERS CHINA': 'carpet-cleaning',
  'DOM EQUIP VACUUM CLEANERS': 'carpet-cleaning',
  'IMP EQUIP VAC CLEANERS & SPAYE': 'carpet-cleaning',
  'DOM EQUIP METH': 'carpet-cleaning',
  'DOM REST AIRMOVERS': 'water-damage-restoration',
  'IMP REST AIRMOVERS': 'water-damage-restoration',
  'IMP REST AIRMOVERS CHINA': 'water-damage-restoration',
  'IMP REST DEHUMIDIFIERS': 'water-damage-restoration',
  'DOM REST SPEC DRYING': 'water-damage-restoration',
  'IMP REST SPEC DRYING': 'water-damage-restoration',
};

export const SKIPPED_TYPES: ReadonlySet<string> = new Set([
  'DOM EQUIP TILE & GROUT',
  'IMP EQUIP TILE & GROUT',
  'IMP EQUIP AIRCON CLEANING',
]);

export function vendorKeyOf(raw: string): string {
  return raw.trim().toLowerCase();
}

export function rightsBasisFor(vendorKey: string): RightsBasis {
  return OWN_BRAND_VENDOR_KEYS.has(vendorKey)
    ? 'ccw-own-brand'
    : 'ccw-supplier-authorised';
}

export function routeProduct(p: ShopifyProduct): Route {
  if (
    EXCLUDED_VENDORS.includes(vendorKeyOf(p.vendor)) ||
    EXCLUDED_HANDLES.includes(p.handle)
  ) {
    return { skip: 'denylist' };
  }
  if (SKIPPED_TYPES.has(p.product_type)) return { skip: 'type-skiplist' };
  const industry = TYPE_TO_INDUSTRY[p.product_type];
  if (!industry) return { skip: 'unmapped' };
  if (/upholstery/i.test(p.title)) return { industry: 'upholstery-cleaning' };
  return { industry };
}

export function selectImages(p: ShopifyProduct, cap = 4): ShopifyImage[] {
  return [...p.images].sort((a, b) => a.position - b.position).slice(0, cap);
}

export function fileNameFor(handle: string, imageId: number): string {
  return `ccw-${handle}-${imageId}.webp`;
}

/** Insert Shopify's _2048x2048 fit-within variant before the extension, preserving the query. */
export function sizedSrc(src: string): string {
  const [path, query] = src.split('?');
  const dot = path.lastIndexOf('.');
  if (dot === -1) return src;
  const sized = `${path.slice(0, dot)}_2048x2048${path.slice(dot)}`;
  return query ? `${sized}?${query}` : sized;
}

/** Likely spec charts / dimension diagrams — flagged for human spot-check (§6.6). */
export function aspectFlagged(img: ShopifyImage): boolean {
  if (!img.width || !img.height) return false;
  const r = img.width / img.height;
  return r > 3 || r < 1 / 3;
}

/** Flat heuristic (§6.9) — dims-independent by design. */
export function estimateBytes(imageCount: number): number {
  return imageCount * 262_144; // 0.25 MB
}

/** Drift-aware idempotency (§6.5): image-id list equality AND files on disk. */
export function needsIngest(
  existing: ManifestSubject | undefined,
  selected: ShopifyImage[],
  fileExists: (file: string) => boolean
): boolean {
  if (!existing?.images) return true;
  const storedIds = existing.images.map(i => i.imageId ?? -1);
  const freshIds = selected.map(i => i.id);
  if (
    storedIds.length !== freshIds.length ||
    storedIds.some((id, n) => id !== freshIds[n])
  ) {
    return true;
  }
  return existing.images.some(i => !fileExists(i.file));
}

export function buildSubject(
  p: ShopifyProduct,
  processed: Array<{
    image: ShopifyImage;
    file: string;
    width: number;
    height: number;
    contentHash: string;
  }>,
  ingestedAt: string
): ManifestSubject {
  const vendorKey = vendorKeyOf(p.vendor);
  return {
    rights: 'owned',
    label: p.title,
    provenance: {
      source: 'ccw-shopify',
      vendorKey,
      vendorRaw: p.vendor,
      sourceUrl: `https://www.ccwonline.com.au/products/${p.handle}`,
      ingestedAt,
      rightsBasis: rightsBasisFor(vendorKey),
      rightsAssertionRef: RIGHTS_ASSERTION_REF,
    },
    images: processed.map(x => ({
      file: x.file,
      width: x.width,
      height: x.height,
      source: 'ccw-shopify',
      imageId: x.image.id,
      position: x.image.position,
      imageSrc: x.image.src,
      contentHash: x.contentHash,
    })),
  };
}

/** Locate which industry currently owns a subject key, or null if none does. */
export function findSubjectIndustry(m: Manifest, key: string): string | null {
  for (const [ind, data] of Object.entries(m.industries)) {
    if (Object.hasOwn(data.subjects, key)) return ind;
  }
  return null;
}

/**
 * Preserve existing key order; append new; replace-in-place on same key.
 * Never sorts (§7.5). When an addition's key already exists under a
 * DIFFERENT industry (cross-industry re-route), the stale key is deleted
 * from that other industry so a subject can never live under two
 * industries at once.
 */
export function mergeManifest(
  existing: Manifest,
  additions: Array<{ industry: string; key: string; subject: ManifestSubject }>
): Manifest {
  const out: Manifest = JSON.parse(JSON.stringify(existing)) as Manifest;
  for (const a of additions) {
    const ind = out.industries[a.industry];
    if (!ind) continue;
    const staleIndustry = findSubjectIndustry(out, a.key);
    if (staleIndustry && staleIndustry !== a.industry) {
      delete out.industries[staleIndustry].subjects[a.key];
    }
    ind.subjects[a.key] = a.subject; // insertion order: existing keys keep position, new keys append
  }
  return out;
}

export interface ReconcilePlan {
  oldIndustry: string | null;
  routeChanged: boolean;
  mustIngest: boolean; // routeChanged || forced || needsIngest(...)
}

/**
 * Decide whether a catalogue product needs (re-)ingesting this run, and
 * whether its route changed since the last ingest. Pulled out of the CLI's
 * `main()` so route-flip and drift decisions are unit-testable (§6.5).
 */
export function reconcileProduct(
  m: Manifest,
  handle: string,
  newIndustry: string,
  selected: ShopifyImage[],
  fileExists: (industry: string, file: string) => boolean,
  forced: boolean
): ReconcilePlan {
  const key = `ccw-${handle}`;
  const oldIndustry = findSubjectIndustry(m, key);
  const existing = oldIndustry
    ? m.industries[oldIndustry].subjects[key]
    : undefined;
  // Route change → re-ingest even if the image id list is unchanged, so the
  // subject moves to its correct industry and stale files get cleaned up.
  const routeChanged = oldIndustry !== null && oldIndustry !== newIndustry;
  const mustIngest =
    forced ||
    routeChanged ||
    needsIngest(existing, selected, f =>
      fileExists(oldIndustry ?? newIndustry, f)
    );
  return { oldIndustry, routeChanged, mustIngest };
}

/**
 * Which of a subject's previously-ingested files are now de-referenced
 * (§6.5) — either because the image list changed, or because the whole
 * subject moved to a different industry (cross-industry re-route, where the
 * entire old-industry file set is stale regardless of filename match).
 */
export function staleFilesFor(
  existing: ManifestSubject | undefined,
  processedFiles: string[],
  oldIndustry: string | null,
  newIndustry: string
): Array<{ industry: string; file: string }> {
  const stale: Array<{ industry: string; file: string }> = [];
  for (const img of existing?.images ?? []) {
    const stillReferenced =
      oldIndustry === newIndustry && processedFiles.includes(img.file);
    if (!stillReferenced) {
      stale.push({ industry: oldIndustry ?? newIndustry, file: img.file });
    }
  }
  return stale;
}

export function vendorPartition(m: Manifest): Map<string, string[]> {
  const part = new Map<string, string[]>();
  for (const ind of Object.values(m.industries)) {
    for (const s of Object.values(ind.subjects)) {
      const vk = s.provenance?.vendorKey;
      if (!vk || s.provenance?.source !== 'ccw-shopify') continue;
      const files = (s.images ?? []).map(i => i.file);
      part.set(vk, [...(part.get(vk) ?? []), ...files]);
    }
  }
  return part;
}

export function removeVendor(
  m: Manifest,
  vendorKey: string
): { manifest: Manifest; deletedFiles: string[] } {
  const out: Manifest = JSON.parse(JSON.stringify(m)) as Manifest;
  const deletedFiles: string[] = [];
  for (const ind of Object.values(out.industries)) {
    for (const [key, s] of Object.entries(ind.subjects)) {
      if (s.provenance?.vendorKey === vendorKey) {
        deletedFiles.push(...(s.images ?? []).map(i => i.file));
        delete ind.subjects[key];
      }
    }
  }
  return { manifest: out, deletedFiles };
}

export function retagVendor(
  m: Manifest,
  vendorKey: string,
  rights: string
): Manifest {
  const out: Manifest = JSON.parse(JSON.stringify(m)) as Manifest;
  for (const ind of Object.values(out.industries)) {
    for (const s of Object.values(ind.subjects)) {
      if (s.provenance?.vendorKey === vendorKey) s.rights = rights;
    }
  }
  return out;
}
