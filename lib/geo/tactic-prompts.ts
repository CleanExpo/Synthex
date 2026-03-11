/**
 * GEO Tactic Rewrite Prompt Templates
 *
 * Builds system + user prompts for each of the 9 Princeton GEO tactics.
 * Temperature must be kept at 0.3 externally — these prompts assume conservative rewriting.
 *
 * @module lib/geo/tactic-prompts
 */

import type { GEOTactic } from './types';

export interface RewritePromptContext {
  content: string;
  /** If provided, only rewrite this excerpt (content contains full context) */
  section?: string;
}

// ─── Human-readable tactic labels ─────────────────────────────────────────────

export const TACTIC_LABELS: Record<GEOTactic, string> = {
  'authoritative-citations': 'Authoritative Citations',
  'statistics':              'Statistics',
  'quotations':              'Quotations',
  'fluency':                 'Fluency',
  'readability':             'Readability',
  'technical-vocabulary':    'Technical Vocabulary',
  'uniqueness':              'Uniqueness',
  'information-flow':        'Information Flow',
  'persuasion':              'Persuasion (Reduce Over-Optimisation)',
};

// ─── Tactic system prompts ─────────────────────────────────────────────────────

const TACTIC_SYSTEM_PROMPTS: Record<GEOTactic, string> = {
  'authoritative-citations': `You are a GEO content specialist. Your task is to improve the Authoritative Citations score of the provided content by adding named source references.

RULES:
- Add phrases like "According to [Source Name], [year]," before key claims
- Use placeholder format [SOURCE: relevant statistic here] where real data would go
- Do NOT fabricate specific statistics or studies
- Preserve the author's exact voice, sentence structure, and paragraph breaks
- Return ONLY the rewritten content — no commentary, no preamble`,

  'statistics': `You are a GEO content specialist improving the Statistics score.

RULES:
- Replace vague claims ("many companies", "most users") with quantified versions using placeholder format: "X% of [audience]" where X is a plausible estimate
- Add attribution: "(Source: [industry body])" after each statistic
- Do NOT invent specific numbers without a [placeholder] indicator
- Preserve the author's voice and all existing content
- Return ONLY the rewritten content`,

  'quotations': `You are a GEO content specialist improving Quotation Inclusion.

RULES:
- Add 1–2 attributed direct quotes per major section
- Format: "[Expert Name], [Title] at [Organisation], states: \\"[quote text]\\""
- If quoting hypothetically, add "(paraphrased)" or use placeholder [QUOTE FROM EXPERT]
- Keep quotes >20 characters, relevant to the surrounding paragraph
- Return ONLY the rewritten content`,

  'fluency': `You are a GEO content specialist improving Fluency by removing hedge language.

RULES:
- Replace hedge words: "might" → "will", "perhaps" → (remove), "could possibly" → "does", "seems to" → "is", "appears to" → "is", "maybe" → (restructure to declarative), "arguably" → (state the position directly), "somewhat" → (use precise adjective)
- Convert weak assertions to confident declarative statements
- Do NOT change facts, claims, or the author's position — only the confidence level
- Return ONLY the rewritten content`,

  'readability': `You are a GEO content specialist improving Readability (target: 15–18 words per sentence).

RULES:
- Split sentences longer than 25 words into 2 shorter sentences
- Join sentences shorter than 8 words into a natural compound sentence
- Use plain language: replace "utilise" with "use", "facilitate" with "help", etc.
- Keep all technical terms that are defined — just ensure the surrounding sentences are short
- Do NOT lose any information or change meaning
- Return ONLY the rewritten content`,

  'technical-vocabulary': `You are a GEO content specialist improving Technical Vocabulary score.

RULES:
- Introduce 2–4 domain-specific terms with parenthetical definitions: "term (definition)"
- Add relevant industry abbreviations where natural: "Search Engine Results Pages (SERPs)"
- Use precise technical language for vague terms where appropriate
- Do NOT add jargon without defining it — definitions improve citability
- Return ONLY the rewritten content`,

  'uniqueness': `You are a GEO content specialist improving content Uniqueness.

RULES:
- Identify repeated phrases used 3+ times and replace with synonyms
- Vary sentence openings (avoid starting 3+ consecutive sentences the same way)
- Replace generic words ("good", "great", "important") with specific descriptors
- Use the thesaurus principle: if a word appears >3 times, alternate with an equivalent
- Return ONLY the rewritten content`,

  'information-flow': `You are a GEO content specialist improving Information Flow with transition phrases.

RULES:
- Add transition phrases between paragraphs: "Furthermore,", "Building on this,", "As a result,", "This means that", "Specifically,", "In contrast,", "Additionally,"
- Ensure each paragraph's last sentence sets up the next paragraph's topic
- Do NOT add new information — only improve logical connectors
- Target: at least 1 transition phrase per paragraph
- Return ONLY the rewritten content`,

  'persuasion': `You are a GEO content specialist reducing over-persuasion and keyword stuffing.

RULES:
- Find 3-grams (3-word phrases) that appear 3+ times and rephrase duplicates
- Reduce exact keyword repetition: if the same phrase appears >2 times, use synonyms
- Replace superlatives ("best", "most", "greatest") with specific evidence
- Do NOT reduce the total amount of information — only reduce repetition
- Return ONLY the rewritten content`,
};

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Build the system and user prompts for a tactic-specific GEO rewrite.
 *
 * @param tactic  - The GEO tactic to optimise for
 * @param ctx     - Content context (full content + optional section to rewrite)
 * @returns { system, user } prompt pair for the AI provider
 */
export function buildTacticRewritePrompt(
  tactic: GEOTactic,
  ctx: RewritePromptContext
): { system: string; user: string } {
  const system = TACTIC_SYSTEM_PROMPTS[tactic];

  let user: string;

  if (ctx.section) {
    user = `FULL CONTENT (for context only — do not return this):
---
${ctx.content}
---

SECTION TO REWRITE (return only this section, improved for ${TACTIC_LABELS[tactic]}):
---
${ctx.section}
---`;
  } else {
    user = `Rewrite the following content to improve its ${TACTIC_LABELS[tactic]} score. Return only the rewritten content.

---
${ctx.content}
---`;
  }

  return { system, user };
}
