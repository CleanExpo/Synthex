/**
 * Boardroom — multi-model triangulation
 *
 * A senior agency does not make important decisions with one voice. This module
 * runs the same prompt through N models in parallel and synthesises a single
 * answer with the panel's perspectives attached. When the panel disagrees
 * sharply, the synthesiser is escalated to a higher-tier model for tiebreak
 * reasoning.
 *
 * Sibling pattern to `.claude/review-board/` — that one triangulates *domain*
 * specialists; this one triangulates *model* lenses.
 *
 * Default panel for a Synthex strategic decision:
 *   [gemma4:e4b (local), deepseek-v4-flash (cheap cloud), sonnet (senior)]
 * Default synthesiser: sonnet → opus on high divergence.
 */

import { logger } from '@/lib/logger';
import { getAIProvider } from './providers';
import { OllamaProvider } from './providers/ollama-provider';
import type { AIProvider } from './providers/base-provider';
import type { ModelChoice } from './task-routing';

/**
 * Resolve a ProviderId to a concrete AIProvider instance.
 * Ollama is local (no key); cloud providers use platform env keys via the factory.
 */
function resolveProvider(providerId: ModelChoice['provider']): AIProvider {
  if (providerId === 'ollama') return new OllamaProvider();
  // For cloud providers we use the platform-key path. The factory's user-key
  // branch only triggers when apiKey is truthy; we want the cached singleton.
  // We temporarily flip AI_PROVIDER so the factory returns the right provider —
  // safe because the factory caches per-name.
  const previous = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = providerId;
  try {
    return getAIProvider();
  } finally {
    if (previous === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previous;
  }
}

export interface BoardroomQueryRequest {
  /** The prompt run through every panel member. */
  prompt: string;
  /** System prompt prepended to every panel call. Optional. */
  systemPrompt?: string;
  /** The N model lenses to consult. */
  panel: ModelChoice[];
  /** Synthesiser that produces the final answer (default Sonnet). */
  synthesiser?: ModelChoice;
  /** Escalate to opus if Jaccard similarity across the panel falls below this. */
  divergenceThreshold?: number;
  /** Tier to escalate to when divergence is high. Default opus. */
  escalation?: ModelChoice;
  /** Soft per-call temperature. */
  temperature?: number;
  /** Max tokens for any single panel/synthesiser call. */
  maxTokens?: number;
}

export interface PanelResponse {
  member: ModelChoice;
  content: string;
  ok: boolean;
  error?: string;
}

export interface BoardroomResponse {
  /** Synthesised final answer. */
  answer: string;
  /** Each panel member's raw output (or error). */
  panel: PanelResponse[];
  /** Jaccard similarity score across panel outputs (0..1). */
  agreement: number;
  /** True if escalation triggered due to disagreement. */
  escalated: boolean;
  /** Which model produced the synthesised `answer`. */
  synthesisedBy: ModelChoice;
}

const DEFAULT_DIVERGENCE_THRESHOLD = 0.35;

/** Light stem-tokenise: lowercase, strip punctuation, drop short words. */
function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 3),
  );
}

/** Average Jaccard similarity across all pairs in the panel (0..1). */
function panelAgreement(outputs: string[]): number {
  if (outputs.length < 2) return 1;
  const tokens = outputs.map(tokenise);
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i];
      const b = tokens[j];
      const intersection = new Set([...a].filter(x => b.has(x)));
      const union = new Set([...a, ...b]);
      const jaccard = union.size === 0 ? 0 : intersection.size / union.size;
      total += jaccard;
      pairs += 1;
    }
  }
  return pairs === 0 ? 1 : total / pairs;
}

/** Run a single ModelChoice through the provider factory. */
async function runOne(
  member: ModelChoice,
  prompt: string,
  systemPrompt?: string,
  temperature?: number,
  maxTokens?: number,
): Promise<PanelResponse> {
  try {
    const provider = resolveProvider(member.provider);
    const messages = systemPrompt
      ? [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: prompt },
        ]
      : [{ role: 'user' as const, content: prompt }];
    const res = await provider.complete({
      model: member.modelId,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
    return {
      member,
      content: res.choices[0]?.message?.content ?? '',
      ok: true,
    };
  } catch (err) {
    const e = err as Error;
    return {
      member,
      content: '',
      ok: false,
      error: e.message,
    };
  }
}

/**
 * Run a prompt through N model lenses, score divergence, and return a synthesis.
 */
export async function boardroomQuery(req: BoardroomQueryRequest): Promise<BoardroomResponse> {
  if (req.panel.length === 0) {
    throw new Error('boardroomQuery: panel must contain at least one model');
  }

  const synthesiser =
    req.synthesiser ?? {
      provider: 'openrouter',
      modelId: 'anthropic/claude-sonnet-4-6',
      estimatedCostPer1kOutput: 0.015,
      fallback: [],
      rationale: 'default synthesiser',
    };
  const escalation =
    req.escalation ?? {
      provider: 'openrouter',
      modelId: 'anthropic/claude-opus-4-7',
      estimatedCostPer1kOutput: 0.075,
      fallback: [],
      rationale: 'default escalation',
    };
  const threshold = req.divergenceThreshold ?? DEFAULT_DIVERGENCE_THRESHOLD;

  // 1. Run panel in parallel
  const settled = await Promise.allSettled(
    req.panel.map(m => runOne(m, req.prompt, req.systemPrompt, req.temperature, req.maxTokens)),
  );
  const panel: PanelResponse[] = settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : { member: req.panel[i], content: '', ok: false, error: String(s.reason) },
  );

  const okOutputs = panel.filter(p => p.ok && p.content).map(p => p.content);
  if (okOutputs.length === 0) {
    throw new Error('boardroomQuery: every panel member failed');
  }

  // 2. Score divergence
  const agreement = panelAgreement(okOutputs);
  const escalated = agreement < threshold;
  const synthBy = escalated ? escalation : synthesiser;

  // 3. Synthesise
  const synthesisPrompt = [
    'You are the boardroom synthesiser. Below are N independent perspectives on the same question.',
    'Produce one concise answer that integrates the strongest reasoning from each lens. Surface where',
    'the panel disagrees and explain which view should prevail and why.',
    '',
    `Question:\n${req.prompt}`,
    '',
    panel
      .filter(p => p.ok)
      .map((p, i) => `---\nLens ${i + 1} (${p.member.modelId}):\n${p.content}`)
      .join('\n\n'),
  ].join('\n');

  const synthResult = await runOne(synthBy, synthesisPrompt, req.systemPrompt, req.temperature, req.maxTokens);
  if (!synthResult.ok) {
    logger.warn('boardroom synthesiser failed; returning concatenated panel', {
      error: synthResult.error,
    });
    return {
      answer: okOutputs.join('\n\n---\n\n'),
      panel,
      agreement,
      escalated,
      synthesisedBy: synthBy,
    };
  }

  return {
    answer: synthResult.content,
    panel,
    agreement,
    escalated,
    synthesisedBy: synthBy,
  };
}

// Exported for tests
export const __test__ = { tokenise, panelAgreement };
