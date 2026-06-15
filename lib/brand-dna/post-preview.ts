// lib/brand-dna/post-preview.ts
// Generates an instant AI post preview from minimal website data (≤3s path).
// Falls back to a template if AI is unavailable.
//
// Routes through the shared AI provider factory (getAIProvider) so this brand-
// voice preview uses the same OpenAI-only direction as the rest of the brand-DNA
// extraction pipeline (lib/ai/website-analyzer, lib/ai/onboarding-pipeline),
// instead of a hardcoded OpenRouter fetch. Companion to #401 / #412, which
// routed other brand-voice AI paths onto the provider factory.

import { getAIProvider } from '@/lib/ai/providers';
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

/** Hard budget for the instant-preview path; degrade to a template past this. */
const PREVIEW_TIMEOUT_MS = 4000;

function fallbackTemplate(businessName: string): string {
  const template =
    FALLBACK_TEMPLATES[Math.floor(Math.random() * FALLBACK_TEMPLATES.length)];
  return template(businessName);
}

export async function generateInstantPostPreview(
  input: PreviewInput
): Promise<string> {
  const { businessName, industry, heroCopy } = input;

  try {
    const ai = getAIProvider();

    const prompt = [
      `Write a single short social media post (max 2 sentences, under 180 characters) for "${businessName}", a ${industry} business.`,
      heroCopy ? `Their website says: "${heroCopy.slice(0, 200)}"` : '',
      'Be warm, local, and specific. No hashtags. No emojis unless natural. Write in Australian English.',
    ]
      .filter(Boolean)
      .join('\n');

    // Race the completion against a hard timeout so the instant path can never
    // hang — the SDK doesn't honour the old raw-fetch AbortSignal.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('post-preview timeout')),
        PREVIEW_TIMEOUT_MS
      )
    );

    const response = await Promise.race([
      ai.complete({
        model: ai.models.fast,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7,
      }),
      timeout,
    ]);

    const content = response.choices[0]?.message?.content?.trim();
    return content || fallbackTemplate(businessName);
  } catch (error) {
    logger.error('[post-preview] AI generation failed, using fallback', error);
    return fallbackTemplate(businessName);
  }
}
