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
 *   3. Images   — one styled illustration per beat. Default is the validated
 *                 Gemini "nano-banana" adapter shipped with the skill
 *                 (.claude/skills/brand-video/pipeline/image_gen.py, GEMINI_API_KEY),
 *                 which works server-side (unlike the local margot MCP). An
 *                 IMAGE_API_URL + IMAGE_API_KEY pair, if set, overrides it.
 *   4. Stitch   — ffmpeg (concat demuxer) images + audio -> final-1080p.mp4
 *   5. Upload   — push the mp4 to Supabase Storage (BRAND_VIDEO_BUCKET) and set
 *                 status='done' + output_url (the bucket's public URL).
 *
 * Status lifecycle: queued -> rendering -> done | failed
 *
 * Usage:
 *   npx tsx scripts/brand-video-worker.ts            # claim + render one job
 *   npx tsx scripts/brand-video-worker.ts --loop     # keep claiming until empty
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ELEVENLABS_API_KEY            — voiceover (job fails without it)
 *   GEMINI_API_KEY               — per-beat images (default adapter)
 *   BRAND_VIDEO_BUCKET           — Supabase Storage bucket for finished mp4s
 * Optional env:
 *   ELEVENLABS_VOICE_ID          — voice (falls back to Rachel default)
 *   IMAGE_API_URL + IMAGE_API_KEY — override the Gemini image adapter
 *   BRAND_VIDEO_IMAGE_MODEL      — override Gemini model (read by image_gen.py)
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

const WORK_DIR = path.join(ROOT_DIR, 'tmp', 'brand-video');
const IMAGE_GEN_SCRIPT = path.join(
  ROOT_DIR,
  '.claude',
  'skills',
  'brand-video',
  'pipeline',
  'image_gen.py'
);

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVEN_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID ??
  process.env.ELEVENLABS_VIOCE_ID ?? // typo variant used elsewhere in repo
  '21m00Tcm4TlvDq8ikWAM'; // Rachel default

const IMAGE_API_URL = process.env.IMAGE_API_URL;
const IMAGE_API_KEY = process.env.IMAGE_API_KEY;
const BRAND_VIDEO_BUCKET = process.env.BRAND_VIDEO_BUCKET || 'brand-videos';

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

function requireEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

function getSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? requireEnv('SUPABASE_URL');
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
 * Render one styled beat illustration to `outPath`.
 *
 * Default: the validated Gemini "nano-banana" adapter shipped with the skill
 * (image_gen.py) — plain server-side HTTPS, native 16:9 PNG, GEMINI_API_KEY.
 * Override: if IMAGE_API_URL + IMAGE_API_KEY are set, POST to that endpoint
 * instead. Throws on failure (caller marks the job failed).
 */
async function renderBeatImage(
  beatPrompt: string,
  style: string,
  outPath: string
): Promise<void> {
  const tokens = STYLE_PROMPTS[style] ?? STYLE_PROMPTS['flat-line'];
  const fullPrompt = `${tokens.positive}. Scene: ${beatPrompt}. Avoid: ${tokens.negative}.`;

  // Optional generic image-API override.
  if (IMAGE_API_URL && IMAGE_API_KEY) {
    const res = await fetch(IMAGE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${IMAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `${tokens.positive}. ${beatPrompt}`,
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
    fs.writeFileSync(outPath, Buffer.from(payload.image_base64, 'base64'));
    return;
  }

  // Default: Gemini nano-banana via the skill's validated adapter.
  execFileSync('python3', [IMAGE_GEN_SCRIPT, fullPrompt, outPath], {
    stdio: 'pipe',
    env: process.env,
  });
}

/** ffmpeg concat-demuxer stitch: images (timed) + audio -> 1080p mp4. */
async function stitch(
  imagePaths: string[],
  audioPath: string,
  outPath: string,
  workDir: string
): Promise<void> {
  const ffmpegPath: string = (await import('@ffmpeg-installer/ffmpeg')).path;
  const ffprobePath: string = (await import('@ffprobe-installer/ffprobe')).path;

  // Derive per-image durations from the ACTUAL voiceover length so the visuals
  // span the full narration and -shortest can never truncate the audio (the old
  // hardcoded 4s/beat made total = beats*4, clipping any VO longer than that).
  // Mirrors .claude/skills/brand-video/pipeline/stitch.py: with no per-beat
  // transcript timings available here (single TTS call), split the probed audio
  // duration evenly across the images. Falls back to 4s/image only if probing
  // fails, with -shortest still clamping as a backstop.
  let audioDuration = 0;
  try {
    audioDuration = parseFloat(
      execFileSync(ffprobePath, [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'csv=p=0',
        audioPath,
      ])
        .toString()
        .trim()
    );
  } catch {
    audioDuration = 0;
  }

  const n = imagePaths.length;
  const totalDuration =
    Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : n * 4;

  const listPath = path.join(workDir, 'list.txt');
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    const start = (i * totalDuration) / n;
    const end = ((i + 1) * totalDuration) / n;
    const dur = Math.max(0.4, Number((end - start).toFixed(3)));
    lines.push(`file '${imagePaths[i].replace(/'/g, "'\\''")}'`);
    lines.push(`duration ${dur}`);
  }
  // concat demuxer requires the final image listed once more without duration.
  lines.push(`file '${imagePaths[n - 1].replace(/'/g, "'\\''")}'`);
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

    // 3. Images (one per beat)
    log('  Images...');
    const imagePaths: string[] = [];
    for (let i = 0; i < beats.length; i++) {
      const p = path.join(imgDir, `${String(i + 1).padStart(2, '0')}.png`);
      await renderBeatImage(beats[i], job.style, p);
      imagePaths.push(p);
    }

    // 4. Stitch
    log('  Stitching...');
    const outPath = path.join(jobDir, 'final-1080p.mp4');
    await stitch(imagePaths, audioPath, outPath, jobDir);

    // 5. Upload to Supabase Storage + finish
    log(`  Uploading to bucket '${BRAND_VIDEO_BUCKET}'...`);
    const objectPath = `${job.id}/final-1080p.mp4`;
    const { error: upErr } = await supabase.storage
      .from(BRAND_VIDEO_BUCKET)
      .upload(objectPath, fs.readFileSync(outPath), {
        contentType: 'video/mp4',
        upsert: true,
      });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { data: pub } = supabase.storage
      .from(BRAND_VIDEO_BUCKET)
      .getPublicUrl(objectPath);

    await finish(supabase, job.id, {
      status: 'done',
      output_url: pub.publicUrl,
    });
    log(`  Done -> ${pub.publicUrl}`);
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
