/**
 * Platform-level AI provider key detection.
 *
 * Edge-safe (no DB/Node-only imports) — safe for middleware and route handlers.
 */
export function hasPlatformAIKey(): boolean {
  return !!(
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim()
  );
}
