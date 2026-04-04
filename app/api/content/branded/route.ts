/**
 * POST /api/content/branded
 *
 * Generate content using the client's own API keys and brand profile.
 * This is the PRIMARY content generation endpoint for paying clients.
 * Uses ClientBrandedContentService — not the legacy content generator.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ClientBrandedContentService } from '@/lib/services/client-branded-content';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';

const BrandedContentSchema = z.object({
  platform: z.string().min(1).max(100),
  prompt: z.string().min(1).max(2000),
  contentType: z
    .enum(['post', 'caption', 'thread', 'article', 'story'])
    .optional(),
  tone: z.string().max(100).optional(),
  targetLength: z.enum(['short', 'medium', 'long']).optional(),
  includeHashtags: z.boolean().optional(),
  includeEmojis: z.boolean().optional(),
  customInstructions: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const authenticatedUserId = await getUserIdFromRequestOrCookies(request);
  if (!authenticatedUserId) return unauthorizedResponse();

  const authenticatedOrgId =
    await getEffectiveOrganizationId(authenticatedUserId);
  if (!authenticatedOrgId) {
    return NextResponse.json(
      { error: 'No organisation context' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const parsed = BrandedContentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      platform,
      prompt,
      contentType,
      tone,
      targetLength,
      includeHashtags,
      includeEmojis,
      customInstructions,
    } = parsed.data;

    const result = await ClientBrandedContentService.generate({
      orgId: authenticatedOrgId,
      userId: authenticatedUserId,
      platform,
      prompt,
      contentType,
      tone,
      targetLength,
      includeHashtags,
      includeEmojis,
      customInstructions,
    });
    return NextResponse.json({
      success: true,
      data: {
        content: result.content,
        variations: result.variations,
        model: result.model,
        credentialSource: result.credentialSource,
        brandApplied: result.brandApplied,
        metadata: result.metadata,
      },
    });
  } catch (err) {
    console.error('[API] Branded content error:', err);
    return NextResponse.json(
      { success: false, error: 'Content generation failed' },
      { status: 500 }
    );
  }
}
