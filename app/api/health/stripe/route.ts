/**
 * Stripe Health Check Endpoint
 * Tests Stripe API connectivity with a minimal API call.
 *
 * GET /api/health/stripe — Returns connectivity status and latency
 *
 * ENVIRONMENT VARIABLES:
 * - STRIPE_SECRET_KEY: Stripe secret key (optional — unhealthy if missing)
 */

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/config';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * The tier price-ID env vars the checkout code resolves. A stale/typo'd/inactive
 * id here silently breaks that tier's checkout — the exact failure that left
 * Starter/Enterprise broken in prod. `?prices=1` retrieves each SET id from
 * Stripe and confirms it's active; the verification runbook calls this.
 */
const TIER_PRICE_ENV_VARS = [
  'STRIPE_STARTER_PRICE_ID',
  'STRIPE_INTRODUCTORY_PRICE_ID',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_ENTERPRISE_PRICE_ID',
  'STRIPE_ENTERPRISE_TIER_PRICE_ID',
] as const;

type PriceCheck = {
  envVar: string;
  priceId: string | null;
  status: 'active' | 'inactive' | 'not_found' | 'unset';
};

async function checkTierPrices(client: Stripe): Promise<PriceCheck[]> {
  return Promise.all(
    TIER_PRICE_ENV_VARS.map(async (envVar): Promise<PriceCheck> => {
      const priceId = process.env[envVar];
      if (!priceId) return { envVar, priceId: null, status: 'unset' };
      try {
        const price = await client.prices.retrieve(priceId);
        return {
          envVar,
          priceId,
          status: price.active ? 'active' : 'inactive',
        };
      } catch {
        return { envVar, priceId, status: 'not_found' };
      }
    })
  );
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const validatePrices =
    request.nextUrl.searchParams.get('prices') === '1';

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

    let priceChecks: PriceCheck[] | undefined;
    let pricesHealthy = true;
    if (validatePrices) {
      priceChecks = await checkTierPrices(stripe);
      // A configured (set) price that is inactive or missing is a real defect;
      // an unset tier is allowed (may be sales-assisted only).
      pricesHealthy = priceChecks.every(
        (p) => p.status === 'active' || p.status === 'unset'
      );
    }

    const latencyMs = Date.now() - startTime;
    const status = pricesHealthy ? ('healthy' as const) : ('degraded' as const);

    return NextResponse.json(
      {
        status,
        latencyMs,
        ...(priceChecks ? { priceChecks } : {}),
        timestamp: new Date().toISOString(),
      },
      {
        status: pricesHealthy ? 200 : 503,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    logger.error('Stripe health check failed:', { error: error instanceof Error ? error.message : String(error), latencyMs });

    return NextResponse.json(
      {
        status: 'unhealthy' as const,
        latencyMs,
        error: 'Stripe service check failed',
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );
  }
}
