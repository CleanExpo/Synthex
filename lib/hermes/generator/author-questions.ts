/**
 * HERMES author-questions generator (HER-7 / B-5)
 *
 * The "draft-then-ask-the-author-questions" human-in-the-loop step.
 *
 * Instead of generating a finished post in one shot (see generateDraft), this
 * produces an INITIAL draft plus 2-3 targeted questions that elicit the
 * author's lived experience. The questions are delivered to the author (out of
 * band — e.g. Telegram); their answers are then woven into a final draft via
 * finaliseDraftWithAnswers. Injecting real first-hand experience is what makes
 * the content genuinely good rather than generically competent.
 *
 * The prompt-building and parsing are pure functions so the model-dependent
 * behaviour is fully unit-testable without a live model call.
 */

import { routedCall } from '@/lib/ai/model-router';
import { logger } from '@/lib/logger';
import {
  loadSystemPrompt,
  type DraftRequest,
  type DraftResult,
} from '@/lib/hermes/generator/draft';

/** Maximum questions surfaced to the author. Keeps the ask short and answerable. */
export const MAX_AUTHOR_QUESTIONS = 3;

export interface DraftWithQuestionsResult {
  /** The initial (incomplete) draft, before the author's experience is woven in. */
  draft: string;
  /** 2-3 targeted questions for the author. */
  questions: string[];
  modelUsed: string;
  promptTokensEstimate: number;
}

export interface AuthorQa {
  question: string;
  answer: string;
}

// ---------------------------------------------------------------------------
// Pure helpers (no IO) — the testable seam.
// ---------------------------------------------------------------------------

/** Build the user prompt that asks the model for a draft + author questions. */
export function buildQuestionsPrompt(req: DraftRequest): string {
  return [
    `Topic: ${req.topic}`,
    '',
    `Why this is a gap: ${req.rationale}`,
    req.signalSummary ? `\nUnderlying signals:\n${req.signalSummary}` : '',
    '',
    'Write an INITIAL LinkedIn post draft on this topic following the rules above,',
    `then list ${MAX_AUTHOR_QUESTIONS} specific questions that would let the author`,
    'add their own first-hand experience, opinion, or a concrete example — the kind',
    'of detail only someone who has actually done this work would know. Ask about',
    'specifics (a real situation, a number, a mistake, a result), never generic',
    'questions like "what is your goal?".',
    '',
    'Respond with STRICT JSON only, no markdown fences, in exactly this shape:',
    '{"draft": "<the initial post as plain text>", "questions": ["<q1>", "<q2>", "<q3>"]}',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Build the user prompt that finalises a draft using the author's answers. */
export function buildFinalisePrompt(
  req: DraftRequest,
  draft: string,
  qa: AuthorQa[]
): string {
  const answered = qa.filter(p => p.answer.trim().length > 0);
  const qaBlock = answered
    .map((p, i) => `${i + 1}. Q: ${p.question}\n   A: ${p.answer.trim()}`)
    .join('\n');

  return [
    `Topic: ${req.topic}`,
    '',
    'Here is the initial draft:',
    '"""',
    draft,
    '"""',
    '',
    "Here are the author's answers to the clarifying questions:",
    qaBlock,
    '',
    "Rewrite the post to weave in the author's specific experience and examples",
    'from the answers above. Keep their authentic voice — do not generalise the',
    'concrete details back into vague claims. Follow all the rules above.',
    'Plain text only. No headers, no markdown decorations, no preamble such as',
    '"Here is the post". Maximum 3 hashtags at the end if appropriate.',
  ].join('\n');
}

/** Parse the model's JSON response into a draft + questions, defensively. */
export function parseDraftAndQuestions(raw: string): {
  draft: string;
  questions: string[];
} {
  // Strip an optional ```json ... ``` fence the model may add despite instructions.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('hermes author-questions: model did not return valid JSON');
  }

  const obj = parsed as { draft?: unknown; questions?: unknown };
  const draft = typeof obj.draft === 'string' ? obj.draft.trim() : '';
  const questions = Array.isArray(obj.questions)
    ? obj.questions
        .filter(
          (q): q is string => typeof q === 'string' && q.trim().length > 0
        )
        .map(q => q.trim())
    : [];

  if (!draft)
    throw new Error('hermes author-questions: missing draft in model response');
  if (questions.length === 0)
    throw new Error('hermes author-questions: no questions in model response');

  return { draft, questions: questions.slice(0, MAX_AUTHOR_QUESTIONS) };
}

// ---------------------------------------------------------------------------
// Async functions (compose the pure helpers + the routed model call).
// ---------------------------------------------------------------------------

/**
 * Generate an initial draft plus targeted questions for the author.
 * Caller persists the questions and surfaces them to the author (Telegram).
 */
export async function generateDraftWithQuestions(
  req: DraftRequest
): Promise<DraftWithQuestionsResult> {
  const systemPrompt = await loadSystemPrompt();
  const userPrompt = buildQuestionsPrompt(req);
  const inputTokenEstimate = Math.ceil(
    (systemPrompt.length + userPrompt.length) / 4
  );

  let modelUsed = '';
  const raw = await routedCall<string>({
    task: {
      taskType: 'caption_generation',
      inputTokenEstimate,
      qualityThreshold: 'medium',
      clientId: req.organizationId,
      runId: `hermes-draft-questions-${Date.now()}`,
    },
    execute: async (modelId: string) => {
      modelUsed = modelId;
      const { AnthropicProvider } =
        await import('@/lib/ai/providers/anthropic-provider');
      const provider = new AnthropicProvider();
      const response = await provider.complete({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 900,
        temperature: 0.7,
      });
      const text = response.choices[0]?.message?.content?.trim() ?? '';
      if (!text)
        throw new Error('Empty draft-with-questions response from Haiku');
      return text;
    },
  });

  const { draft, questions } = parseDraftAndQuestions(raw);

  logger.info('[hermes:author-questions] generated', {
    orgId: req.organizationId,
    topic: req.topic,
    model: modelUsed,
    questionCount: questions.length,
  });

  return {
    draft,
    questions,
    modelUsed,
    promptTokensEstimate: inputTokenEstimate,
  };
}

/**
 * Finalise a draft by weaving in the author's answers.
 * Result is passed to the existing voice gate, same as generateDraft output.
 */
export async function finaliseDraftWithAnswers(
  req: DraftRequest,
  draft: string,
  qa: AuthorQa[]
): Promise<DraftResult> {
  if (qa.filter(p => p.answer.trim().length > 0).length === 0) {
    throw new Error(
      'hermes author-questions: no answered questions to finalise with'
    );
  }

  const systemPrompt = await loadSystemPrompt();
  const userPrompt = buildFinalisePrompt(req, draft, qa);
  const inputTokenEstimate = Math.ceil(
    (systemPrompt.length + userPrompt.length) / 4
  );

  let modelUsed = '';
  const content = await routedCall<string>({
    task: {
      taskType: 'caption_generation',
      inputTokenEstimate,
      qualityThreshold: 'medium',
      clientId: req.organizationId,
      runId: `hermes-draft-finalise-${Date.now()}`,
    },
    execute: async (modelId: string) => {
      modelUsed = modelId;
      const { AnthropicProvider } =
        await import('@/lib/ai/providers/anthropic-provider');
      const provider = new AnthropicProvider();
      const response = await provider.complete({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 900,
        temperature: 0.7,
      });
      const text = response.choices[0]?.message?.content?.trim() ?? '';
      if (!text) throw new Error('Empty finalised-draft response from Haiku');
      return text;
    },
  });

  logger.info('[hermes:author-questions] finalised', {
    orgId: req.organizationId,
    topic: req.topic,
    model: modelUsed,
    contentChars: content.length,
  });

  return { content, modelUsed, promptTokensEstimate: inputTokenEstimate };
}
