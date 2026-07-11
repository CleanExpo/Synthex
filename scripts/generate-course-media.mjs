#!/usr/bin/env node
/**
 * generate-course-media.mjs — CARSI course-media bridge.
 *
 * The missing container between the CARSI course content (which declares the
 * images/video it needs, in a media manifest) and the Synthex media factory
 * (/api/media/generate/{image,video,voice}). Reads a manifest, validates every
 * request payload against the real endpoint schema, and — with --execute —
 * drives the factory, tags outputs into the media library, and writes an asset
 * map back so CARSI modules/marketing can embed the finished assets.
 *
 * The manifest is authored in CARSI (data/media/*-media-manifest.json). This
 * runner is provider-agnostic: it only speaks the Synthex media-gen HTTP API.
 *
 * Usage:
 *   node scripts/generate-course-media.mjs <manifest.json|url> [options]
 * Options:
 *   --execute            actually call the media factory (default: dry-run)
 *   --only=id1,id2       restrict to specific manifest asset ids
 *   --kind=image|video   restrict to a kind
 *   --out=path.json      asset-map output (default: <manifest>-assets.generated.json)
 *   --base=URL           Synthex base URL (env SYNTHEX_BASE_URL)
 *   --concurrency=N      parallel requests in execute mode (default 3)
 *
 * Auth (execute only): EVERY media route requires Authorization: Bearer <JWT>
 * (a logged-in Synthex session token, verified against JWT_SECRET by
 * lib/security/api-security-checker.ts) supplied via SYNTHEX_BEARER. Video/voice
 * ADDITIONALLY require X-Service-Token via SYNTHEX_SERVICE_TOKEN. Never printed.
 * Dry-run needs no base URL and no token — it validates shape and exits.
 *
 * No new dependencies: node built-ins + global fetch only.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';

// ── schema mirror (kept in lock-step with app/api/media/generate/*/route.ts) ──
const IMAGE_ASPECTS = ['1:1', '16:9', '9:16', '4:3', '3:4'];
const VIDEO_ASPECTS = ['16:9', '9:16', '1:1'];
const VIDEO_TYPES = ['text-to-video', 'image-to-video', 'avatar', 'motion'];
const VIDEO_PROVIDERS = ['runway', 'synthesia', 'd-id'];
const VIDEO_STYLES = ['cinematic', 'animation', 'realistic', 'artistic'];
const MOTION = ['subtle', 'moderate', 'dynamic'];
const RESOLUTIONS = ['720p', '1080p', '4k'];

const ENDPOINTS = {
  image: '/api/media/generate/image',
  video: '/api/media/generate/video',
  voice: '/api/media/generate/voice',
};

/** Validate a manifest asset's request against the real endpoint constraints.
 *  Returns an array of human-readable errors (empty = valid). */
function validate(asset) {
  const e = [];
  const { kind, request: r, id } = asset;
  if (!id) e.push('missing id');
  if (!ENDPOINTS[kind])
    return [`unknown kind "${kind}" (expected image|video|voice)`];
  if (!r || typeof r !== 'object') return ['missing request object'];

  if (kind === 'image') {
    if (!r.prompt || r.prompt.length < 1 || r.prompt.length > 4000)
      e.push('image.prompt 1..4000 required');
    if (r.negativePrompt && r.negativePrompt.length > 2000)
      e.push('image.negativePrompt <=2000');
    if (r.aspectRatio && !IMAGE_ASPECTS.includes(r.aspectRatio))
      e.push(`image.aspectRatio in ${IMAGE_ASPECTS}`);
    for (const dim of ['width', 'height']) {
      if (r[dim] != null && (r[dim] < 256 || r[dim] > 2048))
        e.push(`image.${dim} 256..2048`);
    }
  }
  if (kind === 'video') {
    if (!VIDEO_TYPES.includes(r.type)) e.push(`video.type in ${VIDEO_TYPES}`);
    if (r.prompt && r.prompt.length > 2000) e.push('video.prompt <=2000');
    if (r.script && r.script.length > 5000) e.push('video.script <=5000');
    if (r.type === 'text-to-video' && !r.prompt)
      e.push('text-to-video needs prompt');
    if (r.type === 'image-to-video' && !r.imageUrl)
      e.push('image-to-video needs imageUrl');
    if (r.type === 'avatar' && !r.script) e.push('avatar needs script');
    if (r.duration != null && (r.duration < 1 || r.duration > 60))
      e.push('video.duration 1..60');
    if (r.aspectRatio && !VIDEO_ASPECTS.includes(r.aspectRatio))
      e.push(`video.aspectRatio in ${VIDEO_ASPECTS}`);
    if (r.resolution && !RESOLUTIONS.includes(r.resolution))
      e.push(`video.resolution in ${RESOLUTIONS}`);
    if (r.provider && !VIDEO_PROVIDERS.includes(r.provider))
      e.push(`video.provider in ${VIDEO_PROVIDERS}`);
    if (r.style && !VIDEO_STYLES.includes(r.style))
      e.push(`video.style in ${VIDEO_STYLES}`);
    if (r.motionAmount && !MOTION.includes(r.motionAmount))
      e.push(`video.motionAmount in ${MOTION}`);
  }
  if (kind === 'voice') {
    if (!r.text && !r.script) e.push('voice needs text or script');
  }
  return e;
}

function parseArgs(argv) {
  const o = {
    execute: false,
    concurrency: 3,
    only: null,
    kind: null,
    out: null,
    base: process.env.SYNTHEX_BASE_URL || null,
  };
  const positional = [];
  for (const a of argv) {
    if (a === '--execute') o.execute = true;
    else if (a.startsWith('--only='))
      o.only = a
        .slice(7)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    else if (a.startsWith('--kind=')) o.kind = a.slice(7);
    else if (a.startsWith('--out=')) o.out = a.slice(6);
    else if (a.startsWith('--base=')) o.base = a.slice(7);
    else if (a.startsWith('--concurrency='))
      o.concurrency = Math.max(1, parseInt(a.slice(14), 10) || 3);
    else if (!a.startsWith('--')) positional.push(a);
  }
  o.manifestArg = positional[0];
  return o;
}

async function loadManifest(arg) {
  if (/^https?:\/\//.test(arg)) {
    const res = await fetch(arg);
    if (!res.ok) throw new Error(`fetch manifest ${res.status}`);
    return { data: await res.json(), dir: process.cwd() };
  }
  const p = resolve(arg);
  return {
    data: JSON.parse(readFileSync(p, 'utf8')),
    dir: dirname(p),
    path: p,
  };
}

async function callFactory(base, auth, asset) {
  const url = base.replace(/\/$/, '') + ENDPOINTS[asset.kind];
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth.bearer ? { Authorization: `Bearer ${auth.bearer}` } : {}),
      ...(auth.serviceToken ? { 'X-Service-Token': auth.serviceToken } : {}),
    },
    body: JSON.stringify(asset.request),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-json */
  }
  if (!res.ok) {
    return {
      status: 'failed',
      httpStatus: res.status,
      error: body?.error || body?.message || `HTTP ${res.status}`,
    };
  }
  // Endpoints return either a finished asset or an async job (video).
  const assetId =
    body?.id ||
    body?.assetId ||
    body?.mediaId ||
    body?.jobId ||
    body?.videoId ||
    null;
  const outUrl =
    body?.url ||
    body?.assetUrl ||
    body?.output?.url ||
    body?.result?.url ||
    null;
  const jobStatus = body?.status || (outUrl ? 'completed' : 'submitted');
  return {
    status: jobStatus,
    assetId,
    url: outUrl,
    provider: body?.provider || asset.request.provider || null,
  };
}

async function runPool(items, n, worker) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await worker(items[idx], idx);
      }
    })
  );
  return out;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.manifestArg) {
    console.error(
      'Usage: node scripts/generate-course-media.mjs <manifest.json|url> [--execute] [--only=…] [--kind=image|video] [--out=…]'
    );
    process.exit(2);
  }
  const { data: manifest, dir, path } = await loadManifest(o.manifestArg);
  let assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  if (o.only) assets = assets.filter(a => o.only.includes(a.id));
  if (o.kind) assets = assets.filter(a => a.kind === o.kind);

  console.log(
    `\nCARSI course-media bridge — manifest "${manifest.manifest || manifest.course || basename(o.manifestArg)}"`
  );
  console.log(
    `assets selected: ${assets.length}${o.only ? ` (--only)` : ''}${o.kind ? ` (--kind=${o.kind})` : ''}`
  );
  console.log(
    `mode: ${o.execute ? 'EXECUTE (will call the media factory)' : 'DRY-RUN (validate only, no API calls)'}\n`
  );

  // 1) validate all — a bad payload must fail before any money is spent
  let invalid = 0;
  for (const a of assets) {
    const errs = validate(a);
    const tag = errs.length ? `✖ ${errs.join('; ')}` : '✓ valid';
    console.log(`  [${a.kind.padEnd(5)}] ${a.id.padEnd(34)} ${tag}`);
    if (errs.length) invalid++;
  }
  if (invalid) {
    console.error(
      `\n${invalid} invalid asset(s) — fix the manifest before executing. Nothing generated.`
    );
    process.exit(1);
  }
  console.log(
    `\nAll ${assets.length} payloads valid against the Synthex media-gen schema.`
  );

  const outPath =
    o.out ||
    join(dir, `${manifest.course || 'course'}-media-assets.generated.json`);

  if (!o.execute) {
    // dry-run: write a plan so the operator/founder sees exactly what will run
    const plan = {
      manifest: manifest.manifest || null,
      course: manifest.course || null,
      dryRunAt: new Date().toISOString(),
      base: o.base || '(SYNTHEX_BASE_URL unset — required for --execute)',
      willGenerate: assets.map(a => ({
        id: a.id,
        kind: a.kind,
        endpoint: ENDPOINTS[a.kind],
        purpose: a.purpose,
        placement: a.placement,
        tags: a.tags,
      })),
    };
    writeFileSync(
      outPath.replace(/\.json$/, '.plan.json'),
      JSON.stringify(plan, null, 2)
    );
    console.log(
      `\nDry-run plan written: ${outPath.replace(/\.json$/, '.plan.json')}`
    );
    console.log(
      'Re-run with --execute (and SYNTHEX_BASE_URL + SYNTHEX_SERVICE_TOKEN set) to generate.\n'
    );
    return;
  }

  // 2) execute
  if (!o.base) {
    console.error('SYNTHEX_BASE_URL (or --base) required for --execute.');
    process.exit(2);
  }
  const auth = {
    bearer: process.env.SYNTHEX_BEARER || process.env.SYNTHEX_JWT || null,
    serviceToken: process.env.SYNTHEX_SERVICE_TOKEN || null,
  };
  if (!auth.bearer)
    console.warn(
      '⚠ SYNTHEX_BEARER not set — EVERY media route requires an Authorization: Bearer <JWT> (a logged-in Synthex session token). All calls will 403.'
    );
  if (!auth.serviceToken)
    console.warn(
      '⚠ SYNTHEX_SERVICE_TOKEN not set — video/voice additionally require X-Service-Token and will be rejected.'
    );

  const results = await runPool(assets, o.concurrency, async a => {
    try {
      const r = await callFactory(o.base, auth, a);
      const icon =
        r.status === 'failed' ? '✖' : r.status === 'completed' ? '✓' : '…';
      console.log(
        `  ${icon} ${a.id.padEnd(34)} ${r.status}${r.url ? ' → ' + r.url : ''}${r.error ? ' — ' + r.error : ''}`
      );
      return {
        id: a.id,
        kind: a.kind,
        purpose: a.purpose,
        placement: a.placement,
        tags: a.tags,
        ...r,
      };
    } catch (err) {
      console.log(`  ✖ ${a.id.padEnd(34)} error — ${err.message}`);
      return { id: a.id, kind: a.kind, status: 'failed', error: err.message };
    }
  });

  const map = {
    manifest: manifest.manifest || null,
    course: manifest.course || null,
    generatedAt: new Date().toISOString(),
    base: o.base,
    assets: results,
    summary: {
      total: results.length,
      completed: results.filter(r => r.status === 'completed').length,
      submitted: results.filter(
        r =>
          r.status === 'submitted' ||
          r.status === 'processing' ||
          r.status === 'pending'
      ).length,
      failed: results.filter(r => r.status === 'failed').length,
    },
  };
  writeFileSync(outPath, JSON.stringify(map, null, 2));
  console.log(`\nAsset map written: ${outPath}`);
  console.log(
    `summary: ${map.summary.completed} completed · ${map.summary.submitted} submitted(async) · ${map.summary.failed} failed`
  );
  console.log(
    'Async (video) completions land in the Synthex media library — filter by tag e.g. "ccw-workshop".'
  );
  if (path)
    console.log(
      `Commit the asset map into CARSI beside the manifest so modules can embed finished URLs.\n`
    );
}

main().catch(err => {
  console.error('bridge error:', err.message);
  process.exit(1);
});
