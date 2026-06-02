/**
 * Proxy for HeyGen avatar video generation.
 *
 * Accepts cross-product service auth (RestoreAssist → Synthex).
 * Uses canonical HeyGen credentials stored in Synthex.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { validateServiceToken } from '@/lib/security/service-token-validator';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { createHeyGenClient } from '@/lib/marketing-agency/heygen/client';

const RequestSchema = z.object({
  script: z.string().min(1).max(5000),
  avatarId: z.string().min(1),
  voiceId: z.string().optional(),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function POST(request: NextRequest) {
  // ── Cross-product service auth ──
  const serviceAuth = validateServiceToken(request);
  const isServiceRequest = serviceAuth.valid;

  if (!isServiceRequest) {
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
  }

  try {
    const body = await request.json();
    const validated = RequestSchema.parse(body);

    const client = createHeyGenClient();

    const job = await client.generateAvatarVideo({
      avatar_id: validated.avatarId,
      voice_id: validated.voiceId ?? '2d5b0e6cf36f460aa7fb6a862da5d26c',
      input_text: validated.script,
      background_color: validated.backgroundColor ?? '#1C2E47',
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      videoId: job.data.video_id,
      status: job.data.status,
      videoUrl: job.data.video_url,
      thumbnailUrl: job.data.thumbnail_url,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('HeyGen proxy error:', message);

    return APISecurityChecker.createSecureResponse(
      { error: 'HeyGen generation failed', details: message },
      500
    );
  }
}
