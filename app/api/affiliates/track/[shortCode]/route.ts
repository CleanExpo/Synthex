/**
 * Affiliate Link Tracking Redirect
 *
 * @description Public endpoint for tracking affiliate link clicks and redirecting.
 *
 * GET /api/affiliates/track/:shortCode - Track click and redirect to affiliate URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { AffiliateLinkService } from '@/lib/affiliates/affiliate-link-service';
import { RateLimiter } from '@/lib/rate-limit';
import crypto from 'crypto';

// ─── Rate limiter — 120 req/min ─────────────────────────────────────────────

const rateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 120,
  identifier: (req: NextRequest) => {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    return `affiliate-track:${ip}`;
  },
});

// =============================================================================
// Helpers
// =============================================================================

function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function getCountryFromRequest(request: NextRequest): string | undefined {
  // Try Vercel headers first
  const country = request.headers.get('x-vercel-ip-country');
  if (country) return country;

  // Try Cloudflare header
  const cfCountry = request.headers.get('cf-ipcountry');
  if (cfCountry) return cfCountry;

  return undefined;
}

function getIPFromRequest(request: NextRequest): string {
  // Try various headers for the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;

  // Fallback
  return '0.0.0.0';
}

// =============================================================================
// GET - Track Click and Redirect
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  try {
    // Rate limit check
    const rateResult = await rateLimiter.check(request);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: new Date(rateResult.resetTime).toISOString() },
        { status: 429, headers: { ...RateLimiter.createHeaders(rateResult) } }
      );
    }

    const { shortCode } = await params;

    // Find the link
    const link = await AffiliateLinkService.getLinkByShortCode(shortCode);

    if (!link || !link.isActive) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    // Track the click (non-blocking)
    const ip = getIPFromRequest(request);
    const userAgent = request.headers.get('user-agent') || undefined;
    const referer = request.headers.get('referer') || undefined;
    const country = getCountryFromRequest(request);

    // Fire and forget - don't await
    AffiliateLinkService.trackClick(link.id, {
      ipHash: hashIP(ip),
      userAgent,
      referer,
      country,
    }).catch((err) => {
      logger.error('Failed to track affiliate click:', { error: err.message, linkId: link.id });
    });

    // Redirect to affiliate URL
    return NextResponse.redirect(link.affiliateUrl, { status: 302 });
  } catch (error) {
    logger.error('Affiliate Track error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to process redirect' },
      { status: 500 }
    );
  }
}
