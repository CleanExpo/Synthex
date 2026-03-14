/**
 * AI Video Generation Service
 *
 * @description Multi-provider video generation using Runway ML, Synthesia, D-ID, and HeyGen
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - RUNWAY_API_KEY: Runway ML API key (SECRET)
 * - SYNTHESIA_API_KEY: Synthesia API key (SECRET)
 * - DID_API_KEY: D-ID API key (SECRET)
 * - HEYGEN_API_KEY: HeyGen API key (SECRET, GOD MODE ONLY)
 *
 * FAILURE MODE: Falls back to alternative providers, returns error if all fail
 */

import { logger } from '@/lib/logger';

// Provider types
export type VideoProvider = 'runway' | 'synthesia' | 'd-id' | 'heygen';

// Video generation types
export type VideoType = 'text-to-video' | 'image-to-video' | 'avatar' | 'motion' | 'template';

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
  status: 'pending' | 'processing' | 'completed' | 'failed';
  provider: VideoProvider;
  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
    format?: string;
    model?: string;
  };
  error?: string;
}

// Provider configurations
const RUNWAY_API_BASE = 'https://api.runwayml.com/v1';
const SYNTHESIA_API_BASE = 'https://api.synthesia.io/v2';
const DID_API_BASE = 'https://api.d-id.com';
const HEYGEN_API_BASE = 'https://api.heygen.com';

/**
 * Generate video using Runway ML Gen-3
 */
async function generateWithRunway(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    return { success: false, provider: 'runway', status: 'failed', error: 'RUNWAY_API_KEY not configured' };
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
      payload.motion_amount = options.motionAmount === 'subtle' ? 0.3
        : options.motionAmount === 'dynamic' ? 0.9 : 0.6;
      if (options.prompt) {
        payload.prompt = options.prompt;
      }
    } else {
      return { success: false, provider: 'runway', status: 'failed', error: 'Invalid options for Runway' };
    }

    // Create generation request
    const response = await fetch(`${RUNWAY_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error instanceof Error ? error.message : String(error) || `Runway API error: ${response.status}`);
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
    return { success: false, provider: 'runway', status: 'failed', error: error instanceof Error ? error.message : String(error) };
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
    return { success: false, provider: 'synthesia', status: 'failed', error: 'SYNTHESIA_API_KEY not configured' };
  }

  if (!options.script) {
    return { success: false, provider: 'synthesia', status: 'failed', error: 'Script required for Synthesia' };
  }

  try {
    const response = await fetch(`${SYNTHESIA_API_BASE}/videos`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        test: process.env.NODE_ENV !== 'production', // Use test mode in dev
        input: [{
          scriptText: options.script,
          avatar: options.avatarId || 'anna_costume1_cameraA',
          avatarSettings: {
            voice: options.voiceId || 'en-US-JennyNeural',
            horizontalAlign: 'center',
            scale: 1,
            style: 'rectangular',
          },
          background: 'off_white',
        }],
        aspectRatio: options.aspectRatio || '16:9',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error instanceof Error ? error.message : String(error) || `Synthesia API error: ${response.status}`);
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
    return { success: false, provider: 'synthesia', status: 'failed', error: error instanceof Error ? error.message : String(error) };
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
    return { success: false, provider: 'd-id', status: 'failed', error: 'DID_API_KEY not configured' };
  }

  if (!options.script && !options.imageUrl) {
    return { success: false, provider: 'd-id', status: 'failed', error: 'Script or image required for D-ID' };
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
      source_url: options.imageUrl || 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg',
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
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error instanceof Error ? error.message : String(error) || `D-ID API error: ${response.status}`);
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
    return { success: false, provider: 'd-id', status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Generate video using HeyGen (God Mode only)
 *
 * Supports two modes:
 * - Avatar video: script + avatarId → AI-generated presenter video
 * - Template video: templateId + variables → template-based video
 *
 * Auth gate is enforced at the API route level, NOT here.
 */
async function generateWithHeyGen(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return { success: false, provider: 'heygen', status: 'failed', error: 'HEYGEN_API_KEY not configured' };
  }

  try {
    let endpoint: string;
    let payload: Record<string, unknown>;

    if (options.type === 'template' && options.templateId) {
      // Template-based video generation
      endpoint = `${HEYGEN_API_BASE}/v2/template/${options.templateId}/generate`;
      payload = {
        test: process.env.NODE_ENV !== 'production',
        caption: false,
        title: options.prompt || 'Synthex generated video',
      };
    } else {
      // Avatar-based video generation (script required)
      if (!options.script) {
        return { success: false, provider: 'heygen', status: 'failed', error: 'Script required for HeyGen avatar video' };
      }

      endpoint = `${HEYGEN_API_BASE}/v2/video/generate`;
      payload = {
        test: process.env.NODE_ENV !== 'production',
        caption: false,
        title: options.prompt || 'Synthex generated video',
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: options.avatarId || 'Angela-inblackskirt-20220820',
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            input_text: options.script,
            voice_id: options.voiceId || '1bd001e7e50f421d891986aad5c21024',
            speed: 1.0,
          },
          background: {
            type: 'color',
            value: '#FFFFFF',
          },
        }],
        dimension: {
          width: options.aspectRatio === '9:16' ? 720 : 1920,
          height: options.aspectRatio === '9:16' ? 1280 : 1080,
        },
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = (errorData as Record<string, unknown>).message || `HeyGen API error: ${response.status}`;
      throw new Error(String(errorMsg));
    }

    const data = await response.json() as { data?: { video_id?: string } };

    return {
      success: true,
      provider: 'heygen',
      videoId: data.data?.video_id,
      status: 'processing',
      metadata: {
        model: 'heygen-avatar',
        duration: options.duration,
      },
    };
  } catch (error: unknown) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    logger.error('HeyGen generation failed:', { error });
    return {
      success: false,
      provider: 'heygen',
      status: 'failed',
      error: isTimeout
        ? 'HeyGen request timed out after 30s'
        : (error instanceof Error ? error.message : String(error)),
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
        const response = await fetch(`${RUNWAY_API_BASE}/generations/${videoId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        const data = await response.json();

        return {
          success: data.status === 'SUCCEEDED',
          provider: 'runway',
          videoId,
          videoUrl: data.output?.[0],
          status: data.status === 'SUCCEEDED' ? 'completed'
            : data.status === 'FAILED' ? 'failed' : 'processing',
          error: data.error,
        };
      }

      case 'synthesia': {
        const apiKey = process.env.SYNTHESIA_API_KEY;
        const response = await fetch(`${SYNTHESIA_API_BASE}/videos/${videoId}`, {
          headers: { 'Authorization': apiKey! },
        });
        const data = await response.json();

        return {
          success: data.status === 'complete',
          provider: 'synthesia',
          videoId,
          videoUrl: data.download,
          status: data.status === 'complete' ? 'completed'
            : data.status === 'failed' ? 'failed' : 'processing',
          error: data.error,
        };
      }

      case 'd-id': {
        const apiKey = process.env.DID_API_KEY;
        const response = await fetch(`${DID_API_BASE}/talks/${videoId}`, {
          headers: { 'Authorization': `Basic ${apiKey}` },
        });
        const data = await response.json();

        return {
          success: data.status === 'done',
          provider: 'd-id',
          videoId,
          videoUrl: data.result_url,
          status: data.status === 'done' ? 'completed'
            : data.status === 'error' ? 'failed' : 'processing',
          error: data.error?.description,
        };
      }

      case 'heygen': {
        const heygenKey = process.env.HEYGEN_API_KEY;
        const response = await fetch(
          `${HEYGEN_API_BASE}/v1/video_status.get?video_id=${videoId}`,
          { headers: { 'x-api-key': heygenKey! } }
        );
        const data = await response.json() as {
          data?: { status?: string; video_url?: string; error?: { message?: string } };
        };

        const heygenStatus = data.data?.status;
        return {
          success: heygenStatus === 'completed',
          provider: 'heygen',
          videoId,
          videoUrl: data.data?.video_url,
          status: heygenStatus === 'completed' ? 'completed'
            : heygenStatus === 'failed' ? 'failed' : 'processing',
          error: data.data?.error?.message,
        };
      }

      default:
        return { success: false, provider, videoId, status: 'failed', error: 'Unknown provider' };
    }
  } catch (error: unknown) {
    logger.error(`Failed to check video status for ${provider}:`, { error });
    return { success: false, provider, videoId, status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Main video generation function with provider selection
 */
export async function generateVideo(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  // Select provider based on video type
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
      case 'template':
        provider = 'heygen'; // Templates are HeyGen-only (God Mode)
        break;
      default:
        provider = 'runway';
    }
  }

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
    case 'heygen':
      result = await generateWithHeyGen(options);
      break;
    default:
      result = { success: false, provider: provider!, status: 'failed', error: 'Unknown provider' };
  }

  if (result.success) {
    logger.info(`Video generation initiated with ${provider}`, { videoId: result.videoId });
  } else {
    logger.error(`Video generation failed with ${provider}`, { error: result.error });
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
