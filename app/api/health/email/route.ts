/**
 * Email Service Health Check Endpoint
 * Tests email provider (Resend/SendGrid) API connectivity.
 *
 * GET /api/health/email — Returns connectivity status and latency
 *
 * ENVIRONMENT VARIABLES:
 * - EMAIL_PROVIDER: 'sendgrid' | 'resend' (default: 'sendgrid')
 * - RESEND_API_KEY: Resend API key (optional)
 * - SENDGRID_API_KEY: SendGrid API key (optional)
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET() {
  const startTime = Date.now();
  const provider = process.env.EMAIL_PROVIDER || 'sendgrid';

  // Determine which API key to check
  const apiKey =
    provider === 'resend'
      ? process.env.RESEND_API_KEY
      : process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        status: 'unhealthy' as const,
        latencyMs: Date.now() - startTime,
        provider,
        error: `Email provider "${provider}" is not configured (API key missing)`,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      if (provider === 'resend') {
        // Resend: GET /domains is a lightweight read-only call
        response = await fetch('https://api.resend.com/domains', {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
      } else {
        // SendGrid: GET /v3/user/profile is lightweight and read-only
        response = await fetch('https://api.sendgrid.com/v3/user/profile', {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
      }
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'unhealthy' as const,
          latencyMs,
          provider,
          error: `${provider} returned ${response.status}: ${response.statusText}`,
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
        provider,
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
    logger.error('Email health check failed:', { error: message, provider, latencyMs });

    return NextResponse.json(
      {
        status: 'unhealthy' as const,
        latencyMs,
        provider,
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
