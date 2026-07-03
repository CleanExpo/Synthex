/**
 * Cheap-LLM expansion of a plain subject into a cinematography-grade prompt.
 * Used only for the Freeform card (other cards carry their own scaffolds).
 * Failure-safe: any LLM error returns the raw subject — never block generation.
 *
 * Model selection: uses modelForTask('prompt-enhance') so the env var
 * LLM_ROUTING_PROMPT_ENHANCE can override the default without code changes.
 * The OpenRouterProvider accepts raw OpenRouter model IDs directly in the
 * `model` field, so the routing config strings are valid as-is.
 */
import { getAIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';
import { modelForTask } from './llm-routing';

const SYSTEM = `You expand short video ideas into one vivid text-to-video prompt.
Include: shot type, camera motion, lighting, subject motion, setting.
One sentence, max 60 words, no preamble, no quotes.`;

export async function enhancePrompt(subject: string): Promise<string> {
  try {
    const ai = getAIProvider();
    const res = await ai.complete({
      model: modelForTask('prompt-enhance'),
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: subject },
      ],
      temperature: 0.8,
      max_tokens: 150,
    });
    const out = res.choices[0]?.message?.content?.trim();
    return out || subject;
  } catch (err) {
    logger.warn('prompt enhancement failed, using raw subject', { err });
    return subject;
  }
}
