/**
 * Mechanical brand-voice gate for workflow validation steps (SYN-972).
 * Lightweight rules — full skill runs in IDE; product path blocks obvious violations.
 */

export interface BrandVoiceGateInput {
  content: string;
  voiceTag?: string;
  antiPatterns?: string[];
}

export interface BrandVoiceGateResult {
  pass: boolean;
  score: number;
  violations: string[];
  voiceTag?: string;
}

const GLOBAL_ANTI_PATTERNS = [
  'game-changing',
  'revolutionary',
  'leverage synergies',
  'excited to announce',
  'as an ai',
  'as an AI',
];

const VOICE_TAG_RULES: Record<string, RegExp[]> = {
  brand_anonymous: [/^\s*I\s/m, /\bI'm\b/i, /\bI am\b/i],
  hybrid_phill_strategic_brand_routine: [
    /projected earnings/i,
    /guaranteed roi/i,
  ],
};

export function runBrandVoiceGate(
  input: BrandVoiceGateInput
): BrandVoiceGateResult {
  const text = input.content?.trim() ?? '';
  const violations: string[] = [];

  if (!text) {
    return {
      pass: false,
      score: 0,
      violations: ['empty_content'],
      voiceTag: input.voiceTag,
    };
  }

  const patterns = [...GLOBAL_ANTI_PATTERNS, ...(input.antiPatterns ?? [])];

  for (const phrase of patterns) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      violations.push(`anti_pattern:${phrase}`);
    }
  }

  if (input.voiceTag && VOICE_TAG_RULES[input.voiceTag]) {
    for (const rule of VOICE_TAG_RULES[input.voiceTag]) {
      if (rule.test(text)) {
        violations.push(`voice_tag:${input.voiceTag}`);
        break;
      }
    }
  }

  const score = Math.max(0, 100 - violations.length * 25);
  return {
    pass: violations.length === 0,
    score,
    violations,
    voiceTag: input.voiceTag,
  };
}

/**
 * Extract draft text from prior workflow step outputs.
 */
export function extractDraftFromPriorOutputs(
  priorOutputs: { output: unknown }[]
): string {
  for (let i = priorOutputs.length - 1; i >= 0; i--) {
    const out = priorOutputs[i].output;
    if (typeof out === 'string' && out.trim()) return out;
    if (out && typeof out === 'object') {
      const o = out as Record<string, unknown>;
      if (typeof o.content === 'string') return o.content;
      if (typeof o.text === 'string') return o.text;
      if (typeof o.generatedContent === 'string') return o.generatedContent;
    }
  }
  return '';
}
