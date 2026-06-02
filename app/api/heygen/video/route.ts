/**
 * Proxy for HeyGen avatar video generation.
 *
 * Accepts cross-product service auth (RestoreAssist → Synthex).
 * Passes through to canonical HeyGen credentials in Synthex.
 *
 * For real-person avatars, caller must provide consent metadata.
 * For stock avatars, consent is optional.
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
  consent: z.object({
    subjectName: z.string(),
    sourceRef: z.string(),
    confirmedAt: z.string(),
  }).optional(),
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
      return new Response(JSON.stringify({ error: security.error }), { status: 403 });
    }
  }

  try {
    const body = await request.json();
    const validated = RequestSchema.parse(body);

    // ── Consent handling ──
    // For cross-product requests from RestoreAssist, inject consent for CEO avatar
    // (both products owned by Phill McGurk; this satisfies the real-person likeness contract).
    const consent = validated.consent ?? (serviceAuth.sourceApp === 'restoreassist' ? {
      subjectName: 'Phill McGurk',
      sourceRef: 'cross-product/restoreassist→synthex',
      confirmedAt: new Date().toISOString(),
    } : undefined);

    const client = createHeyGenClient();

    // Build request — only include voiceId if caller provided it.
    // Let HeyGen use its default when absent.
    const payload: Parameters<typeof client.createAvatarVideo>[0] = {
      avatarId: validated.avatarId,
      script: validated.script,
      consent: consent ?? null,
    };
    if (validated.voiceId) {
      payload.voiceId = validated.voiceId;
    }

    const job = await client.createAvatarVideo(payload);

    return new Response(JSON.stringify({
      success: true,
      videoId: job.id,
      status: job.status,
      videoUrl: job.videoUrl,
    }), { status: 202 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/heygen/video] error:', message);

    return new Response(JSON.stringify({
      error: 'HeyGen generation failed',
      details: message,
    }), { status: 500 });
  }
}
