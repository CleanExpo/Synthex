/**
 * LLM copy hook — the real Anthropic-backed CopyWriter.
 *
 * Wraps the shared AI provider (`getAIProvider`) with a schema-constrained
 * request (SYN-313 `structuredOutput`) so the model returns a validated
 * {@link SiteCopy} object — no fence-stripping, no manual JSON.parse. The
 * prompt encodes the same rules the validators enforce (Aid Rule, no ACL §18
 * category claims, mention the hero service, honour brand forbidden-words), and
 * on a repair pass it lists the prior violations verbatim so the model fixes
 * them. The validator gate in `generateSiteWithCopy` is still the source of
 * truth — this prompt only makes the model likely to pass it first try.
 */

import { z } from 'zod';

import { getAIProvider } from '@/lib/ai/providers';
import type { AIMessage, AIProvider } from '@/lib/ai/providers/base-provider';
import { structuredOutput } from '@/lib/ai/structured-output';

import type { CopyWriter, CopyWriterInput } from './copywriter';
import type { SiteCopy } from './types';

const FaqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

/** Structured-output contract — mirrors {@link SiteCopy}. */
export const SiteCopySchema = z.object({
  headline: z.string().min(1),
  intro: z.string().min(1),
  bodyParagraphs: z.array(z.string().min(1)).min(1),
  faqs: z.array(FaqSchema),
});

export interface LlmCopyWriterDeps {
  /** Override the provider (tests inject a stub). Defaults to `getAIProvider()`. */
  provider?: AIProvider;
  /** Model id. Defaults to the estate's content-generation model. */
  model?: string;
  /** Sampling temperature. Defaults to 0.4 (on-brand but not robotic). */
  temperature?: number;
}

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_TEMPERATURE = 0.4;

const SYSTEM_PROMPT = [
  'You write concise, on-brand website copy for a LOCAL SERVICE BUSINESS.',
  'Hard rules — every draft MUST satisfy all of them:',
  '1. The business (its people), never "AI", is the actor. Never write that AI',
  '   restores, cleans, inspects, repairs, assesses, delivers, or otherwise does',
  '   the physical work — AI only assists.',
  '2. No superlative or ranking claims: never "best", "leading", "first", "only",',
  '   "number 1", "largest", "cheapest", or "guaranteed". They are legally gated',
  '   under Australian Consumer Law and will be rejected.',
  '3. The copy must clearly name the hero service.',
  '4. Never use any of the brand’s forbidden words.',
  'Write in Australian English. Be specific and trustworthy, not hypey.',
  'Return ONLY the structured JSON object.',
].join('\n');

function buildUserMessage(input: CopyWriterInput): string {
  const { profile, brand, heroService, priorViolations } = input;
  const loc = [profile.address.addressLocality, profile.address.addressRegion]
    .filter(Boolean)
    .join(', ');

  const lines: string[] = [
    `Business: ${profile.name}${profile.legalName ? ` (legal name ${profile.legalName})` : ''}`,
    loc ? `Location: ${loc}` : '',
    `Hero service (name it in the copy): ${heroService.label}`,
    `Other services: ${profile.services.map(s => s.label).join(', ') || '(none)'}`,
    `Brand: ${brand.displayName}${brand.tagline ? ` — "${brand.tagline}"` : ''}`,
    brand.forbiddenWords.length > 0
      ? `Forbidden words (never use): ${brand.forbiddenWords.join(', ')}`
      : '',
  ].filter(Boolean);

  if (profile.faqs && profile.faqs.length > 0) {
    lines.push(
      'Source FAQs (rewrite in-voice, keep the facts):',
      ...profile.faqs.map(f => `- Q: ${f.question} A: ${f.answer}`)
    );
  }

  lines.push(
    '',
    'Produce:',
    '- headline: <= ~12 words, names the hero service.',
    '- intro: 1–2 sentences.',
    '- bodyParagraphs: 2–3 short paragraphs; name the hero service.',
    '- faqs: 3–4 entries, each answered in 1–2 sentences.'
  );

  if (priorViolations.length > 0) {
    lines.push(
      '',
      'Your previous draft was REJECTED. Fix EVERY one of these violations:',
      ...priorViolations.map(v => `- [${v.rule}] ${v.message}`)
    );
  }

  return lines.join('\n');
}

/**
 * Build an Anthropic-backed {@link CopyWriter}. Throws from `write` if the
 * provider cannot return schema-valid copy, which `generateSiteWithCopy`
 * catches and turns into a deterministic fallback.
 */
export function createLlmCopyWriter(deps: LlmCopyWriterDeps = {}): CopyWriter {
  const model = deps.model ?? DEFAULT_MODEL;
  const temperature = deps.temperature ?? DEFAULT_TEMPERATURE;
  const outputFormat = structuredOutput(SiteCopySchema);

  return {
    async write(input: CopyWriterInput): Promise<SiteCopy> {
      const provider = deps.provider ?? getAIProvider();
      const messages: AIMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(input) },
      ];

      const res = await provider.complete({
        model,
        max_tokens: 1500,
        temperature,
        messages,
        outputFormat,
      });

      if (!res.parsed) {
        throw new Error(
          'llm-copywriter: provider returned no schema-valid copy'
        );
      }
      return res.parsed as SiteCopy;
    },
  };
}
