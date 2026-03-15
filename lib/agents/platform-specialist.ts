/**
 * Platform Specialist Agent — Phase 67
 *
 * Enhances existing posts for a specific social platform using platform
 * algorithm weights, winning formulas, and content specs from
 * platform_master_config.json.
 *
 * Circuit breaker: max 100 calls per hour per org (in-memory, resets hourly).
 * Supported platforms: twitter, linkedin, instagram, tiktok, facebook,
 *   youtube, pinterest, reddit, threads
 */

import { getAIProvider } from '@/lib/ai/providers'
import { logger } from '@/lib/logger'
import platformConfig from '@/platform_master_config.json'

// ============================================================================
// TYPES
// ============================================================================

export type SocialPlatform =
  | 'twitter'
  | 'linkedin'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'youtube'
  | 'pinterest'
  | 'reddit'
  | 'threads'

export interface EnhanceParams {
  content: string
  platform: SocialPlatform
  businessName: string
  businessIndustry?: string
  tone?: string
  orgId: string
}

export interface EnhancedPost {
  content: string
  platform: string
  hashtags: string[]
  metadata: {
    format: string
    characterCount: number
    optimalPostingTime: string
    winningTemplate: string
    confidenceScore: number
  }
  suggestions: string[]
}

// ============================================================================
// CIRCUIT BREAKER (in-memory, per org, resets hourly)
// ============================================================================

interface CircuitBreakerEntry {
  count: number
  windowStart: number
}

const circuitBreakerMap = new Map<string, CircuitBreakerEntry>()
const CIRCUIT_BREAKER_MAX = 100
const CIRCUIT_BREAKER_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkCircuitBreaker(orgId: string): boolean {
  const now = Date.now()
  const entry = circuitBreakerMap.get(orgId)

  if (!entry || now - entry.windowStart >= CIRCUIT_BREAKER_WINDOW_MS) {
    // New window
    circuitBreakerMap.set(orgId, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= CIRCUIT_BREAKER_MAX) {
    return false
  }

  entry.count++
  return true
}

// ============================================================================
// PLATFORM CONFIG HELPERS
// ============================================================================

// The config has 8 named platforms; threads uses a twitter-derived fallback
type ConfigPlatformKey = 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'pinterest' | 'reddit'

const THREADS_FALLBACK: ConfigPlatformKey = 'twitter'

function getConfigKey(platform: SocialPlatform): ConfigPlatformKey {
  if (platform === 'threads') return THREADS_FALLBACK
  return platform as ConfigPlatformKey
}

interface PlatformEntry {
  name: string
  category: string
  algorithm_weights: Record<string, number>
  winning_formulas: Array<{
    template: string
    structure: string
    engagement_rate: string
    best_for: string[]
    key_elements: string[]
  }>
  optimization_checklist?: string[]
  posting_schedule?: {
    optimal_times: string[]
    frequency: string
  }
  content_specs: Record<string, unknown>
}

function getPlatformConfig(platform: SocialPlatform): PlatformEntry | null {
  const key = getConfigKey(platform)
  const platforms = platformConfig.platforms as Record<string, PlatformEntry>
  return platforms[key] ?? null
}

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

function buildSystemPrompt(
  platform: SocialPlatform,
  config: PlatformEntry,
  businessName: string,
  businessIndustry: string | undefined,
  tone: string | undefined
): string {
  const winningFormula = config.winning_formulas[0]

  const algorithmWeightsText = Object.entries(config.algorithm_weights)
    .map(([k, v]) => `  • ${k}: ${v}%`)
    .join('\n')

  const winningTemplatesText = config.winning_formulas
    .map(
      (f) =>
        `  • ${f.template} (${f.engagement_rate} engagement rate)\n` +
        `    Structure: ${f.structure}\n` +
        `    Best for: ${f.best_for.join(', ')}\n` +
        `    Key elements: ${f.key_elements.join(', ')}`
    )
    .join('\n')

  const checklistText = config.optimization_checklist
    ? config.optimization_checklist.map((item) => `  ✓ ${item}`).join('\n')
    : '  ✓ Follow platform best practices'

  const optimalTime = config.posting_schedule?.optimal_times?.[0] ?? 'check platform analytics'

  const platformLabel = platform === 'threads' ? 'Threads (Meta)' : config.name

  return `You are a Platform Specialist Agent for ${platformLabel}. Your role is to enhance social media content to maximise organic reach and engagement for ${businessName}${businessIndustry ? ` (${businessIndustry} industry)` : ''}.

## Platform: ${platformLabel}
Category: ${config.category}

## Algorithm Weights (what the algorithm prioritises):
${algorithmWeightsText}

## Winning Formulas:
${winningTemplatesText}

## Optimisation Checklist:
${checklistText}

## Tone Guidance:
${tone ? `Requested tone: ${tone}` : 'Match the platform natural communication style'}

## Primary Winning Formula to Apply:
Template: ${winningFormula.template}
Structure: ${winningFormula.structure}

## Task:
Enhance the provided content following the winning formula structure. Return ONLY valid JSON matching this exact schema:
{
  "content": "<enhanced post text>",
  "hashtags": ["<hashtag1>", "<hashtag2>"],
  "format": "<standard|thread|carousel|short-form|long-form|script>",
  "optimalPostingTime": "<optimal posting time>",
  "winningTemplate": "<template name>",
  "confidenceScore": 0.0,
  "suggestions": ["<improvement tip 1>", "<improvement tip 2>", "<improvement tip 3>"]
}

Rules:
- content: fully enhanced and ready-to-post text
- hashtags: relevant, platform-appropriate (no # prefix — add it in code)
- confidenceScore: your honest assessment of how well the enhancement will perform
- suggestions: 3 actionable follow-up improvements the user can make`
}

// ============================================================================
// PLATFORM SPECIALIST AGENT
// ============================================================================

export class PlatformSpecialistAgent {
  /**
   * Enhance a post for a specific social platform.
   * Applies platform algorithm weights and winning formula structure.
   */
  async enhance(params: EnhanceParams): Promise<EnhancedPost> {
    const { content, platform, businessName, businessIndustry, tone, orgId } = params

    // Circuit breaker guard
    if (!checkCircuitBreaker(orgId)) {
      logger.warn('platform-specialist: circuit breaker tripped', { orgId, platform })
      return this.fallbackResponse(content, platform)
    }

    const config = getPlatformConfig(platform)
    if (!config) {
      logger.error('platform-specialist: unknown platform', { platform })
      return this.fallbackResponse(content, platform)
    }

    const systemPrompt = buildSystemPrompt(platform, config, businessName, businessIndustry, tone)

    const userPrompt = `Enhance this content for ${platform === 'threads' ? 'Threads (Meta)' : config.name}:

---
${content}
---

Business: ${businessName}${businessIndustry ? `\nIndustry: ${businessIndustry}` : ''}

Apply the ${config.winning_formulas[0].template} formula. Return ONLY the JSON response.`

    try {
      const ai = getAIProvider()

      const response = await ai.complete({
        model: ai.models.balanced,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 1024,
      })

      const raw = response.choices?.[0]?.message?.content ?? ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in AI response')

      const parsed = JSON.parse(jsonMatch[0]) as {
        content?: string
        hashtags?: string[]
        format?: string
        optimalPostingTime?: string
        winningTemplate?: string
        confidenceScore?: number
        suggestions?: string[]
      }

      const enhancedContent = parsed.content ?? content
      const hashtags = (parsed.hashtags ?? []).map((h) =>
        h.startsWith('#') ? h : `#${h}`
      )
      const confidenceScore = Math.min(1.0, Math.max(0.0, parsed.confidenceScore ?? 0.5))

      logger.info('platform-specialist: enhancement complete', {
        orgId,
        platform,
        confidenceScore,
        characterCount: enhancedContent.length,
      })

      return {
        content: enhancedContent,
        platform,
        hashtags,
        metadata: {
          format: parsed.format ?? 'standard',
          characterCount: enhancedContent.length,
          optimalPostingTime: parsed.optimalPostingTime ?? config.posting_schedule?.optimal_times?.[0] ?? '',
          winningTemplate: parsed.winningTemplate ?? config.winning_formulas[0].template,
          confidenceScore,
        },
        suggestions: (parsed.suggestions ?? []).slice(0, 3),
      }
    } catch (err) {
      logger.error('platform-specialist: enhancement failed', { orgId, platform, error: err })
      return this.fallbackResponse(content, platform)
    }
  }

  /** Returns original content with a zero-confidence fallback when AI fails. */
  private fallbackResponse(content: string, platform: SocialPlatform): EnhancedPost {
    return {
      content,
      platform,
      hashtags: [],
      metadata: {
        format: 'standard',
        characterCount: content.length,
        optimalPostingTime: '',
        winningTemplate: 'fallback',
        confidenceScore: 0.0,
      },
      suggestions: [],
    }
  }
}
