#!/usr/bin/env npx tsx
/**
 * Educational Video Render + Upload Pipeline (SYN-430)
 *
 * Renders educational marketing videos via Remotion and uploads them to YouTube.
 *
 * Pipeline per video:
 *   1. Generate ElevenLabs voiceover → tmp/audio/{id}.mp3
 *   2. Bundle Remotion entry point (once, reused across all renders)
 *   3. Render video → tmp/videos/{id}.mp4
 *   4. Upload to YouTube (unless --dry-run)
 *   5. Write result to scripts/video-ids.json
 *
 * Usage:
 *   npx tsx scripts/render-and-upload-videos.ts
 *   npx tsx scripts/render-and-upload-videos.ts --id intro-ai-marketing
 *   npx tsx scripts/render-and-upload-videos.ts --dry-run
 *   npx tsx scripts/render-and-upload-videos.ts --force
 *
 * Environment variables:
 *   ELEVENLABS_API_KEY     — ElevenLabs API key (optional — voiceover skipped if absent)
 *   ELEVENLABS_VOICE_ID    — ElevenLabs voice ID (falls back to Rachel default)
 *   ELEVENLABS_VIOCE_ID    — Typo variant also supported
 *   YOUTUBE_CLIENT_ID      — YouTube OAuth client ID
 *   YOUTUBE_CLIENT_SECRET  — YouTube OAuth client secret
 *   YOUTUBE_REFRESH_TOKEN  — YouTube OAuth refresh token
 *   YOUTUBE_PLAYLIST_ID    — Optional playlist to add videos to
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { RenderMediaOptions } from '@remotion/renderer';
import {
  EDUCATIONAL_VIDEOS,
  type EducationalVideo,
} from '../lib/remotion/educational-content';
import {
  YouTubeUploader,
  YOUTUBE_CATEGORIES,
} from '../lib/video/youtube-uploader';

// ── Bootstrap ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env.local'), override: true });
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const TMP_AUDIO_DIR = path.join(ROOT_DIR, 'tmp', 'audio');
const TMP_VIDEO_DIR = path.join(ROOT_DIR, 'tmp', 'videos');
const REMOTION_ENTRY = path.join(ROOT_DIR, 'lib', 'remotion', 'index.tsx');
const VIDEO_IDS_PATH = path.join(__dirname, 'video-ids.json');

// ── ElevenLabs config ─────────────────────────────────────────────────────────

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
// Support the VIOCE_ID typo variant present in the existing audio script
const ELEVEN_VOICE_ID =
  process.env.ELEVENLABS_VIOCE_ID ??
  process.env.ELEVENLABS_VOICE_ID ??
  '21m00Tcm4TlvDq8ikWAM'; // Rachel (default)

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function log(message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${timestamp}] ${message}\n`);
}

// ── CLI Args ─────────────────────────────────────────────────────────────────

function parseArgs(): { idFilter?: string; dryRun: boolean; force: boolean } {
  const args = process.argv.slice(2);
  let idFilter: string | undefined;
  let dryRun = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id' && args[i + 1]) idFilter = args[++i];
    else if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--force') force = true;
  }

  return { idFilter, dryRun, force };
}

// ── ElevenLabs Voiceover ──────────────────────────────────────────────────────

/**
 * Generates a voiceover MP3 via ElevenLabs TTS.
 * Returns true if the file is ready (cached or freshly generated).
 * Returns false if ElevenLabs is unconfigured or generation failed — pipeline
 * continues without audio in that case.
 */
async function generateVoiceover(
  text: string,
  outputPath: string,
  force: boolean
): Promise<boolean> {
  if (!ELEVEN_API_KEY) {
    log('  WARNING: ELEVENLABS_API_KEY not configured — skipping voiceover');
    return false;
  }

  if (!force && fs.existsSync(outputPath)) {
    log(`  Voiceover cached: ${path.basename(outputPath)}`);
    return true;
  }

  log(`  Generating voiceover (${text.length} chars)...`);

  try {
    const response = await fetch(
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

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(
        `ElevenLabs ${response.status}: ${errBody.slice(0, 200)}`
      );
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    log(`  Voiceover saved (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
    return true;
  } catch (err) {
    log(
      `  ERROR: Voiceover failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return false;
  }
}

// ── Video IDs persistence ─────────────────────────────────────────────────────

interface VideoIdRecord {
  youtubeVideoId: string;
  videoUrl: string;
  uploadedAt: string;
}

type VideoIdsMap = Record<string, VideoIdRecord>;

function loadVideoIds(): VideoIdsMap {
  if (!fs.existsSync(VIDEO_IDS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(VIDEO_IDS_PATH, 'utf-8')) as VideoIdsMap;
  } catch {
    return {};
  }
}

function saveVideoIds(map: VideoIdsMap): void {
  fs.writeFileSync(
    VIDEO_IDS_PATH,
    JSON.stringify(map, null, 2) + '\n',
    'utf-8'
  );
}

// ── Per-video pipeline ────────────────────────────────────────────────────────

interface VideoResult {
  id: string;
  title: string;
  rendered: boolean;
  uploaded: boolean;
  skipped: boolean;
  youtubeVideoId?: string;
  error?: string;
}

async function processVideo(
  video: EducationalVideo,
  bundleLocation: string,
  uploader: YouTubeUploader,
  videoIds: VideoIdsMap,
  opts: { dryRun: boolean; force: boolean }
): Promise<VideoResult> {
  const result: VideoResult = {
    id: video.id,
    title: video.title,
    rendered: false,
    uploaded: false,
    skipped: false,
  };

  const audioPath = path.join(TMP_AUDIO_DIR, `${video.id}.mp3`);
  const videoPath = path.join(TMP_VIDEO_DIR, `${video.id}.mp4`);

  log(`\n--- ${video.id} ---`);
  log(`  Title: ${video.title}`);

  // 1. Generate voiceover (non-fatal if absent — renders without audio)
  const hasVoiceover = await generateVoiceover(
    video.voiceoverScript,
    audioPath,
    opts.force
  );

  // 2. Skip render if video already exists and not forced
  if (!opts.force && fs.existsSync(videoPath)) {
    log(`  Skipping render — video exists (use --force to re-render)`);
    result.rendered = true;
    result.skipped = true;
  } else {
    // 3. Render video
    log(
      `  Rendering ${video.compositionId} (${video.width}x${video.height}, ${video.durationInFrames / video.fps}s)...`
    );

    try {
      const inputProps: Record<string, unknown> = {
        voiceoverStaticFile: hasVoiceover
          ? `audio/educational/${video.id}.mp3`
          : undefined,
      };

      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: video.compositionId,
        inputProps,
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: videoPath,
        inputProps,
        onProgress: ({ progress }) => {
          const pct = Math.round(progress * 100);
          if (pct % 25 === 0) {
            process.stdout.write(`\r  [${video.id}] ${pct}%   `);
          }
        },
      } as RenderMediaOptions);

      process.stdout.write('\n');
      const sizeMB = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(1);
      log(`  Rendered: ${video.id}.mp4 (${sizeMB} MB)`);
      result.rendered = true;
    } catch (err) {
      process.stdout.write('\n');
      result.error = err instanceof Error ? err.message : String(err);
      log(`  ERROR: Render failed: ${result.error}`);
      return result;
    }
  }

  // 4. Upload to YouTube (skip if --dry-run or already uploaded)
  if (opts.dryRun) {
    log('  DRY RUN — skipping upload');
    return result;
  }

  if (!uploader.isConfigured()) {
    log('  WARNING: YouTube credentials not configured — skipping upload');
    return result;
  }

  // Skip if already uploaded and not forced
  if (!opts.force && videoIds[video.id]) {
    const existing = videoIds[video.id];
    log(`  Already uploaded: ${existing.videoUrl}`);
    result.uploaded = true;
    result.youtubeVideoId = existing.youtubeVideoId;
    return result;
  }

  try {
    log('  Uploading to YouTube...');
    const uploadResult = await uploader.uploadVideo(videoPath, {
      title: video.title,
      description: video.description,
      tags: video.tags,
      categoryId: YOUTUBE_CATEGORIES.EDUCATION,
      privacyStatus: 'unlisted',
      playlistId: process.env.YOUTUBE_PLAYLIST_ID,
    });

    result.uploaded = true;
    result.youtubeVideoId = uploadResult.videoId;
    log(`  Uploaded: ${uploadResult.videoUrl}`);

    // Persist to video-ids.json (merge, not overwrite)
    videoIds[video.id] = {
      youtubeVideoId: uploadResult.videoId,
      videoUrl: uploadResult.videoUrl,
      uploadedAt: new Date().toISOString(),
    };
    saveVideoIds(videoIds);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    log(`  ERROR: Upload failed: ${result.error}`);
  }

  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { idFilter, dryRun, force } = parseArgs();

  // Resolve video list
  let videos = EDUCATIONAL_VIDEOS;
  if (idFilter) {
    const found = EDUCATIONAL_VIDEOS.find(v => v.id === idFilter);
    if (!found) {
      console.error(`Video not found: ${idFilter}`);
      console.error(
        `Available IDs: ${EDUCATIONAL_VIDEOS.map(v => v.id).join(', ')}`
      );
      process.exit(1);
    }
    videos = [found];
  }

  ensureDir(TMP_AUDIO_DIR);
  ensureDir(TMP_VIDEO_DIR);

  log('\n============================');
  log('Educational Video Pipeline');
  log('============================');
  log(`Videos:   ${videos.length}`);
  log(
    `Mode:     ${[dryRun && 'DRY RUN', force && 'FORCE'].filter(Boolean).join(', ') || 'INCREMENTAL'}`
  );
  log(`Voice ID: ${ELEVEN_VOICE_ID}`);
  log(
    `ElevenLabs: ${ELEVEN_API_KEY ? 'configured' : 'NOT CONFIGURED (renders without audio)'}`
  );
  log(
    `YouTube:    ${process.env.YOUTUBE_CLIENT_ID ? 'configured' : 'NOT CONFIGURED (will skip upload)'}`
  );
  log('============================\n');

  // Bundle Remotion entry point once — reused across all renders
  log('Bundling Remotion entry point...');
  const bundleLocation = await bundle({
    entryPoint: REMOTION_ENTRY,
    webpackOverride: config => config,
    publicDir: path.join(ROOT_DIR, 'public'),
  });
  log(`Bundle ready: ${bundleLocation}\n`);

  // Initialise YouTube uploader
  const uploader = new YouTubeUploader();

  // Load existing video IDs for merge
  const videoIds = loadVideoIds();

  // Process videos sequentially (Remotion renderer is resource-intensive)
  const results: VideoResult[] = [];
  for (const video of videos) {
    const result = await processVideo(
      video,
      bundleLocation,
      uploader,
      videoIds,
      { dryRun, force }
    );
    results.push(result);
  }

  // ── Summary table ──────────────────────────────────────────────────────────

  log('\n============================');
  log('Summary');
  log('============================');

  const colW = 32;
  log(`${'Video ID'.padEnd(colW)} Rendered  Uploaded  Status`);
  log('-'.repeat(colW + 34));

  for (const r of results) {
    const rendered = r.rendered ? 'yes     ' : 'no      ';
    const uploaded = r.uploaded ? 'yes     ' : dryRun ? 'dry-run ' : 'no      ';
    const status = r.error
      ? `ERROR: ${r.error.slice(0, 40)}`
      : r.youtubeVideoId
        ? `https://youtu.be/${r.youtubeVideoId}`
        : r.skipped
          ? 'skipped (cached)'
          : 'ok';
    log(`${r.id.padEnd(colW)} ${rendered}  ${uploaded}  ${status}`);
  }

  const successCount = results.filter(r => r.rendered && !r.error).length;
  const errorCount = results.filter(r => !!r.error).length;

  log('============================');
  log(`Rendered: ${successCount}/${results.length}`);
  if (errorCount > 0) log(`Errors:   ${errorCount}`);
  if (dryRun) log('Upload:   skipped (--dry-run)');
  log(`Output:   ${TMP_VIDEO_DIR}`);
  log(`IDs file: ${VIDEO_IDS_PATH}`);
  log('============================\n');

  if (errorCount > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
