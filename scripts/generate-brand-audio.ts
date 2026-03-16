#!/usr/bin/env npx tsx
/**
 * Brand Audio Generator
 *
 * Generates two audio layers for each brand video:
 *
 * 1. VOICEOVER — ElevenLabs TTS narration per composition type
 *    (BrandShowcase ~45s, BrandReel ~15s, BrandSquare ~20s)
 *
 * 2. BACKGROUND MUSIC — Synthesised ambient tracks via FFmpeg's aevalsrc
 *    - corporate.mp3 : C major chord with slow tremolo (DR, CARSI, NRPG)
 *    - tech.mp3      : A minor chord with pulse (Synthex, RestoreAssist, Unite-Group)
 *
 * Output paths (served by Remotion as staticFile):
 *   public/audio/{brand}/showcase-voice.mp3
 *   public/audio/{brand}/reel-voice.mp3
 *   public/audio/{brand}/square-voice.mp3
 *   public/audio/music/corporate.mp3
 *   public/audio/music/tech.mp3
 *
 * Usage:
 *   npx tsx scripts/generate-brand-audio.ts
 *   npx tsx scripts/generate-brand-audio.ts --brand disaster-recovery
 *   npx tsx scripts/generate-brand-audio.ts --force   (re-generate even if file exists)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import {
  getActiveBrands,
  getBrandById,
  type BrandContent,
} from '../lib/remotion/brand-content';

// ── Bootstrap ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env.local'), override: true });
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const PUBLIC_AUDIO = path.join(ROOT_DIR, 'public', 'audio');
const MUSIC_DIR = path.join(PUBLIC_AUDIO, 'music');

// ── CLI Args ─────────────────────────────────────────────────────────────────

function parseArgs(): { brandFilter?: string; force: boolean } {
  const args = process.argv.slice(2);
  let brandFilter: string | undefined;
  let force = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--brand' && args[i + 1]) brandFilter = args[++i];
    else if (args[i] === '--force') force = true;
  }
  return { brandFilter, force };
}

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

// ── ElevenLabs Voiceover ──────────────────────────────────────────────────────

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
// Note: env var has typo VIOCE_ID — support both spellings
const ELEVEN_VOICE_ID =
  process.env.ELEVENLABS_VIOCE_ID ??
  process.env.ELEVENLABS_VOICE_ID ??
  '21m00Tcm4TlvDq8ikWAM'; // Rachel (default)

async function generateVoiceover(
  text: string,
  outputPath: string,
  force: boolean,
): Promise<boolean> {
  if (!ELEVEN_API_KEY) {
    log('  ⚠ ELEVENLABS_API_KEY not configured — skipping voiceover');
    return false;
  }

  if (!force && fs.existsSync(outputPath)) {
    log(`  ✓ Voiceover cached: ${path.basename(outputPath)}`);
    return true;
  }

  log(`  Generating voiceover (${text.length} chars)…`);

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
            similarity_boost: 0.80,
            style: 0.25,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`ElevenLabs ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    log(`  ✓ Voiceover saved (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
    return true;
  } catch (err) {
    log(`  ✗ Voiceover failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ── Voiceover Script Builders ─────────────────────────────────────────────────

function showcaseScript(b: BrandContent): string {
  // Target ~40-45 seconds of speech at natural pace
  return (
    `${b.brandName}. ${b.tagline}. ` +
    `We specialise in ${b.industry.toLowerCase()}. ` +
    `${b.valueProps[0]}. ` +
    `${b.valueProps[1]}. ` +
    `And ${b.valueProps[2]}. ` +
    `When you need a trusted ${b.industry.toLowerCase()} partner, ` +
    `choose ${b.brandName}. ` +
    `Visit ${b.websiteUrl} to get started today.`
  );
}

function reelScript(b: BrandContent): string {
  // Target ~13-15 seconds — tight and punchy
  return `${b.hookText}. ${b.brandName}. ${b.benefit}. ${b.ctaText}.`;
}

function squareScript(b: BrandContent): string {
  // Target ~18-20 seconds
  return (
    `${b.problem}. ` +
    `${b.brandName} has the answer. ` +
    `${b.solution}. ` +
    `Contact ${b.brandName} today.`
  );
}

// ── Background Music (FFmpeg synthesis) ──────────────────────────────────────

type MusicStyle = 'corporate' | 'tech';

const MUSIC_BRAND_MAP: Record<string, MusicStyle> = {
  'disaster-recovery': 'corporate',
  carsi: 'corporate',
  nrpg: 'corporate',
  synthex: 'tech',
  restoreassist: 'tech',
  'unite-group': 'tech',
};

function ffmpegAvailable(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function generateMusic(style: MusicStyle, outputPath: string, force: boolean): boolean {
  if (!force && fs.existsSync(outputPath)) {
    log(`  ✓ Music cached: ${path.basename(outputPath)}`);
    return true;
  }

  if (!ffmpegAvailable()) {
    log('  ⚠ FFmpeg not found — skipping background music generation');
    return false;
  }

  log(`  Generating ${style} background music via FFmpeg…`);

  try {
    const duration = 90; // 90 seconds — long enough to loop twice across all formats
    const fadeIn = 3;
    const fadeOut = duration - 3;

    // aevalsrc expressions: chord harmonics × slow tremolo LFO
    // Corporate: C major (C4·E4·G4·C5) — warm, professional
    // Tech: A minor (A3·C4·E4·A4) — slightly tense, forward-moving
    const expr =
      style === 'corporate'
        ? [
            '0.22*sin(2*PI*261.63*t)*sin(PI*0.08*t+0.5)',   // C4 + tremolo
            '0.16*sin(2*PI*329.63*t)*sin(PI*0.07*t+1.0)',   // E4
            '0.12*sin(2*PI*392.00*t)*sin(PI*0.06*t+0.3)',   // G4
            '0.07*sin(2*PI*523.25*t)*sin(PI*0.05*t+0.8)',   // C5 (octave)
          ].join('+')
        : [
            '0.20*sin(2*PI*220.00*t)*sin(PI*0.10*t+0.2)',   // A3 + faster pulse
            '0.15*sin(2*PI*261.63*t)*sin(PI*0.09*t+0.7)',   // C4
            '0.12*sin(2*PI*329.63*t)*sin(PI*0.08*t+1.2)',   // E4
            '0.08*sin(2*PI*440.00*t)*sin(PI*0.12*t+0.4)',   // A4 (octave)
            '0.03*(sin(2*PI*4*t)>0)*sin(2*PI*880*t)*0.4',   // subtle 4Hz pulse click
          ].join('+');

    const cmd = [
      'ffmpeg -y',
      `-f lavfi -i "aevalsrc=${expr}:s=44100:d=${duration}"`,
      `-af "afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOut}:d=${fadeIn},volume=3.0"`,
      `-ar 44100 -ac 1 -b:a 128k`,
      `"${outputPath}"`,
    ].join(' ');

    execSync(cmd, { stdio: 'ignore' });
    const size = fs.statSync(outputPath).size;
    log(`  ✓ Music generated: ${path.basename(outputPath)} (${(size / 1024).toFixed(0)} KB)`);
    return true;
  } catch (err) {
    log(`  ✗ Music generation failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ── Per-Brand Audio Manifest ──────────────────────────────────────────────────

interface BrandAudioManifest {
  brandId: string;
  showcaseVoice: string | null;  // staticFile path
  reelVoice: string | null;
  squareVoice: string | null;
  musicStyle: MusicStyle;
  musicFile: string | null;      // staticFile path
}

async function processBrand(
  brand: BrandContent,
  force: boolean,
): Promise<BrandAudioManifest> {
  const brandAudioDir = path.join(PUBLIC_AUDIO, brand.id);
  fs.mkdirSync(brandAudioDir, { recursive: true });

  console.log(`\n--- ${brand.brandName} ---`);

  const manifest: BrandAudioManifest = {
    brandId: brand.id,
    showcaseVoice: null,
    reelVoice: null,
    squareVoice: null,
    musicStyle: MUSIC_BRAND_MAP[brand.id] ?? 'corporate',
    musicFile: null,
  };

  // 1. BrandShowcase voiceover
  const showcasePath = path.join(brandAudioDir, 'showcase-voice.mp3');
  if (await generateVoiceover(showcaseScript(brand), showcasePath, force)) {
    manifest.showcaseVoice = `audio/${brand.id}/showcase-voice.mp3`;
  }

  // 2. BrandReel voiceover
  const reelPath = path.join(brandAudioDir, 'reel-voice.mp3');
  if (await generateVoiceover(reelScript(brand), reelPath, force)) {
    manifest.reelVoice = `audio/${brand.id}/reel-voice.mp3`;
  }

  // 3. BrandSquare voiceover
  const squarePath = path.join(brandAudioDir, 'square-voice.mp3');
  if (await generateVoiceover(squareScript(brand), squarePath, force)) {
    manifest.squareVoice = `audio/${brand.id}/square-voice.mp3`;
  }

  // 4. Background music (shared per style, generate once)
  const musicFile = `${manifest.musicStyle}.mp3`;
  const musicPath = path.join(MUSIC_DIR, musicFile);
  if (generateMusic(manifest.musicStyle, musicPath, force)) {
    manifest.musicFile = `audio/music/${musicFile}`;
  }

  // 5. Save manifest next to video outputs
  const videoDir = path.join(ROOT_DIR, 'output', 'videos', brand.id);
  if (fs.existsSync(videoDir)) {
    fs.writeFileSync(
      path.join(videoDir, 'audio-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );
  }

  return manifest;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { brandFilter, force } = parseArgs();

  let brands = getActiveBrands();
  if (brandFilter) {
    const brand = getBrandById(brandFilter);
    if (!brand) {
      console.error(`Brand not found: ${brandFilter}`);
      process.exit(1);
    }
    brands = [brand];
  }

  fs.mkdirSync(MUSIC_DIR, { recursive: true });

  console.log('\n================================');
  console.log('Brand Audio Generator');
  console.log(`ElevenLabs voice: ${ELEVEN_VOICE_ID}`);
  console.log(`Mode: ${force ? 'FORCE (re-generate all)' : 'INCREMENTAL (skip cached)'}`);
  console.log('================================\n');

  const manifests: BrandAudioManifest[] = [];

  for (const brand of brands) {
    const manifest = await processBrand(brand, force);
    manifests.push(manifest);
  }

  // Summary
  console.log('\n================================');
  console.log('Audio Summary');
  console.log('================================\n');

  for (const m of manifests) {
    const voiceCount = [m.showcaseVoice, m.reelVoice, m.squareVoice].filter(Boolean).length;
    console.log(`${m.brandId}:`);
    console.log(`  Voiceovers: ${voiceCount}/3`);
    console.log(`  Music: ${m.musicFile ?? 'not generated'}`);
  }

  console.log('\nNext step: re-render with audio');
  console.log('  npx tsx scripts/render-brand-videos.ts\n');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
