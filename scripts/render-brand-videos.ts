#!/usr/bin/env npx tsx
/**
 * Brand Video Render Pipeline
 *
 * Renders BrandShowcase, BrandReel, and BrandSquare videos for all active businesses
 * using @remotion/bundler + @remotion/renderer Node.js API.
 * Generates thumbnails via FFmpeg after each render.
 *
 * Usage:
 *   npx tsx scripts/render-brand-videos.ts
 *   npx tsx scripts/render-brand-videos.ts --brand disaster-recovery
 *   npx tsx scripts/render-brand-videos.ts --composition BrandReel
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { bundle } from '@remotion/bundler';
import {
  renderMedia,
  selectComposition,
  RenderMediaOptions,
} from '@remotion/renderer';
import {
  getActiveBrands,
  getBrandById,
  toBrandShowcaseProps,
  toBrandReelProps,
  toBrandSquareProps,
  type BrandContent,
} from '../lib/remotion/brand-content';
import type { AudioConfig } from '../lib/remotion/types';

// ── Configuration ────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_BASE = path.join(ROOT_DIR, 'output', 'videos');
const REMOTION_ENTRY = path.join(ROOT_DIR, 'lib', 'remotion', 'index.tsx');

// ── Audio Manifest ────────────────────────────────────────────────────────────

interface AudioManifest {
  brandId: string;
  showcaseVoice: string | null;
  reelVoice: string | null;
  squareVoice: string | null;
  musicStyle: string;
  musicFile: string | null;
}

function loadAudioManifest(brandId: string): AudioManifest | null {
  const manifestPath = path.join(OUTPUT_BASE, brandId, 'audio-manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as AudioManifest;
  } catch {
    return null;
  }
}

function buildAudioConfig(
  manifest: AudioManifest | null,
  voiceKey: 'showcaseVoice' | 'reelVoice' | 'squareVoice',
): AudioConfig | undefined {
  if (!manifest) return undefined;
  const voiceoverStaticFile = manifest[voiceKey] ?? undefined;
  const musicStaticFile = manifest.musicFile ?? undefined;
  if (!voiceoverStaticFile && !musicStaticFile) return undefined;
  return { voiceoverStaticFile, musicStaticFile };
}

interface CompositionConfig {
  id: string;
  filename: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  audioKey: 'showcaseVoice' | 'reelVoice' | 'squareVoice';
  getProps: (brand: BrandContent, audioConfig?: AudioConfig) => Record<string, unknown>;
}

const COMPOSITIONS: CompositionConfig[] = [
  {
    id: 'BrandShowcase',
    filename: 'BrandShowcase.mp4',
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 1350,
    audioKey: 'showcaseVoice',
    getProps: (brand, audioConfig) =>
      ({ ...toBrandShowcaseProps(brand), audioConfig }) as unknown as Record<string, unknown>,
  },
  {
    id: 'BrandReel',
    filename: 'BrandReel.mp4',
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 450,
    audioKey: 'reelVoice',
    getProps: (brand, audioConfig) =>
      ({ ...toBrandReelProps(brand), audioConfig }) as unknown as Record<string, unknown>,
  },
  {
    id: 'BrandSquare',
    filename: 'BrandSquare.mp4',
    width: 1080,
    height: 1080,
    fps: 30,
    durationInFrames: 600,
    audioKey: 'squareVoice',
    getProps: (brand, audioConfig) =>
      ({ ...toBrandSquareProps(brand), audioConfig }) as unknown as Record<string, unknown>,
  },
];

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

async function generateThumbnail(videoPath: string, outputPath: string): Promise<boolean> {
  try {
    const ffmpegPath: string = (await import('@ffmpeg-installer/ffmpeg')).path;
    const { execSync } = await import('child_process');
    const cmd = `"${ffmpegPath}" -i "${videoPath}" -ss 00:00:05 -vframes 1 -q:v 2 "${outputPath}" -y`;
    execSync(cmd, { stdio: 'pipe', timeout: 30_000 });
    log(`  Thumbnail: ${path.basename(outputPath)}`);
    return true;
  } catch {
    log(`  WARNING: Could not generate thumbnail for ${path.basename(videoPath)}`);
    return false;
  }
}

// ── CLI Args ─────────────────────────────────────────────────────────────────

function parseArgs(): { brandFilter?: string; compositionFilter?: string; force: boolean } {
  const args = process.argv.slice(2);
  let brandFilter: string | undefined;
  let compositionFilter: string | undefined;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--brand' && args[i + 1]) {
      brandFilter = args[++i];
    } else if (args[i] === '--composition' && args[i + 1]) {
      compositionFilter = args[++i];
    } else if (args[i] === '--force') {
      force = true;
    }
  }

  return { brandFilter, compositionFilter, force };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { brandFilter, compositionFilter, force } = parseArgs();

  // Get brands
  let brands = getActiveBrands();
  if (brandFilter) {
    const brand = getBrandById(brandFilter);
    if (!brand) {
      console.error(`Brand not found: ${brandFilter}`);
      console.error(`Available: ${getActiveBrands().map((b) => b.id).join(', ')}`);
      process.exit(1);
    }
    brands = [brand];
  }

  // Filter compositions
  let compositions = COMPOSITIONS;
  if (compositionFilter) {
    compositions = compositions.filter((c) => c.id === compositionFilter);
    if (compositions.length === 0) {
      console.error(`Composition not found: ${compositionFilter}`);
      console.error(`Available: ${COMPOSITIONS.map((c) => c.id).join(', ')}`);
      process.exit(1);
    }
  }

  ensureDir(OUTPUT_BASE);

  const totalVideos = brands.length * compositions.length;
  let rendered = 0;
  let failed = 0;

  log(`\n============================`);
  log(`Brand Video Render Pipeline`);
  log(`============================`);
  log(`Brands:       ${brands.map((b) => b.brandName).join(', ')}`);
  log(`Compositions: ${compositions.map((c) => c.id).join(', ')}`);
  log(`Total videos: ${totalVideos}`);
  log(`Mode:         ${force ? 'FORCE (re-render all)' : 'INCREMENTAL (skip existing)'}`);
  log(`Output:       ${OUTPUT_BASE}`);
  log(`============================\n`);

  // Bundle once — reuse across all renders
  log(`Bundling Remotion entry point...`);
  const bundleLocation = await bundle({
    entryPoint: REMOTION_ENTRY,
    webpackOverride: (config) => config,
    publicDir: path.join(ROOT_DIR, 'public'),
  });
  log(`Bundle ready: ${bundleLocation}\n`);

  for (const brand of brands) {
    const brandDir = path.join(OUTPUT_BASE, brand.id);
    ensureDir(brandDir);

    // Load audio manifest once per brand
    const audioManifest = loadAudioManifest(brand.id);
    if (audioManifest) {
      const voiceCount = [audioManifest.showcaseVoice, audioManifest.reelVoice, audioManifest.squareVoice].filter(Boolean).length;
      log(`--- ${brand.brandName} --- (audio: ${voiceCount}/3 voices, music: ${audioManifest.musicFile ? '✓' : '✗'})`);
    } else {
      log(`--- ${brand.brandName} --- (no audio manifest — rendering without audio)`);
    }

    for (const comp of compositions) {
      const videoPath = path.join(brandDir, comp.filename);
      const thumbPath = path.join(brandDir, comp.filename.replace('.mp4', '-thumb.jpg'));

      // Skip if already rendered (unless --force)
      if (!force && fs.existsSync(videoPath)) {
        log(`  Skipping ${comp.id} (already exists — use --force to re-render)`);
        rendered++;
        continue;
      }

      const audioConfig = buildAudioConfig(audioManifest, comp.audioKey);
      const audioNote = audioConfig
        ? `voice=${audioConfig.voiceoverStaticFile ? '✓' : '✗'} music=${audioConfig.musicStaticFile ? '✓' : '✗'}`
        : 'no audio';

      log(`  Rendering ${comp.id} (${comp.width}x${comp.height}, ${comp.durationInFrames / comp.fps}s, ${audioNote})...`);

      try {
        const inputProps = comp.getProps(brand, audioConfig);

        const composition = await selectComposition({
          serveUrl: bundleLocation,
          id: comp.id,
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
            if (pct % 20 === 0) {
              process.stdout.write(`\r  [${comp.id}] ${pct}%   `);
            }
          },
        } as RenderMediaOptions);

        process.stdout.write('\n');
        const sizeMB = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(1);
        log(`  Done: ${comp.filename} (${sizeMB} MB)`);
        rendered++;

        await generateThumbnail(videoPath, thumbPath);
      } catch (err: unknown) {
        process.stdout.write('\n');
        const message = err instanceof Error ? err.message : String(err);
        log(`  ERROR: ${message}`);
        failed++;
      }
    }

    log('');
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  log(`============================`);
  log(`Render Complete`);
  log(`============================`);
  log(`Rendered: ${rendered}/${totalVideos}`);
  if (failed > 0) log(`Failed:   ${failed}`);
  log(`Output:   ${OUTPUT_BASE}`);
  log(`============================\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
