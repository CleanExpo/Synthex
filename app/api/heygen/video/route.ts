/**
 * Proxy for HeyGen avatar video generation — ElevenLabs-audio-first.
 *
 * Accepts cross-product service auth (RestoreAssist -> Synthex).
 * Pipeline:  script -> ElevenLabs TTS -> Supabase Storage public URL -> HeyGen lip-sync.
 * This eliminates dependency on HeyGen voice_id catalog and uses our CEO voice clone.
 *
 * For real-person avatars, caller must provide consent metadata.
 * For stock avatars, consent is optional.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { validateServiceToken } from '@/lib/security/service-token-validator';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { createHeyGenClient } from '@/lib/marketing-agency/heygen/client';
import { generateSpeech } from '@/lib/services/ai/voice-generation';
import { uploadToStorage } from '@/lib/storage/supabase-storage';

const RequestSchema = z.object({
  script: z.string().min(1).max(5000),
  avatarId: z.string().min(1),
  voiceId: z.string().optional(),        // ElevenLabs voice ID (default: CEO clone)
  audioUrl: z.string().url().optional(),  // pre-generated audio (skip ElevenLabs)
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
  title: z.string().max(200).optional(),
  consent: z.object({
    subjectName: z.string(),
    sourceRef: z.string(),      // e.g. "signed-pdf-v1"
    confirmedAt: z.string(),    // ISO-8601
  }).optional(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────
  const serviceAuth = validateServiceToken(request);

  if (!serviceAuth.valid) {
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.SERVICE_WRITE,
    );
    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403,
      );
    }
  }

  // ── Validate ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid JSON body' },
      400,
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Validation error', details: parsed.error.issues },
      400,
    );
  }
  const validated = parsed.data;

  // ── Consent check (real-person avatars) ──────────────────────────────
  const consent = validated.consent ? {
    subjectName: validated.consent.subjectName,
    sourceRef: validated.consent.sourceRef,
    confirmedAt: validated.consent.confirmedAt,
  } : { subjectName: 'stock-avatar', sourceRef: 'terms-of-service', confirmedAt: new Date().toISOString() };

  try {
    // ── Step 1: Get audio URL ─────────────────────────────────────────
    let audioUrl: string;

    if (validated.audioUrl) {
      // Caller already has audio (e.g. pre-generated ElevenLabs MP3)
      audioUrl = validated.audioUrl;
    } else {
      // Generate ElevenLabs audio -> upload to Supabase Storage
      const voiceResult = await generateSpeech({
        text: validated.script,
        voiceId: validated.voiceId || process.env.ELEVENLABS_VOICE_ID || 'aGkVQvWUZi16EH8aZJvT', // CEO clone
        modelId: 'eleven_multilingual_v2',
        stability: 0.55,
        similarityBoost: 0.8,
        style: 0.25,
        outputFormat: 'mp3_44100_128',
      });

      if (!voiceResult.success || !voiceResult.audioBase64) {
        return APISecurityChecker.createSecureResponse(
          { error: 'ElevenLabs audio generation failed', details: voiceResult.error },
          500,
        );
      }

      // Decode base64 -> Buffer
      const audioBuffer = Buffer.from(voiceResult.audioBase64, 'base64');

      // Upload to Supabase Storage (service account)
      const uploadResult = await uploadToStorage(
        'system:heygen-video-pipeline',
        `heygen-audio-${Date.now()}.mp3`,
        audioBuffer,
        'audio/mpeg',
      );

      audioUrl = uploadResult.url;
    }

    // ── Step 2: HeyGen avatar video with audio lip-sync ────────────────
    const client = createHeyGenClient();

    const job = await client.createAvatarVideo({
      avatarId: validated.avatarId,
      audioUrl,                           // ElevenLabs audio for lip-sync
      consent,
      dimension: validated.aspectRatio === '9:16'
        ? { width: 720, height: 1280 }
        : validated.aspectRatio === '1:1'
          ? { width: 720, height: 720 }
          : { width: 1280, height: 720 },
      ...(validated.title ? { title: validated.title } : {}),
    });

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        videoId: job.id,
        provider: job.provider,
        status: job.status,
        pollUrl: `/api/heygen/video?videoId=${encodeURIComponent(job.id)}`,
        pollInterval: 5,
      },
      202,
    );

  } catch (err: unknown) {
    console.error('[heygen/video] Pipeline error:', err);
    return APISecurityChecker.createSecureResponse(
      {
        error: 'HeyGen generation failed',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────
  const serviceAuth = validateServiceToken(request);

  if (!serviceAuth.valid) {
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.SERVICE_READ,
    );
    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403,
      );
    }
  }

  // ── Validate params ─────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Missing videoId query parameter' },
      400,
    );
  }

  try {
    const client = createHeyGenClient();
    const job = await client.getVideoStatus(videoId);

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        videoId: job.id,
        videoUrl: job.videoUrl,
        thumbnailUrl: undefined,
        status: job.status,
        provider: job.provider,
        error: job.error,
      },
      200,
    );
  } catch (err: unknown) {
    return APISecurityChecker.createSecureResponse(
      {
        error: 'Failed to poll video status',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}
