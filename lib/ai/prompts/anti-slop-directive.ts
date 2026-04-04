/**
 * Anti-AI-Slop Directive — lib/ai/prompts/anti-slop-directive.ts
 *
 * Universal writing quality rules injected into every AI system prompt.
 * Designed to be appended (default) or prepended to any existing prompt.
 *
 * Three export types:
 *  1. ANTI_SLOP_DIRECTIVE — the raw directive string (~450 tokens)
 *  2. withAntiSlop()       — wraps an existing prompt with the directive
 *  3. ANTI_SLOP_BANNED     — compact comma-separated banned phrase list
 *
 * @task SYN-571
 */

// ---------------------------------------------------------------------------
// Banned phrases — compact list for efficient LLM scanning
// ---------------------------------------------------------------------------

export const ANTI_SLOP_BANNED = [
  // Overused LLM vocabulary
  'delve',
  'robust',
  'leverage',
  'foster',
  'seamlessly',
  'tapestry',
  'nuanced',
  'multifaceted',
  'pivotal',
  'paramount',
  'cutting-edge',
  'game-changer',
  'innovative',
  'comprehensive',
  'dynamic',
  'enhance',
  // Video-sourced (Leila Hormozi memo, SYN-567)
  'embarked',
  'invaluable',
  'relentless',
  'groundbreaking',
  'endeavour',
  'enlighten',
  'esteemed',
  'shed light',
  'treasure trove',
  'testament',
  'pertinent',
  'synergy',
  'underscores',
  'navigate the complexities',
  'ever-changing landscape',
  'deep understanding',
  'intricate',
  'crucial',
  'elevate',
  'resonate',
  'offerings',
  'streamlined',
  // Corporate therapist voice
  'lean into',
  'foster a culture of',
  'powerful opportunity',
  'resilient and agile',
  'holistic approach',
  'empower',
  'unleash',
  'unlock potential',
  // Lazy transitions
  'in conclusion',
  'in summary',
  'furthermore',
  'moreover',
  'additionally',
  'it should be noted',
  'needless to say',
  // Filler
  "it's important to note",
  "it's worth noting",
  'as you can see',
  // Structural
  "in today's fast-paced world",
  'as we navigate',
  'in the ever-evolving',
  'not only... but also',
  // Neat-bow conclusions
  'ultimately the goal is',
  'at the end of the day',
  'moving forward',
  'in an ever-changing',
].join(', ');

// ---------------------------------------------------------------------------
// The directive
// ---------------------------------------------------------------------------

export const ANTI_SLOP_DIRECTIVE = `
--- WRITING QUALITY RULES (apply to all text output) ---

VOICE: Write like a human. Keep it professional but conversational. Be clear, direct, and natural — like writing to a smart friend. Use Australian English (colour, organise, recognise, licence, centre, travelled).

BANNED PHRASES (never use these): ${ANTI_SLOP_BANNED}

BANNED STRUCTURAL PATTERNS:
- Do not open paragraphs with transition words (moreover, furthermore, additionally, that said, importantly). Vary your openings.
- Do not use bold-word-colon bullet lists (**Clarity:** Ensure...). Vary bullet formatting.
- Do not use em-dashes (\u2014). Use full stops, commas, or restructure instead.
- Do not wrap up with generic conclusions that could apply to any company. End with a specific next step or concrete takeaway.
- Do not use "not X, but Y" forced negation framing. State what it IS directly.
- Do not open with throat-clearing ("It's important to note that...", "As we all know..."). Start with the actual point.

INSTEAD:
- Start each paragraph with the actual point, not a transition word.
- Replace superlatives with specific numbers or evidence.
- Vary sentence length (mix short punchy sentences with longer ones).
- Use "you/your" language where appropriate.
- If recommending an action, name the action and the expected benefit.
- Read it back: if a paragraph sounds smart but you cannot summarise its point in one plain sentence, delete it.

--- END WRITING QUALITY RULES ---
`.trim();

// ---------------------------------------------------------------------------
// Helper — wraps any existing system prompt with the directive
// ---------------------------------------------------------------------------

/**
 * Append (default) or prepend the anti-slop directive to a system prompt.
 *
 * Use `'append'` (default) when the module has structural requirements
 * (JSON output format, content type constraints) that must come first.
 * Use `'prepend'` when voice quality should take highest priority.
 */
export function withAntiSlop(
  existingPrompt: string,
  position: 'prepend' | 'append' = 'append'
): string {
  if (position === 'prepend') {
    return `${ANTI_SLOP_DIRECTIVE}\n\n${existingPrompt}`;
  }
  return `${existingPrompt}\n\n${ANTI_SLOP_DIRECTIVE}`;
}
