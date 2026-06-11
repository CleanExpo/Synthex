/**
 * Video Script Generation API
 *
 * POST /api/video/generate - Generate a video script using AI
 *
 * Accepts topic, style, and duration. Returns a structured video script
 * with scenes, voiceover text, and visual descriptions.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET (CRITICAL)
 * - DATABASE_URL (CRITICAL)
 *
 * @module app/api/video/generate/route
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import prisma from '@/lib/prisma';
import { getAIProvider } from '@/lib/ai/providers';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';
import { submitGenerativeVideo } from '@/lib/services/ai/video/generation-service';
import { QuotaExceededError } from '@/lib/services/ai/video/types';

export const dynamic = 'force-dynamic';

// =============================================================================
// Schemas
// =============================================================================

const GenerateVideoSchema = z.object({
  topic: z.string().min(3).max(500),
  style: z.enum(['social-reel', 'explainer', 'how-to']),
  duration: z.enum(['15-60s', '2-3m', '3-5m']),
  title: z.string().min(1).max(200).optional(),
});

const GenerativeVideoSchema = z.object({
  mode: z.literal('generative'),
  prompt: z.string().min(3).max(1000),
  imageUrl: z.string().url().optional(),
  methodCardId: z.string().min(1),
  modifierIds: z.array(z.string()).max(12).optional(),
  brandCardId: z.string().optional(),
  audio: z.boolean().optional(),
  variants: z.number().int().min(1).max(8).optional(),
  modelTier: z.enum(['draft', 'standard', 'premium']).optional(),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).optional(),
  durationSeconds: z.number().int().min(4).max(10).optional(),
});

// =============================================================================
// Style configuration
// =============================================================================

const STYLE_CONFIG = {
  'social-reel': {
    label: 'Social Reel',
    durationRange: '15-60 seconds',
    sceneCount: 4,
    platforms: ['instagram', 'tiktok', 'linkedin'],
  },
  explainer: {
    label: 'Explainer Video',
    durationRange: '2-3 minutes',
    sceneCount: 8,
    platforms: ['youtube'],
  },
  'how-to': {
    label: 'How-To Guide',
    durationRange: '3-5 minutes',
    sceneCount: 10,
    platforms: ['youtube'],
  },
} as const;

// =============================================================================
// POST - Generate video script
// =============================================================================

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
    }

    // Parse and validate request
    const body = await request.json();

    // ---- Generative mode (fal.ai engine) -------------------------------
    if ((body as { mode?: string })?.mode === 'generative') {
      if (process.env.VIDEO_STUDIO_ENABLED !== 'true') {
        return APISecurityChecker.createSecureResponse(
          {
            success: false,
            error: 'Video studio is not enabled (VIDEO_STUDIO_ENABLED)',
          },
          403
        );
      }
      const parsed = GenerativeVideoSchema.safeParse(body);
      if (!parsed.success) {
        return APISecurityChecker.createSecureResponse(
          {
            success: false,
            error: 'Invalid request',
            details: parsed.error.issues,
          },
          400
        );
      }
      const organizationId = await getEffectiveOrganizationId(userId);
      if (!organizationId) {
        return APISecurityChecker.createSecureResponse(
          {
            success: false,
            error: 'No organisation context — cannot submit generative video',
          },
          400
        );
      }
      try {
        const jobs = await submitGenerativeVideo({
          ...parsed.data,
          userId,
          organizationId,
          initiatedBy: 'studio',
        });
        return APISecurityChecker.createSecureResponse({
          success: true,
          data: { jobs },
        });
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          return APISecurityChecker.createSecureResponse(
            { success: false, error: err.message, cap: err.cap },
            402
          );
        }
        logger.error('generative video submit failed', { err });
        const msg = err instanceof Error ? err.message : '';
        if (
          /unknown method card|requires an input image|variants must be/i.test(
            msg
          )
        ) {
          return APISecurityChecker.createSecureResponse(
            { success: false, error: msg },
            400
          );
        }
        return APISecurityChecker.createSecureResponse(
          { success: false, error: 'Video generation submit failed' },
          500
        );
      }
    }
    // ---- Script mode (existing behaviour, unchanged below) -------------

    const validation = GenerateVideoSchema.safeParse(body);

    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Invalid request',
          details: validation.error.issues,
        },
        400
      );
    }

    const { topic, style, duration, title } = validation.data;
    const styleConfig = STYLE_CONFIG[style];
    const videoTitle = title || `${styleConfig.label}: ${topic}`;

    // Resolve organisation context
    const organizationId = await getEffectiveOrganizationId(userId);

    // Check if user has a Gemini/AI key configured (use existing AI provider)
    let aiProvider;
    try {
      aiProvider = getAIProvider();
    } catch {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error:
            'AI provider not configured. Please add an API key in Settings.',
          requiresApiKey: true,
        },
        400
      );
    }

    // Create the VideoGeneration record in pending state
    const videoGen = await prisma.videoGeneration.create({
      data: {
        userId,
        organizationId,
        title: videoTitle,
        topic,
        style,
        duration,
        status: 'generating',
      },
    });

    // Generate the video script using AI
    const scriptPrompt = buildScriptPrompt(topic, style, duration, styleConfig);

    try {
      const response = await aiProvider.complete({
        model: aiProvider.models.balanced,
        messages: [
          {
            role: 'system',
            content:
              'You are a professional video scriptwriter for marketing content. Output valid JSON only, no markdown or explanation.',
          },
          { role: 'user', content: scriptPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const scriptText = response.choices[0]?.message?.content || '';

      // Parse the AI response as JSON
      let scriptContent;
      try {
        // Strip potential markdown code fences
        const cleaned = scriptText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        scriptContent = JSON.parse(cleaned);
      } catch {
        // Fallback: structure the raw text as a basic script
        scriptContent = {
          title: videoTitle,
          scenes: [
            {
              sceneNumber: 1,
              duration: duration,
              voiceover: scriptText.slice(0, 500),
              visualDescription: 'Title card with topic text overlay',
              textOverlay: topic,
            },
          ],
          totalDuration: duration,
          style: styleConfig.label,
        };
      }

      // Update the record with the generated script
      const updatedVideo = await prisma.videoGeneration.update({
        where: { id: videoGen.id },
        data: {
          scriptContent,
          status: 'rendered',
          metadata: {
            model: response.model,
            tokens: response.usage?.total_tokens || 0,
            generatedAt: new Date().toISOString(),
          },
        },
      });

      return APISecurityChecker.createSecureResponse({
        success: true,
        data: {
          id: updatedVideo.id,
          title: updatedVideo.title,
          topic: updatedVideo.topic,
          style: updatedVideo.style,
          duration: updatedVideo.duration,
          status: updatedVideo.status,
          scriptContent: updatedVideo.scriptContent,
          createdAt: updatedVideo.createdAt,
        },
      });
    } catch (aiError) {
      // Mark as failed
      await prisma.videoGeneration.update({
        where: { id: videoGen.id },
        data: {
          status: 'failed',
          errorMessage:
            aiError instanceof Error ? aiError.message : 'AI generation failed',
        },
      });

      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error:
            'Failed to generate video script. Please check your API key configuration.',
          videoId: videoGen.id,
        },
        500
      );
    }
  } catch (error) {
    logger.error('Video generate API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to generate video' },
      500
    );
  }
}

// =============================================================================
// Helpers
// =============================================================================

function buildScriptPrompt(
  topic: string,
  style: string,
  duration: string,
  config: (typeof STYLE_CONFIG)[keyof typeof STYLE_CONFIG]
): string {
  return `Create a video script for a ${config.label} (${config.durationRange}) about: "${topic}"

Requirements:
- Style: ${config.label}
- Target duration: ${duration}
- Number of scenes: ${config.sceneCount}
- Target platforms: ${config.platforms.join(', ')}

Return a JSON object with this exact structure:
{
  "title": "Video title",
  "hook": "Opening hook line (first 3 seconds)",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": "Xs",
      "voiceover": "What the narrator says",
      "visualDescription": "What appears on screen",
      "textOverlay": "Text shown on screen (optional)"
    }
  ],
  "callToAction": "End CTA text",
  "totalDuration": "${duration}",
  "style": "${config.label}",
  "suggestedMusic": "Music mood suggestion",
  "hashtags": ["relevant", "hashtags"]
}

Make the content engaging, concise, and suitable for Australian small business marketing. Use Australian English spelling.`;
}

export const runtime = 'nodejs';
