/**
 * SYN-826 — FAQPage schema emitter for DR + CARSI service/Hub pages.
 *
 * Per Q3.2.3 A4 binding: FAQ schema only on pages where visible Q&A exists.
 * This helper enforces that constraint mechanically — it requires both the
 * visible Q&A content AND a passing brand-voice-enforce result for each
 * answer string before emitting the schema.
 *
 * Spec: docs/aeo/brand-voice-enforce-spec-2026-05-16.md (R1..R5 govern answer
 * copy; surface='schema-faq' has no extra length rule).
 */

import { enforceBrandVoice } from './brand-voice-enforce';
import type { BrandVoiceEnforceResult } from './types';
import type { BrandSlug } from '@unite-group/brand-config';

export interface FaqQA {
  question: string;
  answer: string;
}

export interface BuildFaqSchemaInput {
  brand: BrandSlug;
  pageUrl: string;
  qas: FaqQA[];
}

export interface FaqSchemaResult {
  /** JSON-LD object ready to embed in a Next.js page via <Script type="application/ld+json">. */
  jsonLd: Record<string, unknown> | null;
  /** Whether the FAQ schema is safe to emit (every answer passed the gate). */
  safe: boolean;
  /** Per-QA gate decisions in the same order as `qas`. */
  perAnswerGate: BrandVoiceEnforceResult[];
}

/**
 * Build a FAQPage JSON-LD object from a list of Q&As, gating every answer
 * through brand-voice-enforce. If any answer fails the gate, the result
 * `safe` is false and `jsonLd` is null — the caller MUST NOT emit schema
 * for unverified copy.
 */
export async function buildFaqSchema(
  input: BuildFaqSchemaInput,
): Promise<FaqSchemaResult> {
  if (input.qas.length === 0) {
    return { jsonLd: null, safe: false, perAnswerGate: [] };
  }

  const gates: BrandVoiceEnforceResult[] = [];
  for (const qa of input.qas) {
    const result = await enforceBrandVoice({
      brand: input.brand,
      candidate: qa.answer,
      surface: 'schema-faq',
    });
    gates.push(result);
  }

  const safe = gates.every((g) => g.pass);
  if (!safe) {
    return { jsonLd: null, safe: false, perAnswerGate: gates };
  }

  return {
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      url: input.pageUrl,
      mainEntity: input.qas.map((qa) => ({
        '@type': 'Question',
        name: qa.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: qa.answer,
        },
      })),
    },
    safe: true,
    perAnswerGate: gates,
  };
}
