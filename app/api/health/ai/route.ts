/**
 * AI (OpenRouter) Health Check Endpoint
 * Tests OpenRouter API connectivity with a minimal request.
 *
 * GET /api/health/ai — Returns connectivity status and latency
 *
 * ENVIRONMENT VARIABLES:
 * - OPENROUTER_API_KEY: OpenRouter API key (optional — unhealthy if missing)
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET() {
  const startTime = Date.now();
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        status: 'unhealthy' as const,
        latencyMs: Date.now() - startTime,
        error: 'OpenRouter is not configured (OPENROUTER_API_KEY missing)',
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );
  }

  try {
    // Minimal API call: list models (lightweight, read-only, no tokens consumed)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/models', {
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
          latencyMs,
          error: `OpenRouter returned ${response.status}: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        },
        {
          status: 503,
          headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        }
      );
    }

    return NextResponse.json(
      {
        status: 'healthy' as const,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    logger.error('AI health check failed:', { error: error instanceof Error ? error.message : String(error), latencyMs });

    return NextResponse.json(
      {
        status: 'unhealthy' as const,
        latencyMs,
        error: 'AI service check failed',
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );
  }
}
