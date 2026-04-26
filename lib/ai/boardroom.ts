/**
 * Boardroom — multi-model synthesis — SYN-807 Phase 2
 *
 * A senior agency does not make important decisions with one voice. This
 * module runs the same prompt through N models in parallel and synthesises
 * a single answer that carries each panellist's perspective.
 *
 * Use it for:
 *   - Brand voice and creative critique (Claude says X; Gemma says Y; what
 *     do we ship?)
 *   - Architecture decisions where we want junior + mid + senior takes
 *   - High-stakes recommendations where divergence between models is itself
 *     a useful signal (if all three agree, ship; if they disagree, escalate)
 *
 * Cost discipline: panel calls run in parallel via `Promise.allSettled`.
 * One slow / failed panellist does not block the synthesis. Default panel
 * carries one local Gemma 4 ($0), one DeepSeek V4 Flash (~$0.0003/call),
 * and one Claude Sonnet (~$0.015/call) — total typical cost <$0.02 per
 * decision.
 *
 * Divergence handling: a Jaccard similarity is computed over stem-tokenised
 * panel outputs. If pairwise similarity falls below `divergenceThreshold`,
 * the synthesiser is escalated to the next-tier model (default: Sonnet →
 * Opus) for tiebreaker reasoning. The escalation marker is surfaced in
 * the response so callers can log it to the cost ledger.
 */

import type { AIProvider as ModelProviderName } from './model-registry';
import type {
  AIMessage,
  AICompletionRequest,
  AIProvider,
} from './providers/base-provider';
import { getAIProvider, OllamaUnavailableError } from './providers';
import { logger } from '@/lib/logger';

/**
 * Provider names the boardroom can call. Drops `'openai'` from the wider
 * registry union because there is no `OpenAIProvider` in the factory —
 * Synthex routes OpenAI access through OpenRouter instead.
 */
export type BoardroomProviderName = Exclude<ModelProviderName, 'openai'>;

/** A single panellist seat. Matches the shape used in `lib/ai/task-routing.ts`. */
export interface BoardroomPanellist {
  provider: BoardroomProviderName;
  modelId: string;
}

export interface BoardroomQueryRequest {
  /** The prompt every panellist receives. Identical input → comparable outputs. */
  prompt: string;
  /** Optional system prompt prepended to every panellist call. */
  systemPrompt?: string;
  /** The panel — typically 2–4 models drawn from different providers. */
  panel: BoardroomPanellist[];
  /**
   * Synthesiser that combines the panel's outputs into a final answer.
   * Defaults to Claude Sonnet 4.6 via OpenRouter. The synthesiser sees
   * each panellist's verbatim response, attributed by model id.
   */
  synthesiser?: BoardroomPanellist;
  /**
   * Pairwise Jaccard similarity below this threshold flags divergence
   * and triggers escalation to a higher-tier synthesiser. Range 0–1.
   * Default: 0.25 (low threshold; treats most answers as "in agreement").
   */
  divergenceThreshold?: number;
  /**
   * Higher-tier synthesiser invoked when divergence is detected. Defaults
   * to Claude Opus 4.6 via OpenRouter.
   */
  escalationSynthesiser?: BoardroomPanellist;
  /** Per-call max output tokens for each panellist. Default: 800. */
  maxTokensPerPanellist?: number;
  /** Per-call max output tokens for the synthesiser. Default: 1200. */
  maxTokensSynthesiser?: number;
}

export interface PanellistOutcome {
  panellist: BoardroomPanellist;
  /** Raw response text. `null` when the panellist failed. */
  response: string | null;
  /** Model-reported token usage (when available). */
  tokensIn?: number;
  tokensOut?: number;
  /** Wall-clock latency in milliseconds. */
  latencyMs: number;
  /** Populated when `response === null`. */
  error?: { name: string; message: string };
}

export interface BoardroomQueryResponse {
  /** The synthesised final answer the caller should ship. */
  answer: string;
  /** The synthesiser model that produced `answer`. */
  synthesiserUsed: BoardroomPanellist;
  /** Each panellist's verbatim response (or error). */
  panel: PanellistOutcome[];
  /** Lowest pairwise Jaccard similarity across the successful panellists. */
  minPairwiseSimilarity: number;
  /** True when divergence triggered the escalation path. */
  escalated: boolean;
  /** Number of panellists that returned a response. */
  successfulPanellists: number;
}

const DEFAULT_SYNTHESISER: BoardroomPanellist = {
  provider: 'openrouter',
  modelId: 'anthropic/claude-sonnet-4-6',
};

const DEFAULT_ESCALATION_SYNTHESISER: BoardroomPanellist = {
  provider: 'openrouter',
  modelId: 'anthropic/claude-opus-4-6',
};

/**
 * Run a multi-model boardroom query.
 *
 * Algorithm:
 *   1. Fan out the same prompt to every panellist (Promise.allSettled).
 *   2. Compute pairwise Jaccard similarity over stem-tokenised outputs.
 *   3. If similarity falls below threshold → escalation synthesiser.
 *   4. Synthesise a single answer; attribute each panellist's contribution.
 */
export async function boardroomQuery(
  request: BoardroomQueryRequest
): Promise<BoardroomQueryResponse> {
  const {
    prompt,
    systemPrompt,
    panel,
    synthesiser = DEFAULT_SYNTHESISER,
    divergenceThreshold = 0.25,
    escalationSynthesiser = DEFAULT_ESCALATION_SYNTHESISER,
    maxTokensPerPanellist = 800,
    maxTokensSynthesiser = 1200,
  } = request;

  if (!panel || panel.length < 2) {
    throw new Error(
      'Boardroom needs at least two panellists; got ' + (panel?.length ?? 0)
    );
  }

  // ── Phase 1: fan out ────────────────────────────────────────────
  const panelOutcomes = await Promise.all(
    panel.map(p =>
      callPanellist(p, prompt, systemPrompt, maxTokensPerPanellist)
    )
  );

  const successful = panelOutcomes.filter(o => o.response !== null);
  if (successful.length === 0) {
    throw new Error(
      'Boardroom query failed: no panellists returned a response'
    );
  }

  // ── Phase 2: divergence scoring ─────────────────────────────────
  const minSimilarity = computeMinPairwiseJaccard(
    successful.map(o => o.response as string)
  );
  const diverged = minSimilarity < divergenceThreshold;

  // ── Phase 3: synthesise ─────────────────────────────────────────
  const synth = diverged ? escalationSynthesiser : synthesiser;
  const answer = await synthesisePanel(
    panelOutcomes,
    prompt,
    synth,
    maxTokensSynthesiser
  );

  return {
    answer,
    synthesiserUsed: synth,
    panel: panelOutcomes,
    minPairwiseSimilarity: minSimilarity,
    escalated: diverged,
    successfulPanellists: successful.length,
  };
}

/** Invoke a single panellist with isolated error handling. */
async function callPanellist(
  panellist: BoardroomPanellist,
  prompt: string,
  systemPrompt: string | undefined,
  maxTokens: number
): Promise<PanellistOutcome> {
  const startedAt = Date.now();
  try {
    const provider: AIProvider = getAIProvider({
      apiKey: 'unused',
      provider: panellist.provider,
    });
    const messages: AIMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const req: AICompletionRequest = {
      model: panellist.modelId,
      messages,
      max_tokens: maxTokens,
    };

    const res = await provider.complete(req);
    const text = res.choices[0]?.message?.content ?? '';

    return {
      panellist,
      response: text,
      tokensIn: res.usage?.prompt_tokens,
      tokensOut: res.usage?.completion_tokens,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const isOllamaDown = error instanceof OllamaUnavailableError;
    if (isOllamaDown) {
      logger.info('Boardroom panellist skipped — Ollama unavailable', {
        panellist,
      });
    } else {
      logger.warn('Boardroom panellist failed', { panellist, error });
    }
    return {
      panellist,
      response: null,
      latencyMs: Date.now() - startedAt,
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/** Ask the synthesiser to combine the panel's perspectives. */
async function synthesisePanel(
  outcomes: PanellistOutcome[],
  originalPrompt: string,
  synthesiser: BoardroomPanellist,
  maxTokens: number
): Promise<string> {
  const successful = outcomes.filter(o => o.response !== null);

  const transcript = successful
    .map((o, i) => {
      const id = `${o.panellist.provider}/${o.panellist.modelId}`;
      return `### Panellist ${i + 1} — ${id}\n${o.response}`;
    })
    .join('\n\n---\n\n');

  const synthesisPrompt = `You are a senior moderator synthesising a boardroom discussion.

The original question was:

${originalPrompt}

The panel returned the following responses:

${transcript}

Produce a single recommended answer that:
1. Captures any consensus across the panel.
2. Explicitly notes any meaningful disagreements and which panellist held which view.
3. Resolves the disagreement with reasoning — do not just average the answers.
4. Returns the resolved answer in the form the original question requires.

Do not add filler. Do not begin with "Based on" or "Looking at". Begin with the answer.`;

  const provider = getAIProvider({
    apiKey: 'unused',
    provider: synthesiser.provider,
  });
  const res = await provider.complete({
    model: synthesiser.modelId,
    messages: [{ role: 'user', content: synthesisPrompt }],
    max_tokens: maxTokens,
  });

  return res.choices[0]?.message?.content ?? '';
}

/** Stem-tokenise: lowercase, strip punctuation, split, drop common stopwords. */
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'should',
  'could',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'with',
  'by',
  'from',
  'as',
  'into',
  'this',
  'that',
  'these',
  'those',
  'i',
  'we',
  'you',
  'they',
  'it',
  'he',
  'she',
  'his',
  'her',
  'their',
  'our',
  'your',
  'my',
  'me',
  'us',
  'them',
  'so',
  'if',
  'then',
  'than',
  'just',
  'also',
  'only',
  'very',
  'too',
  'not',
  'no',
  'yes',
]);

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOPWORDS.has(t))
  );
}

/** Jaccard similarity between two stem-tokenised sets. Range 0–1. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

/**
 * Compute the lowest pairwise Jaccard similarity across all successful
 * panellists. Returns 1 when only one or zero panellists responded
 * (nothing to disagree with).
 */
export function computeMinPairwiseJaccard(responses: string[]): number {
  if (responses.length < 2) return 1;
  const sets = responses.map(tokenise);
  let min = 1;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const setI = sets[i];
      const setJ = sets[j];
      if (!setI || !setJ) continue;
      const sim = jaccard(setI, setJ);
      if (sim < min) min = sim;
    }
  }
  return min;
}

/** Re-export for tests / external callers that want to tokenise directly. */
export const __testing = { tokenise, jaccard };
