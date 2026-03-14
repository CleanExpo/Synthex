/**
 * AI Video Generation API
 *
 * @description Generate videos using AI (Runway ML, Synthesia, D-ID, HeyGen)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - RUNWAY_API_KEY: Runway ML API key (SECRET)
 * - SYNTHESIA_API_KEY: Synthesia API key (SECRET)
 * - DID_API_KEY: D-ID API key (SECRET)
 * - HEYGEN_API_KEY: HeyGen API key (SECRET, GOD MODE ONLY)
 *
 * FAILURE MODE: Returns error response with provider details
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import {
  generateVideo,
  generateScriptVideo,
  animateImage,
  checkVideoStatus,
  VideoGenerationOptions,
} from '@/lib/services/ai/video-generation';
import { logger } from '@/lib/logger';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Request validation schemas
const VideoGenerationSchema = z.object({
  type: z.enum(['text-to-video', 'image-to-video', 'avatar', 'motion', 'template']),
  prompt: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  script: z.string().max(5000).optional(),
  duration: z.number().min(1).max(60).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
  resolution: z.enum(['720p', '1080p', '4k']).optional(),
  provider: z.enum(['runway', 'synthesia', 'd-id', 'heygen']).optional(),
  avatarId: z.string().optional(),
  voiceId: z.string().optional(),
  style: z.enum(['cinematic', 'animation', 'realistic', 'artistic']).optional(),
  motionAmount: z.enum(['subtle', 'moderate', 'dynamic']).optional(),
  templateId: z.string().optional(),
  saveToLibrary: z.boolean().default(true),
});

const ScriptVideoSchema = z.object({
  script: z.string().min(1).max(5000),
  avatarId: z.string().optional(),
  voiceId: z.string().optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
  provider: z.enum(['synthesia', 'd-id', 'heygen']).optional(),
  saveToLibrary: z.boolean().default(true),
});

const AnimateImageSchema = z.object({
  imageUrl: z.string().url(),
  prompt: z.string().max(1000).optional(),
  duration: z.number().min(1).max(10).default(5),
  motionAmount: z.enum(['subtle', 'moderate', 'dynamic']).default('moderate'),
  saveToLibrary: z.boolean().default(true),
});

const StatusCheckSchema = z.object({
  videoId: z.string(),
  provider: z.enum(['runway', 'synthesia', 'd-id', 'heygen']),
});

/**
 * POST /api/media/generate/video
 * Generate an AI video
 */
export async function POST(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;

  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'generate';

    let result;
    let validated: z.infer<typeof VideoGenerationSchema> | z.infer<typeof ScriptVideoSchema> | z.infer<typeof AnimateImageSchema>;

    switch (action) {
      case 'script': {
        // Generate avatar video from script
        validated = ScriptVideoSchema.parse(body);
        result = await generateScriptVideo(validated.script, {
          avatarId: validated.avatarId,
          voiceId: validated.voiceId,
          aspectRatio: validated.aspectRatio,
          provider: validated.provider,
        });
        break;
      }

      case 'animate': {
        // Animate a static image
        validated = AnimateImageSchema.parse(body);
        result = await animateImage(validated.imageUrl, {
          prompt: validated.prompt,
          duration: validated.duration,
          motionAmount: validated.motionAmount,
        });
        break;
      }

      case 'generate':
      default: {
        // Full video generation
        validated = VideoGenerationSchema.parse(body);

        // God Mode gate: HeyGen is owner-only
        if (validated.provider === 'heygen' || validated.type === 'template') {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
          });
          if (!user || !isOwnerEmail(user.email)) {
            return APISecurityChecker.createSecureResponse(
              { error: 'HeyGen provider requires God Mode access' },
              403
            );
          }
        }

        // Validate required fields based on type
        if (validated.type === 'text-to-video' && !validated.prompt) {
          return APISecurityChecker.createSecureResponse(
            { error: 'Prompt required for text-to-video generation' },
            400
          );
        }

        if (validated.type === 'image-to-video' && !validated.imageUrl) {
          return APISecurityChecker.createSecureResponse(
            { error: 'Image URL required for image-to-video generation' },
            400
          );
        }

        if (validated.type === 'avatar' && !validated.script) {
          return APISecurityChecker.createSecureResponse(
            { error: 'Script required for avatar video generation' },
            400
          );
        }

        const options: VideoGenerationOptions = {
          type: validated.type,
          prompt: validated.prompt,
          imageUrl: validated.imageUrl,
          script: validated.script,
          duration: validated.duration,
          aspectRatio: validated.aspectRatio,
          resolution: validated.resolution,
          provider: validated.provider,
          avatarId: validated.avatarId,
          voiceId: validated.voiceId,
          style: validated.style,
          motionAmount: validated.motionAmount,
          templateId: validated.templateId,
        };

        result = await generateVideo(options);
        break;
      }
    }

    if (!result.success && result.status === 'failed') {
      logger.error('Video generation failed', { error: result.error, userId });
      return APISecurityChecker.createSecureResponse(
        { error: result.error || 'Video generation failed', provider: result.provider },
        500
      );
    }

    // Save to media library if video is processing/complete
    let mediaAssetId: string | undefined;
    if (validated.saveToLibrary && result.videoId) {
      const { data: asset, error: saveError } = await supabase
        .from('media_assets')
        .insert({
          user_id: userId,
          type: 'video',
          provider: result.provider,
          external_id: result.videoId,
          status: result.status,
          metadata: {
            ...result.metadata,
            type: ('type' in validated ? validated.type : undefined) || action,
            prompt: ('prompt' in validated ? validated.prompt : undefined),
            script: ('script' in validated ? validated.script : undefined),
          },
          video_url: result.videoUrl,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (!saveError && asset) {
        mediaAssetId = asset.id;
      }
    }

    // Audit log
    await auditLogger.logData(
      'create',
      'video',
      mediaAssetId,
      userId,
      'success',
      {
        action: 'MEDIA_GENERATE',
        provider: result.provider,
        type: ('type' in validated ? validated.type : undefined) || action,
        videoId: result.videoId,
        status: result.status,
      }
    );

    return APISecurityChecker.createSecureResponse({
      success: result.success,
      provider: result.provider,
      videoId: result.videoId,
      videoUrl: result.videoUrl,
      status: result.status,
      metadata: result.metadata,
      mediaAssetId,
      // Include polling instructions for async generation
      ...(result.status === 'processing' && {
        pollUrl: `/api/media/generate/video?videoId=${result.videoId}&provider=${result.provider}`,
        pollInterval: 5000, // 5 seconds
      }),
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Video generation error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * GET /api/media/generate/video
 * Check video generation status
 */
export async function GET(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  const videoId = searchParams.get('videoId');
  const provider = searchParams.get('provider') as 'runway' | 'synthesia' | 'd-id' | 'heygen';

  if (!videoId || !provider) {
    // Return available options
    return APISecurityChecker.createSecureResponse({
      providers: {
        runway: {
          name: 'Runway ML',
          types: ['text-to-video', 'image-to-video', 'motion'],
          maxDuration: 10,
        },
        synthesia: {
          name: 'Synthesia',
          types: ['avatar'],
          maxDuration: 60,
          requiresScript: true,
        },
        'd-id': {
          name: 'D-ID',
          types: ['avatar'],
          maxDuration: 60,
          requiresScript: true,
          supportsCustomImage: true,
        },
        heygen: {
          name: 'HeyGen',
          types: ['avatar', 'template'],
          maxDuration: 300,
          requiresScript: true,
          godModeOnly: true,
        },
      },
      videoTypes: ['text-to-video', 'image-to-video', 'avatar', 'motion', 'template'],
      aspectRatios: ['16:9', '9:16', '1:1'],
      resolutions: ['720p', '1080p', '4k'],
      styles: ['cinematic', 'animation', 'realistic', 'artistic'],
      motionAmounts: ['subtle', 'moderate', 'dynamic'],
    });
  }

  try {
    const validated = StatusCheckSchema.parse({ videoId, provider });
    const result = await checkVideoStatus(validated.videoId, validated.provider);

    // Update media asset if status changed
    if (result.videoUrl) {
      await supabase
        .from('media_assets')
        .update({
          status: result.status,
          video_url: result.videoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('external_id', videoId)
        .eq('user_id', userId);
    }

    return APISecurityChecker.createSecureResponse({
      videoId: result.videoId,
      provider: result.provider,
      status: result.status,
      videoUrl: result.videoUrl,
      error: result.error,
      ...(result.status === 'processing' && {
        pollUrl: `/api/media/generate/video?videoId=${videoId}&provider=${provider}`,
        pollInterval: 5000,
      }),
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Video status check error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * PUT /api/media/generate/video
 * Batch video generation (multiple videos)
 */
export async function PUT(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;

  try {
    const body = await request.json();
    const requests = z.array(VideoGenerationSchema).max(5).parse(body.requests || []);

    const results = [];
    const savedAssets: string[] = [];

    for (const req of requests) {
      const options: VideoGenerationOptions = {
        type: req.type,
        prompt: req.prompt,
        imageUrl: req.imageUrl,
        script: req.script,
        duration: req.duration,
        aspectRatio: req.aspectRatio,
        resolution: req.resolution,
        provider: req.provider,
        avatarId: req.avatarId,
        voiceId: req.voiceId,
        style: req.style,
        motionAmount: req.motionAmount,
      };

      const result = await generateVideo(options);
      results.push(result);

      // Save to library
      if (req.saveToLibrary && result.videoId) {
        const { data: asset } = await supabase
          .from('media_assets')
          .insert({
            user_id: userId,
            type: 'video',
            provider: result.provider,
            external_id: result.videoId,
            status: result.status,
            metadata: {
              ...result.metadata,
              type: req.type,
              prompt: req.prompt,
            },
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (asset) {
          savedAssets.push(asset.id);
        }
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Audit log
    await auditLogger.logData(
      'create',
      'video',
      undefined,
      userId,
      'success',
      {
        action: 'MEDIA_GENERATE_BATCH',
        count: requests.length,
        successCount: results.filter(r => r.success).length,
        savedAssets,
      }
    );

    return APISecurityChecker.createSecureResponse({
      success: true,
      results: results.map((r, i) => ({
        index: i,
        success: r.success,
        provider: r.provider,
        videoId: r.videoId,
        status: r.status,
        error: r.error,
        mediaAssetId: savedAssets[i],
      })),
      totalSuccess: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Batch video generation error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}
