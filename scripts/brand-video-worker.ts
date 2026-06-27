#!/usr/bin/env npx tsx
/**
 * Brand Video Studio — render worker
 *
 * Claims one queued row from `brand_video_jobs` and runs the brand-video
 * pipeline end-to-end:
 *
 *   1. Script   — derive ~12-16 short beats (one sentence = one visual beat)
 *                 from the job topic. (LLM scripting is out of scope here; the
 *                 topic text is the VO source — swap in an LLM at SCRIPT step.)
 *   2. Voice    — ElevenLabs TTS over HTTP (server-side) -> voiceover.mp3
 *                 needs ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID.
 *   3. Images   — one styled illustration per beat via generateImage() adapter.
 *                 margot is a LOCAL MCP and is NOT reachable server-side, so the
 *                 adapter calls a generic image HTTP API (IMAGE_API_URL +
 *                 IMAGE_API_KEY). If those env vars are ABSENT the job is marked
 *                 `needs_local_render` (NOT failed) so it can be finished on a
 *                 machine with margot.
 *   4. Stitch   — ffmpeg (concat demuxer) images + audio -> final-1080p.mp4
 *   5. Finish   — status='done' + output_url (served from /public), or 'failed'.
 *
 * Status lifecycle: queued -> rendering -> done | needs_local_render | failed
 *
 * Usage:
 *   npx tsx scripts/brand-video-worker.ts            # claim + render one job
 *   npx tsx scripts/brand-video-worker.ts --loop     # keep claiming until empty
 *
 * Required env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ELEVENLABS_API_KEY            — voiceover (job fails without it)
 *   ELEVENLABS_VOICE_ID           — voice (falls back to Rachel default)
 * Optional env:
 *   IMAGE_API_URL + IMAGE_API_KEY — per-beat image generation seam.
 *                                   Absent -> job -> needs_local_render.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// ── Bootstrap ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env.local'), override: true });
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'brand-video');
const WORK_DIR = path.join(ROOT_DIR, 'tmp', 'brand-video');

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVEN_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID ??
  process.env.ELEVENLABS_VIOCE_ID ?? // typo variant used elsewhere in repo
  '21m00Tcm4TlvDq8ikWAM'; // Rachel default

const IMAGE_API_URL = process.env.IMAGE_API_URL;
const IMAGE_API_KEY = process.env.IMAGE_API_KEY;

// Per-style image prompt tokens — mirrors .claude/skills/brand-video/styles.md.
const STYLE_PROMPTS: Record<string, { positive: string; negative: string }> = {
  'flat-line': {
    positive:
      'Clean modern flat-line explainer illustration, confident hand-drawn vector look, thick charcoal outlines, restrained palette of deep teal + warm amber + soft slate on off-white, single clear subject, generous white space',
    negative:
      'not childish, not photorealistic, not a 3D render, no gradients, no text, no logos, no clutter',
  },
  'hand-doodle': {
    positive:
      'Hand-drawn marker doodle illustration, loose sketchy black ink lines on white, simple friendly characters, light spot-colour highlights, whiteboard-explainer energy, single clear subject',
    negative:
      'not photorealistic, not a 3D render, not corporate-stock, no gradients, no text, no logos, no clutter',
  },
  'bold-kinetic': {
    positive:
      'Bold flat colour-block illustration, high-contrast saturated palette, thick geometric shapes, strong diagonal composition, punchy poster energy, single dominant subject',
    negative:
      'not muted, not photorealistic, not a 3D render, no gradients, no text, no logos, no fine detail clutter',
  },
  'cinematic-photoreal': {
    positive:
      'Cinematic photorealistic still, shallow depth of field, dramatic directional lighting, filmic colour grade, real-world environment, single clear focal subject, premium editorial mood',
    negative:
      'not cartoon, not illustration, not flat, no text overlays, no logos, no watermark, no cluttered backgrounds',
  },
  'minimal-corporate': {
    positive:
      'Minimal corporate illustration, clean line + single accent colour on white, abundant whitespace, precise geometric icons, restrained and trustworthy, one clear subject',
    negative:
      'not busy, not childish, not photorealistic, no gradients, no text, no logos, no clutter',
  },
  'retro-print': {
    positive:
      'Warm retro mid-century print-poster illustration, limited risograph-style palette, visible halftone texture, bold simplified shapes, nostalgic editorial feel, single clear subject',
    negative:
      'not photorealistic, not 3D, not glossy, no text, no logos, no modern flat-gradient look, no clutter',
  },
};

interface BrandVideoJob {
  id: string;
  brand: string;
  style: string;
  topic: string;
  count: number;
  status: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(message: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${ts}] ${message}\n`);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

function getSupabase() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Split topic into beats — one short sentence per visual beat. */
function toBeats(topic: string): string[] {
  return topic
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// ── Pipeline steps ─────────────────────────────────────────────────────────

/** ElevenLabs TTS over HTTP. Writes mp3, returns true on success. */
async function generateVoiceover(
  text: string,
  outPath: string
): Promise<boolean> {
  if (!ELEVEN_API_KEY) {
    log('  ELEVENLABS_API_KEY not set — cannot generate voiceover');
    return false;
  }
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.8,
          style: 0.25,
          use_speaker_boost: true,
        },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(
      `ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`
    );
  }
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  return true;
}

/**
 * Image generation adapter — THE LOCAL-RENDER SEAM.
 *
 * margot (the validated brand-video image source) is a LOCAL MCP, unreachable
 * from a server-side worker. This adapter calls a generic HTTP image API
 * instead. Returns a PNG buffer, or `null` if no image API is configured — the
 * caller treats `null` as "needs local render" rather than a failure.
 *
 * Wire a real provider by setting IMAGE_API_URL + IMAGE_API_KEY. Expected
 * contract: POST { prompt, negative_prompt, width, height } -> { image_base64 }.
 */
async function generateImage(
  prompt: string,
  style: string
): Promise<Buffer | null> {
  if (!IMAGE_API_URL || !IMAGE_API_KEY) return null;

  const tokens = STYLE_PROMPTS[style] ?? STYLE_PROMPTS['flat-line'];
  const res = await fetch(IMAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${IMAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: `${tokens.positive}. ${prompt}`,
      negative_prompt: tokens.negative,
      width: 1920,
      height: 1080,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Image API ${res.status}: ${(await res.text()).slice(0, 200)}`
    );
  }
  const payload = (await res.json()) as { image_base64?: string };
  if (!payload.image_base64) {
    throw new Error('Image API returned no image_base64');
  }
  return Buffer.from(payload.image_base64, 'base64');
}

/** ffmpeg concat-demuxer stitch: images (timed) + audio -> 1080p mp4. */
async function stitch(
  imagePaths: string[],
  audioPath: string,
  outPath: string,
  workDir: string
): Promise<void> {
  const ffmpegPath: string = (await import('@ffmpeg-installer/ffmpeg')).path;

  // ~150 wpm baseline; -shortest clamps the final length to the real audio.
  const perBeat = 4;
  const listPath = path.join(workDir, 'list.txt');
  const lines: string[] = [];
  for (const img of imagePaths) {
    lines.push(`file '${img.replace(/'/g, "'\\''")}'`);
    lines.push(`duration ${perBeat}`);
  }
  // concat demuxer requires the final image listed once more without duration.
  lines.push(
    `file '${imagePaths[imagePaths.length - 1].replace(/'/g, "'\\''")}'`
  );
  fs.writeFileSync(listPath, lines.join('\n'));

  execFileSync(
    ffmpegPath,
    [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-i',
      audioPath,
      '-vf',
      'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
      '-c:v',
      'libx264',
      '-r',
      '25',
      '-c:a',
      'aac',
      '-shortest',
      outPath,
    ],
    { stdio: 'pipe' }
  );
}

// ── Job lifecycle ──────────────────────────────────────────────────────────

/** Claim the oldest queued job (best-effort optimistic guard). */
async function claimJob(
  supabase: ReturnType<typeof getSupabase>
): Promise<BrandVideoJob | null> {
  const { data: candidates } = await supabase
    .from('brand_video_jobs')
    .select('id, brand, style, topic, count, status')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1);

  const job = candidates?.[0] as BrandVideoJob | undefined;
  if (!job) return null;

  const { data: claimed } = await supabase
    .from('brand_video_jobs')
    .update({ status: 'rendering', updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'queued') // lost-update guard
    .select('id, brand, style, topic, count, status')
    .single();

  return (claimed as BrandVideoJob) ?? null;
}

async function finish(
  supabase: ReturnType<typeof getSupabase>,
  jobId: string,
  patch: { status: string; output_url?: string | null; error?: string | null }
): Promise<void> {
  await supabase
    .from('brand_video_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId);
}

async function processJob(
  supabase: ReturnType<typeof getSupabase>,
  job: BrandVideoJob
): Promise<void> {
  log(`Job ${job.id}: ${job.brand} / ${job.style}`);
  const jobDir = path.join(WORK_DIR, job.id);
  const imgDir = path.join(jobDir, 'images');
  ensureDir(imgDir);

  try {
    const beats = toBeats(job.topic);
    if (beats.length === 0) {
      await finish(supabase, job.id, {
        status: 'failed',
        error: 'Empty topic',
      });
      return;
    }

    // 2. Voiceover
    const audioPath = path.join(jobDir, 'voiceover.mp3');
    log(`  Voiceover (${beats.length} beats)...`);
    const voiced = await generateVoiceover(job.topic, audioPath);
    if (!voiced) {
      await finish(supabase, job.id, {
        status: 'failed',
        error: 'Voiceover failed — check ELEVENLABS_API_KEY',
      });
      return;
    }

    // 3. Images (one per beat) — local-render seam
    const imagePaths: string[] = [];
    for (let i = 0; i < beats.length; i++) {
      const buf = await generateImage(beats[i], job.style);
      if (buf === null) {
        log('  No image API configured — marking needs_local_render');
        await finish(supabase, job.id, {
          status: 'needs_local_render',
          error:
            'Set IMAGE_API_URL/IMAGE_API_KEY, or finish on a machine with margot.',
        });
        return;
      }
      const p = path.join(imgDir, `${String(i + 1).padStart(2, '0')}.png`);
      fs.writeFileSync(p, buf);
      imagePaths.push(p);
    }

    // 4. Stitch
    log('  Stitching...');
    ensureDir(path.join(OUTPUT_DIR, job.id));
    const outPath = path.join(OUTPUT_DIR, job.id, 'final-1080p.mp4');
    await stitch(imagePaths, audioPath, outPath, jobDir);

    // 5. Finish — served from /public
    const outputUrl = `/brand-video/${job.id}/final-1080p.mp4`;
    await finish(supabase, job.id, { status: 'done', output_url: outputUrl });
    log(`  Done -> ${outputUrl}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`  ERROR: ${message}`);
    await finish(supabase, job.id, {
      status: 'failed',
      error: message.slice(0, 500),
    });
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const loop = process.argv.includes('--loop');
  const supabase = getSupabase();
  ensureDir(WORK_DIR);
  ensureDir(OUTPUT_DIR);

  do {
    const job = await claimJob(supabase);
    if (!job) {
      log('No queued jobs.');
      break;
    }
    await processJob(supabase, job);
  } while (loop);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
