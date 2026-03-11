/**
 * Prompt Tester (Phase 96)
 *
 * Tests a natural-language prompt using the existing OpenRouter/Claude integration
 * and parses the AI response for brand visibility signals.
 *
 * Uses model: claude-3-5-haiku-20241022 (fast + cost-effective)
 *
 * @module lib/prompts/prompt-tester
 */

import type { PromptTestResult } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMPT_MODEL = 'anthropic/claude-3-5-haiku';
const MAX_TOKENS = 800;

// Common AI search engine behaviour markers for quality scoring
const QUALITY_MARKERS = {
  positive: ['recommend', 'consider', 'popular', 'trusted', 'known for', 'specialises', 'offers', 'provides'],
  negative: ['unfortunately', 'unable to', 'not sure', 'cannot', 'don\'t know', 'i don\'t have'],
};

// ─── Core Test Function ───────────────────────────────────────────────────────

/**
 * Test a prompt against the Claude AI and parse the response for brand signals.
 *
 * @param promptText  - The natural language prompt to test
 * @param entityName  - The brand/entity name to look for in the response
 * @returns Parsed test result with visibility metrics
 */
export async function testPrompt(
  promptText: string,
  entityName: string
): Promise<PromptTestResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured — cannot test prompts');
  }

  const siteUrl = process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.app';
  const siteName = process.env.OPENROUTER_SITE_NAME || 'SYNTHEX';

  // ── Call the OpenRouter API ──
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': siteUrl,
      'X-Title': siteName,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PROMPT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful AI assistant. Answer questions naturally and informatively as you would in an AI search engine. Focus on providing useful, accurate information.',
        },
        {
          role: 'user',
          content: promptText,
        },
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[]
  };

  const aiResponse = data.choices?.[0]?.message?.content ?? '';

  // ── Parse response ──
  return parseResponse(aiResponse, entityName);
}

// ─── Response Parser ──────────────────────────────────────────────────────────

/**
 * Parse an AI response for brand visibility signals.
 * Exported for testability.
 */
export function parseResponse(
  aiResponse: string,
  entityName: string
): PromptTestResult {
  const sentences = splitIntoSentences(aiResponse);
  const nameLower = entityName.toLowerCase();

  // ── Brand mention detection ──
  let brandMentioned = false;
  let brandPosition: number | null = null;
  let mentionContext: string | null = null;

  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].toLowerCase().includes(nameLower)) {
      brandMentioned = true;
      brandPosition = i + 1;  // 1-based position
      mentionContext = sentences[i].trim();
      break;
    }
  }

  // ── Competitor detection ──
  // Extract capitalised proper nouns (likely company/product names)
  const competitorsFound = extractProperNouns(aiResponse, entityName);

  // ── Response quality score ──
  const responseQuality = scoreResponseQuality(aiResponse, sentences);

  return {
    response: aiResponse,
    brandMentioned,
    brandPosition,
    mentionContext,
    competitorsFound,
    responseQuality,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Split text into sentences. Handles common abbreviations.
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

/**
 * Extract proper nouns from text that are likely competitor names.
 * Looks for capitalised 2-3 word phrases not matching the entity name.
 */
function extractProperNouns(text: string, entityName: string): string[] {
  const nameLower = entityName.toLowerCase();

  // Match capitalised words (potential brand names)
  // Pattern: one or more consecutive Title Case or ALL-CAPS words (2+ chars each)
  const matches = text.match(/\b[A-Z][a-zA-Z]{1,}(?:\s+[A-Z][a-zA-Z]{1,}){0,2}\b/g) ?? [];

  const exclusions = new Set([
    'I', 'The', 'A', 'An', 'In', 'On', 'At', 'To', 'For', 'Of', 'And', 'Or',
    'But', 'If', 'So', 'As', 'By', 'Up', 'It', 'Is', 'Be', 'Do', 'Go', 'My',
    'We', 'You', 'He', 'She', 'They', 'This', 'That', 'These', 'Those',
    'When', 'Where', 'What', 'Which', 'Who', 'How', 'Why',
    'Also', 'Additionally', 'Furthermore', 'However', 'Therefore', 'Moreover',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'AI', 'API', 'URL', 'FAQ', 'CRM', 'SEO', 'CTA',
  ]);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const match of matches) {
    const trimmed = match.trim();
    const lower = trimmed.toLowerCase();

    if (
      trimmed.length >= 3 &&
      !exclusions.has(trimmed) &&
      !lower.includes(nameLower) &&
      !seen.has(lower)
    ) {
      seen.add(lower);
      result.push(trimmed);
    }
  }

  // Return top 10 to avoid noise
  return result.slice(0, 10);
}

/**
 * Compute a 0–1 quality score for the response based on heuristics.
 */
function scoreResponseQuality(text: string, sentences: string[]): number {
  let score = 0.5;  // Baseline

  // Length bonus (longer = more informative)
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 100) score += 0.1;
  if (wordCount > 200) score += 0.1;

  // Positive language bonus
  const textLower = text.toLowerCase();
  const positiveHits = QUALITY_MARKERS.positive.filter((m) => textLower.includes(m)).length;
  score += positiveHits * 0.03;

  // Negative language penalty
  const negativeHits = QUALITY_MARKERS.negative.filter((m) => textLower.includes(m)).length;
  score -= negativeHits * 0.05;

  // Structure bonus (response has multiple sentences = structured answer)
  if (sentences.length >= 3) score += 0.05;
  if (sentences.length >= 5) score += 0.05;

  return Math.min(1, Math.max(0, score));
}
