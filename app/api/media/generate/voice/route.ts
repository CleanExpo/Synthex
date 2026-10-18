/**
 * AI Voice Generation API
 *
 * @description Text-to-speech and voice cloning using ElevenLabs
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - ELEVENLABS_API_KEY: ElevenLabs API key (SECRET)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { validateServiceToken } from '@/lib/security/service-token-validator';
import { auditLogger } from '@/lib/security/audit-logger';
import {
  generateSpeech,
  generateSpeechStream,
  getVoices,
  getCustomVoices,
  getVoiceSettings,
  getCharacterQuota,
  DEFAULT_VOICES,
} from '@/lib/services/ai/voice-generation';
import { logger } from '@/lib/logger';
import { requireEntitlement } from '@/lib/billing/require-entitlement';
import {
  notProvisionedBody,
  tableUnavailable,
} from '@/lib/api/not-provisioned';

// NOT_PROVISIONED: prisma/schema.prisma has no user_voices or media_assets
// model. Voice ownership (clone, list, delete) cannot be recorded or checked,
// so those paths answer 501 / available:false; speech saves report `library`
// instead of dropping the write silently.
const MEDIA_LIBRARY_UNAVAILABLE = tableUnavailable('media_assets');

// SYN-859: ElevenLabs voiceId allowlist. Voice IDs are short alphanumeric
// strings; anything else risks path-injection / SSRF when interpolated into
// the upstream API URL (e.g. ../, %2F, control characters).
const VOICE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

// Request validation schemas
const VoiceConfigSchema = z
  .object({
    stability: z.number().min(0).max(1).optional(),
    similarityBoost: z.number().min(0).max(1).optional(),
    style: z.number().min(0).max(1).optional(),
    useSpeakerBoost: z.boolean().optional(),
  })
  .strict()
  .optional();

const SpeechGenerationSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().regex(VOICE_ID_PATTERN).optional(),
  voiceName: z
    .enum([
      'rachel',
      'adam',
      'bella',
      'josh',
      'elli',
      'sam',
      'charlotte',
      'clyde',
      'grace',
    ])
    .optional(),
  modelId: z
    .enum([
      'eleven_multilingual_v2',
      'eleven_turbo_v2',
      'eleven_monolingual_v1',
    ])
    .optional(),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  useSpeakerBoost: z.boolean().optional(),
  outputFormat: z
    .enum([
      'mp3_44100_128',
      'mp3_44100_192',
      'pcm_16000',
      'pcm_22050',
      'pcm_24000',
    ])
    .optional(),
  saveToLibrary: z.boolean().default(true),
  voiceConfig: VoiceConfigSchema,
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

const VoiceCloneSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  audioFiles: z.array(z.string().url()).min(1).max(25),
  labels: z.record(z.string(), z.string()).optional(),
});

const VoiceDeleteSchema = z.object({
  voiceId: z.string().regex(VOICE_ID_PATTERN),
});

/**
 * POST /api/media/generate/voice
 * Generate speech from text
 */
export async function POST(request: NextRequest) {
  // ── Cross-product service auth (RestoreAssist → Synthex) ──
  const serviceAuth = validateServiceToken(request);
  const isServiceRequest = serviceAuth.valid;

  if (!isServiceRequest) {
    // Fall back to user auth for non-service requests
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

  let authenticatedUserId: string | undefined;

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
    authenticatedUserId = security.context.userId!;
  }

  const userId = isServiceRequest
    ? `service:${serviceAuth.sourceApp ?? 'unknown'}`
    : authenticatedUserId!;

  if (!userId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Unable to determine caller identity' },
      500
    );
  }

  // Subscription gate — AI Voice generation requires the Business tier
  // (status-aware, fails closed on a missing or unpaid/past-due subscription).
  // Cross-product service callers (validated service token) are exempt: they
  // are trusted internal integrations, not end-user subscriptions.
  if (!isServiceRequest) {
    const entitlement = await requireEntitlement(userId, 'ai_voice');
    if (!entitlement.allowed) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'AI Voice generation requires a Business subscription',
          upgradeRequired: true,
          requiredPlan: 'business',
        },
        402
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'generate';

  try {
    const body = await request.json();

    switch (action) {
      case 'clone': {
        // Clone a voice from audio samples. Cloning without a user_voices
        // row would create a provider voice nobody can list or delete, so
        // refuse before spending.
        VoiceCloneSchema.parse(body);
        return APISecurityChecker.createSecureResponse(
          notProvisionedBody('user_voices', 'Voice cloning'),
          501
        );
      }

      case 'stream': {
        // Stream speech (returns ReadableStream info)
        const validated = SpeechGenerationSchema.parse(body);

        // Resolve voice ID
        let voiceId = validated.voiceId;
        if (!voiceId && validated.voiceName) {
          voiceId = DEFAULT_VOICES[validated.voiceName];
        }

        const stream = await generateSpeechStream({
          text: validated.text,
          voiceId,
          modelId: validated.modelId,
          stability: validated.stability,
          similarityBoost: validated.similarityBoost,
        });

        if (!stream) {
          return APISecurityChecker.createSecureResponse(
            { error: 'Failed to generate speech stream' },
            500
          );
        }

        // Return streaming response
        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Transfer-Encoding': 'chunked',
          },
        });
      }

      case 'generate':
      default: {
        // Standard speech generation
        const validated = SpeechGenerationSchema.parse(body);

        // Merge voiceConfig fields (voiceConfig overrides top-level if both provided)
        const effectiveStability =
          validated.voiceConfig?.stability ?? validated.stability;
        const effectiveSimilarityBoost =
          validated.voiceConfig?.similarityBoost ?? validated.similarityBoost;
        const effectiveStyle = validated.voiceConfig?.style ?? validated.style;
        const effectiveUseSpeakerBoost =
          validated.voiceConfig?.useSpeakerBoost ?? validated.useSpeakerBoost;

        // Resolve voice ID from name if provided
        let voiceId = validated.voiceId;
        if (!voiceId && validated.voiceName) {
          voiceId = DEFAULT_VOICES[validated.voiceName];
        }

        const result = await generateSpeech({
          text: validated.text,
          voiceId,
          modelId: validated.modelId,
          stability: effectiveStability,
          similarityBoost: effectiveSimilarityBoost,
          style: effectiveStyle,
          useSpeakerBoost: effectiveUseSpeakerBoost,
          outputFormat: validated.outputFormat,
        });

        if (!result.success) {
          logger.error('Speech generation failed', {
            error: result.error,
            userId,
          });
          return APISecurityChecker.createSecureResponse(
            { error: result.error || 'Speech generation failed' },
            500
          );
        }

        const libraryRequested =
          !isServiceRequest && validated.saveToLibrary && !!result.audioBase64;

        // Audit log (skip for service requests to avoid noise)
        if (!isServiceRequest) {
          await auditLogger.logData(
            'create',
            'audio',
            undefined,
            userId,
            'success',
            {
              action: 'MEDIA_GENERATE',
              voiceId: result.voiceId,
              characterCount: result.characterCount,
            }
          );
        }

        return APISecurityChecker.createSecureResponse({
          success: true,
          audioBase64: result.audioBase64,
          contentType: result.contentType,
          voiceId: result.voiceId,
          characterCount: result.characterCount,
          ...(libraryRequested && { library: MEDIA_LIBRARY_UNAVAILABLE }),
        });
      }
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.issues },
        400
      );
    }

    logger.error('Voice generation error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * GET /api/media/generate/voice
 * Get available voices and quota information
 */
export async function GET(request: NextRequest) {
  // ── Cross-product service auth (RestoreAssist → Synthex) ──
  const serviceAuth = validateServiceToken(request);
  const isServiceRequest = serviceAuth.valid;

  if (!isServiceRequest) {
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

  let authenticatedUserId: string | undefined;
  if (!isServiceRequest) {
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
    authenticatedUserId = security.context.userId!;
  }

  const userId = isServiceRequest
    ? `service:${serviceAuth.sourceApp ?? 'unknown'}`
    : authenticatedUserId!;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  const voiceId = searchParams.get('voiceId');

  // SYN-859: validate voiceId before passing to ElevenLabs URL construction.
  // ElevenLabs voice IDs are short alphanumeric strings — anything else is
  // either malformed or an attempted path-injection / SSRF.
  if (voiceId !== null && !VOICE_ID_PATTERN.test(voiceId)) {
    return APISecurityChecker.createSecureResponse(
      {
        error:
          'Invalid voiceId — must be alphanumeric, underscore, or hyphen, 1-64 chars',
      },
      400
    );
  }

  try {
    // Get specific voice settings
    if (voiceId) {
      const settings = await getVoiceSettings(voiceId);
      if (!settings) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Voice not found' },
          404
        );
      }

      return APISecurityChecker.createSecureResponse({
        voiceId,
        settings,
      });
    }

    // Get quota information
    if (type === 'quota') {
      const quota = await getCharacterQuota();
      return APISecurityChecker.createSecureResponse({
        quota: quota || {
          characterCount: 0,
          characterLimit: 0,
          canExtendCharacterLimit: false,
        },
      });
    }

    // Get voices based on type
    let voices;
    switch (type) {
      case 'custom':
        voices = await getCustomVoices();
        break;
      case 'default':
        voices = Object.entries(DEFAULT_VOICES).map(([name, id]) => ({
          voiceId: id,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          category: 'premade' as const,
        }));
        break;
      case 'all':
      default:
        voices = await getVoices();
        break;
    }

    // Get quota for display
    const quota = await getCharacterQuota();

    return APISecurityChecker.createSecureResponse({
      voices,
      userVoices: tableUnavailable('user_voices'),
      defaultVoices: DEFAULT_VOICES,
      quota,
      models: [
        {
          id: 'eleven_multilingual_v2',
          name: 'Multilingual V2',
          languages: 29,
        },
        { id: 'eleven_turbo_v2', name: 'Turbo V2 (Fast)', languages: 1 },
        { id: 'eleven_monolingual_v1', name: 'Monolingual V1', languages: 1 },
      ],
      outputFormats: [
        { id: 'mp3_44100_128', name: 'MP3 128kbps' },
        { id: 'mp3_44100_192', name: 'MP3 192kbps' },
        { id: 'pcm_16000', name: 'PCM 16kHz' },
        { id: 'pcm_22050', name: 'PCM 22kHz' },
        { id: 'pcm_24000', name: 'PCM 24kHz' },
      ],
    });
  } catch (error: unknown) {
    logger.error('Voice list error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * DELETE /api/media/generate/voice
 * Delete a cloned voice
 */
export async function DELETE(request: NextRequest) {
  // Security check
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

  const userId = security.context.userId!;

  try {
    const body = await request.json();
    VoiceDeleteSchema.parse(body);

    // Ownership lives in user_voices; without it no caller can be shown to
    // own a voice, so nothing is deleted.
    return APISecurityChecker.createSecureResponse(
      notProvisionedBody('user_voices', 'Voice deletion'),
      501
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.issues },
        400
      );
    }

    logger.error('Voice deletion error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * PUT /api/media/generate/voice
 * Batch speech generation
 */
export async function PUT(request: NextRequest) {
  // Security check
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

  const userId = security.context.userId!;

  // Subscription gate — AI Voice generation requires the Business tier
  // (status-aware, fails closed on a missing or unpaid/past-due subscription).
  const entitlement = await requireEntitlement(userId, 'ai_voice');
  if (!entitlement.allowed) {
    return APISecurityChecker.createSecureResponse(
      {
        success: false,
        error: 'AI Voice generation requires a Business subscription',
        upgradeRequired: true,
        requiredPlan: 'business',
      },
      402
    );
  }

  try {
    const body = await request.json();
    const requests = z
      .array(SpeechGenerationSchema)
      .max(10)
      .parse(body.requests || []);

    const results = [];
    let totalCharacters = 0;

    for (const req of requests) {
      // Resolve voice ID
      let voiceId = req.voiceId;
      if (!voiceId && req.voiceName) {
        voiceId = DEFAULT_VOICES[req.voiceName];
      }

      const result = await generateSpeech({
        text: req.text,
        voiceId,
        modelId: req.modelId,
        stability: req.stability,
        similarityBoost: req.similarityBoost,
        style: req.style,
        useSpeakerBoost: req.useSpeakerBoost,
        outputFormat: req.outputFormat,
      });

      results.push(result);

      if (result.success) {
        totalCharacters += result.characterCount || 0;
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Audit log
    await auditLogger.logData('create', 'audio', undefined, userId, 'success', {
      action: 'MEDIA_GENERATE_BATCH',
      count: requests.length,
      successCount: results.filter(r => r.success).length,
      totalCharacters,
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      results: results.map((r, i) => ({
        index: i,
        success: r.success,
        audioBase64: r.audioBase64,
        contentType: r.contentType,
        voiceId: r.voiceId,
        characterCount: r.characterCount,
        error: r.error,
        ...(requests[i].saveToLibrary &&
          r.audioBase64 && { library: MEDIA_LIBRARY_UNAVAILABLE }),
      })),
      totalSuccess: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
      totalCharacters,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.issues },
        400
      );
    }

    logger.error('Batch voice generation error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}
