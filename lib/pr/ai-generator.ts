/**
 * PR AI Generator (Phase 93)
 *
 * Generates AI-powered press releases using the OpenRouter client.
 * Falls back to template-based generation if the AI call fails or no API key
 * is configured.
 *
 * Model: anthropic/claude-3-haiku — fast, cost-effective for structured text.
 *
 * @module lib/pr/ai-generator
 */

import { buildPressRelease, generateSlug } from './press-release-builder';
import type { PressReleaseInput } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PRGenerationInput {
  /** Brand or company name */
  brandName: string;
  /** News angle / story hook — e.g. "Series A of $5M AUD" */
  angle: string;
  /** Key facts to include — each item becomes a bullet point in the AI prompt */
  keyFacts: string[];
  /** Target audience — e.g. "B2B SaaS founders in Australia" */
  targetAudience: string;
  /** Name of the spokesperson being quoted */
  quoteName: string;
  /** The actual quote text */
  quoteText: string;
  /** Optional contact details */
  contactInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  /** Optional category */
  category?: 'funding' | 'product' | 'partnership' | 'award' | 'other';
  /** Optional location dateline — defaults to "SYDNEY, AUSTRALIA" */
  location?: string;
}

export interface PRGenerationResult {
  title: string;
  summary: string;
  body: string;
  suggestedSlug: string;
  jsonLd: Record<string, unknown>;
  /** true if the result came from the AI; false if from template fallback */
  isAIGenerated: boolean;
}

// ---------------------------------------------------------------------------
// AI system prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert PR copywriter. You write press releases optimised for AI search engine citation by ChatGPT, Perplexity, Google AI Overviews, and Bing Copilot.

Rules:
- Write in Australian English (colour, organise, licence, recognise)
- Use active voice and concise sentences
- Headline: ≤ 100 characters, newsy, factual
- Lead paragraph: who, what, when, where, why in the first two sentences
- Include the provided quote naturally in the second or third paragraph
- Include the key facts as specific data points woven into the body — not a bullet list
- Body: 250–400 words
- Summary: 1–2 sentences, ≤ 200 characters
- Return ONLY valid JSON matching the schema below — no markdown fencing

JSON schema:
{
  "title": "string — headline",
  "summary": "string — 1-2 sentence summary",
  "body": "string — full press release body text (no headline, no FOR IMMEDIATE RELEASE header)"
}`;

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate a press release using OpenRouter AI.
 *
 * @param input - Generation parameters
 * @param byokApiKey - Optional user-supplied OpenRouter API key (BYOK)
 * @returns Generated press release content
 */
export async function generatePressRelease(
  input: PRGenerationInput,
  byokApiKey?: string,
): Promise<PRGenerationResult> {
  const apiKey = byokApiKey || process.env.OPENROUTER_API_KEY;

  if (apiKey) {
    try {
      return await generateWithAI(input, apiKey);
    } catch (err) {
      console.error('[ai-generator] AI generation failed, falling back to template:', err);
    }
  }

  return generateWithTemplate(input);
}

// ---------------------------------------------------------------------------
// AI generation path
// ---------------------------------------------------------------------------

async function generateWithAI(
  input: PRGenerationInput,
  apiKey: string,
): Promise<PRGenerationResult> {
  const userPrompt = buildUserPrompt(input);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.app',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'Synthex',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenRouter error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('Empty response from OpenRouter');

  // Strip optional markdown code fences before parsing
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  let parsed: { title: string; summary: string; body: string };
  try {
    parsed = JSON.parse(cleaned) as { title: string; summary: string; body: string };
  } catch {
    throw new Error('OpenRouter returned non-JSON content');
  }

  if (!parsed.title || !parsed.body) {
    throw new Error('OpenRouter response missing required fields');
  }

  const suggestedSlug = generateSlug(parsed.title);

  // Build JSON-LD using existing builder
  const prInput: PressReleaseInput = {
    headline: parsed.title,
    body: parsed.body,
    slug: suggestedSlug,
    location: input.location,
    category: input.category,
    contactName: input.contactInfo?.name,
    contactEmail: input.contactInfo?.email,
    contactPhone: input.contactInfo?.phone,
    datePublished: new Date().toISOString(),
  };

  const { jsonLd } = buildPressRelease(prInput);

  return {
    title: parsed.title,
    summary: parsed.summary || parsed.body.slice(0, 200),
    body: parsed.body,
    suggestedSlug,
    jsonLd,
    isAIGenerated: true,
  };
}

// ---------------------------------------------------------------------------
// Template fallback path
// ---------------------------------------------------------------------------

function generateWithTemplate(input: PRGenerationInput): PRGenerationResult {
  const facts = input.keyFacts.length > 0 ? input.keyFacts : ['No additional details provided.'];

  const body = [
    `${input.brandName} today announced ${input.angle}.`,
    '',
    facts.map((f) => `• ${f}`).join('\n'),
    '',
    `"${input.quoteText}" said ${input.quoteName}.`,
    '',
    `This development is targeted at ${input.targetAudience}.`,
  ].join('\n');

  const title = `${input.brandName} Announces ${capitalise(input.angle)}`;
  const summary = `${input.brandName} has announced ${input.angle}. ${input.quoteName} commented on the development.`;
  const suggestedSlug = generateSlug(title);

  const prInput: PressReleaseInput = {
    headline: title,
    body,
    slug: suggestedSlug,
    location: input.location,
    category: input.category,
    contactName: input.contactInfo?.name,
    contactEmail: input.contactInfo?.email,
    contactPhone: input.contactInfo?.phone,
    datePublished: new Date().toISOString(),
  };

  const { jsonLd } = buildPressRelease(prInput);

  return {
    title,
    summary,
    body,
    suggestedSlug,
    jsonLd,
    isAIGenerated: false,
  };
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildUserPrompt(input: PRGenerationInput): string {
  const lines = [
    `Brand: ${input.brandName}`,
    `Angle: ${input.angle}`,
    `Target audience: ${input.targetAudience}`,
    `Location: ${input.location || 'Sydney, Australia'}`,
    `Quote by ${input.quoteName}: "${input.quoteText}"`,
    '',
    'Key facts to include:',
    ...input.keyFacts.map((f, i) => `${i + 1}. ${f}`),
    '',
    'Write the press release now. Return only valid JSON.',
  ];

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalise(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
