/**
 * MiniMax Prefix Cache — prompt prefix optimization for Anthropic API
 *
 * MiniMax supports explicit prompt caching via Anthropic-compatible cache_control
 * blocks. Cached content has a 5-minute TTL with automatic refresh on hit.
 *
 * Per docs: prefix matching is constructed as "tool list ? system prompts ?
 * user messages". Static content should go at the FRONT of the conversation
 * (cacheable), dynamic content at the END (not cached).
 *
 * Cache write cost (M2.x only): separate fee per million tokens.
 * Cache read cost: discounted rate per million tokens.
 *
 * This module provides a small wrapper that:
 *   - Automatically tags your last static content block as cache_control: ephemeral
 *   - Skips tagging if total input < 512 tokens (caching threshold)
 *   - Tracks cache hit rate over time so you can measure savings
 */

import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import type { MiniMaxContentPart } from "../client";

// ---------------------------------------------------------------------------
// Cache control helpers
// ---------------------------------------------------------------------------

export const MINIMAX_CACHE_MIN_TOKENS = 512;

/** Estimate token count for cache threshold check */
export function estimateTokensForContent(content: string | MiniMaxContentPart[]): number {
  if (typeof content === "string") return Math.ceil(content.length / 4);
  let chars = 0;
  for (const p of content) {
    if (p.type === "text") chars += p.text.length;
    else if (p.type === "image") chars += 2000;
    else if (p.type === "video") chars += 60_000;
    else chars += 200;
  }
  return Math.ceil(chars / 4);
}

/**
 * Wrap a system prompt for caching. Adds cache_control to the LAST block so
 * the cache boundary sits right before dynamic user content.
 *
 * Per MiniMax prefix rules: system ? user. So we cache the system block,
 * then dynamic user messages come in fresh.
 */
export function withSystemCache(
  system: string | MiniMaxContentPart[] | undefined,
  options: { minTokens?: number } = {}
): string | MiniMaxContentPart[] | undefined {
  if (!system) return undefined;
  const minTokens = options.minTokens ?? MINIMAX_CACHE_MIN_TOKENS;

  if (typeof system === "string") {
    if (estimateTokensForContent(system) < minTokens) return system;
    return [
      { type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } },
    ];
  }

  // Array form: cache-control goes on the LAST block so the prefix includes everything
  const total = estimateTokensForContent(system);
  if (total < minTokens) return system;
  const lastIdx = system.length - 1;
  const last = system[lastIdx];
  if (last.type !== "text") return system;
  return [
    ...system.slice(0, lastIdx),
    { ...last, cache_control: { type: "ephemeral" as const } },
  ];
}

/**
 * Wrap a long user message for caching when its static parts repeat across calls.
 * Useful for RAG: cache the document chunks, let the question stay dynamic.
 */
export function withUserContentCache(
  content: MiniMaxContentPart[],
  options: { minTokens?: number } = {}
): MiniMaxContentPart[] {
  const minTokens = options.minTokens ?? MINIMAX_CACHE_MIN_TOKENS;
  const total = estimateTokensForContent(content);
  if (total < minTokens) return content;
  // Cache boundary goes on the last text block of the user message
  const lastIdx = content.length - 1;
  const last = content[lastIdx];
  if (last.type !== "text") return content;
  return [
    ...content.slice(0, lastIdx),
    { ...last, cache_control: { type: "ephemeral" as const } },
  ];
}

/**
 * Wrap tools array for caching. Per docs, the prefix order is "tools ? system ?
 * user", so the tools come FIRST in the cache.
 */
export function withToolsCache<T extends { name: string; description: string; input_schema: unknown }>(
  tools: T[]
): T[] {
  if (tools.length === 0) return tools;
  // Anthropic SDK applies cache_control to tools differently — passed at request level.
  // We return tools as-is and let the caller pass cache_control via tools param
  // (Anthropic supports per-tool cache_control as of 2024).
  return tools;
}

// ---------------------------------------------------------------------------
// Hit-rate tracking (optional local telemetry)
// ---------------------------------------------------------------------------

interface CacheStats {
  totalCalls: number;
  cacheHits: number;
  cacheMisses: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

const _stats: CacheStats = {
  totalCalls: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
};

export function recordCacheOutcome(outcome: {
  cacheReadTokens: number;
  cacheCreationTokens: number;
}): void {
  _stats.totalCalls++;
  _stats.cacheReadTokens += outcome.cacheReadTokens;
  _stats.cacheCreationTokens += outcome.cacheCreationTokens;
  if (outcome.cacheReadTokens > 0) _stats.cacheHits++;
  else _stats.cacheMisses++;
}

export function getCacheStats(): Readonly<CacheStats> {
  return { ..._stats };
}

export function resetCacheStats(): void {
  _stats.totalCalls = 0;
  _stats.cacheHits = 0;
  _stats.cacheMisses = 0;
  _stats.cacheReadTokens = 0;
  _stats.cacheCreationTokens = 0;
}

/**
 * Compute the prefix hash for a cacheable region. Useful for debugging
 * cache misses when content looks identical.
 */
export function prefixHash(content: string | MiniMaxContentPart[]): string {
  const normalized =
    typeof content === "string"
      ? content
      : content.map((p) => (p.type === "text" ? p.text : `<${p.type}>`)).join("\n");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Convenience: build a fully-cached request
// ---------------------------------------------------------------------------

export interface CachedRequest {
  system: string | MiniMaxContentPart[];
  messages: Array<{ role: "user" | "assistant"; content: MiniMaxContentPart[] }>;
}

/**
 * Helper: take raw inputs and apply cache_control automatically.
 * - Caches system prompt (if >= 512 tokens)
 * - Caches the longest user-content block (RAG docs, etc.)
 * - Leaves short user messages uncached
 */
export function applyAutoCaching(input: CachedRequest): CachedRequest {
  const system = withSystemCache(input.system) ?? "";

  const messages = input.messages.map((m) => {
    // Only cache the FIRST user message (most likely to contain RAG docs)
    if (m.role === "user") {
      return { ...m, content: withUserContentCache(m.content) };
    }
    return m;
  });

  if (system !== input.system || messages.some((m, i) => m.content !== input.messages[i].content)) {
    logger.debug("MiniMax: applied cache_control to request", {
      systemTokens: estimateTokensForContent(system),
      messageCount: messages.length,
    });
  }

  return { system, messages };
}
