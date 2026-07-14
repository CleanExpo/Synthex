#!/usr/bin/env node
/**
 * extract-frames-fal.mjs — cloud frame extraction via fal.ai (no local ffmpeg).
 *
 * Extracts representative still frames from a video and saves them locally so
 * they can be curated into the reference library. Uses fal's ffmpeg utility
 * (`fal-ai/workflow-utilities/extract-nth-frame`). The video is uploaded to
 * fal storage first (fal fetches video_url over the public internet).
 *
 * Auth: reads FAL_API_KEY (or FAL_KEY) from the environment / .env.local.
 * The secret is never printed.
 *
 * Usage:
 *   node scripts/extract-frames-fal.mjs --video=/path/to/clip.mp4 --out=./frames \
 *        --interval=90 --max=8 --format=webp --quality=92
 *   node scripts/extract-frames-fal.mjs --video=https://public/clip.mp4 --out=./frames
 *
 * A remote https video_url skips the upload step.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

// --- tiny .env.local loader (no dep) ---
function loadEnvLocal() {
  for (const f of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      /* file may not exist */
    }
  }
}
loadEnvLocal();

const KEY = process.env.FAL_API_KEY || process.env.FAL_KEY;
if (!KEY) {
  console.error('❌ FAL_API_KEY not set (checked env + .env.local).');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || true];
  })
);
const video = args.video;
const outDir = args.out || './frames';
const interval = Number(args.interval || 90); // every ~3s at 30fps
const maxFrames = Number(args.max || 8);
const format = args.format || 'webp';
const quality = Number(args.quality || 92);

if (!video) {
  console.error(
    'Usage: node scripts/extract-frames-fal.mjs --video=<path|url> --out=<dir> [--interval=90 --max=8 --format=webp --quality=92]'
  );
  process.exit(1);
}

const authHeaders = { Authorization: `Key ${KEY}` };

/** Upload a local file to fal storage → returns a public file URL. */
async function uploadToFal(path) {
  const bytes = readFileSync(path);
  const fileName = basename(path);
  const contentType = fileName.toLowerCase().endsWith('.mov')
    ? 'video/quicktime'
    : 'video/mp4';
  console.log(
    `↑ uploading ${fileName} (${(bytes.length / 1e6).toFixed(1)} MB) to fal storage…`
  );
  const initiate = await fetch(
    'https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3',
    {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: contentType, file_name: fileName }),
    }
  );
  if (!initiate.ok) {
    throw new Error(
      `fal upload initiate ${initiate.status}: ${await initiate.text()}`
    );
  }
  const { upload_url, file_url } = await initiate.json();
  const put = await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: bytes,
  });
  if (!put.ok) throw new Error(`fal storage PUT ${put.status}`);
  console.log('✓ uploaded');
  return file_url;
}

async function extractFrames(videoUrl) {
  console.log(
    `⚙ extract-nth-frame (every ${interval}, max ${maxFrames}, ${format})…`
  );
  const res = await fetch(
    'https://fal.run/fal-ai/workflow-utilities/extract-nth-frame',
    {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_url: videoUrl,
        frame_interval: interval,
        max_frames: maxFrames,
        output_format: format,
        quality,
      }),
    }
  );
  if (!res.ok)
    throw new Error(`extract-nth-frame ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const isUrl = /^https?:\/\//.test(String(video));
  const videoUrl = isUrl ? video : await uploadToFal(video);

  const result = await extractFrames(videoUrl);
  const images = result.images || [];
  console.log(
    `✓ fal returned ${images.length} frame(s) (frame_count=${result.frame_count})`
  );

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const stem = isUrl
    ? 'frame'
    : basename(String(video)).replace(/\.[^.]+$/, '');
  let saved = 0;
  for (let i = 0; i < images.length; i++) {
    const url = images[i].url;
    if (!url) continue;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const fn = `${outDir}/${stem}-f${String(i + 1).padStart(2, '0')}.${format}`;
    writeFileSync(fn, buf);
    saved++;
    console.log(`  ↓ ${fn} (${(buf.length / 1024).toFixed(0)} KB)`);
  }
  console.log(`\n✅ saved ${saved} frame(s) to ${outDir}`);
}

main().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
