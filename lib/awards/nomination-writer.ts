/**
 * Award Nomination Writer — AI-powered nomination generator (Phase 94)
 *
 * Generates nomination text for industry awards using the OpenRouter API.
 * Falls back to a template-based nomination if the AI call fails or no API
 * key is configured. Follows the same pattern as lib/pr/ai-generator.ts.
 *
 * Model: anthropic/claude-3-haiku — fast, cost-effective for structured text.
 *
 * @module lib/awards/nomination-writer
 */

import type { NominationDraft } from './types';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface NominationInput {
  award: {
    name: string;
    category: string;
    organizer: string;
  };
  brand: {
    canonicalName: string;
    description: string;
    credentials?: string[];   // e.g. ["Founded 2022", "500+ clients", "SOC 2 certified"]
    achievements?: string[];  // e.g. ["Launched AI-powered content engine", "Grew 3x YoY"]
    location?: string;        // e.g. "Brisbane, Australia"
  };
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert award nomination copywriter. You write compelling, evidence-backed award nominations optimised for industry judging panels.

Rules:
- Write in Australian English (colour, organise, licence, recognise, realise)
- Use active voice and specific, quantified claims
- Focus on outcomes and impact, not just features
- Structure: hook, credentials, key achievements, why this category
- Nomination body: 300–500 words
- Key points: 4–6 concise bullet points summarising the strongest claims
- Return ONLY valid JSON matching the schema below — no markdown fencing

JSON schema:
{
  "title": "string — compelling nomination title (≤ 100 chars)",
  "body": "string — full nomination text",
  "keyPoints": ["string", "string", "string", "string"]
}`;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate an award nomination using OpenRouter AI.
 *
 * @param input - Award and brand details
 * @param byokApiKey - Optional user-supplied OpenRouter API key (BYOK)
 * @returns NominationDraft with title, body, keyPoints, wordCount
 */
export async function generateNomination(
  input: NominationInput,
  byokApiKey?: string,
): Promise<NominationDraft> {
  const apiKey = byokApiKey || process.env.OPENROUTER_API_KEY;

  if (apiKey) {
    try {
      return await generateWithAI(input, apiKey);
    } catch (err) {
      console.error('[nomination-writer] AI generation failed, falling back to template:', err);
    }
  }

  return generateWithTemplate(input);
}

// ---------------------------------------------------------------------------
// AI generation path
// ---------------------------------------------------------------------------

async function generateWithAI(
  input: NominationInput,
  apiKey: string,
): Promise<NominationDraft> {
  const userPrompt = buildUserPrompt(input);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer':
        process.env.OPENROUTER_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://synthex.app',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'Synthex',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1400,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenRouter error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenRouter');

  const parsed = JSON.parse(content) as {
    title: string;
    body: string;
    keyPoints: string[];
  };

  return {
    title: parsed.title,
    body: parsed.body,
    keyPoints: parsed.keyPoints || [],
    wordCount: parsed.body.split(/\s+/).length,
    isAiGenerated: true,
  };
}

// ---------------------------------------------------------------------------
// Template fallback
// ---------------------------------------------------------------------------

function generateWithTemplate(input: NominationInput): NominationDraft {
  const { award, brand } = input;
  const credentialsList =
    brand.credentials?.map((c) => `- ${c}`).join('\n') ?? '';
  const achievementsList =
    brand.achievements?.map((a) => `- ${a}`).join('\n') ?? '';
  const location = brand.location ?? 'Australia';

  const body = `${brand.canonicalName} is proud to be nominated for the ${award.name} in the ${award.category} category, organised by ${award.organizer}.

${brand.canonicalName} is ${brand.description} Based in ${location}, the company has established itself as a leader in its field through a commitment to innovation, customer outcomes, and measurable business impact.

${credentialsList ? `Key credentials:\n${credentialsList}\n` : ''}
${achievementsList ? `Recent achievements:\n${achievementsList}\n` : ''}
${brand.canonicalName} exemplifies the qualities recognised by the ${award.category} category. The organisation has consistently demonstrated excellence through its product development, customer success, and industry contributions.

We believe ${brand.canonicalName} represents the best of what ${award.category} looks like today — innovative, customer-centric, and built to endure.`;

  const keyPoints = [
    `${brand.canonicalName}: ${brand.description.slice(0, 100)}`,
    `Nominated for ${award.category} at the ${award.name}`,
    ...(brand.credentials?.slice(0, 2) ?? ['Innovative product', 'Customer-focused']),
    ...(brand.achievements?.slice(0, 2) ?? ['Strong growth trajectory']),
  ].slice(0, 5);

  return {
    title: `${brand.canonicalName} — ${award.category} Nomination`,
    body: body.trim(),
    keyPoints,
    wordCount: body.trim().split(/\s+/).length,
    isAiGenerated: false,
  };
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildUserPrompt(input: NominationInput): string {
  const { award, brand } = input;
  const lines: string[] = [
    `Award: ${award.name}`,
    `Organiser: ${award.organizer}`,
    `Category: ${award.category}`,
    `Company: ${brand.canonicalName}`,
    `Description: ${brand.description}`,
  ];

  if (brand.location) lines.push(`Location: ${brand.location}`);

  if (brand.credentials?.length) {
    lines.push('Credentials:');
    brand.credentials.forEach((c) => lines.push(`  - ${c}`));
  }

  if (brand.achievements?.length) {
    lines.push('Key Achievements:');
    brand.achievements.forEach((a) => lines.push(`  - ${a}`));
  }

  return lines.join('\n');
}
