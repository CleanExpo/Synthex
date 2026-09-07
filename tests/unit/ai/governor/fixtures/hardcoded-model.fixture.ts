/**
 * SYN-1196 — NEGATIVE FIXTURE. This file deliberately contains hardcoded model
 * strings. It exists so governor-model-registry.test.ts can point the audit at
 * a scope that IS dirty and watch it exit 1.
 *
 * Without this, "the audit reports lib/ai/governor clean" would be a claim
 * about the tool as much as about the code — a matcher that finds nothing
 * anywhere returns exactly the same verdict as a genuinely clean path.
 *
 * DO NOT import this from product code, and do not "fix" the strings below:
 * they are the defect the control is calibrated against.
 */

export const HARDCODED_ANTHROPIC = 'claude-sonnet-5';
export const HARDCODED_OPENROUTER = 'anthropic/claude-haiku-4-5';
export const HARDCODED_OPENAI = 'gpt-4-o';
