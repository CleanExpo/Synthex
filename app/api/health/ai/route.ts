/**
 * AI Health Check Endpoint
 * Tests the configured AI provider's connectivity with a minimal, read-only
 * request (lists models — no tokens consumed).
 *
 * GET /api/health/ai — Returns connectivity status and latency
 *
 * Synthex defaults to OpenAI (OpenAI-only direction), so this probe prefers
 * OPENAI_API_KEY and falls back to OPENROUTER_API_KEY when OpenAI is not
 * configured. It reports unhealthy only when NO AI provider key is present.
 *
 * ENVIRONMENT VARIABLES:
 * - OPENAI_API_KEY: OpenAI API key (primary — unhealthy if no provider key)
 * - OPENROUTER_API_KEY: OpenRouter API key (legacy fallback)
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10;

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/** Resolve which provider to probe, preferring OpenAI (OpenAI-only direction). */
function resolveProvider():
  | { provider: 'openai' | 'openrouter'; apiKey: string; url: string }
  | null {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const base = process.env.OPENAI_BASE_URL?.replace(/\/$/, '') || 'https://api.openai.com/v1';
    return { provider: 'openai', apiKey: openaiKey, url: `${base}/models` };
  }
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    return {
      provider: 'openrouter',
      apiKey: openRouterKey,
      url: 'https://openrouter.ai/api/v1/models',
    };
  }
  return null;
}

export async function GET() {
  const startTime = Date.now();
  const resolved = resolveProvider();

  if (!resolved) {
    return NextResponse.json(
      {
        status: 'unhealthy' as const,
        latencyMs: Date.now() - startTime,
        error: 'No AI provider configured (OPENAI_API_KEY / OPENROUTER_API_KEY missing)',
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: NO_STORE }
    );
  }

  const { provider, apiKey, url } = resolved;

  try {
    // Minimal API call: list models (lightweight, read-only, no tokens consumed)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'unhealthy' as const,
          provider,
          latencyMs,
          error: `${provider} returned ${response.status}: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        },
        { status: 503, headers: NO_STORE }
      );
    }

    return NextResponse.json(
      {
        status: 'healthy' as const,
        provider,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: NO_STORE }
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    logger.error('AI health check failed:', {
      provider,
      error: error instanceof Error ? error.message : String(error),
      latencyMs,
    });

    return NextResponse.json(
      {
        status: 'unhealthy' as const,
        provider,
        latencyMs,
        error: 'AI service check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: NO_STORE }
    );
  }
}
