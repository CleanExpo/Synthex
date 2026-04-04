// lib/brand-dna/post-preview.ts
// Generates an instant AI post preview from minimal website data (≤3s path).
// Falls back to a template if AI is unavailable.

import { logger } from '@/lib/logger';

export interface PreviewInput {
  businessName: string;
  industry: string;
  heroCopy: string;
}

const FALLBACK_TEMPLATES = [
  (b: string) => `${b} — where every detail matters. Come see us today.`,
  (b: string) => `Big things happening at ${b}! Follow along for updates.`,
  (b: string) => `Your local ${b} — quality you can count on. Visit us soon.`,
];

export async function generateInstantPostPreview(
  input: PreviewInput
): Promise<string> {
  const { businessName, industry, heroCopy } = input;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logger.warn('[post-preview] No API key — using fallback template');
    const template =
      FALLBACK_TEMPLATES[Math.floor(Math.random() * FALLBACK_TEMPLATES.length)];
    return template(businessName);
  }

  try {
    const prompt = [
      `Write a single short social media post (max 2 sentences, under 180 characters) for "${businessName}", a ${industry} business.`,
      heroCopy ? `Their website says: "${heroCopy.slice(0, 200)}"` : '',
      'Be warm, local, and specific. No hashtags. No emojis unless natural. Write in Australian English.',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://synthex.social',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(4000), // hard 4s limit for instant path
      }
    );

    if (!response.ok) throw new Error(`OpenRouter ${response.status}`);
    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    return (
      data.choices[0]?.message?.content?.trim() ??
      FALLBACK_TEMPLATES[0](businessName)
    );
  } catch (error) {
    logger.error('[post-preview] AI generation failed, using fallback', error);
    return FALLBACK_TEMPLATES[0](businessName);
  }
}
