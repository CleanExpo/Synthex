/**
 * Stripe Health Check Endpoint
 * Tests Stripe API connectivity with a minimal API call.
 *
 * GET /api/health/stripe — Returns connectivity status and latency
 *
 * ENVIRONMENT VARIABLES:
 * - STRIPE_SECRET_KEY: Stripe secret key (optional — unhealthy if missing)
 */

import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/config';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET() {
  const startTime = Date.now();

  try {
    if (!stripe) {
      return NextResponse.json(
        {
          status: 'unhealthy' as const,
          latencyMs: Date.now() - startTime,
          error: 'Stripe is not configured (STRIPE_SECRET_KEY missing)',
          timestamp: new Date().toISOString(),
        },
        {
          status: 503,
          headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        }
      );
    }

    // Minimal API call: retrieve account balance (lightweight, read-only)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      await stripe.balance.retrieve({
        // @ts-expect-error -- Stripe SDK doesn't type fetchOptions but it works
        fetchOptions: { signal: controller.signal },
      });
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - startTime;

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
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Stripe health check failed:', { error: message, latencyMs });

    return NextResponse.json(
      {
        status: 'unhealthy' as const,
        latencyMs,
        error: message,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );
  }
}
