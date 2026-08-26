/**
 * MiniMax API Client � Anthropic-compatible with prompt caching
 *
 * Wraps the @anthropic-ai/sdk pointed at https://api.minimax.io/anthropic
 * with three credit-protection layers:
 *
 *   1. Pre-call cost estimation + budget reserve via credit-guard.ts
 *   2. Prompt cache reuse (5-min TTL, automatic refresh on hit)
 *   3. Post-call actual-cost commit (refunds over-estimation)
 *
 * Supports:
 *   - All M-series models (M3, M2.7/M2.7-highspeed, M2.5 family, M2.1 family, M2)
 *   - Interleaved thinking (M3) with reasoning_split
 *   - Tool use / function calling
 *   - Streaming responses
 *   - Vision (images) + video input (M3 only)
 *   - Server tools: web_search (M3 only, Anthropic API)
 *
 * Environment variables:
 *   MINIMAX_API_KEY     Anthropic-format subscription key (starts with sk-cp-)
 *   MINIMAX_MONTHLY_CEILING_USD   Optional monthly USD cap (default 50)
 *   MINIMAX_DAILY_CEILING_USD     Optional daily USD cap
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import {
  PRICING,
  computeCallCostUsd,
  type MiniMaxModelId,
  type ServiceTier,
} from './pricing';
import { creditGuard, MiniMaxCreditExceededError } from './credit-guard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MiniMaxContentPart =
  | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
  | {
      type: 'image';
      source:
        | { type: 'base64'; media_type: string; data: string }
        | { type: 'url'; url: string };
    }
  | {
      type: 'video';
      source:
        | { type: 'base64'; media_type: string; data: string }
        | { type: 'url'; url: string }
        | { type: 'mm_file'; file_id: string };
    }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string | MiniMaxContentPart[];
    };

export interface MiniMaxMessage {
  role: 'user' | 'assistant';
  content: string | MiniMaxContentPart[];
}

export interface MiniMaxTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface MiniMaxCallOptions {
  model?: MiniMaxModelId;
  system?: string | MiniMaxContentPart[];
  messages: MiniMaxMessage[];
  tools?: MiniMaxTool[];
  /** Max tokens to generate. M3 default 131072, others 65536. */
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  /** Disable thinking for M3. Ignored for M2.x (thinking always on). */
  disableThinking?: boolean;
  /** Use reasoning_split format (separates thinking from content). Default true. */
  reasoningSplit?: boolean;
  stream?: boolean;
  serviceTier?: ServiceTier;
  /** Skip credit guard (admin/internal only). */
  skipBudgetCheck?: boolean;
  /** Override ceiling for this single call (USD). */
  budgetOverrideUsd?: number;
}

export interface MiniMaxUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  estimatedCostUsd: number;
  actualCostUsd: number;
  model: MiniMaxModelId;
}

export interface MiniMaxResponse {
  id: string;
  model: MiniMaxModelId;
  content: MiniMaxContentPart[];
  /** Only present when reasoningSplit=true */
  reasoningDetails?: Array<{ type: string; text: string }>;
  stopReason: string | null;
  usage: MiniMaxUsage;
}

export interface MiniMaxStreamEvent {
  type:
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'message_delta'
    | 'message_stop'
    | 'thinking_delta'
    | 'text_delta'
    | 'error';
  data: unknown;
}

// ---------------------------------------------------------------------------
// Client (singleton)
// ---------------------------------------------------------------------------

const BASE_URL = 'https://api.minimax.io/anthropic';
const DEFAULT_MODEL: MiniMaxModelId = 'MiniMax-M3';

let _client: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_client) {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      throw new Error(
        'MINIMAX_API_KEY is not set. Get one from https://platform.minimax.io/user-center/basic-information/interface-key'
      );
    }
    _client = new Anthropic({ baseURL: BASE_URL, apiKey });
  }
  return _client;
}

export function resetMiniMaxClient(): void {
  _client = null;
}

// ---------------------------------------------------------------------------
// Message conversion (ours ? Anthropic SDK)
// ---------------------------------------------------------------------------

function convertMessage(m: MiniMaxMessage): Anthropic.Messages.MessageParam {
  if (typeof m.content === 'string') {
    return { role: m.role, content: m.content };
  }
  const blocks: Anthropic.Messages.ContentBlockParam[] = m.content.map(part => {
    switch (part.type) {
      case 'text':
        return part.cache_control
          ? { type: 'text', text: part.text, cache_control: part.cache_control }
          : { type: 'text', text: part.text };
      case 'image':
        return {
          type: 'image',
          source: part.source as Anthropic.Messages.ImageBlockParam['source'],
        };
      case 'video':
        // Anthropic-compatible video: same source structure as image for URL/base64,
        // or mm_file reference
        if (part.source.type === 'mm_file') {
          // Custom: pass as a tool_use-compatible block? No, instead use a tagged source
          return {
            type: 'document' as any,
            source: { type: 'url', url: `mm_file://${part.source.file_id}` },
          } as any;
        }
        return { type: 'video' as any, source: part.source } as any;
      case 'tool_use':
        return {
          type: 'tool_use',
          id: part.id,
          name: part.name,
          input: part.input as Anthropic.Messages.ToolUseBlockParam['input'],
        };
      case 'tool_result':
        return {
          type: 'tool_result',
          tool_use_id: part.tool_use_id,
          content:
            part.content as Anthropic.Messages.ToolResultBlockParam['content'],
        };
      default:
        throw new Error(`Unsupported content part type: ${(part as any).type}`);
    }
  });
  return { role: m.role, content: blocks };
}

function convertSystem(
  sys: string | MiniMaxContentPart[] | undefined
): string | Anthropic.Messages.TextBlockParam[] | undefined {
  if (sys === undefined) return undefined;
  if (typeof sys === 'string') return sys;
  return sys
    .filter(p => p.type === 'text')
    .map(p => {
      const tp = p as Extract<MiniMaxContentPart, { type: 'text' }>;
      return tp.cache_control
        ? {
            type: 'text' as const,
            text: tp.text,
            cache_control: tp.cache_control,
          }
        : { type: 'text' as const, text: tp.text };
    });
}

function convertTools(
  tools?: MiniMaxTool[]
): Anthropic.Messages.Tool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Messages.Tool.InputSchema,
  }));
}

// ---------------------------------------------------------------------------
// Token estimation (rough)
// ---------------------------------------------------------------------------

/**
 * Rough pre-call token estimation. Useful for budgeting before the call.
 * Real tokens may differ by 10�20%; the actual cost is computed from API usage.
 *
 * Rules of thumb:
 *   - English text: 1 token � 4 chars
 *   - JSON: 1 token � 3�4 chars
 *   - Images (default detail): ~1000�3000 tokens each
 *   - Video: ~1000 tokens per minute
 */
export function estimateInputTokens(opts: {
  system?: string | MiniMaxContentPart[];
  messages: MiniMaxMessage[];
  tools?: MiniMaxTool[];
}): { inputTokens: number; outputTokens: number } {
  let chars = 0;
  if (opts.system) {
    chars +=
      typeof opts.system === 'string'
        ? opts.system.length
        : JSON.stringify(opts.system).length;
  }
  for (const m of opts.messages) {
    if (typeof m.content === 'string') {
      chars += m.content.length;
    } else {
      for (const p of m.content) {
        if (p.type === 'text') chars += p.text.length;
        else if (p.type === 'image')
          chars += 2000; // rough default-detail image estimate
        else if (p.type === 'video')
          chars += 60_000; // rough 1-min video
        else chars += 200; // tool_use/tool_result overhead
      }
    }
  }
  if (opts.tools) chars += JSON.stringify(opts.tools).length;
  const inputTokens = Math.ceil(chars / 4);
  return { inputTokens, outputTokens: 0 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Make a non-streaming MiniMax call.
 *
 * Lifecycle:
 *   1. Estimate cost from input size (chars/4)
 *   2. Reserve against monthly budget (Redis Lua atomic)
 *   3. Call MiniMax API
 *   4. On success: commit actual cost (refund over-estimation)
 *   5. On failure: release reservation
 *   6. Always: log usage to local file + emit metrics
 */
export async function callMiniMax(
  opts: MiniMaxCallOptions
): Promise<MiniMaxResponse> {
  const model = opts.model ?? DEFAULT_MODEL;
  const tier = opts.serviceTier ?? 'standard';
  const reasoningSplit = opts.reasoningSplit ?? true;

  // Step 1: estimate
  const est = estimateInputTokens({
    system: opts.system,
    messages: opts.messages,
    tools: opts.tools,
  });
  const expectedMaxOut = opts.maxTokens ?? 4096;
  const estimatedCostUsd = computeCallCostUsd(
    model,
    est.inputTokens,
    expectedMaxOut,
    0,
    tier
  );

  // Step 2: reserve
  let reservation: Awaited<ReturnType<typeof creditGuard.reserve>> | null =
    null;
  if (!opts.skipBudgetCheck) {
    try {
      reservation = await creditGuard.reserve({
        model,
        inputTokens: est.inputTokens,
        outputTokens: expectedMaxOut,
        cacheReadTokens: 0,
        tier,
      });
    } catch (e) {
      if (e instanceof MiniMaxCreditExceededError) {
        logger.error('MiniMax call blocked: budget exceeded', {
          window: e.window,
          spent: e.spentUsd,
          reserved: e.reservedUsd,
          attempted: e.attemptedUsd,
          ceiling: e.ceilingUsd,
        });
        throw e;
      }
      throw e;
    }
  }

  // Step 3: call
  try {
    const anthropic = getAnthropic();
    const params: Anthropic.Messages.MessageCreateParams = {
      model,
      max_tokens: opts.maxTokens ?? (model === 'MiniMax-M3' ? 131072 : 65536),
      messages: opts.messages.map(convertMessage),
      ...(convertSystem(opts.system) !== undefined
        ? { system: convertSystem(opts.system)! }
        : {}),
      ...(convertTools(opts.tools) ? { tools: convertTools(opts.tools) } : {}),
      ...(opts.temperature !== undefined
        ? { temperature: opts.temperature }
        : {}),
      ...(opts.topP !== undefined ? { top_p: opts.topP } : {}),
      ...(model === 'MiniMax-M3'
        ? {
            thinking: opts.disableThinking
              ? { type: 'disabled' }
              : { type: 'adaptive' },
          }
        : {}),
    };

    const response = await anthropic.messages.create(params);

    // Step 4: compute actual cost
    const usage = response.usage;
    const cacheRead = (usage as any).cache_read_input_tokens ?? 0;
    const actualCostUsd = computeCallCostUsd(
      model,
      usage.input_tokens,
      usage.output_tokens,
      cacheRead,
      tier
    );

    // Step 5: commit
    if (reservation) await reservation.commit(actualCostUsd);

    // Convert content blocks
    const content: MiniMaxContentPart[] = response.content.map(b => {
      if (b.type === 'text') return { type: 'text', text: b.text };
      if (b.type === 'thinking')
        return { type: 'text' as any, text: (b as any).thinking ?? '' } as any;
      if (b.type === 'tool_use')
        return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
      return { type: 'text' as any, text: '' } as any;
    });

    const result: MiniMaxResponse = {
      id: response.id,
      model: model as MiniMaxModelId,
      content,
      stopReason: response.stop_reason,
      usage: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: cacheRead,
        cacheCreationTokens: (usage as any).cache_creation_input_tokens ?? 0,
        estimatedCostUsd,
        actualCostUsd,
        model,
      },
    };

    if (reasoningSplit) {
      result.reasoningDetails = content
        .filter(
          b =>
            (b as any).type === 'text' &&
            (b as any).text.startsWith?.('<think>')
        )
        .map(b => ({ type: 'thinking', text: (b as any).text }));
    }

    logger.info('MiniMax call complete', {
      model,
      tier,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheRead,
      estimatedCostUsd,
      actualCostUsd,
      savingsVsEstimate: estimatedCostUsd - actualCostUsd,
    });

    return result;
  } catch (e) {
    // Release reservation on failure
    if (reservation) await reservation.release();
    logger.error('MiniMax call failed', {
      model,
      error: e instanceof Error ? e.message : String(e),
      reservedUsd: reservation?.usd,
    });
    throw e;
  }
}

/**
 * Streaming variant � emits events as content deltas arrive.
 * Reservation is committed on stream completion based on final usage.
 */
export async function* streamMiniMax(
  opts: MiniMaxCallOptions
): AsyncGenerator<MiniMaxStreamEvent, MiniMaxUsage, undefined> {
  const model = opts.model ?? DEFAULT_MODEL;
  const tier = opts.serviceTier ?? 'standard';

  const est = estimateInputTokens({
    system: opts.system,
    messages: opts.messages,
    tools: opts.tools,
  });
  const expectedMaxOut = opts.maxTokens ?? 4096;
  const estimatedCostUsd = computeCallCostUsd(
    model,
    est.inputTokens,
    expectedMaxOut,
    0,
    tier
  );

  let reservation: Awaited<ReturnType<typeof creditGuard.reserve>> | null =
    null;
  if (!opts.skipBudgetCheck) {
    reservation = await creditGuard.reserve({
      model,
      inputTokens: est.inputTokens,
      outputTokens: expectedMaxOut,
      cacheReadTokens: 0,
      tier,
    });
  }

  let finalUsage: { input: number; output: number; cacheRead: number } | null =
    null;
  try {
    const anthropic = getAnthropic();
    const params: Anthropic.Messages.MessageCreateParams = {
      model,
      max_tokens: opts.maxTokens ?? (model === 'MiniMax-M3' ? 131072 : 65536),
      messages: opts.messages.map(convertMessage),
      ...(convertSystem(opts.system) !== undefined
        ? { system: convertSystem(opts.system)! }
        : {}),
      ...(convertTools(opts.tools) ? { tools: convertTools(opts.tools) } : {}),
      ...(opts.temperature !== undefined
        ? { temperature: opts.temperature }
        : {}),
      ...(opts.topP !== undefined ? { top_p: opts.topP } : {}),
      ...(model === 'MiniMax-M3'
        ? {
            thinking: opts.disableThinking
              ? { type: 'disabled' }
              : { type: 'adaptive' },
          }
        : {}),
    };

    const stream = anthropic.messages.stream(params);
    for await (const event of stream) {
      yield { type: event.type as any, data: event } as MiniMaxStreamEvent;
      if (event.type === 'message_delta' && (event as any).usage) {
        finalUsage = {
          input: (event as any).usage.input_tokens ?? 0,
          output: (event as any).usage.output_tokens ?? 0,
          cacheRead: (event as any).usage.cache_read_input_tokens ?? 0,
        };
      }
    }

    // After stream complete, fetch final usage from the stream instance
    const finalMessage = await stream.finalMessage();
    const u = finalMessage.usage;
    finalUsage = {
      input: u.input_tokens,
      output: u.output_tokens,
      cacheRead: (u as any).cache_read_input_tokens ?? 0,
    };

    const actualCostUsd = computeCallCostUsd(
      model,
      finalUsage.input,
      finalUsage.output,
      finalUsage.cacheRead,
      tier
    );

    if (reservation) await reservation.commit(actualCostUsd);

    const usage: MiniMaxUsage = {
      inputTokens: finalUsage.input,
      outputTokens: finalUsage.output,
      cacheReadTokens: finalUsage.cacheRead,
      cacheCreationTokens: 0,
      estimatedCostUsd,
      actualCostUsd,
      model,
    };

    logger.info('MiniMax stream complete', {
      model,
      tier,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheRead: usage.cacheReadTokens,
      actualCostUsd,
    });

    return usage;
  } catch (e) {
    if (reservation) await reservation.release();
    logger.error('MiniMax stream failed', {
      model,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Convenience exports
// ---------------------------------------------------------------------------

export { computeCallCostUsd, PRICING };
export type { MiniMaxModelId };
export { MiniMaxCreditExceededError, creditGuard };
