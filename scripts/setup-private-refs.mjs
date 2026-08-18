#!/usr/bin/env node
/**
 * setup-private-refs.mjs — one-off: load owned but PRIVATE reference images into
 * a private Supabase bucket + write a private manifest. These images (real
 * customer job-site photos) must NEVER live in the public repo/site; grounding
 * fetches them via short-lived signed URLs at generation time.
 *
 * Usage: node scripts/setup-private-refs.mjs <industry> <subjectKey> <label> <srcDir>
 * e.g.   node scripts/setup-private-refs.mjs water-damage-restoration \
 *          mould-containment-jobsite "Mould Containment — real S520 job site (owned)" \
 *          ~/industry-wiki/_private-owned/mould-containment
 *
 * Reads DATABASE_URL + DATABASE_URL from env/.env.local.
 * The bucket is created PRIVATE (public:false). Never prints secrets.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname } from 'node:path';
import { createClient } from '@/lib/platform/noop-client';

function loadEnvLocal() {
  for (const f of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]])
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch {}
  }
}
loadEnvLocal();

const URL = process.env.DATABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.DATABASE_URL;
if (!URL || !KEY) {
  console.error('❌ DATABASE_URL / DATABASE_URL not set.');
  process.exit(1);
}
const BUCKET = 'reference-library-private';
const MANIFEST_PATH = '_private-manifest.json';

const [industry, subjectKey, label, srcDir] = process.argv.slice(2);
if (!industry || !subjectKey || !label || !srcDir) {
  console.error(
    'Usage: node scripts/setup-private-refs.mjs <industry> <subjectKey> <label> <srcDir>'
  );
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some(b => b.name === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
    });
    if (error && !/exists/i.test(error.message)) throw error;
    console.log(`✓ created PRIVATE bucket ${BUCKET}`);
  } else {
    console.log(`✓ bucket ${BUCKET} exists`);
  }
}

async function loadManifest() {
  const { data } = await supabase.storage.from(BUCKET).download(MANIFEST_PATH);
  if (!data) return { version: 1, industries: {} };
  try {
    return JSON.parse(Buffer.from(await data.arrayBuffer()).toString('utf8'));
  } catch {
    return { version: 1, industries: {} };
  }
}

async function main() {
  await ensureBucket();
  const dir = srcDir.replace(/^~/, process.env.HOME);
  const files = readdirSync(dir)
    .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  if (!files.length) {
    console.error('no images in', dir);
    process.exit(1);
  }

  const images = [];
  let i = 0;
  for (const f of files) {
    i++;
    const buf = readFileSync(join(dir, f));
    const ext = extname(f).toLowerCase();
    const storagePath = `${industry}/${subjectKey}/${String(i).padStart(2, '0')}${ext}`;
    const contentType =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/jpeg';
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType, upsert: true });
    if (error) throw error;
    images.push({
      path: storagePath,
      bytes: buf.length,
      contentHash: 'sha256:' + createHash('sha256').update(buf).digest('hex'),
      source: 'owned-job-photo',
    });
    console.log(`  ↑ ${storagePath} (${(buf.length / 1024).toFixed(0)} KB)`);
  }

  const manifest = await loadManifest();
  manifest.industries ??= {};
  manifest.industries[industry] ??= { subjects: {} };
  manifest.industries[industry].subjects[subjectKey] = {
    rights: 'owned',
    label,
    provenance: {
      source: 'owned-job-photo',
      rightsBasis: 'owned',
      ingestedAt: '2026-07-12',
    },
    images,
  };
  const { error: mErr } = await supabase.storage
    .from(BUCKET)
    .upload(MANIFEST_PATH, Buffer.from(JSON.stringify(manifest, null, 2)), {
      contentType: 'application/json',
      upsert: true,
    });
  if (mErr) throw mErr;

  console.log(
    `\n✅ ${images.length} private image(s) → ${BUCKET}/${industry}/${subjectKey}; manifest updated.`
  );
}

main().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
