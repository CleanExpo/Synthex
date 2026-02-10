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
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import {
  generateSpeech,
  generateSpeechStream,
  cloneVoice,
  getVoices,
  getCustomVoices,
  deleteVoice,
  getVoiceSettings,
  getCharacterQuota,
  DEFAULT_VOICES,
} from '@/lib/services/ai/voice-generation';
import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Request validation schemas
const SpeechGenerationSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().optional(),
  voiceName: z.enum(['rachel', 'adam', 'bella', 'josh', 'elli', 'sam', 'charlotte', 'clyde', 'grace']).optional(),
  modelId: z.enum(['eleven_multilingual_v2', 'eleven_turbo_v2', 'eleven_monolingual_v1']).optional(),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  useSpeakerBoost: z.boolean().optional(),
  outputFormat: z.enum(['mp3_44100_128', 'mp3_44100_192', 'pcm_16000', 'pcm_22050', 'pcm_24000']).optional(),
  saveToLibrary: z.boolean().default(true),
});

const VoiceCloneSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  audioFiles: z.array(z.string().url()).min(1).max(25),
  labels: z.record(z.string()).optional(),
});

const VoiceDeleteSchema = z.object({
  voiceId: z.string(),
});

/**
 * POST /api/media/generate/voice
 * Generate speech from text
 */
export async function POST(request: NextRequest) {
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
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'generate';

  try {
    const body = await request.json();

    switch (action) {
      case 'clone': {
        // Clone a voice from audio samples
        const validated = VoiceCloneSchema.parse(body);

        const result = await cloneVoice({
          name: validated.name,
          description: validated.description,
          audioFiles: validated.audioFiles,
          labels: validated.labels,
        });

        if (!result.success) {
          return APISecurityChecker.createSecureResponse(
            { error: result.error || 'Voice cloning failed' },
            500
          );
        }

        // Save cloned voice reference
        await supabase.from('user_voices').insert({
          user_id: userId,
          voice_id: result.voiceId,
          name: validated.name,
          description: validated.description,
          is_cloned: true,
          created_at: new Date().toISOString(),
        });

        // Audit log
        await auditLogger.logData(
          'create',
          'voice',
          result.voiceId,
          userId,
          'success',
          {
            action: 'VOICE_CLONE',
            name: validated.name,
            audioFilesCount: validated.audioFiles.length,
          }
        );

        return APISecurityChecker.createSecureResponse({
          success: true,
          voiceId: result.voiceId,
          name: validated.name,
        });
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

        // Resolve voice ID from name if provided
        let voiceId = validated.voiceId;
        if (!voiceId && validated.voiceName) {
          voiceId = DEFAULT_VOICES[validated.voiceName];
        }

        const result = await generateSpeech({
          text: validated.text,
          voiceId,
          modelId: validated.modelId,
          stability: validated.stability,
          similarityBoost: validated.similarityBoost,
          style: validated.style,
          useSpeakerBoost: validated.useSpeakerBoost,
          outputFormat: validated.outputFormat,
        });

        if (!result.success) {
          logger.error('Speech generation failed', { error: result.error, userId });
          return APISecurityChecker.createSecureResponse(
            { error: result.error || 'Speech generation failed' },
            500
          );
        }

        // Save to media library if requested
        let mediaAssetId: string | undefined;
        if (validated.saveToLibrary && result.audioBase64) {
          const { data: asset, error: saveError } = await supabase
            .from('media_assets')
            .insert({
              user_id: userId,
              type: 'audio',
              provider: 'elevenlabs',
              metadata: {
                voiceId: result.voiceId,
                characterCount: result.characterCount,
                model: validated.modelId || 'eleven_multilingual_v2',
                text: validated.text.substring(0, 500), // Store first 500 chars
              },
              base64_data: result.audioBase64,
              content_type: result.contentType,
              created_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (!saveError && asset) {
            mediaAssetId = asset.id;
          }
        }

        // Audit log
        await auditLogger.logData(
          'create',
          'audio',
          mediaAssetId,
          userId,
          'success',
          {
            action: 'MEDIA_GENERATE',
            voiceId: result.voiceId,
            characterCount: result.characterCount,
          }
        );

        return APISecurityChecker.createSecureResponse({
          success: true,
          audioBase64: result.audioBase64,
          contentType: result.contentType,
          voiceId: result.voiceId,
          characterCount: result.characterCount,
          mediaAssetId,
        });
      }
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
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
  // Security check
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

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  const voiceId = searchParams.get('voiceId');

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

    // Also get user's saved voices from database
    const { data: userVoices } = await supabase
      .from('user_voices')
      .select('*')
      .eq('user_id', userId);

    // Get quota for display
    const quota = await getCharacterQuota();

    return APISecurityChecker.createSecureResponse({
      voices,
      userVoices: userVoices || [],
      defaultVoices: DEFAULT_VOICES,
      quota,
      models: [
        { id: 'eleven_multilingual_v2', name: 'Multilingual V2', languages: 29 },
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
  } catch (error: any) {
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
    const validated = VoiceDeleteSchema.parse(body);

    // Verify user owns this voice
    const { data: userVoice } = await supabase
      .from('user_voices')
      .select('*')
      .eq('user_id', userId)
      .eq('voice_id', validated.voiceId)
      .single();

    if (!userVoice) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Voice not found or not owned by user' },
        404
      );
    }

    // Delete from ElevenLabs
    const success = await deleteVoice(validated.voiceId);

    if (!success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Failed to delete voice from provider' },
        500
      );
    }

    // Delete from database
    await supabase
      .from('user_voices')
      .delete()
      .eq('voice_id', validated.voiceId)
      .eq('user_id', userId);

    // Audit log
    await auditLogger.logData(
      'delete',
      'voice',
      validated.voiceId,
      userId,
      'success',
      {
        action: 'VOICE_DELETE',
        name: userVoice.name,
      }
    );

    return APISecurityChecker.createSecureResponse({
      success: true,
      deletedVoiceId: validated.voiceId,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
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

  try {
    const body = await request.json();
    const requests = z.array(SpeechGenerationSchema).max(10).parse(body.requests || []);

    const results = [];
    const savedAssets: string[] = [];
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

        // Save to library
        if (req.saveToLibrary && result.audioBase64) {
          const { data: asset } = await supabase
            .from('media_assets')
            .insert({
              user_id: userId,
              type: 'audio',
              provider: 'elevenlabs',
              metadata: {
                voiceId: result.voiceId,
                characterCount: result.characterCount,
                text: req.text.substring(0, 500),
              },
              base64_data: result.audioBase64,
              content_type: result.contentType,
              created_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (asset) {
            savedAssets.push(asset.id);
          }
        }
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Audit log
    await auditLogger.logData(
      'create',
      'audio',
      undefined,
      userId,
      'success',
      {
        action: 'MEDIA_GENERATE_BATCH',
        count: requests.length,
        successCount: results.filter(r => r.success).length,
        totalCharacters,
        savedAssets,
      }
    );

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
        mediaAssetId: savedAssets[i],
      })),
      totalSuccess: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
      totalCharacters,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
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
