/**
 * AI Video Generation Service
 *
 * @description Multi-provider video generation using Runway ML, Synthesia, and D-ID.
 *
 * SUBSTRATE REALITY (SYN-43 / SYN-48): none of Runway ML, Synthesia or D-ID are
 * in the sanctioned Synthex media stack. The owned substrate is the Artlist AI
 * Toolkit (images, via browser-harness) + ElevenLabs (voice). These paid
 * text-to-video providers are UNCONFIGURED/aspirational — standing one up is a
 * founder-gated decision. Each provider is therefore gated behind a key-present
 * check: when its API key env is absent/empty the service performs NO network
 * I/O and returns a typed `not_configured` result (never fabricates a video).
 * If a key is ever set the real provider path still runs unchanged.
 *
 * ENVIRONMENT VARIABLES (only when a provider is deliberately wired):
 * - RUNWAY_API_KEY: Runway ML API key (SECRET)
 * - SYNTHESIA_API_KEY: Synthesia API key (SECRET)
 * - DID_API_KEY: D-ID API key (SECRET)
 *
 * FAILURE MODE: unconfigured provider → `not_configured`; genuine call error →
 * `failed`. Callers must treat `not_configured` as a clear client-facing error
 * (never a 500).
 */

import { logger } from '@/lib/logger';

// Provider types
export type VideoProvider = 'runway' | 'synthesia' | 'd-id';

// Video generation types
export type VideoType =
  | 'text-to-video'
  | 'image-to-video'
  | 'avatar'
  | 'motion';

// Video generation options
export interface VideoGenerationOptions {
  prompt?: string;
  imageUrl?: string;
  script?: string;
  type: VideoType;
  duration?: number; // seconds
  aspectRatio?: '16:9' | '9:16' | '1:1';
  resolution?: '720p' | '1080p' | '4k';
  provider?: VideoProvider;
  avatarId?: string;
  voiceId?: string;
  style?: 'cinematic' | 'animation' | 'realistic' | 'artistic';
  motionAmount?: 'subtle' | 'moderate' | 'dynamic';
  templateId?: string;
}

// Generation result
export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  videoId?: string;
  // `not_configured` = the provider is not wired into the Synthex stack (no key);
  // the service made no network call and fabricated nothing.
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'not_configured';
  provider: VideoProvider;
  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
    format?: string;
    model?: string;
  };
  error?: string;
  // Human-readable explanation when `status === 'not_configured'`.
  reason?: string;
}

// Provider configurations
const RUNWAY_API_BASE = 'https://api.runwayml.com/v1';
const SYNTHESIA_API_BASE = 'https://api.synthesia.io/v2';
const DID_API_BASE = 'https://api.d-id.com';

// Why an unconfigured provider degrades rather than errors. Runway/Synthesia/D-ID
// are NOT in the Synthex stack — the sanctioned substrate is the Artlist AI
// Toolkit (images) + ElevenLabs (voice); real text-to-video is founder-gated.
const SUBSTRATE_NOTE =
  'provider not in stack — Artlist AI Toolkit (images) + ElevenLabs (voice) is ' +
  'the sanctioned Synthex substrate; real text-to-video is a founder-gated decision';

/**
 * Build the typed not-configured result for a provider whose API key is unset.
 * No network I/O is performed by callers of this helper.
 */
function notConfigured(
  provider: VideoProvider,
  envVar: string
): VideoGenerationResult {
  return {
    success: false,
    provider,
    status: 'not_configured',
    reason: `${envVar} not configured — ${SUBSTRATE_NOTE}`,
    error: `${envVar} not configured`,
  };
}

/**
 * Generate video using Runway ML Gen-3
 */
async function generateWithRunway(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    return notConfigured('runway', 'RUNWAY_API_KEY');
  }

  try {
    const endpoint = '/generations';
    const payload: {
      model: string;
      duration: number;
      aspect_ratio: string;
      prompt?: string;
      mode?: string;
      init_image?: string;
      motion_amount?: number;
    } = {
      model: 'gen3',
      duration: options.duration || 5,
      aspect_ratio: options.aspectRatio || '16:9',
    };

    if (options.type === 'text-to-video' && options.prompt) {
      payload.prompt = options.prompt;
      payload.mode = 'text_to_video';
    } else if (options.type === 'image-to-video' && options.imageUrl) {
      payload.init_image = options.imageUrl;
      payload.mode = 'image_to_video';
      payload.motion_amount =
        options.motionAmount === 'subtle'
          ? 0.3
          : options.motionAmount === 'dynamic'
            ? 0.9
            : 0.6;
      if (options.prompt) {
        payload.prompt = options.prompt;
      }
    } else {
      return {
        success: false,
        provider: 'runway',
        status: 'failed',
        error: 'Invalid options for Runway',
      };
    }

    // Create generation request
    const response = await fetch(`${RUNWAY_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error instanceof Error
          ? error.message
          : String(error) || `Runway API error: ${response.status}`
      );
    }

    const data = await response.json();

    return {
      success: true,
      provider: 'runway',
      videoId: data.id,
      status: 'processing',
      metadata: {
        model: 'gen3',
        duration: options.duration || 5,
      },
    };
  } catch (error: unknown) {
    logger.error('Runway ML generation failed:', { error });
    return {
      success: false,
      provider: 'runway',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate avatar video using Synthesia
 */
async function generateWithSynthesia(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const apiKey = process.env.SYNTHESIA_API_KEY;
  if (!apiKey) {
    return notConfigured('synthesia', 'SYNTHESIA_API_KEY');
  }

  if (!options.script) {
    return {
      success: false,
      provider: 'synthesia',
      status: 'failed',
      error: 'Script required for Synthesia',
    };
  }

  try {
    const response = await fetch(`${SYNTHESIA_API_BASE}/videos`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        test: process.env.NODE_ENV !== 'production', // Use test mode in dev
        input: [
          {
            scriptText: options.script,
            avatar: options.avatarId || 'anna_costume1_cameraA',
            avatarSettings: {
              voice: options.voiceId || 'en-US-JennyNeural',
              horizontalAlign: 'center',
              scale: 1,
              style: 'rectangular',
            },
            background: 'off_white',
          },
        ],
        aspectRatio: options.aspectRatio || '16:9',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error instanceof Error
          ? error.message
          : String(error) || `Synthesia API error: ${response.status}`
      );
    }

    const data = await response.json();

    return {
      success: true,
      provider: 'synthesia',
      videoId: data.id,
      status: 'processing',
      metadata: {
        model: 'synthesia-avatar',
      },
    };
  } catch (error: unknown) {
    logger.error('Synthesia generation failed:', { error });
    return {
      success: false,
      provider: 'synthesia',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate talking head video using D-ID
 */
async function generateWithDID(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) {
    return notConfigured('d-id', 'DID_API_KEY');
  }

  if (!options.script && !options.imageUrl) {
    return {
      success: false,
      provider: 'd-id',
      status: 'failed',
      error: 'Script or image required for D-ID',
    };
  }

  try {
    const payload: {
      source_url: string;
      script: {
        type: string;
        input: string;
        provider: {
          type: string;
          voice_id: string;
        };
      };
      config: {
        stitch: boolean;
        pad_audio: number;
      };
    } = {
      source_url:
        options.imageUrl ||
        'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg',
      script: {
        type: 'text',
        input: options.script || options.prompt || '',
        provider: {
          type: 'microsoft',
          voice_id: options.voiceId || 'en-US-JennyNeural',
        },
      },
      config: {
        stitch: true,
        pad_audio: 0.5,
      },
    };

    const response = await fetch(`${DID_API_BASE}/talks`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error instanceof Error
          ? error.message
          : String(error) || `D-ID API error: ${response.status}`
      );
    }

    const data = await response.json();

    return {
      success: true,
      provider: 'd-id',
      videoId: data.id,
      status: 'processing',
      metadata: {
        model: 'd-id-talks',
      },
    };
  } catch (error: unknown) {
    logger.error('D-ID generation failed:', { error });
    return {
      success: false,
      provider: 'd-id',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check video generation status
 */
export async function checkVideoStatus(
  videoId: string,
  provider: VideoProvider
): Promise<VideoGenerationResult> {
  try {
    switch (provider) {
      case 'runway': {
        const apiKey = process.env.RUNWAY_API_KEY;
        if (!apiKey) {
          return { ...notConfigured('runway', 'RUNWAY_API_KEY'), videoId };
        }
        const response = await fetch(
          `${RUNWAY_API_BASE}/generations/${videoId}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );
        const data = await response.json();

        return {
          success: data.status === 'SUCCEEDED',
          provider: 'runway',
          videoId,
          videoUrl: data.output?.[0],
          status:
            data.status === 'SUCCEEDED'
              ? 'completed'
              : data.status === 'FAILED'
                ? 'failed'
                : 'processing',
          error: data.error,
        };
      }

      case 'synthesia': {
        const apiKey = process.env.SYNTHESIA_API_KEY;
        if (!apiKey) {
          return {
            ...notConfigured('synthesia', 'SYNTHESIA_API_KEY'),
            videoId,
          };
        }
        const response = await fetch(
          `${SYNTHESIA_API_BASE}/videos/${videoId}`,
          {
            headers: { Authorization: apiKey },
          }
        );
        const data = await response.json();

        return {
          success: data.status === 'complete',
          provider: 'synthesia',
          videoId,
          videoUrl: data.download,
          status:
            data.status === 'complete'
              ? 'completed'
              : data.status === 'failed'
                ? 'failed'
                : 'processing',
          error: data.error,
        };
      }

      case 'd-id': {
        const apiKey = process.env.DID_API_KEY;
        if (!apiKey) {
          return { ...notConfigured('d-id', 'DID_API_KEY'), videoId };
        }
        const response = await fetch(`${DID_API_BASE}/talks/${videoId}`, {
          headers: { Authorization: `Basic ${apiKey}` },
        });
        const data = await response.json();

        return {
          success: data.status === 'done',
          provider: 'd-id',
          videoId,
          videoUrl: data.result_url,
          status:
            data.status === 'done'
              ? 'completed'
              : data.status === 'error'
                ? 'failed'
                : 'processing',
          error: data.error?.description,
        };
      }

      default:
        return {
          success: false,
          provider,
          videoId,
          status: 'failed',
          error: 'Unknown provider',
        };
    }
  } catch (error: unknown) {
    logger.error(`Failed to check video status for ${provider}:`, { error });
    return {
      success: false,
      provider,
      videoId,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Main video generation function with provider selection
 */
export async function generateVideo(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  // FAIL CLOSED. Nothing in this module meters spend: there is no organisation
  // resolution, no reservation, no attempt record and no cap anywhere in it,
  // yet it POSTs to Runway, Synthesia and D-ID. With a provider key present it
  // was an unlimited bypass of the shared media budget and the MCP sub-cap —
  // the exact hole SYN-1115 exists to close, on a route the branch had not
  // touched.
  //
  // It looked safe only because no key is set, and that is a configuration
  // accident rather than a control: adding one would have made the bypass live
  // and silent.
  //
  // Refusal rather than metering, because none of these providers has a
  // registry entry or a verified price, and an unpriced model fails CLOSED by
  // founder ruling. A hold cannot be sized for a call whose cost is unknown.
  // Route them through the meter when they are priced — see the retire TODO in
  // app/api/media/generate/video/route.ts (SYN-1115 release review).
  let provider = options.provider;

  if (!provider) {
    switch (options.type) {
      case 'text-to-video':
      case 'image-to-video':
      case 'motion':
        provider = 'runway';
        break;
      case 'avatar':
        provider = options.imageUrl ? 'd-id' : 'synthesia';
        break;
      default:
        provider = 'runway';
    }
  }

  // FAIL CLOSED, after resolving which provider WOULD have run so the caller
  // still learns that — the route returns it as `details.provider`.
  //
  // Nothing in this module meters spend: no organisation resolution, no
  // reservation, no attempt record, no cap, yet it POSTs to Runway, Synthesia
  // and D-ID. With a provider key present it was an unlimited bypass of the
  // shared media budget and the MCP sub-cap — the exact hole SYN-1115 exists
  // to close, on a route the branch had not touched. It looked safe only
  // because no key is set, and that is a configuration accident, not a
  // control: adding one would have made the bypass live and silent.
  //
  // Refusal rather than metering, because none of these providers has a
  // registry entry or a verified price, and an unpriced model fails CLOSED by
  // founder ruling — a hold cannot be sized for a call of unknown cost. Route
  // them through the meter once priced; see the retire TODO in
  // app/api/media/generate/video/route.ts (SYN-1115 release review).
  return {
    success: false,
    provider,
    status: 'not_configured',
    reason:
      `${provider} is not in the Synthex substrate: it has no verified price ` +
      'and no spend hold, so it cannot be metered against the organisation ' +
      'budget. Use the generative video path (fal) instead.',
    error: `unmetered video provider refused — no spend hold (${provider})`,
  };

  logger.info(`Attempting video generation with ${provider}`, {
    type: options.type,
    duration: options.duration,
  });

  let result: VideoGenerationResult;

  switch (provider) {
    case 'runway':
      result = await generateWithRunway(options);
      break;
    case 'synthesia':
      result = await generateWithSynthesia(options);
      break;
    case 'd-id':
      result = await generateWithDID(options);
      break;
    default:
      result = {
        success: false,
        provider: provider!,
        status: 'failed',
        error: 'Unknown provider',
      };
  }

  if (result.success) {
    logger.info(`Video generation initiated with ${provider}`, {
      videoId: result.videoId,
    });
  } else {
    logger.error(`Video generation failed with ${provider}`, {
      error: result.error,
    });
  }

  return result;
}

/**
 * Generate video from script (avatar-based)
 */
export async function generateScriptVideo(
  script: string,
  options: Partial<VideoGenerationOptions> = {}
): Promise<VideoGenerationResult> {
  return generateVideo({
    ...options,
    script,
    type: 'avatar',
  });
}

/**
 * Generate motion video from image
 */
export async function animateImage(
  imageUrl: string,
  options: Partial<VideoGenerationOptions> = {}
): Promise<VideoGenerationResult> {
  return generateVideo({
    ...options,
    imageUrl,
    type: 'image-to-video',
  });
}

// Export service
export const videoGenerationService = {
  generate: generateVideo,
  generateScriptVideo,
  animateImage,
  checkStatus: checkVideoStatus,
};
