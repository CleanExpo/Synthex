/**
 * AI Content Translation API
 *
 * @description Translates content to different languages while preserving tone and context
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: OpenRouter API key for AI operations (SECRET)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns error responses on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import crypto from 'crypto';
import { resolveAIProvider, hasAIAccess } from '@/lib/ai/api-credential-injector';
import { logger } from '@/lib/logger';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';

// Supported languages with their codes and names
const SUPPORTED_LANGUAGES: Record<string, { name: string; nativeName: string; rtl?: boolean }> = {
  en: { name: 'English', nativeName: 'English' },
  es: { name: 'Spanish', nativeName: 'Español' },
  fr: { name: 'French', nativeName: 'Français' },
  de: { name: 'German', nativeName: 'Deutsch' },
  it: { name: 'Italian', nativeName: 'Italiano' },
  pt: { name: 'Portuguese', nativeName: 'Português' },
  nl: { name: 'Dutch', nativeName: 'Nederlands' },
  pl: { name: 'Polish', nativeName: 'Polski' },
  ru: { name: 'Russian', nativeName: 'Русский' },
  ja: { name: 'Japanese', nativeName: '日本語' },
  ko: { name: 'Korean', nativeName: '한국어' },
  zh: { name: 'Chinese (Simplified)', nativeName: '中文' },
  'zh-TW': { name: 'Chinese (Traditional)', nativeName: '繁體中文' },
  ar: { name: 'Arabic', nativeName: 'العربية', rtl: true },
  hi: { name: 'Hindi', nativeName: 'हिन्दी' },
  tr: { name: 'Turkish', nativeName: 'Türkçe' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  th: { name: 'Thai', nativeName: 'ไทย' },
  id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  sv: { name: 'Swedish', nativeName: 'Svenska' },
  da: { name: 'Danish', nativeName: 'Dansk' },
  no: { name: 'Norwegian', nativeName: 'Norsk' },
  fi: { name: 'Finnish', nativeName: 'Suomi' },
  el: { name: 'Greek', nativeName: 'Ελληνικά' },
  he: { name: 'Hebrew', nativeName: 'עברית', rtl: true },
  uk: { name: 'Ukrainian', nativeName: 'Українська' },
  cs: { name: 'Czech', nativeName: 'Čeština' },
  ro: { name: 'Romanian', nativeName: 'Română' },
  hu: { name: 'Hungarian', nativeName: 'Magyar' },
};

// Validation schema
const TranslateRequestSchema = z.object({
  content: z.string().min(1).max(10000).describe('The content to translate'),
  targetLanguage: z.string().min(2).max(10).describe('Target language code (e.g., es, fr, de)'),
  sourceLanguage: z.string().min(2).max(10).optional().describe('Source language code (auto-detected if not provided)'),
  preserveTone: z.boolean().default(true).describe('Preserve the original tone and style'),
  preserveEmojis: z.boolean().default(true).describe('Keep emojis in the translation'),
  preserveHashtags: z.boolean().default(true).describe('Keep or translate hashtags'),
  localizeHashtags: z.boolean().default(false).describe('Translate hashtags to target language'),
  formalityLevel: z.enum(['formal', 'informal', 'neutral']).default('neutral'),
  platform: z.enum(['twitter', 'linkedin', 'instagram', 'tiktok', 'facebook', 'youtube', 'general']).default('general'),
});

export async function POST(request: NextRequest) {
  try {
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

    // Get requesting user ID
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const parseResult = TranslateRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const {
      content,
      targetLanguage,
      sourceLanguage,
      preserveTone,
      preserveEmojis,
      preserveHashtags,
      localizeHashtags,
      formalityLevel,
      platform
    } = parseResult.data;

    // Validate target language
    if (!SUPPORTED_LANGUAGES[targetLanguage]) {
      return NextResponse.json(
        {
          error: 'Unsupported target language',
          supportedLanguages: Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => ({
            code,
            name: info.name,
            nativeName: info.nativeName
          }))
        },
        { status: 400 }
      );
    }

    // Check if AI access is available (user key or platform key)
    if (!(await hasAIAccess(userId))) {
      return NextResponse.json(
        { error: 'Translation service not configured. Please add your AI API key in Settings.' },
        { status: 503 }
      );
    }

    const targetLangInfo = SUPPORTED_LANGUAGES[targetLanguage];
    const sourceLangInfo = sourceLanguage ? SUPPORTED_LANGUAGES[sourceLanguage] : null;

    // Extract hashtags and emojis for preservation
    const hashtags = content.match(/#\w+/g) || [];
    const emojis = content.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];

    // Build translation prompt
    const prompt = buildTranslationPrompt(
      content,
      targetLanguage,
      targetLangInfo.name,
      sourceLanguage,
      sourceLangInfo?.name,
      preserveTone,
      preserveEmojis,
      preserveHashtags,
      localizeHashtags,
      formalityLevel,
      platform
    );

    let translatedContent: string;
    let detectedSourceLanguage: string | null = null;
    let translationNotes: string[] = [];
    let aiMetadata: { model?: string; tokensUsed?: number; responseTime?: number; usage?: Record<string, unknown> } | null = null;

    try {
      const ai = await resolveAIProvider(userId);
      const response = await ai.complete({
        model: ai.models.balanced,
        messages: [
          {
            role: 'system',
            content: `You are an expert translator specializing in social media content localization.
Your task is to translate content while preserving the original meaning, tone, and cultural nuances.

Return a JSON object with:
{
  "translated": "the translated content",
  "detectedLanguage": "detected source language code (if not provided)",
  "notes": ["any important translation notes"]
}

Key guidelines:
- Preserve the emotional impact and engagement potential
- Adapt cultural references when appropriate
- Maintain hashtag effectiveness for the target audience
- Keep the content length appropriate for the platform`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more accurate translation
        max_tokens: 2000
      });

      const aiContent = response.choices[0]?.message?.content || '';
      const parsed = parseTranslationResponse(aiContent);

      if (parsed) {
        translatedContent = parsed.translated;
        detectedSourceLanguage = parsed.detectedLanguage || sourceLanguage || null;
        translationNotes = parsed.notes || [];
        aiMetadata = {
          model: ai.models.balanced,
          usage: response.usage
        };
      } else {
        // Fallback: use raw AI response
        translatedContent = aiContent.trim();
        translationNotes = ['Direct AI translation applied'];
      }

      // Post-process translation
      translatedContent = postProcessTranslation(
        translatedContent,
        content,
        hashtags,
        emojis,
        preserveEmojis,
        preserveHashtags,
        localizeHashtags
      );

    } catch (error) {
      logger.error('Translation failed', { error });
      return NextResponse.json(
        { error: 'Translation service temporarily unavailable' },
        { status: 503 }
      );
    }

    // Calculate quality metrics
    const qualityMetrics = calculateTranslationQuality(content, translatedContent, hashtags, emojis);

    // Audit log
    await auditLogger.log({
      userId,
      action: 'ai.content_translated',
      resource: 'ai_content',
      resourceId: crypto.randomUUID(),
      category: 'api',
      severity: 'low',
      outcome: 'success',
      details: {
        targetLanguage,
        sourceLanguage: detectedSourceLanguage || 'auto',
        originalLength: content.length,
        translatedLength: translatedContent.length,
        platform
      }
    });

    return NextResponse.json({
      success: true,
      original: content,
      translated: translatedContent,
      sourceLanguage: {
        code: detectedSourceLanguage || sourceLanguage || 'auto',
        name: detectedSourceLanguage ? SUPPORTED_LANGUAGES[detectedSourceLanguage]?.name : 'Auto-detected'
      },
      targetLanguage: {
        code: targetLanguage,
        name: targetLangInfo.name,
        nativeName: targetLangInfo.nativeName,
        rtl: targetLangInfo.rtl || false
      },
      notes: translationNotes,
      quality: qualityMetrics,
      metadata: {
        preservedEmojis: preserveEmojis ? emojis : [],
        preservedHashtags: preserveHashtags ? hashtags : [],
        characterChange: translatedContent.length - content.length,
        aiMetadata
      }
    });
  } catch (error) {
    logger.error('Translation request failed', { error });
    return NextResponse.json(
      { error: 'Failed to process translation request' },
      { status: 500 }
    );
  }
}

// GET endpoint to list supported languages
export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.PUBLIC_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    const languages = Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => ({
      code,
      name: info.name,
      nativeName: info.nativeName,
      rtl: info.rtl || false
    }));

    return NextResponse.json({
      success: true,
      languages,
      count: languages.length
    });
  } catch (error) {
    logger.error('Failed to list languages', { error });
    return NextResponse.json(
      { error: 'Failed to fetch supported languages' },
      { status: 500 }
    );
  }
}

// Build translation prompt
function buildTranslationPrompt(
  content: string,
  targetLangCode: string,
  targetLangName: string,
  sourceLangCode?: string,
  sourceLangName?: string,
  preserveTone: boolean = true,
  preserveEmojis: boolean = true,
  preserveHashtags: boolean = true,
  localizeHashtags: boolean = false,
  formalityLevel: string = 'neutral',
  platform: string = 'general'
): string {
  let prompt = `Translate the following content to ${targetLangName} (${targetLangCode}):\n\n"${content}"\n\n`;

  if (sourceLangCode && sourceLangName) {
    prompt += `Source language: ${sourceLangName} (${sourceLangCode})\n`;
  } else {
    prompt += `Detect the source language and include it in your response.\n`;
  }

  prompt += `\nTranslation requirements:\n`;
  prompt += `- Formality level: ${formalityLevel}\n`;
  prompt += `- Platform: ${platform}\n`;

  if (preserveTone) {
    prompt += `- Preserve the original tone, style, and emotional impact\n`;
  }

  if (preserveEmojis) {
    prompt += `- Keep all emojis in their original positions\n`;
  }

  if (preserveHashtags) {
    if (localizeHashtags) {
      prompt += `- Translate hashtags to equivalent ${targetLangName} hashtags that are popular in the target market\n`;
    } else {
      prompt += `- Keep hashtags in their original form (English hashtags often have better reach)\n`;
    }
  }

  prompt += `\nProvide the translation and any important cultural notes.`;

  return prompt;
}

// Parse translation response
function parseTranslationResponse(content: string): { translated: string; detectedLanguage?: string; notes: string[] } | null {
  try {
    // Try to parse as JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.translated) {
        return {
          translated: parsed.translated,
          detectedLanguage: parsed.detectedLanguage,
          notes: parsed.notes || []
        };
      }
    }

    // Fallback: use the entire response as translated content
    if (content.length > 10 && !content.includes('{')) {
      return {
        translated: content.trim(),
        notes: []
      };
    }

    return null;
  } catch {
    // If JSON parsing fails, return the raw content
    if (content.length > 10) {
      return {
        translated: content.trim(),
        notes: ['Raw translation applied']
      };
    }
    return null;
  }
}

// Post-process translation
function postProcessTranslation(
  translated: string,
  original: string,
  originalHashtags: string[],
  originalEmojis: string[],
  preserveEmojis: boolean,
  preserveHashtags: boolean,
  localizeHashtags: boolean
): string {
  let result = translated;

  // Ensure emojis are preserved if requested
  if (preserveEmojis && originalEmojis.length > 0) {
    const translatedEmojis: string[] = result.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];

    // If emojis were lost in translation, try to add them back
    if (translatedEmojis.length < originalEmojis.length) {
      const missingEmojis = originalEmojis.filter(e => !translatedEmojis.includes(e));
      if (missingEmojis.length > 0 && !result.startsWith(missingEmojis[0])) {
        // Add first missing emoji at the start if it was there originally
        if (original.startsWith(originalEmojis[0])) {
          result = originalEmojis[0] + ' ' + result;
        }
      }
    }
  }

  // Ensure hashtags are preserved if requested and not localized
  if (preserveHashtags && !localizeHashtags && originalHashtags.length > 0) {
    const translatedHashtags = result.match(/#\w+/g) || [];

    // If hashtags were lost or changed, add original ones
    if (translatedHashtags.length < originalHashtags.length) {
      const missingHashtags = originalHashtags.filter(h =>
        !translatedHashtags.some(th => th.toLowerCase() === h.toLowerCase())
      );

      if (missingHashtags.length > 0) {
        // Check if original had hashtags at the end
        if (original.trim().endsWith(originalHashtags[originalHashtags.length - 1])) {
          result = result.trim() + '\n\n' + missingHashtags.join(' ');
        }
      }
    }
  }

  return result;
}

// Calculate translation quality metrics
function calculateTranslationQuality(
  original: string,
  translated: string,
  originalHashtags: string[],
  originalEmojis: string[]
): {
  overall: number;
  lengthRatio: number;
  hashtagPreservation: number;
  emojiPreservation: number;
  completeness: number;
} {
  // Length ratio (ideal is 0.8-1.5 depending on languages)
  const lengthRatio = translated.length / original.length;
  const lengthScore = lengthRatio >= 0.5 && lengthRatio <= 2.0 ? 100 : 70;

  // Hashtag preservation
  const translatedHashtags = translated.match(/#\w+/g) || [];
  const hashtagScore = originalHashtags.length > 0
    ? Math.round((translatedHashtags.length / originalHashtags.length) * 100)
    : 100;

  // Emoji preservation
  const translatedEmojis = translated.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];
  const emojiScore = originalEmojis.length > 0
    ? Math.round((translatedEmojis.length / originalEmojis.length) * 100)
    : 100;

  // Completeness (translation exists and is substantial)
  const completenessScore = translated.length > 10 ? 100 : 50;

  // Overall score
  const overall = Math.round((lengthScore + hashtagScore + emojiScore + completenessScore) / 4);

  return {
    overall: Math.min(overall, 100),
    lengthRatio: Math.round(lengthRatio * 100) / 100,
    hashtagPreservation: Math.min(hashtagScore, 100),
    emojiPreservation: Math.min(emojiScore, 100),
    completeness: completenessScore
  };
}

// Node.js runtime required for OpenRouter API calls
export const runtime = 'nodejs';
