/**
 * BayesNF Service Health Proxy
 *
 * GET /api/admin/bayesian-health — Proxy to the Python BayesNF service health endpoint.
 * Admin-only (verifyAdmin — api-key or JWT + owner/admin role).
 *
 * ENVIRONMENT VARIABLES:
 * - BAYESIAN_SERVICE_URL — base URL of the Python AI service
 * - BAYESIAN_SERVICE_API_KEY — service authentication key
 *
 * @module app/api/admin/bayesian-health/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Admin auth check
  const auth = await verifyAdmin(request);
  if (!auth.isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden', message: auth.error ?? 'Admin access required' },
      { status: auth.error === 'Authentication required' ? 401 : 403 },
    );
  }

  const BASE_URL = process.env.BAYESIAN_SERVICE_URL;
  const API_KEY = process.env.BAYESIAN_SERVICE_API_KEY;

  if (!BASE_URL || !API_KEY) {
    return NextResponse.json({
      status: 'unconfigured',
      message: 'BAYESIAN_SERVICE_URL is not set',
    });
  }

  try {
    const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/health`, {
      headers: { 'X-Service-Key': API_KEY },
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await res.json()) as unknown;
    return NextResponse.json({ status: res.ok ? 'reachable' : 'error', data });
  } catch (error) {
    logger.error('BayesNF health check failed:', error);
    return NextResponse.json({
      status: 'unreachable',
      error: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}

export const runtime = 'nodejs';
