/**
 * Liveness Probe Endpoint
 * Used by load balancers to check if the process is alive
 *
 * @task UNI-438 - Implement Load Balancer Health Checks
 *
 * This endpoint:
 * - Returns 200 if the process is running
 * - Is extremely lightweight (no external dependencies)
 * - Used by Kubernetes livenessProbe, AWS ALB, etc.
 *
 * Response codes:
 * - 200: Process is alive
 * - 503: Process is not responding (should never happen if this executes)
 */

import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

// Track process start time for uptime calculation
const processStartTime = Date.now();

export async function GET() {
  // Simple liveness check - if this code executes, the process is alive
  return NextResponse.json(
    {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - processStartTime) / 1000),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Content-Type': 'application/json',
        // Standard health check headers
        'X-Health-Check': 'liveness',
      },
    }
  );
}

// HEAD request support for minimal overhead health checks
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'X-Health-Check': 'liveness',
    },
  });
}
