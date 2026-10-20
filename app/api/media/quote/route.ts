/**
 * POST /api/media/quote — price and hold for an image or video generation,
 * before any spend row exists (P5, spec M10).
 *
 * Read-only: no spend row, no reservation, no provider call. The numbers come
 * from the same functions the spend path uses (lib/services/ai/media-quote.ts).
 * Text generation keeps its own cost cap and is not quoted here.
 *
 * Auth: session or machine key (smk_) via withOrg; the organisation is the
 * caller's, never the body's. A budget that cannot be read answers 503, never a
 * zero quote.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { defineOrgRoute } from '@/lib/api/define-route';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';
import { logger } from '@/lib/logger';
import {
  MediaQuoteUnavailableError,
  MediaQuoteUnpriceableError,
  quoteMedia,
} from '@/lib/services/ai/media-quote';

export const runtime = 'nodejs';

const imageSchema = z.object({
  kind: z.literal('image'),
  count: z.number().int().min(1).max(8).default(1),
  model: z.string().max(100).optional(),
  width: z.number().int().min(64).max(4096).optional(),
  height: z.number().int().min(64).max(4096).optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional(),
  loraId: z.string().max(100).optional(),
  useReferences: z.boolean().optional(),
  provider: z.enum(['stability', 'dalle', 'gemini']).optional(),
  referenceImageCount: z.number().int().min(0).max(16).optional(),
});

const videoSchema = z.object({
  kind: z.literal('video'),
  tier: z.enum(['draft', 'standard', 'premium']).default('draft'),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).default('9:16'),
  durationSeconds: z.number().int().min(1).max(60).default(6),
  variants: z.number().int().min(1).max(8).default(1),
  audio: z.boolean().optional(),
  requiresImage: z.boolean().optional(),
});

const bodySchema = z.discriminatedUnion('kind', [imageSchema, videoSchema]);

export const POST = defineOrgRoute(
  {
    body: bodySchema,
    onError: e => logger.error('media quote failed', { error: e }),
  },
  async ({ body }, { org, request }) => {
    // A machine key is an agent: it is quoted against the agent daily cap it
    // would be admitted under.
    const initiatedBy = request.headers
      .get('authorization')
      ?.startsWith('Bearer smk_')
      ? 'mcp'
      : 'studio';

    try {
      const quote =
        body.kind === 'image'
          ? await quoteMedia({
              kind: 'image',
              organizationId: org.id,
              initiatedBy,
              count: body.count,
              options: {
                model: body.model,
                width: body.width,
                height: body.height,
                aspectRatio: body.aspectRatio,
                loraId: body.loraId,
                useReferences: body.useReferences,
                provider: body.provider,
                referenceImageCount: body.referenceImageCount,
              },
            })
          : await quoteMedia({
              kind: 'video',
              organizationId: org.id,
              initiatedBy,
              tier: body.tier,
              aspectRatio: body.aspectRatio,
              durationSeconds: body.durationSeconds,
              variants: body.variants,
              audio: body.audio,
              requiresImage: body.requiresImage,
            });
      return NextResponse.json(quote);
    } catch (err) {
      if (err instanceof MediaQuoteUnavailableError) {
        logger.error('media quote: budget unreadable', { error: err.message });
        return notProvisionedResponse(
          'The media budget could not be read, so no quote was produced.'
        );
      }
      if (err instanceof MediaQuoteUnpriceableError) {
        return NextResponse.json(
          { error: 'UNPRICEABLE_REQUEST', message: err.message },
          { status: 422 }
        );
      }
      if (err instanceof RangeError) {
        return NextResponse.json(
          { error: 'Validation failed', message: err.message },
          { status: 400 }
        );
      }
      throw err;
    }
  }
);
