---
name: content-pipeline
description: >-
  AI content generation pipeline guide for SYNTHEX. Documents the model registry,
  provider abstraction, BYOK key injection, content scoring, and repurposing
  flow. Use when working on AI-powered content features or debugging model
  selection issues.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: reference-skill
  triggers:
    - content generation
    - ai pipeline
    - model selection
    - openrouter
    - byok
    - api key injection
    - content scoring
    - model registry
    - content repurpose
---

# Content Pipeline — AI Content Generation Guide

## Purpose

SYNTHEX generates content through a multi-layer pipeline: model registry
selects the right LLM, provider abstraction handles API differences, BYOK
key injection uses the user's own API key when available, and content scoring
evaluates quality without any AI calls.

This skill documents the full pipeline flow and the key decisions at each stage.

## Pipeline Flow

```
User Request
  │
  ▼
ContentRequest (type, platform, tone, persona)
  │
  ▼
API Credential Injector ─── Does user have a BYOK key?
  │                           YES → Decrypt and use user's key
  │                           NO  → Use platform OPENROUTER_API_KEY
  ▼
Provider Abstraction (getAIProvider)
  │
  ├─ OpenRouter Provider (primary, supports 100+ models)
  ├─ Anthropic Provider (direct Claude access)
  ├─ Google Provider (Gemini models)
  └─ OpenRouter Provider with OpenAI keys (passthrough)
  │
  ▼
Model Registry → Select model by provider + tier
  │
  ▼
Content Generator → Build prompt with persona, platform rules
  │
  ▼
Generated Content
  │
  ▼
Content Scorer → Score across 5 dimensions (no AI call)
  │
  ▼
Content Repurposer → Adapt for multiple platforms
```

## Model Registry

**File:** `lib/ai/model-registry.ts`
**Purpose:** Single source of truth for which models SYNTHEX uses system-wide

**Types:**
- `AIProvider`: `'openai' | 'anthropic' | 'google' | 'openrouter'`
- `ModelTier`: `'latest' | 'production' | 'legacy'`
- `ModelConfig`: Full model specification (id, capabilities, cost, context window)

**Key functions:**
- `getAllLatestModels()` — Returns the latest model for each provider
- Models not in the registry are rejected by the system

**Admin refresh:** `POST /api/system/models` (owner-only) calls `modelManager.forceUpdate()`

**Model Manager:** `lib/ai/model-manager.ts` — Handles health monitoring, auto-failover,
and periodic registry refresh.

## Provider Abstraction

**Files:**
- `lib/ai/providers/index.ts` — Factory function `getAIProvider()`
- `lib/ai/providers/base-provider.ts` — Abstract base class
- `lib/ai/providers/openrouter-provider.ts` — OpenRouter implementation
- `lib/ai/providers/anthropic-provider.ts` — Anthropic (Claude) direct
- `lib/ai/providers/google-provider.ts` — Google (Gemini) direct

**Usage:**
```typescript
import { getAIProvider } from '@/lib/ai/providers';

const ai = getAIProvider({ apiKey: userKey || undefined });
const response = await ai.complete({
  model: 'gpt-4-turbo',
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.7,
});
```

**Key pattern:** All providers implement the same interface. The factory selects
the right provider based on the model ID or explicit provider parameter.

## BYOK Key Injection

**File:** `lib/ai/api-credential-injector.ts`
**Purpose:** Bridges user-stored API credentials into AI provider calls

**Flow:**
1. Look up user's API credential in DB (`prisma.aPICredential.findFirst`)
2. Filter: `isActive: true`, `revokedAt: null`, most recent first
3. Decrypt with `decryptApiKey()` from `lib/encryption/api-key-encryption.ts`
4. Pass decrypted key to `getAIProvider({ apiKey })` — overrides platform key

**Provider mapping:**
```
openrouter → openrouter
openai     → openrouter (OpenAI keys work through OpenRouter)
anthropic  → anthropic
google     → google
```

**Security:**
- Keys stored encrypted at rest (AES-256-GCM)
- Decrypted only at point of use, never logged
- `revokedAt` field prevents use of compromised keys

## Legacy OpenRouter Client

**File:** `lib/ai/openrouter-client.ts`
**Purpose:** Direct OpenRouter API calls (legacy — prefer provider abstraction)

**Environment variables:**
- `OPENROUTER_API_KEY` — Platform-level API key
- `OPENROUTER_SITE_NAME` — App name header
- `OPENROUTER_SITE_URL` — App URL header

**When to use:** Only for legacy code paths. New code should use `getAIProvider()`.

## Content Generator

**File:** `lib/ai/content-generator.ts`
**Purpose:** Multi-model content creation with persona-based voice consistency

**ContentRequest fields:**
- `type`: post, caption, thread, story, reel, article
- `platform`: twitter, instagram, linkedin, tiktok, facebook, youtube
- `tone`: professional, casual, humorous, inspirational, educational
- `personaId`: Optional trained persona for voice/style consistency
- `keywords`, `targetAudience`, `length`, `includeEmojis`, `includeHashtags`, `includeCTA`

**Persona integration:** When `personaId` is provided, the generator loads the
persona's tone, style, vocabulary, and emotion settings from the database and
injects them into the system prompt.

## Content Scorer

**File:** `lib/ai/content-scorer.ts`
**Purpose:** Real-time content quality scoring with zero AI calls

**Five dimensions (0-100 each):**
| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| Engagement | 30% | Hooks, questions, emojis, CTAs, conversation starters |
| Readability | 25% | Flesch-Kincaid approximation for social content |
| Platform Fit | 20% | Character limits, formatting patterns per platform |
| Clarity | 15% | Jargon, passive voice, specificity |
| Emotional | 10% | Sentiment strength, power words, urgency, storytelling |

**Overall score:** Weighted average of all five dimensions.

**Key design choice:** Pure functions with no AI calls. This enables real-time
scoring in the UI without latency or cost.

## Content Repurposer

**File:** `lib/ai/content-repurposer.ts`
**Purpose:** Adapts a single piece of content for multiple platforms

Takes generated content and transforms it to match each platform's format,
character limits, and audience expectations.

## Common Mistakes

| Mistake | Why It's Wrong | Correct Pattern |
|---------|---------------|----------------|
| Hardcoding model IDs | Breaks when models update | Use model-registry.ts |
| Using openrouter-client.ts directly | Bypasses provider abstraction | Use `getAIProvider()` |
| Logging decrypted API keys | Security vulnerability | Never log keys |
| Skipping content scoring | Inconsistent quality | Always score before publish |
| Ignoring persona when available | Brand voice inconsistency | Pass `personaId` through |

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `OPENROUTER_API_KEY` | Platform-level AI API key | CRITICAL |
| `OPENROUTER_SITE_NAME` | App name for OpenRouter headers | Required |
| `OPENROUTER_SITE_URL` | App URL for OpenRouter headers | Required |
| `ANTHROPIC_API_KEY` | Direct Anthropic access | Optional |
| `GOOGLE_AI_API_KEY` | Direct Google AI access | Optional |
| `API_ENCRYPTION_KEY` | BYOK key encryption (AES-256-GCM) | CRITICAL |

## File Index

| File | Purpose |
|------|---------|
| `lib/ai/model-registry.ts` | Model catalogue and version tracking |
| `lib/ai/model-manager.ts` | Health monitoring, failover, auto-refresh |
| `lib/ai/providers/index.ts` | Provider factory (`getAIProvider`) |
| `lib/ai/providers/base-provider.ts` | Abstract provider base class |
| `lib/ai/providers/openrouter-provider.ts` | OpenRouter implementation |
| `lib/ai/providers/anthropic-provider.ts` | Anthropic (Claude) implementation |
| `lib/ai/providers/google-provider.ts` | Google (Gemini) implementation |
| `lib/ai/api-credential-injector.ts` | BYOK key lookup and decryption |
| `lib/ai/content-generator.ts` | Prompt building and content generation |
| `lib/ai/content-scorer.ts` | Real-time quality scoring (no AI calls) |
| `lib/ai/content-repurposer.ts` | Multi-platform content adaptation |
| `lib/ai/openrouter-client.ts` | Legacy OpenRouter client (prefer providers) |
| `lib/encryption/api-key-encryption.ts` | AES-256-GCM key encryption/decryption |
