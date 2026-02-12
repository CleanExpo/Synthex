/**
 * AI Voice Generation Service
 *
 * @description Text-to-speech and voice cloning using ElevenLabs
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - ELEVENLABS_API_KEY: ElevenLabs API key (SECRET)
 *
 * FAILURE MODE: Returns error response with details
 */

import { logger } from '@/lib/logger';

// Voice generation options
export interface VoiceGenerationOptions {
  text: string;
  voiceId?: string;
  modelId?: 'eleven_multilingual_v2' | 'eleven_turbo_v2' | 'eleven_monolingual_v1';
  stability?: number; // 0-1, default 0.5
  similarityBoost?: number; // 0-1, default 0.75
  style?: number; // 0-1, default 0
  useSpeakerBoost?: boolean;
  outputFormat?: 'mp3_44100_128' | 'mp3_44100_192' | 'pcm_16000' | 'pcm_22050' | 'pcm_24000';
}

// Voice cloning options
export interface VoiceCloneOptions {
  name: string;
  description?: string;
  audioFiles: string[]; // URLs to audio files for cloning
  labels?: Record<string, string>;
}

// Voice result
export interface VoiceGenerationResult {
  success: boolean;
  audioUrl?: string;
  audioBase64?: string;
  contentType?: string;
  voiceId?: string;
  characterCount?: number;
  error?: string;
}

// Available voice
export interface Voice {
  voiceId: string;
  name: string;
  category: 'premade' | 'cloned' | 'generated';
  labels?: Record<string, string>;
  previewUrl?: string;
}

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

// Default voices for quick access
export const DEFAULT_VOICES = {
  rachel: '21m00Tcm4TlvDq8ikWAM', // Female, American
  adam: 'pNInz6obpgDQGcFmaJgB', // Male, American
  bella: 'EXAVITQu4vr4xnSDxMaL', // Female, American
  josh: 'TxGEqnHWrfWFTfGW9XjX', // Male, American
  elli: 'MF3mGyEYCl7XYWbV9V6O', // Female, American
  sam: 'yoZ06aMxZJJ28mfd3POQ', // Male, American
  charlotte: 'XB0fDUnXU5powFXDhCwa', // Female, English
  clyde: '2EiwWnXFnvU5JabPnv8n', // Male, American
  grace: 'oWAxZDx7w5VEj9dCyTzz', // Female, American
} as const;

/**
 * Generate speech from text
 */
export async function generateSpeech(
  options: VoiceGenerationOptions
): Promise<VoiceGenerationResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'ELEVENLABS_API_KEY not configured' };
  }

  const voiceId = options.voiceId || DEFAULT_VOICES.rachel;
  const modelId = options.modelId || 'eleven_multilingual_v2';

  try {
    const response = await fetch(
      `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': options.outputFormat?.startsWith('mp3') ? 'audio/mpeg' : 'audio/wav',
        },
        body: JSON.stringify({
          text: options.text,
          model_id: modelId,
          voice_settings: {
            stability: options.stability ?? 0.5,
            similarity_boost: options.similarityBoost ?? 0.75,
            style: options.style ?? 0,
            use_speaker_boost: options.useSpeakerBoost ?? true,
          },
          output_format: options.outputFormat || 'mp3_44100_128',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail?.message || `ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'audio/mpeg';

    return {
      success: true,
      audioBase64,
      contentType,
      voiceId,
      characterCount: options.text.length,
    };
  } catch (error: unknown) {
    logger.error('ElevenLabs speech generation failed:', { error });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Generate speech with streaming (for real-time playback)
 */
export async function generateSpeechStream(
  options: VoiceGenerationOptions
): Promise<ReadableStream | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    logger.error('ELEVENLABS_API_KEY not configured');
    return null;
  }

  const voiceId = options.voiceId || DEFAULT_VOICES.rachel;
  const modelId = options.modelId || 'eleven_turbo_v2'; // Turbo for streaming

  try {
    const response = await fetch(
      `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: options.text,
          model_id: modelId,
          voice_settings: {
            stability: options.stability ?? 0.5,
            similarity_boost: options.similarityBoost ?? 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail?.message || `ElevenLabs streaming error: ${response.status}`);
    }

    return response.body;
  } catch (error: unknown) {
    logger.error('ElevenLabs streaming failed:', { error });
    return null;
  }
}

/**
 * Clone a voice from audio samples
 */
export async function cloneVoice(
  options: VoiceCloneOptions
): Promise<VoiceGenerationResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'ELEVENLABS_API_KEY not configured' };
  }

  if (options.audioFiles.length === 0) {
    return { success: false, error: 'At least one audio file required for voice cloning' };
  }

  try {
    // Create form data with audio files
    const formData = new FormData();
    formData.append('name', options.name);

    if (options.description) {
      formData.append('description', options.description);
    }

    // Fetch and append audio files
    for (let i = 0; i < options.audioFiles.length; i++) {
      const audioUrl = options.audioFiles[i];
      const audioResponse = await fetch(audioUrl);
      const audioBlob = await audioResponse.blob();
      formData.append('files', audioBlob, `sample_${i}.mp3`);
    }

    if (options.labels) {
      formData.append('labels', JSON.stringify(options.labels));
    }

    const response = await fetch(`${ELEVENLABS_API_BASE}/voices/add`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail?.message || `Voice cloning error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      voiceId: data.voice_id,
    };
  } catch (error: unknown) {
    logger.error('Voice cloning failed:', { error });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Get available voices
 */
export async function getVoices(): Promise<Voice[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/voices`, {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json();

    return (data.voices || []).map((voice: { voice_id: string; name: string; category?: string; labels?: Record<string, string>; preview_url?: string }) => ({
      voiceId: voice.voice_id,
      name: voice.name,
      category: voice.category,
      labels: voice.labels,
      previewUrl: voice.preview_url,
    }));
  } catch (error: unknown) {
    logger.error('Failed to get voices:', { error });
    return [];
  }
}

/**
 * Get user's custom voices
 */
export async function getCustomVoices(): Promise<Voice[]> {
  const voices = await getVoices();
  return voices.filter(v => v.category === 'cloned' || v.category === 'generated');
}

/**
 * Delete a cloned voice
 */
export async function deleteVoice(voiceId: string): Promise<boolean> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return false;
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/voices/${voiceId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    return response.ok;
  } catch (error: unknown) {
    logger.error('Failed to delete voice:', { error, voiceId });
    return false;
  }
}

/**
 * Get voice settings for a specific voice
 */
export async function getVoiceSettings(voiceId: string): Promise<{
  stability: number;
  similarityBoost: number;
  style?: number;
  useSpeakerBoost?: boolean;
} | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/voices/${voiceId}/settings`, {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      stability: data.stability,
      similarityBoost: data.similarity_boost,
      style: data.style,
      useSpeakerBoost: data.use_speaker_boost,
    };
  } catch (error: unknown) {
    logger.error('Failed to get voice settings:', { error, voiceId });
    return null;
  }
}

/**
 * Get remaining character quota
 */
export async function getCharacterQuota(): Promise<{
  characterCount: number;
  characterLimit: number;
  canExtendCharacterLimit: boolean;
} | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/user/subscription`, {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      characterCount: data.character_count,
      characterLimit: data.character_limit,
      canExtendCharacterLimit: data.can_extend_character_limit,
    };
  } catch (error: unknown) {
    logger.error('Failed to get character quota:', { error });
    return null;
  }
}

// Export service
export const voiceGenerationService = {
  generateSpeech,
  generateSpeechStream,
  cloneVoice,
  getVoices,
  getCustomVoices,
  deleteVoice,
  getVoiceSettings,
  getCharacterQuota,
  DEFAULT_VOICES,
};
