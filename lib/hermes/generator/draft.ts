/**
 * HERMES draft generator (SYN-912 / HER-1d)
 *
 * Assembles the system prompt for one draft generation:
 *   1. Read .claude/skills/senior-copywriter/SKILL.md raw (frontmatter included)
 *   2. Prepend lib/hermes/prompts/restoreassist-context.md
 *   3. Call Haiku 4.5 via routedCall with task type 'caption_generation'
 *
 * The skill is read raw with frontmatter intact — Haiku treats the YAML as
 * text and does not act on it. Stripping adds complexity for no gain. If
 * frontmatter ever causes observable output degradation in pilot review,
 * strip at that point with a one-line regex; do not pre-emptively engineer.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { routedCall } from '@/lib/ai/model-router';
import { logger } from '@/lib/logger';

const REPO_ROOT = process.cwd();
const SENIOR_COPYWRITER_PATH = path.join(
  REPO_ROOT,
  '.claude',
  'skills',
  'senior-copywriter',
  'SKILL.md'
);
const RESTOREASSIST_CONTEXT_PATH = path.join(
  REPO_ROOT,
  'lib',
  'hermes',
  'prompts',
  'restoreassist-context.md'
);

let cachedSystemPrompt: string | null = null;

/**
 * Build the assembled system prompt.
 *
 * Cached per-process — the files are bundled at deploy time and don't change
 * between requests within a single Vercel function instance. Cache invalidates
 * on cold-start (next deploy) automatically.
 */
async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;

  const [seniorCopywriter, restoreAssistContext] = await Promise.all([
    fs.readFile(SENIOR_COPYWRITER_PATH, 'utf8'),
    fs.readFile(RESTOREASSIST_CONTEXT_PATH, 'utf8'),
  ]);

  // restoreassist-context.md FIRST so the brand-specific rules frame the
  // senior-copywriter skill rather than vice versa.
  cachedSystemPrompt = `${restoreAssistContext}\n\n---\n\n${seniorCopywriter}`;
  return cachedSystemPrompt;
}

export interface DraftRequest {
  organizationId: string;
  topic: string;
  rationale: string;
  /** Optional brand-specific signals to inject into the user prompt. */
  signalSummary?: string;
}

export interface DraftResult {
  content: string;
  modelUsed: string;
  promptTokensEstimate: number;
}

/**
 * Generate one LinkedIn-format draft for a HERMES gap candidate.
 * Caller is responsible for passing the result to the voice gate.
 */
export async function generateDraft(req: DraftRequest): Promise<DraftResult> {
  const systemPrompt = await loadSystemPrompt();

  const userPrompt = [
    `Topic: ${req.topic}`,
    '',
    `Why this is a gap: ${req.rationale}`,
    req.signalSummary ? `\nUnderlying signals:\n${req.signalSummary}` : '',
    '',
    'Produce ONE LinkedIn post following the rules above. Plain text only.',
    'No headers, no markdown decorations, no preamble such as "Here is the post".',
    'Maximum 3 hashtags at the end if appropriate.',
  ]
    .filter(Boolean)
    .join('\n');

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
      runId: `hermes-draft-${Date.now()}`,
    },
    execute: async (modelId: string) => {
      modelUsed = modelId;
      const { AnthropicProvider } = await import(
        '@/lib/ai/providers/anthropic-provider'
      );
      const provider = new AnthropicProvider();
      const response = await provider.complete({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.7,
      });
      const text = response.choices[0]?.message?.content?.trim() ?? '';
      if (!text) throw new Error('Empty draft response from Haiku');
      return text;
    },
  });

  logger.info('[hermes:draft] generated', {
    orgId: req.organizationId,
    topic: req.topic,
    model: modelUsed,
    contentChars: content.length,
  });

  return {
    content,
    modelUsed,
    promptTokensEstimate: inputTokenEstimate,
  };
}
