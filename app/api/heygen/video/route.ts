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
import { withRateLimit } from '@/lib/rate-limit/rate-limiter';
import { validateServiceToken } from '@/lib/security/service-token-validator';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import {
  createHeyGenClient,
  HeyGenApiError,
  HeyGenConfigurationError,
  HeyGenConsentError,
  mp3DurationSeconds,
  priceAvatarVideoUsd,
} from '@/lib/marketing-agency/heygen/client';
import {
  generateSpeech,
  priceSpeechUsd,
} from '@/lib/services/ai/voice-generation';
import {
  holdMediaSpend,
  mediaSpendRefusal,
  releaseMediaSpend,
  resolveMediaSpendOwner,
  settleMediaSpend,
  MediaSpendRefusedError,
} from '@/lib/services/ai/media-spend-gate';
import { uploadToStorage } from '@/lib/storage/platform-storage';

const RequestSchema = z.object({
  script: z.string().min(1).max(5000),
  avatarId: z.string().min(1),
  voiceId: z.string().optional(), // ElevenLabs voice ID (default: CEO clone)
  audioUrl: z.string().url().optional(), // pre-generated audio (skip ElevenLabs)
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
  title: z.string().max(200).optional(),
  consent: z
    .object({
      subjectName: z.string(),
      sourceRef: z.string(), // e.g. "signed-pdf-v1"
      confirmedAt: z.string(), // ISO-8601
    })
    .optional(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function _handlePost(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────
  const serviceAuth = validateServiceToken(request);
  let userId: string | undefined;

  if (!serviceAuth.valid) {
    // No valid service token — fall back to a REAL authenticated user.
    // SERVICE_WRITE has requireAuth:false, so using it here made auth a no-op
    // on a paid pipeline. AUTHENTICATED_WRITE enforces a verified session.
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
    userId = security.context.userId;
  }

  // ── Validate ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid JSON body' },
      400
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Validation error', details: parsed.error.issues },
      400
    );
  }
  const validated = parsed.data;

  // ── Consent check (real-person avatars) ──────────────────────────────
  const consent = validated.consent
    ? {
        subjectName: validated.consent.subjectName,
        sourceRef: validated.consent.sourceRef,
        confirmedAt: validated.consent.confirmedAt,
      }
    : {
        subjectName: 'stock-avatar',
        sourceRef: 'terms-of-service',
        confirmedAt: new Date().toISOString(),
      };

  try {
    // ── Spend gate (spec M10) ─────────────────────────────────────────
    // HeyGen bills by seconds of video, which is the length of the audio. Audio
    // the caller supplies has no length we can read before spending, so it
    // cannot be priced and is refused rather than guessed (fail closed).
    if (validated.audioUrl) {
      throw new MediaSpendRefusedError(
        'media_unpriced',
        422,
        'Caller-supplied audio cannot be priced before spend (its length is unknown). Omit audioUrl so the pipeline generates and measures the audio.'
      );
    }
    const owner = await resolveMediaSpendOwner(
      serviceAuth.valid
        ? { isService: true }
        : { isService: false, userId: userId ?? '' }
    );

    // ── Step 1: ElevenLabs audio -> Supabase Storage public URL ───────
    const speechModel = 'eleven_multilingual_v2' as const;
    const speechUsd = priceSpeechUsd(speechModel, validated.script);
    const speechHold = await holdMediaSpend({
      ...owner,
      heldUsd: speechUsd,
      pipeline: 'voice-generation',
      model: speechModel,
    });
    const voiceResult = await generateSpeech({
      text: validated.script,
      voiceId:
        validated.voiceId ||
        process.env.ELEVENLABS_VOICE_ID ||
        'aGkVQvWUZi16EH8aZJvT', // CEO clone
      modelId: speechModel,
      stability: 0.55,
      similarityBoost: 0.8,
      style: 0.25,
      outputFormat: 'mp3_44100_128',
    });

    if (!voiceResult.success || !voiceResult.audioBase64) {
      // success without audio still made a billed call; only a failure is free.
      if (voiceResult.success) await settleMediaSpend(speechHold, speechUsd);
      else await releaseMediaSpend(speechHold);
      return APISecurityChecker.createSecureResponse(
        {
          error: 'ElevenLabs audio generation failed',
          details: voiceResult.error,
        },
        500
      );
    }

    await settleMediaSpend(speechHold, speechUsd);

    // Decode base64 -> Buffer
    const audioBuffer = Buffer.from(voiceResult.audioBase64, 'base64');
    const audioSeconds = mp3DurationSeconds(audioBuffer.length);

    // Upload to Supabase Storage (service account)
    const uploadResult = await uploadToStorage(
      'system:heygen-video-pipeline',
      `heygen-audio-${Date.now()}.mp3`,
      audioBuffer,
      'audio/mpeg'
    );

    const audioUrl = uploadResult.url;

    // ── Step 2: HeyGen avatar video with audio lip-sync ────────────────
    const client = createHeyGenClient();

    // Priced from the measured audio length, held before the HeyGen request.
    const videoUsd = priceAvatarVideoUsd(audioSeconds);
    const videoHold = await holdMediaSpend({
      ...owner,
      heldUsd: videoUsd,
      pipeline: 'heygen-avatar-video',
      model: 'heygen-avatar-iii',
    });

    let job: Awaited<ReturnType<typeof client.createAvatarVideo>>;
    try {
      job = await client.createAvatarVideo({
        avatarId: validated.avatarId,
        script: validated.script,
        audioUrl, // ElevenLabs audio for lip-sync
        consent,
        dimension:
          validated.aspectRatio === '9:16'
            ? { width: 720, height: 1280 }
            : validated.aspectRatio === '1:1'
              ? { width: 720, height: 720 }
              : { width: 1280, height: 720 },
        ...(validated.title ? { title: validated.title } : {}),
      });
    } catch (err) {
      // Return the hold only when no job can exist: HeyGen explicitly refused
      // it, or the client stopped before sending (consent / configuration).
      // Any other failure — a 5xx, a lost or unreadable response — may follow
      // a job HeyGen accepted and bills, so the hold is KEPT at its full
      // amount; the stale sweep charges it rather than handing the headroom
      // back for spend that may be real.
      const provenNoJob =
        (err instanceof HeyGenApiError && !err.dispatched) ||
        err instanceof HeyGenConsentError ||
        err instanceof HeyGenConfigurationError;
      if (provenNoJob) {
        await releaseMediaSpend(videoHold);
      } else {
        console.error(
          '[heygen/video] HeyGen outcome unknown — avatar hold kept',
          { holdId: videoHold.holdId }
        );
      }
      throw err;
    }
    await settleMediaSpend(videoHold, videoUsd);

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        videoId: job.id,
        provider: job.provider,
        status: job.status,
        pollUrl: `/api/heygen/video?videoId=${encodeURIComponent(job.id)}`,
        pollInterval: 5,
      },
      202
    );
  } catch (err: unknown) {
    const refusal = mediaSpendRefusal(err);
    if (refusal) {
      return APISecurityChecker.createSecureResponse(
        refusal.body,
        refusal.status
      );
    }
    console.error('[heygen/video] Pipeline error:', err);
    return APISecurityChecker.createSecureResponse(
      {
        error: 'HeyGen generation failed',
        details: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => _handlePost(request));
}

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────
  const serviceAuth = validateServiceToken(request);

  if (!serviceAuth.valid) {
    // No valid service token — fall back to a REAL authenticated user.
    // SERVICE_READ has requireAuth:false; AUTHENTICATED_READ enforces a session.
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );
    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }
  }

  // ── Validate params ─────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Missing videoId query parameter' },
      400
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
      200
    );
  } catch (err: unknown) {
    return APISecurityChecker.createSecureResponse(
      {
        error: 'Failed to poll video status',
        details: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
}
