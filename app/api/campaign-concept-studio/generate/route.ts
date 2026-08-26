import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { randomUUID } from 'node:crypto';

import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { RateLimiter } from '@/lib/rate-limit/rate-limiter';
import {
  campaignConceptStudioRequestSchema,
  generateCampaignConceptStudio,
} from '@/lib/services/campaign-concept-studio';
import { type CampaignStudioResponse } from '@/lib/types/campaign-concept-studio';

export const runtime = 'nodejs';
export const maxDuration = 180;

const responseSchema = z
  .object({
    concept: z.object({
      concept: z.string(),
      positioning: z.string(),
      valueProposition: z.string(),
    }),
    copyVariants: z.array(
      z.object({
        headline: z.string(),
        body: z.string(),
      })
    ),
    launchChecklist: z.array(z.string()),
    imagePrompts: z.array(
      z.object({
        channel: z.string(),
        prompt: z.string(),
        imageUrl: z.string().optional(),
        status: z.enum(['ready', 'failed']),
        error: z.string().optional(),
        providerImageModel: z.string().optional(),
      })
    ),
    model: z.object({
      textModel: z.string(),
      imageModel: z.string(),
    }),
    usage: z
      .object({
        inputTokens: z.number().nullable().optional(),
        outputTokens: z.number().nullable().optional(),
        totalTokens: z.number().nullable().optional(),
      })
      .optional(),
  })
  .passthrough();

const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 8;

const getCampaignStudioRateLimit = () => {
  const configured = process.env.CAMPAIGN_STUDIO_RATE_LIMIT_PER_MINUTE;
  const parsed = configured
    ? Number.parseInt(configured, 10)
    : DEFAULT_RATE_LIMIT_PER_MINUTE;
  return !Number.isFinite(parsed) || parsed <= 0
    ? DEFAULT_RATE_LIMIT_PER_MINUTE
    : parsed;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json(
        {
          error:
            'No organisation resolved for this account — campaign concept generation is blocked until your account is fully provisioned.',
        },
        { status: 403 }
      );
    }

    const rateLimitKey = `ccs:${userId}:${organizationId}`;
    const limiter = new RateLimiter({
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: getCampaignStudioRateLimit(),
      identifier: () => rateLimitKey,
    });
    const rlResult = await limiter.check(request);
    if (!rlResult.allowed) {
      const rateLimitResponse = NextResponse.json(
        {
          error:
            'Request limit exceeded. Please wait before generating another campaign concept.',
        },
        { status: 429 }
      );
      rateLimitResponse.headers.set(
        'Retry-After',
        String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))
      );
      return rateLimitResponse;
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (_error) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
        },
        { status: 400 }
      );
    }

    const payloadResult = campaignConceptStudioRequestSchema.safeParse(rawBody);

    if (!payloadResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: payloadResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const studioResponse = (await generateCampaignConceptStudio(
      payloadResult.data,
      {
        userId,
        organizationId,
        traceId: randomUUID(),
      }
    )) as CampaignStudioResponse;
    const validatedResponse = responseSchema.parse(studioResponse);

    return NextResponse.json({ success: true, payload: validatedResponse });
  } catch (error) {
    logger.error('[Campaign Concept Studio API] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Unexpected payload shape returned by generator service',
          details: error.flatten().fieldErrors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Campaign concept generation failed' },
      { status: 502 }
    );
  }
}
