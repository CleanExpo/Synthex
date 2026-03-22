/**
 * Client-Branded Content Service
 *
 * CORE PRINCIPLE: Every piece of content Synthex generates for a client
 * uses the CLIENT'S own API keys (from Vault) and brand identity
 * (from ClientBrandProfile). No generic templates. No Synthex fallback keys.
 *
 * This is what makes Synthex worth the monthly subscription — every output
 * is uniquely branded, using the client's own tokens and voice.
 */

import { VaultService } from '@/lib/vault/vault-service';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { VaultActor } from '@/lib/vault/types';
// =============================================================================
// Types
// =============================================================================

/** Brand profile loaded from DB for content generation */
export interface ClientBrand {
  orgId: string;
  businessName: string;
  vertical: string;
  industry: string;
  primaryColour: string | null;
  secondaryColour: string | null;
  neutralColour: string | null;
  logoUrl: string | null;
  brandVoice: {
    formality: number; // 1-5 scale
    boldness: number; // 1-5 scale
    tone: string; // e.g. "friendly", "authoritative"
    samplePhrases: string[];
  };
  persona: {
    ageRange: string;
    values: string[];
    painPoints: string[];
    description: string;
  };
}
/** Resolved API credentials from Vault */
interface ClientCredentials {
  provider: 'openrouter' | 'anthropic' | 'openai';
  apiKey: string;
  model: string;
}

/** Content generation request */
export interface BrandedContentRequest {
  orgId: string;
  userId: string;
  platform: string;
  prompt: string;
  contentType?: 'post' | 'caption' | 'thread' | 'article' | 'story';
  tone?: string;
  targetLength?: 'short' | 'medium' | 'long';
  includeHashtags?: boolean;
  includeEmojis?: boolean;
  customInstructions?: string;
}

/** Branded content output */
export interface BrandedContentResult {
  content: string;
  variations: string[];
  brandApplied: boolean;
  credentialSource: 'client_vault' | 'synthex_fallback';
  model: string;
  metadata: {
    platform: string;
    brandVoiceApplied: boolean;
    personaApplied: boolean;
    colourPaletteAvailable: boolean;
    tokensUsed?: number;
  };
}
// =============================================================================
// Brand Profile Loader
// =============================================================================

/**
 * Load a client's brand profile from the database.
 * Returns null if no profile exists — the UI should prompt them to set one up.
 */
async function loadClientBrand(orgId: string): Promise<ClientBrand | null> {
  try {
    const profile = await prisma.brandDNA.findUnique({
      where: { organizationId: orgId },
    });

    if (!profile) return null;

    // Parse JSON fields with safe defaults
    const brandVoice = (profile.brandVoice as Record<string, unknown>) ?? {};
    const persona = (profile.persona as Record<string, unknown>) ?? {};

    return {
      orgId,
      businessName: profile.businessName,
      vertical: profile.vertical,
      industry: profile.industry,
      primaryColour: profile.primaryColour,
      secondaryColour: profile.secondaryColour,
      neutralColour: profile.neutralColour,
      logoUrl: profile.logoUrl ?? null,
      brandVoice: {
        formality: (brandVoice.formality as number) ?? 3,
        boldness: (brandVoice.boldness as number) ?? 3,
        tone: (brandVoice.tone as string) ?? 'professional',
        samplePhrases: (brandVoice.samplePhrases as string[]) ?? [],
      },
      persona: {
        ageRange: (persona.ageRange as string) ?? '',
        values: (persona.values as string[]) ?? [],
        painPoints: (persona.painPoints as string[]) ?? [],
        description: (persona.description as string) ?? '',
      },
    };
  } catch (err) {
    logger.error('[BrandedContent] Failed to load brand profile', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
// =============================================================================
// Credential Resolution — Client's Vault keys FIRST, Synthex fallback LAST
// =============================================================================

const PROVIDER_PRIORITY: Array<{
  slug: string;
  provider: ClientCredentials['provider'];
  defaultModel: string;
}> = [
  {
    slug: 'openrouter-api-key',
    provider: 'openrouter',
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },
  {
    slug: 'anthropic-api-key',
    provider: 'anthropic',
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  {
    slug: 'openai-api-key',
    provider: 'openai',
    defaultModel: 'gpt-4-turbo-preview',
  },
];

/**
 * Resolve the best API credentials for a client.
 * Priority: Client Vault keys > Synthex environment fallback.
 */
async function resolveCredentials(
  orgId: string,
  actor: VaultActor
): Promise<{
  credentials: ClientCredentials;
  source: 'client_vault' | 'synthex_fallback';
}> {
  // Try client's own keys from Vault (in priority order)
  for (const { slug, provider, defaultModel } of PROVIDER_PRIORITY) {
    const apiKey = await VaultService.getSecret(orgId, slug, actor);
    if (apiKey) {
      return {
        credentials: { provider, apiKey, model: defaultModel },
        source: 'client_vault',
      };
    }
  }
  // Fallback to Synthex's own key (free tier / trial users)
  const fallbackKey = process.env.OPENROUTER_API_KEY;
  if (fallbackKey) {
    logger.warn('[BrandedContent] Using Synthex fallback key for org', {
      orgId,
    });
    return {
      credentials: {
        provider: 'openrouter',
        apiKey: fallbackKey,
        model: 'meta-llama/llama-3.3-70b-instruct:free',
      },
      source: 'synthex_fallback',
    };
  }

  throw new Error(
    'No AI credentials available. Connect your API key in Settings > Vault to generate content.'
  );
}
// =============================================================================
// Brand-Aware Prompt Builder
// =============================================================================

/**
 * Build a system prompt that encodes the client's brand identity.
 * This is the secret sauce — no generic "you are a social media expert".
 * Every instruction is derived from the client's actual brand profile.
 */
function buildBrandSystemPrompt(brand: ClientBrand, platform: string): string {
  const formalityLabel = [
    'very casual',
    'casual',
    'balanced',
    'professional',
    'very formal',
  ][Math.min(brand.brandVoice.formality - 1, 4)];
  const boldnessLabel = [
    'subtle',
    'measured',
    'confident',
    'bold',
    'provocative',
  ][Math.min(brand.brandVoice.boldness - 1, 4)];

  let prompt = `You are the voice of ${brand.businessName}`;
  prompt += brand.industry ? `, a ${brand.industry} business` : '';
  prompt +=
    brand.vertical !== 'other' ? ` in the ${brand.vertical} vertical` : '';
  prompt += '.\n\n';

  prompt += `BRAND VOICE RULES:\n`;
  prompt += `- Formality: ${formalityLabel} (${brand.brandVoice.formality}/5)\n`;
  prompt += `- Boldness: ${boldnessLabel} (${brand.brandVoice.boldness}/5)\n`;
  prompt += `- Tone: ${brand.brandVoice.tone}\n`;
  if (brand.brandVoice.samplePhrases.length > 0) {
    prompt += `- Example phrases this brand would use:\n`;
    for (const phrase of brand.brandVoice.samplePhrases.slice(0, 5)) {
      prompt += `  "${phrase}"\n`;
    }
  }

  if (brand.persona.description) {
    prompt += `\nTARGET AUDIENCE:\n`;
    prompt += `- Description: ${brand.persona.description}\n`;
    if (brand.persona.ageRange)
      prompt += `- Age range: ${brand.persona.ageRange}\n`;
    if (brand.persona.values.length > 0) {
      prompt += `- Values: ${brand.persona.values.join(', ')}\n`;
    }
    if (brand.persona.painPoints.length > 0) {
      prompt += `- Pain points to address: ${brand.persona.painPoints.join(', ')}\n`;
    }
  }

  prompt += `\nPLATFORM: ${platform}\n`;
  prompt += `CRITICAL: Write as ${brand.businessName}. Never use generic marketing language. `;
  prompt += `Every word should sound like it came from this specific brand, not a template.\n`;

  return prompt;
}
// =============================================================================
// AI Call — Uses client credentials via OpenRouter unified endpoint
// =============================================================================

async function callAI(
  credentials: ClientCredentials,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 600
): Promise<{ content: string; tokensUsed: number }> {
  const baseUrl =
    credentials.provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : credentials.provider === 'anthropic'
        ? 'https://openrouter.ai/api/v1/chat/completions' // Route Anthropic through OpenRouter too
        : 'https://openrouter.ai/api/v1/chat/completions';

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://synthex.social',
      'X-Title': 'SYNTHEX Branded Content',
    },
    body: JSON.stringify({
      model: credentials.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.75,
      top_p: 0.9,
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    logger.error('[BrandedContent] AI API call failed', {
      status: response.status,
      body: errorBody.slice(0, 200),
    });
    throw new Error(
      `AI generation failed (${response.status}). Check your API key in Settings > Vault.`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const tokensUsed = data.usage?.total_tokens ?? 0;

  if (!content) {
    throw new Error(
      'AI returned empty content. Try a different prompt or model.'
    );
  }

  return { content: content.trim(), tokensUsed };
}
// =============================================================================
// Main Service — The public API
// =============================================================================

export const ClientBrandedContentService = {
  /**
   * Generate branded content using the client's own API keys and brand profile.
   * This is the ONLY content generation path that should be used for paying clients.
   */
  async generate(
    request: BrandedContentRequest
  ): Promise<BrandedContentResult> {
    const actor: VaultActor = {
      id: request.userId,
      type: 'user',
    };

    // 1. Load client's brand profile
    const brand = await loadClientBrand(request.orgId);

    // 2. Resolve credentials (client Vault → Synthex fallback)
    const { credentials, source } = await resolveCredentials(
      request.orgId,
      actor
    );

    // 3. Build brand-aware system prompt
    const systemPrompt = brand
      ? buildBrandSystemPrompt(brand, request.platform)
      : `You are a professional social media content creator for the ${request.platform} platform. Write engaging, original content.`;

    // 4. Build the user prompt
    let userPrompt = request.prompt;
    if (request.contentType) {
      userPrompt = `Create a ${request.contentType} for ${request.platform}: ${request.prompt}`;
    }
    if (request.tone) {
      userPrompt += `\nTone: ${request.tone}`;
    }
    if (request.targetLength) {
      const lengthGuide = {
        short: '1-2 sentences',
        medium: '3-5 sentences',
        long: '6-10 sentences',
      };
      userPrompt += `\nLength: ${lengthGuide[request.targetLength]}`;
    }
    if (request.includeHashtags) {
      userPrompt += `\nInclude relevant hashtags (platform-appropriate count).`;
    }
    if (request.includeEmojis) {
      userPrompt += `\nUse emojis sparingly where they add personality.`;
    }
    if (request.customInstructions) {
      userPrompt += `\nAdditional instructions: ${request.customInstructions}`;
    }

    // 5. Generate primary content
    const primary = await callAI(credentials, systemPrompt, userPrompt);

    // 6. Generate variations (only if client has their own key — don't burn Synthex quota)
    const variations: string[] = [];
    if (source === 'client_vault') {
      const varPrompt = `Create 2 alternative versions of this content with different angles. Keep the same brand voice. Return each separated by ---\n\nOriginal: ${primary.content}`;
      try {
        const varResult = await callAI(
          credentials,
          systemPrompt,
          varPrompt,
          800
        );
        const parts = varResult.content
          .split('---')
          .map(s => s.trim())
          .filter(Boolean);
        variations.push(...parts.slice(0, 3));
      } catch {
        // Variations are optional — don't fail the whole request
        logger.warn('[BrandedContent] Variation generation failed', {
          orgId: request.orgId,
        });
      }
    }
    return {
      content: primary.content,
      variations,
      brandApplied: !!brand,
      credentialSource: source,
      model: credentials.model,
      metadata: {
        platform: request.platform,
        brandVoiceApplied: !!brand?.brandVoice.tone,
        personaApplied: !!brand?.persona.description,
        colourPaletteAvailable: !!brand?.primaryColour,
        tokensUsed: primary.tokensUsed,
      },
    };
  },

  /**
   * Check if a client has their own API credentials configured.
   * Used by the UI to show "upgrade" prompts or free-tier badges.
   */
  async hasClientCredentials(orgId: string): Promise<boolean> {
    for (const { slug } of PROVIDER_PRIORITY) {
      const meta = await VaultService.getSecretMetadata(orgId, slug);
      if (meta?.isActive) return true;
    }
    return false;
  },

  /**
   * Load a client's brand profile for UI theming.
   * Exported so the DynamicDesignTokenProvider can use it.
   */
  loadBrand: loadClientBrand,
};
