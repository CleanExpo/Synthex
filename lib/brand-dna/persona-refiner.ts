// lib/brand-dna/persona-refiner.ts
// Persona training loop (#8) — refines the BRAND-LEVEL persona/voice held in the
// BrandDNA JSON columns (brandVoice / persona) from user feedback, and folds any
// approved voice samples into brandVoice.samplePhrases so they can feed the
// existing quality-scorer (lib/brand-voice/quality-scorer.ts).
//
// This deliberately does NOT touch the separate user-scoped `Persona` model or
// its `persona-training-pipeline` — that is a different (ghostwriting) concept.
// It reuses the BrandDNA extractor's types and the shared getAIProvider()
// factory; no new model/column, no direct SDK call.

import { getAIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';
import type { BrandVoice, BrandPersona } from './types';

/** A user-approved phrase that exemplifies how the brand should sound. */
export type VoiceSample = string;

export interface PersonaRefinementInput {
  /** Current voice from BrandDNA.brandVoice (already parsed from JSON). */
  brandVoice: BrandVoice;
  /** Current persona from BrandDNA.persona (already parsed from JSON). */
  persona: BrandPersona;
  /** Free-text feedback on how the voice/persona should change. */
  feedback: string;
  /**
   * Optional approved voice samples to fold into brandVoice.samplePhrases. These
   * are the canonical examples that feed the scorer; deduped, capped at 25.
   */
  voiceSamples?: VoiceSample[];
}

export interface PersonaRefinementResult {
  brandVoice: BrandVoice;
  persona: BrandPersona;
  /** Brief explanation of what the refinement changed, for the audit trail. */
  rationale: string;
}

const MAX_SAMPLE_PHRASES = 25;

/** Clamp a 1–5 scale value, tolerating out-of-range / non-numeric model output. */
function clampScale(value: unknown, fallback: BrandVoice['formality']): BrandVoice['formality'] {
  const n = typeof value === 'number' ? Math.round(value) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(5, Math.max(1, n)) as BrandVoice['formality'];
}

/** Merge approved samples into the existing phrases, deduped (case-insensitive) and capped. */
export function mergeVoiceSamples(
  existing: string[],
  incoming: string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const phrase of [...existing, ...incoming]) {
    const trimmed = phrase.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_SAMPLE_PHRASES) break;
  }
  return out;
}

function buildSystemPrompt(): string {
  return `You refine a brand's voice-and-persona profile from owner feedback.

You are given the CURRENT profile as JSON and free-text feedback. Apply the
feedback conservatively: change only what the feedback asks for, keep everything
else as-is. Return ONLY valid JSON matching this exact schema:

{
  "brandVoice": {
    "formality": <integer 1-5, 1=very casual 5=very formal>,
    "boldness": <integer 1-5, 1=reserved 5=bold>,
    "tone": "<short tone description>"
  },
  "persona": {
    "ageRange": "<e.g. 25-45>",
    "values": ["<value>"],
    "painPoints": ["<pain point>"],
    "description": "<1-2 sentence audience description>"
  },
  "rationale": "<one sentence on what you changed and why>"
}

Use Australian English. Do not invent facts the feedback does not support.`;
}

function buildUserPrompt(input: PersonaRefinementInput): string {
  const current = {
    brandVoice: {
      formality: input.brandVoice.formality,
      boldness: input.brandVoice.boldness,
      tone: input.brandVoice.tone,
    },
    persona: input.persona,
  };
  return `CURRENT PROFILE:\n${JSON.stringify(current, null, 2)}\n\nFEEDBACK:\n${input.feedback}`;
}

interface RefinedModelOutput {
  brandVoice?: {
    formality?: number;
    boldness?: number;
    tone?: string;
  };
  persona?: {
    ageRange?: string;
    values?: string[];
    painPoints?: string[];
    description?: string;
  };
  rationale?: string;
}

function parseModelOutput(raw: string): RefinedModelOutput {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in refiner response');
  return JSON.parse(match[0]) as RefinedModelOutput;
}

/**
 * Refine the brand voice/persona from feedback. AI is reached ONLY via
 * getAIProvider(); on any provider/parse failure we degrade gracefully — the
 * existing voice/persona is preserved and only the approved voice samples are
 * folded in, so the loop never corrupts the stored profile.
 */
export async function refineBrandPersona(
  input: PersonaRefinementInput
): Promise<PersonaRefinementResult> {
  const mergedSamples = mergeVoiceSamples(
    input.brandVoice.samplePhrases ?? [],
    input.voiceSamples ?? []
  );

  try {
    const ai = getAIProvider();
    const response = await ai.complete({
      model: ai.models.balanced,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(input) },
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const raw = response.choices?.[0]?.message?.content ?? '';
    const parsed = parseModelOutput(raw);

    const brandVoice: BrandVoice = {
      formality: clampScale(parsed.brandVoice?.formality, input.brandVoice.formality),
      boldness: clampScale(parsed.brandVoice?.boldness, input.brandVoice.boldness),
      tone:
        typeof parsed.brandVoice?.tone === 'string' && parsed.brandVoice.tone.trim()
          ? parsed.brandVoice.tone.trim()
          : input.brandVoice.tone,
      samplePhrases: mergedSamples,
    };

    const persona: BrandPersona = {
      ageRange:
        typeof parsed.persona?.ageRange === 'string'
          ? parsed.persona.ageRange
          : input.persona.ageRange,
      values: Array.isArray(parsed.persona?.values)
        ? parsed.persona!.values!.filter((v): v is string => typeof v === 'string')
        : input.persona.values,
      painPoints: Array.isArray(parsed.persona?.painPoints)
        ? parsed.persona!.painPoints!.filter((v): v is string => typeof v === 'string')
        : input.persona.painPoints,
      description:
        typeof parsed.persona?.description === 'string' && parsed.persona.description.trim()
          ? parsed.persona.description.trim()
          : input.persona.description,
    };

    return {
      brandVoice,
      persona,
      rationale:
        typeof parsed.rationale === 'string' && parsed.rationale.trim()
          ? parsed.rationale.trim()
          : 'Voice and persona updated from feedback.',
    };
  } catch (error) {
    logger.warn('[persona-refiner] AI refinement failed; folding in voice samples only', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Graceful degrade: keep the stored voice/persona, still adopt the approved
    // samples so the user's contribution is never lost.
    return {
      brandVoice: { ...input.brandVoice, samplePhrases: mergedSamples },
      persona: input.persona,
      rationale: 'Refinement service unavailable — voice samples saved; profile unchanged.',
    };
  }
}

/**
 * Map a BrandVoice + BrandPersona into the QualityScorer's BrandVoiceProfile.
 * This is how the refined voice "feeds the scorer": the scorer evaluates a voice
 * sample against the profile derived from the just-refined brand voice.
 */
export function brandVoiceToScorerProfile(
  brandVoice: BrandVoice,
  businessName: string
): {
  name: string;
  tone: string;
  style: string;
  vocabulary: string;
  emotion: string;
} {
  // formality 1-5 → style/vocabulary register
  const style = brandVoice.formality >= 4 ? 'formal' : 'conversational';
  const vocabulary = brandVoice.formality >= 4 ? 'sophisticated' : 'standard';
  // boldness 1-5 → emotional register
  const emotion = brandVoice.boldness >= 4 ? 'confident' : 'friendly';
  return {
    name: businessName,
    tone: brandVoice.tone || 'friendly and approachable',
    style,
    vocabulary,
    emotion,
  };
}
