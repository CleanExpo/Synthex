/**
 * POST /api/content/branded
 *
 * Generate content using the client's own API keys and brand profile.
 * This is the PRIMARY content generation endpoint for paying clients.
 * Uses ClientBrandedContentService — not the legacy content generator.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ClientBrandedContentService } from '@/lib/services/client-branded-content';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';

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
    const {
      platform,
      prompt,
      contentType,
      tone,
      targetLength,
      includeHashtags,
      includeEmojis,
      customInstructions,
    } = body;

    if (!platform || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: platform, prompt' },
        { status: 400 }
      );
    }

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
    const message =
      err instanceof Error ? err.message : 'Content generation failed';
    console.error('[API] Branded content error:', err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
