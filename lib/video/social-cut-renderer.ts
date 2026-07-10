/**
 * Social Cut Renderer — lib/video/social-cut-renderer.ts
 *
 * Physically renders the cut plans that deriveSocialCut lands in
 * video_assets (status 'pending', metadata.source 'deriveSocialCut').
 *
 * Per pending row: claim (pending → processing, idempotent under concurrent
 * crons) → download the hero file → probe dimensions → FFmpeg centred crop +
 * tail trim + burned caption lines → upload the rendered cut to Supabase
 * storage → row 'ready' with the real file URL (the media-fragment plan URL
 * is preserved in metadata.planUrl). Failures mark the row 'failed' with
 * metadata.renderError and never abort the batch. The publish_queue row
 * remains human-gated throughout — rendering never publishes.
 *
 * Heavy deps (fluent-ffmpeg) load lazily inside the default IO so importing
 * this module for its pure helpers costs nothing.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { uploadToStorage } from '@/lib/storage/supabase-storage';
import type {
  SocialCutBox,
  SocialCutTrim,
  SocialCutCaptionPlacement,
} from './social-derivation';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RenderPlan {
  target: string;
  crop: SocialCutBox;
  trim: SocialCutTrim;
  caption: {
    text: string;
    placement: SocialCutCaptionPlacement;
    band: SocialCutBox;
  };
}

export interface PixelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderResult {
  assetId: string;
  status: 'ready' | 'failed' | 'skipped';
  url?: string;
  error?: string;
}

/** IO boundary — injectable so tests never touch ffmpeg/network/storage. */
export interface RendererIo {
  download: (url: string, toPath: string) => Promise<void>;
  probe: (filePath: string) => Promise<{ width: number; height: number }>;
  transcode: (args: {
    inPath: string;
    outPath: string;
    startSec: number;
    durationSec: number;
    filters: string[];
  }) => Promise<void>;
  upload: (
    userId: string,
    fileName: string,
    buffer: Buffer,
    mimeType: string
  ) => Promise<{ url: string }>;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Matches the adapter's wrap estimate so burned lines mirror the plan. */
const CAPTION_CHARS_PER_LINE = 32;
/** Hard cap on burned lines — beyond this the plan was already flagged. */
const CAPTION_MAX_BURN_LINES = 3;

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Convert a percent box to even-rounded pixels (libx264 needs even dims). */
export function pctBoxToPixels(
  box: SocialCutBox,
  width: number,
  height: number
): PixelBox {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const w = even((box.wPct / 100) * width);
  const h = even((box.hPct / 100) * height);
  const x = Math.min(
    Math.max(0, Math.round((box.xPct / 100) * width)),
    Math.max(0, width - w)
  );
  const y = Math.min(
    Math.max(0, Math.round((box.yPct / 100) * height)),
    Math.max(0, height - h)
  );
  return { x, y, w, h };
}

/** Word-wrap a caption to the adapter's line estimate. */
export function wrapCaptionLines(
  text: string,
  charsPerLine = CAPTION_CHARS_PER_LINE,
  maxLines = CAPTION_MAX_BURN_LINES
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= charsPerLine || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
    return kept;
  }
  return lines;
}

/** Escape a line for ffmpeg drawtext (backslash, quote, colon, comma, %). */
export function escapeDrawtext(line: string): string {
  return line
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/%/g, '\\%');
}

/**
 * Build the FFmpeg filter chain: centred crop (when the plan crops) then one
 * drawtext per wrapped caption line, stacked inside the caption band. Font
 * sizing follows the same drawtext pattern video-processor.ts already uses.
 */
export function buildVideoFilters(
  plan: RenderPlan,
  dims: { width: number; height: number }
): string[] {
  const filters: string[] = [];

  const cropped = plan.crop.wPct !== 100 || plan.crop.hPct !== 100;
  const cropPx = pctBoxToPixels(plan.crop, dims.width, dims.height);
  const outW = cropped ? cropPx.w : dims.width;
  const outH = cropped ? cropPx.h : dims.height;
  if (cropped) {
    filters.push(`crop=${cropPx.w}:${cropPx.h}:${cropPx.x}:${cropPx.y}`);
  }

  const lines = wrapCaptionLines(plan.caption.text);
  if (lines.length === 0) return filters;

  const bandTopPx = Math.round((plan.caption.band.yPct / 100) * outH);
  const fontSize = Math.max(24, Math.round(outH * 0.032));
  const lineGap = Math.round(fontSize * 1.25);

  lines.forEach((line, i) => {
    const y = bandTopPx + i * lineGap;
    filters.push(
      `drawtext=text='${escapeDrawtext(line)}':fontsize=${fontSize}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=12:x=(w-text_w)/2:y=${y}`
    );
  });

  return filters;
}

/** Validate the adapter's metadata into a typed render plan. */
export function parseRenderPlan(
  metadata: unknown
): { ok: true; plan: RenderPlan } | { ok: false; error: string } {
  const record =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : null;
  if (record?.source !== 'deriveSocialCut') {
    return { ok: false, error: 'metadata.source is not deriveSocialCut' };
  }
  const derivation = record.derivation as Record<string, unknown> | undefined;
  const crop = derivation?.crop as SocialCutBox | undefined;
  const trim = derivation?.trim as SocialCutTrim | undefined;
  const caption = derivation?.caption as RenderPlan['caption'] | undefined;
  const boxOk = (b: SocialCutBox | undefined): b is SocialCutBox =>
    !!b && [b.xPct, b.yPct, b.wPct, b.hPct].every(Number.isFinite);
  if (!boxOk(crop)) return { ok: false, error: 'derivation.crop malformed' };
  if (
    !trim ||
    !Number.isFinite(trim.fromSec) ||
    !Number.isFinite(trim.toSec) ||
    trim.toSec <= trim.fromSec
  ) {
    return { ok: false, error: 'derivation.trim malformed' };
  }
  if (!caption || typeof caption.text !== 'string' || !boxOk(caption.band)) {
    return { ok: false, error: 'derivation.caption malformed' };
  }
  return {
    ok: true,
    plan: {
      target: String(derivation?.target ?? ''),
      crop,
      trim,
      caption: {
        text: caption.text,
        placement: caption.placement,
        band: caption.band,
      },
    },
  };
}

// ── Default IO (lazy ffmpeg) ─────────────────────────────────────────────────

async function loadFfmpeg() {
  const { default: ffmpeg } = await import('fluent-ffmpeg');
  const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');
  const ffprobeInstaller = await import('@ffprobe-installer/ffprobe');
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
  return ffmpeg;
}

export const defaultIo: RendererIo = {
  async download(url, toPath) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`hero download failed: HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(toPath, buffer);
  },
  async probe(filePath) {
    const ffmpeg = await loadFfmpeg();
    return new Promise((resolve, reject) => {
      type ProbeStream = {
        codec_type?: string;
        width?: number;
        height?: number;
      };
      ffmpeg.ffprobe(
        filePath,
        (err: Error | null, data: { streams: ProbeStream[] }) => {
          if (err) return reject(err);
          const stream = data.streams.find(s => s.codec_type === 'video');
          if (!stream?.width || !stream?.height) {
            return reject(new Error('no video stream dimensions in hero'));
          }
          resolve({ width: stream.width, height: stream.height });
        }
      );
    });
  },
  async transcode({ inPath, outPath, startSec, durationSec, filters }) {
    const ffmpeg = await loadFfmpeg();
    return new Promise((resolve, reject) => {
      ffmpeg(inPath)
        .setStartTime(startSec)
        .duration(durationSec)
        .videoFilters(filters)
        .outputOptions([
          '-c:v libx264',
          '-preset veryfast',
          '-crf 23',
          '-c:a aac',
          '-movflags +faststart',
        ])
        .on('end', () => resolve())
        .on('error', reject)
        .save(outPath);
    });
  },
  async upload(userId, fileName, buffer, mimeType) {
    return uploadToStorage(userId, fileName, buffer, mimeType);
  },
};

// ── Claim + render ───────────────────────────────────────────────────────────

interface PendingCut {
  id: string;
  founderId: string;
  url: string;
  metadata: Prisma.JsonValue;
}

/** Find pending deriveSocialCut rows (oldest first). */
export async function findPendingSocialCuts(limit: number) {
  return prisma.videoAsset.findMany({
    where: {
      status: 'pending',
      metadata: { path: ['source'], equals: 'deriveSocialCut' },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true, founderId: true, url: true, metadata: true },
  });
}

/** Atomically claim one row; false means another worker got it first. */
export async function claimSocialCut(assetId: string): Promise<boolean> {
  const claimed = await prisma.videoAsset.updateMany({
    where: { id: assetId, status: 'pending' },
    data: { status: 'processing' },
  });
  return claimed.count === 1;
}

async function markFailed(
  assetId: string,
  metadata: Prisma.JsonValue,
  error: string
) {
  const existing =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  await prisma.videoAsset.update({
    where: { id: assetId },
    data: {
      status: 'failed',
      metadata: { ...existing, renderError: error } as Prisma.InputJsonValue,
    },
  });
}

/** Render one claimed cut. Never throws — failures land on the row. */
export async function renderSocialCut(
  asset: PendingCut,
  io: RendererIo = defaultIo
): Promise<RenderResult> {
  const parsed = parseRenderPlan(asset.metadata);
  if (!parsed.ok) {
    await markFailed(asset.id, asset.metadata, parsed.error);
    return { assetId: asset.id, status: 'failed', error: parsed.error };
  }
  const plan = parsed.plan;

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-cut-'));
  const inPath = path.join(workDir, 'hero.mp4');
  const outPath = path.join(workDir, 'cut.mp4');
  // The adapter stores the plan as a media-fragment URL — strip the fragment
  // to fetch the actual hero file.
  const heroUrl = asset.url.split('#')[0];

  try {
    await io.download(heroUrl, inPath);
    const dims = await io.probe(inPath);
    const filters = buildVideoFilters(plan, dims);
    await io.transcode({
      inPath,
      outPath,
      startSec: plan.trim.fromSec,
      durationSec: plan.trim.toSec - plan.trim.fromSec,
      filters,
    });

    const buffer = fs.readFileSync(outPath);
    const uploaded = await io.upload(
      asset.founderId,
      `social-cut-${asset.id}.mp4`,
      buffer,
      'video/mp4'
    );

    const existing =
      asset.metadata &&
      typeof asset.metadata === 'object' &&
      !Array.isArray(asset.metadata)
        ? (asset.metadata as Record<string, unknown>)
        : {};
    await prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        status: 'ready',
        url: uploaded.url,
        metadata: {
          ...existing,
          planUrl: asset.url,
          renderedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    logger.info('SocialCutRenderer: cut rendered', {
      assetId: asset.id,
      url: uploaded.url,
    });
    return { assetId: asset.id, status: 'ready', url: uploaded.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('SocialCutRenderer: render failed', {
      assetId: asset.id,
      error: message,
    });
    await markFailed(asset.id, asset.metadata, message).catch(e =>
      logger.error('SocialCutRenderer: failed-state write failed', {
        assetId: asset.id,
        error: String(e),
      })
    );
    return { assetId: asset.id, status: 'failed', error: message };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/** Process pending cuts within a time budget (cron entry point). */
export async function processPendingSocialCuts(
  options: { limit?: number; timeBudgetMs?: number; io?: RendererIo } = {}
): Promise<RenderResult[]> {
  const { limit = 3, timeBudgetMs = 240_000, io = defaultIo } = options;
  const startedAt = Date.now();
  const pending = await findPendingSocialCuts(limit);
  const results: RenderResult[] = [];

  for (const asset of pending) {
    if (Date.now() - startedAt > timeBudgetMs) {
      results.push({
        assetId: asset.id,
        status: 'skipped',
        error: 'time budget exhausted',
      });
      continue;
    }
    if (!(await claimSocialCut(asset.id))) {
      results.push({
        assetId: asset.id,
        status: 'skipped',
        error: 'claimed by another worker',
      });
      continue;
    }
    results.push(await renderSocialCut(asset, io));
  }

  return results;
}
