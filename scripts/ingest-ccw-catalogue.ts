#!/usr/bin/env tsx
/**
 * CCW catalogue ingestion CLI — I/O wrapper around scripts/lib/ccw-ingest-core.
 * Spec: docs/superpowers/specs/2026-07-11-ccw-catalogue-ingest-design.md (v2).
 * Modes: default ingest | --dry-run | --verify | --remove-vendor | --retag-vendor.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type {
  Manifest,
  ManifestSubject,
} from '@/lib/services/ai/reference-library';
import {
  type ShopifyProduct,
  type ShopifyImage,
  routeProduct,
  selectImages,
  fileNameFor,
  sizedSrc,
  aspectFlagged,
  estimateBytes,
  needsIngest,
  buildSubject,
  mergeManifest,
  removeVendor,
  retagVendor,
  vendorKeyOf,
} from './lib/ccw-ingest-core';

const ROOT = path.resolve(__dirname, '..');
const LIB_DIR = path.join(ROOT, 'public/reference-library');
const MANIFEST_PATH = path.join(LIB_DIR, 'manifest.json');
const BASE = 'https://www.ccwonline.com.au';
const SIZE_CAP_BYTES = 150 * 1024 * 1024;

export interface CliArgs {
  dryRun: boolean;
  verify: boolean;
  forceSize: boolean;
  removeVendor?: string;
  retagVendor?: { vendorKey: string; rights: string };
  forceRefreshHandle?: string;
  forceRefreshVendor?: string;
}
export function parseArgs(argv: string[]): CliArgs {
  const a: CliArgs = { dryRun: false, verify: false, forceSize: false };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    if (f === '--dry-run') a.dryRun = true;
    else if (f === '--verify') a.verify = true;
    else if (f === '--force-size') a.forceSize = true;
    else if (f === '--remove-vendor') a.removeVendor = argv[++i];
    else if (f === '--retag-vendor')
      a.retagVendor = { vendorKey: argv[++i], rights: argv[++i] };
    else if (f === '--force-refresh-handle') a.forceRefreshHandle = argv[++i];
    else if (f === '--force-refresh-vendor') a.forceRefreshVendor = argv[++i];
    else throw new Error(`unknown flag: ${f}`);
  }
  return a;
}

export interface Report {
  ingestable: Record<string, number>;
  perVendor: Record<string, number>;
  perRights: Record<string, number>;
  upholsteryRerouted: string[];
  skippedTypes: Record<string, number>;
  unmapped: Record<string, number>;
  denylisted: number;
  stale: string[];
  orphans: string[];
  newVendors: string[];
  aspectFlagged: string[];
  imageCount: number;
  estimatedBytes: number;
  projectedManifestBytes: number;
}
export function formatReport(r: Report): string {
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  return [
    `INGESTABLE per industry: ${JSON.stringify(r.ingestable)}`,
    `per vendor: ${JSON.stringify(r.perVendor)}`,
    `per rightsBasis: ${JSON.stringify(r.perRights)}`,
    `upholstery re-routed (${r.upholsteryRerouted.length}): ${r.upholsteryRerouted.join(', ') || '-'}`,
    `skipped types: ${JSON.stringify(r.skippedTypes)}`,
    `UNMAPPED types (never silent): ${JSON.stringify(r.unmapped)}`,
    `denylisted: ${r.denylisted}`,
    `stale (in manifest, gone upstream): ${r.stale.join(', ') || '-'}`,
    `orphans (on disk, not in manifest): ${r.orphans.join(', ') || '-'}`,
    `new vendors this run: ${r.newVendors.join(', ') || '-'}`,
    `aspect-flagged (human spot-check): ${r.aspectFlagged.join(', ') || '-'}`,
    `images: ${r.imageCount}, size estimate: ${mb(r.estimatedBytes)}, projected manifest: ${mb(r.projectedManifestBytes)}`,
  ].join('\n');
}

async function fetchWithRetry(url: string, tries = 3): Promise<Response> {
  for (let n = 1; ; n++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
    if (res.ok) return res;
    if (n >= tries || (res.status < 500 && res.status !== 429)) {
      throw new Error(`fetch failed ${res.status}: ${url}`);
    }
    await new Promise(r => setTimeout(r, 1000 * 2 ** (n - 1)));
  }
}

async function fetchCatalogue(): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; page <= 40; page++) {
    const res = await fetchWithRetry(
      `${BASE}/products.json?limit=250&page=${page}`
    );
    const data = (await res.json()) as { products?: ShopifyProduct[] };
    if (!Array.isArray(data.products))
      throw new Error(`malformed page ${page}`);
    if (data.products.length === 0) break;
    all.push(...data.products);
  }
  return all;
}

function readManifest(): Manifest {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
}
function writeManifestAtomic(m: Manifest): void {
  const tmp = `${MANIFEST_PATH}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(m, null, 2)}\n`);
  fs.renameSync(tmp, MANIFEST_PATH);
}
function findSubject(m: Manifest, key: string): ManifestSubject | undefined {
  for (const ind of Object.values(m.industries)) {
    if (Object.hasOwn(ind.subjects, key)) return ind.subjects[key];
  }
  return undefined;
}
function listOrphans(m: Manifest): string[] {
  const known = new Set<string>();
  for (const ind of Object.values(m.industries)) {
    for (const s of Object.values(ind.subjects)) {
      for (const i of s.images ?? []) known.add(i.file);
    }
  }
  const orphans: string[] = [];
  for (const dir of fs.readdirSync(LIB_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(LIB_DIR, dir.name))) {
      if (f.startsWith('ccw-') && f.endsWith('.webp') && !known.has(f))
        orphans.push(f);
    }
  }
  return orphans;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readManifest();

  if (args.removeVendor) {
    const { manifest: next, deletedFiles } = removeVendor(
      manifest,
      args.removeVendor
    );
    for (const ind of Object.keys(next.industries)) {
      for (const f of deletedFiles) {
        const p = path.join(LIB_DIR, ind, f);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
    writeManifestAtomic(next);
    console.log(
      `removed vendor ${args.removeVendor}: ${deletedFiles.length} files + subjects`
    );
    return;
  }
  if (args.retagVendor) {
    writeManifestAtomic(
      retagVendor(manifest, args.retagVendor.vendorKey, args.retagVendor.rights)
    );
    console.log(
      `retagged vendor ${args.retagVendor.vendorKey} -> rights=${args.retagVendor.rights}`
    );
    return;
  }
  if (args.verify) {
    let bad = 0;
    for (const [indKey, ind] of Object.entries(manifest.industries)) {
      for (const s of Object.values(ind.subjects)) {
        for (const i of s.images ?? []) {
          if (!i.contentHash) continue;
          const p = path.join(LIB_DIR, indKey, i.file);
          if (!fs.existsSync(p)) {
            console.error(`MISSING ${i.file}`);
            bad++;
            continue;
          }
          const h = `sha256:${createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`;
          if (h !== i.contentHash) {
            console.error(`HASH MISMATCH ${i.file}`);
            bad++;
          }
        }
      }
    }
    console.log(bad === 0 ? 'verify OK' : `verify FAILED: ${bad} issue(s)`);
    process.exitCode = bad === 0 ? 0 : 1;
    return;
  }

  // ── plan (shared by dry-run + ingest) ────────────────────────────────────
  const products = await fetchCatalogue();
  const report: Report = {
    ingestable: {},
    perVendor: {},
    perRights: {},
    upholsteryRerouted: [],
    skippedTypes: {},
    unmapped: {},
    denylisted: 0,
    stale: [],
    orphans: listOrphans(manifest),
    newVendors: [],
    aspectFlagged: [],
    imageCount: 0,
    estimatedBytes: 0,
    projectedManifestBytes: 0,
  };
  const knownVendors = new Set<string>();
  for (const ind of Object.values(manifest.industries)) {
    for (const s of Object.values(ind.subjects)) {
      if (s.provenance?.vendorKey) knownVendors.add(s.provenance.vendorKey);
    }
  }
  const seenHandles = new Set<string>();
  const todo: Array<{
    p: ShopifyProduct;
    industry: string;
    images: ShopifyImage[];
  }> = [];
  for (const p of products) {
    seenHandles.add(p.handle);
    const route = routeProduct(p);
    if ('skip' in route) {
      if (route.skip === 'denylist') report.denylisted++;
      else if (route.skip === 'type-skiplist')
        report.skippedTypes[p.product_type] =
          (report.skippedTypes[p.product_type] ?? 0) + 1;
      else
        report.unmapped[p.product_type] =
          (report.unmapped[p.product_type] ?? 0) + 1;
      continue;
    }
    const images = selectImages(p);
    if (images.length === 0) continue;
    const vk = vendorKeyOf(p.vendor);
    if (!knownVendors.has(vk) && !report.newVendors.includes(vk))
      report.newVendors.push(vk);
    const existing = findSubject(manifest, `ccw-${p.handle}`);
    const forced =
      args.forceRefreshHandle === p.handle || args.forceRefreshVendor === vk;
    const fileOk = (f: string) =>
      fs.existsSync(path.join(LIB_DIR, route.industry, f));
    if (!forced && !needsIngest(existing, images, fileOk)) continue;
    if (/upholstery/i.test(p.title)) report.upholsteryRerouted.push(p.handle);
    report.ingestable[route.industry] =
      (report.ingestable[route.industry] ?? 0) + 1;
    report.perVendor[vk] = (report.perVendor[vk] ?? 0) + 1;
    const rb = buildSubject(p, [], '').provenance!.rightsBasis;
    report.perRights[rb] = (report.perRights[rb] ?? 0) + 1;
    report.imageCount += images.length;
    for (const i of images)
      if (aspectFlagged(i))
        report.aspectFlagged.push(fileNameFor(p.handle, i.id));
    todo.push({ p, industry: route.industry, images });
  }
  // stale: manifest ccw subjects whose handle vanished upstream
  for (const ind of Object.values(manifest.industries)) {
    for (const key of Object.keys(ind.subjects)) {
      if (key.startsWith('ccw-') && !seenHandles.has(key.slice(4)))
        report.stale.push(key);
    }
  }
  report.estimatedBytes = estimateBytes(report.imageCount);
  report.projectedManifestBytes =
    JSON.stringify(manifest).length + todo.length * 700;

  console.log(formatReport(report));
  if (report.estimatedBytes > SIZE_CAP_BYTES && !args.forceSize) {
    console.error(
      'size estimate exceeds 150 MB cap — aborting (use --force-size to override)'
    );
    process.exitCode = 1;
    return;
  }
  if (args.dryRun) return; // zero writes, zero image downloads

  // ── ingest ───────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const additions: Array<{
    industry: string;
    key: string;
    subject: ManifestSubject;
  }> = [];
  const failures: string[] = [];
  let bytesWritten = 0;
  for (const { p, industry, images } of todo) {
    const processed: Array<{
      image: ShopifyImage;
      file: string;
      width: number;
      height: number;
      contentHash: string;
    }> = [];
    let ok = true;
    for (const image of images) {
      try {
        const res = await fetchWithRetry(sizedSrc(image.src));
        const buf = Buffer.from(await res.arrayBuffer());
        const file = fileNameFor(p.handle, image.id);
        const outPath = path.join(LIB_DIR, industry, file);
        const tmpPath = `${outPath}.tmp`;
        const info = await sharp(buf) // decode = integrity check
          .rotate()
          .resize({
            width: 2048,
            height: 2048,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 90 })
          .toFile(tmpPath);
        fs.renameSync(tmpPath, outPath);
        bytesWritten += info.size;
        const hash = `sha256:${createHash('sha256').update(fs.readFileSync(outPath)).digest('hex')}`;
        processed.push({
          image,
          file,
          width: info.width,
          height: info.height,
          contentHash: hash,
        });
      } catch (e) {
        ok = false;
        failures.push(
          `${p.handle}/${image.id}: ${e instanceof Error ? e.message : String(e)}`
        );
        break; // all-or-nothing per product (§6.4)
      }
    }
    if (!ok) continue;
    // delete de-referenced files from a previous ingest of this product (§6.5)
    const existing = findSubject(manifest, `ccw-${p.handle}`);
    for (const old of existing?.images ?? []) {
      if (!processed.some(x => x.file === old.file)) {
        const oldPath = path.join(LIB_DIR, industry, old.file);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }
    additions.push({
      industry,
      key: `ccw-${p.handle}`,
      subject: buildSubject(p, processed, today),
    });
    if (bytesWritten > SIZE_CAP_BYTES && !args.forceSize) {
      console.error(
        `runtime size cap hit after ${additions.length} products — aborting; written so far stays on disk as orphans until next run`
      );
      process.exitCode = 1;
      return; // manifest NOT written — orphan handling per §13
    }
  }
  writeManifestAtomic(mergeManifest(manifest, additions)); // written ONCE (§6.4)
  console.log(
    `ingested ${additions.length} products, ${(bytesWritten / 1024 / 1024).toFixed(1)} MB actual`
  );
  if (failures.length > 0) {
    console.error(
      `product failures (all-or-nothing skipped):\n  ${failures.join('\n  ')}`
    );
    process.exitCode = 2;
  }
}

// Run only when invoked directly (not when imported by tests). Uses the argv
// check rather than `require.main` so it works under tsx/ESM (mirrors
// scripts/verify/deploy-readiness.ts and scripts/social-launch-readiness.ts).
if (process.argv[1]?.endsWith('ingest-ccw-catalogue.ts')) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
