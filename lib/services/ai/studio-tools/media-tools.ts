/**
 * media_* tools — thin, SSRF-guarded clients over the Railway media-worker
 * (services/media-worker), the cloud ffmpeg service.
 *
 * Why a remote worker: the Synthex host has no ffmpeg and a 4.5MB serverless
 * body cap, so probing / frame-extracting / transcoding owned media of real
 * size happens on Railway (native ffmpeg in a container) and these tools just
 * dispatch a URL + options to it. Nothing runs unless MEDIA_WORKER_URL is
 * configured — an unconfigured worker yields an honest `{ error }`, never a
 * throw (same posture as research_* with zero providers).
 *
 * Scope: 'creative' (media authoring utilities, bare-name convention like
 * generate_image). Risk: probe is read; extract/transcode are draft (extract
 * with `upload` writes owned frames straight into the PRIVATE reference bucket
 * — see lib/services/ai/reference-library-private.ts; nothing is ever
 * published or spent, so the v1 read/draft invariant holds).
 *
 * SSRF: every videoUrl passes assertExternalUrlSafe() (protocol + DNS-resolved
 * private/link-local/metadata block) BEFORE it reaches the worker. A rejected
 * URL surfaces as this tool's explicit `error` field, no request is made.
 *
 * outputSchema is deliberately omitted: ffprobe returns free-form JSON, and a
 * declared structuredContent shape is SDK-validated at call time (throws on
 * mismatch — types.ts caveat). Only declare shapes proven by a contract test.
 */
import { z } from 'zod';
import { assertExternalUrlSafe } from '@/lib/security/validate-url';
import type { StudioTool } from './types';

const VideoUrl = z
  .string()
  .url()
  .describe(
    'http(s) URL ffmpeg can fetch — a Supabase signed URL, a fal URL, or a Drive direct-download URL'
  );

const ProbeArgs = z.object({ videoUrl: VideoUrl });

const ExtractArgs = z.object({
  videoUrl: VideoUrl,
  /** Sample one frame every N seconds (fps = 1/N). */
  everySeconds: z.number().positive().max(3600).optional(),
  /** Hard cap on frames returned/written. */
  maxFrames: z.number().int().min(1).max(500).optional(),
  format: z.enum(['jpg', 'png']).optional(),
  /** ffmpeg -q:v (jpg only; 2 = high quality, 31 = low). */
  quality: z.number().int().min(2).max(31).optional(),
  /**
   * When present, frames are written straight into the PRIVATE reference
   * bucket + manifest instead of being returned as base64 — closing the
   * owned-video → private-grounding loop.
   */
  upload: z
    .object({
      industry: z
        .string()
        .regex(/^[a-z0-9-]+$/, 'lowercase kebab industry key'),
      subjectKey: z
        .string()
        .regex(/^[a-z0-9-]+$/, 'lowercase kebab subject key'),
      label: z.string().max(120).optional(),
    })
    .optional(),
});

const TranscodeArgs = z.object({
  videoUrl: VideoUrl,
  format: z.enum(['mp4', 'webm']).optional(),
  maxWidth: z.number().int().min(64).max(3840).optional(),
  /** H.264 CRF (18 = high quality/large, 30 = smaller). */
  crf: z.number().int().min(0).max(51).optional(),
});

function workerBase(): string {
  return (process.env.MEDIA_WORKER_URL || '').replace(/\/+$/, '');
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Dispatch a validated request to the media-worker. Never throws for the
 * expected failure modes (worker unconfigured, SSRF-rejected URL, worker
 * error) — those come back as `{ error }` so the MCP caller gets an honest
 * result rather than a tool exception.
 */
async function callWorker(
  path: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<Record<string, unknown>> {
  const base = workerBase();
  if (!base) {
    return {
      error:
        'media-worker not configured (set MEDIA_WORKER_URL + MEDIA_WORKER_TOKEN)',
    };
  }
  // SSRF boundary — resolve + classify the host before any outbound request.
  try {
    await assertExternalUrlSafe(String(body.videoUrl));
  } catch (err) {
    return { error: `videoUrl rejected: ${errMessage(err)}` };
  }
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MEDIA_WORKER_TOKEN || ''}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      return { error: (json.error as string) || `worker HTTP ${res.status}` };
    }
    return json;
  } catch (err) {
    return { error: `media-worker request failed: ${errMessage(err)}` };
  }
}

export const MEDIA_TOOLS: StudioTool[] = [
  {
    name: 'media_probe',
    description:
      'Probe an owned media URL with ffprobe (via the Railway media-worker) and return its format + stream metadata (duration, codecs, resolution, bitrate). Read-only. SSRF-guarded. Returns { error } if the worker is not configured or the URL is unfetchable.',
    scope: 'creative',
    riskClass: 'read',
    costClass: 'free',
    schema: ProbeArgs,
    execute: async args => {
      const a = ProbeArgs.parse(args);
      return callWorker('/probe', { videoUrl: a.videoUrl }, 90_000);
    },
  },
  {
    name: 'media_extract_frames',
    description:
      'Extract frames from an owned video by URL (fps = 1/everySeconds, capped at maxFrames) via the Railway media-worker. Default: returns frames as base64. With `upload:{industry,subjectKey,label}`: writes the frames straight into the PRIVATE reference-library bucket + manifest so reference-grounded generation can use them immediately — the raw footage never leaves your control. Draft. SSRF-guarded.',
    scope: 'creative',
    riskClass: 'draft',
    costClass: 'free',
    schema: ExtractArgs,
    execute: async args => {
      const a = ExtractArgs.parse(args);
      return callWorker(
        '/extract',
        {
          videoUrl: a.videoUrl,
          everySeconds: a.everySeconds,
          maxFrames: a.maxFrames,
          format: a.format,
          quality: a.quality,
          upload: a.upload,
        },
        280_000
      );
    },
  },
  {
    name: 'media_transcode',
    description:
      'Transcode/downscale an owned video by URL (H.264, scale to maxWidth, CRF quality) via the Railway media-worker and return the result as base64. Draft. SSRF-guarded. For large outputs prefer extract-to-private-bucket over returning bytes.',
    scope: 'creative',
    riskClass: 'draft',
    costClass: 'free',
    schema: TranscodeArgs,
    execute: async args => {
      const a = TranscodeArgs.parse(args);
      return callWorker(
        '/transcode',
        {
          videoUrl: a.videoUrl,
          format: a.format,
          maxWidth: a.maxWidth,
          crf: a.crf,
        },
        280_000
      );
    },
  },
];
