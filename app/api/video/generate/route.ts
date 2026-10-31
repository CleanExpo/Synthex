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

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import prisma from '@/lib/prisma';
import { getAIProvider, type AIProvider } from '@/lib/ai/providers';
import {
  governedRouteCall,
  GovernorRefusedError,
  GOVERNOR_PROVIDERS,
  type GovernorProvider,
} from '@/lib/ai/governor';
import { resolveOrgBrandSlug } from '@/lib/ai/governor-route-support';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';
import { submitGenerativeVideo } from '@/lib/services/ai/video/generation-service';
import { QuotaExceededError } from '@/lib/services/ai/video/types';
import { withRateLimit } from '@/lib/rate-limit/rate-limiter';
import { requireEntitlement } from '@/lib/billing/require-entitlement';

export const dynamic = 'force-dynamic';

/**
 * Duck-typed check for GroundingBlockedError (Real Images Only mandate,
 * lib/services/ai/video/generation-service.ts). Deliberately NOT
 * `instanceof GroundingBlockedError` — that breaks whenever the caller (or a
 * test) holds a different module instance of generation-service than the one
 * that threw (e.g. a manual jest.mock of the module), throwing
 * "Right-hand side of 'instanceof' is not an object/callable" instead of
 * mapping the response. The `blocked` discriminator is the load-bearing
 * contract, not class identity.
 */
function isGroundingBlockedError(
  err: unknown
): err is Error & { blocked: true } {
  return (
    err instanceof Error && (err as { blocked?: unknown }).blocked === true
  );
}

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
  // Real Images Only (2026-07-12): grounding is on by default in the service —
  // referenceSet pins an industry explicitly, useReferences:false is the
  // audited escape hatch back to a synthetic (ungrounded) first frame.
  referenceSet: z.string().min(1).optional(),
  useReferences: z.boolean().optional(),
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

// SYN-1004: durable (Upstash-backed) limiter as the outer gate so the AI rate
// limit survives serverless cold starts, not just APISecurityChecker's
// per-instance in-memory map.
export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, () => _postHandler(request));
}

async function _postHandler(request: NextRequest): Promise<NextResponse> {
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

    // Subscription gate — video generation requires Professional plan or
    // higher. Central entitlement resolves from plan AND status so an
    // unpaid/past-due paid plan fails closed. (This route previously had no
    // tier gate at all.)
    const entitlement = await requireEntitlement(userId, 'video_script');
    if (!entitlement.allowed) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error:
            'Video generation requires a Professional subscription or higher',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
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
        if (isGroundingBlockedError(err)) {
          // Real Images Only mandate: no owned coverage for the subject (or
          // no image-capable model to use it) — the UI renders the
          // add-photos guidance from this, never a generic 500. Duck-typed on
          // `.blocked === true` rather than `instanceof GroundingBlockedError`
          // so this stays correct even across a mocked/duplicated module
          // instance of generation-service (the class identity is not load-
          // bearing — only the discriminator is).
          return APISecurityChecker.createSecureResponse(
            { success: false, error: err.message, blocked: true },
            422
          );
        }
        logger.error('generative video submit failed', { err });
        const msg = err instanceof Error ? err.message : '';
        if (
          /unknown method card|requires an input image|variants must be|exceeds .* maximum|No (draft|standard|premium) model supports/i.test(
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
      const response = await completeScript(
        aiProvider,
        scriptPrompt,
        organizationId
      );

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

      // Enforcing Governor only: the call was refused before any spend.
      if (aiError instanceof GovernorRefusedError) {
        return APISecurityChecker.createSecureResponse(
          {
            success: false,
            error: 'AI call refused by the spend governor',
            code: 'governor_refused',
            outcome: aiError.outcome,
            videoId: videoGen.id,
          },
          403
        );
      }

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

const SCRIPT_SYSTEM_PROMPT =
  'You are a professional video scriptwriter for marketing content. Output valid JSON only, no markdown or explanation.';
const SCRIPT_MAX_TOKENS = 2000;

/** The Governor's provider id for an AIProvider, or null for an ungoverned local one (Ollama). */
function governorProviderOf(ai: AIProvider): GovernorProvider | null {
  const id = ai.name.toLowerCase();
  return (GOVERNOR_PROVIDERS as readonly string[]).includes(id)
    ? (id as GovernorProvider)
    : null;
}

/**
 * The script's paid text call, through the AI Governor in GOVERNOR_MODE (P5,
 * spec M10): one pipeline_cost_ledger row per call with the real model and
 * token usage. The Governor's resolved model and brand key are used when it
 * has them; otherwise (shadow mode) the route keeps its own.
 */
async function completeScript(
  aiProvider: AIProvider,
  scriptPrompt: string,
  organizationId: string | null
) {
  const messages = [
    { role: 'system' as const, content: SCRIPT_SYSTEM_PROMPT },
    { role: 'user' as const, content: scriptPrompt },
  ];
  const call = (ai: AIProvider, model: string) =>
    ai.complete({
      model,
      messages,
      temperature: 0.7,
      max_tokens: SCRIPT_MAX_TOKENS,
    });

  const provider = governorProviderOf(aiProvider);
  if (!provider || !organizationId) {
    // A local provider spends nothing. A user with no organisation cannot be
    // receipted; logged so the gap is visible until enforcing mode refuses it.
    if (provider) {
      logger.warn('video script: no organisation, call not governed', {
        provider,
      });
    }
    return call(aiProvider, aiProvider.models.balanced);
  }

  return governedRouteCall({
    organizationId,
    brandSlug: await resolveOrgBrandSlug(organizationId),
    runner: 'video-script',
    pipelineName: 'video-script',
    provider,
    model: { kind: 'registered', modelId: aiProvider.models.balanced },
    estimate: {
      inputTokens: Math.ceil(
        (SCRIPT_SYSTEM_PROMPT.length + scriptPrompt.length) / 4
      ),
      outputTokens: SCRIPT_MAX_TOKENS,
    },
    execute: async ctx => {
      const ai = ctx.apiKey
        ? getAIProvider({ apiKey: ctx.apiKey, provider })
        : aiProvider;
      const response = await call(
        ai,
        ctx.model?.id ?? aiProvider.models.balanced
      );
      return {
        data: response,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        modelId: response.model,
      };
    },
  });
}

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
