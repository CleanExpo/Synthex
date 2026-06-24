/**
 * HERMES author-input helpers (HER-7 / B-5 wiring)
 *
 * Pure helpers shared by the draft cron (which sends the author questions) and
 * the answer-intake endpoint (which finalises with the answers). Kept free of
 * IO so the decision/format/match logic is unit-tested without a DB or model.
 */

import type { AuthorQa } from '@/lib/hermes/generator/author-questions';

/** Metadata persisted on a HermesProposal that is awaiting the author's input. */
export interface AwaitingAuthorInputMetadata {
  stage: 'awaiting_author_input';
  authorQuestions: string[];
  topic: string;
  rationale: string;
  modelUsed?: string;
}

/** Read the per-org "author questions" opt-in flag from HermesConfig.metadata. */
export function isAuthorQuestionsEnabled(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  return (metadata as Record<string, unknown>).authorQuestions === true;
}

/** Format the Telegram message that surfaces the questions to the author. */
export function formatAuthorQuestionsMessage(
  topic: string,
  questions: string[],
  proposalId: string
): string {
  return [
    `HERMES drafted a post on "${topic}" and needs your input to make it authentic.`,
    '',
    'Please answer:',
    ...questions.map((q, i) => `${i + 1}. ${q}`),
    '',
    `Reply in the dashboard to finalise (proposal ${proposalId}).`,
  ].join('\n');
}

/**
 * Pair the author's answers (index-aligned to the stored questions) into
 * question/answer records, dropping any the author left blank.
 */
export function matchAnswersToQuestions(
  questions: string[],
  answers: string[]
): AuthorQa[] {
  const paired: AuthorQa[] = [];
  for (let i = 0; i < questions.length; i += 1) {
    const answer = (answers[i] ?? '').trim();
    if (answer.length === 0) continue;
    paired.push({ question: questions[i], answer });
  }
  return paired;
}

/** Defensively read the awaiting-input metadata persisted on a proposal. */
export function readAwaitingAuthorInputMetadata(
  metadata: unknown
): AwaitingAuthorInputMetadata | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  const questions = Array.isArray(m.authorQuestions)
    ? m.authorQuestions.filter((q): q is string => typeof q === 'string')
    : [];
  if (questions.length === 0) return null;
  if (typeof m.topic !== 'string' || typeof m.rationale !== 'string')
    return null;
  return {
    stage: 'awaiting_author_input',
    authorQuestions: questions,
    topic: m.topic,
    rationale: m.rationale,
    modelUsed: typeof m.modelUsed === 'string' ? m.modelUsed : undefined,
  };
}
