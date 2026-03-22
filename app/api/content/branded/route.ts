/**
 * POST /api/content/branded
 *
 * Generate content using the client's own API keys and brand profile.
 * This is the PRIMARY content generation endpoint for paying clients.
 * Uses ClientBrandedContentService — not the legacy content generator.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ClientBrandedContentService } from '@/lib/services/client-branded-content';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      orgId,
      userId,
      platform,
      prompt,
      contentType,
      tone,
      targetLength,
      includeHashtags,
      includeEmojis,
      customInstructions,
    } = body;

    if (!orgId || !userId || !platform || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, userId, platform, prompt' },
        { status: 400 }
      );
    }

    const result = await ClientBrandedContentService.generate({
      orgId,
      userId,
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
