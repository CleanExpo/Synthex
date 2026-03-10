/**
 * @internal Server-only endpoint — not called directly by frontend UI.
 * Used by: Paper Banana microservice integration for AI diagram generation; no UI page exists yet.
 */

/**
 * Diagram Generation Route
 *
 * Proxies diagram generation requests to the Paper Banana FastAPI microservice.
 * Returns 501 if PAPER_BANANA_SERVICE_URL is not configured.
 *
 * @route POST /api/generate/diagram
 *
 * Body: { prompt: string; data?: object; style?: string; width?: number; height?: number }
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - PAPER_BANANA_SERVICE_URL: Base URL of the Paper Banana microservice
 * - PAPER_BANANA_API_KEY: API key for authenticating with the service
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const DiagramRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  data: z.record(z.unknown()).optional(),
  style: z.string().optional().default('academic'),
  width: z.number().int().min(200).max(4096).optional().default(1200),
  height: z.number().int().min(200).max(4096).optional().default(800),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const serviceUrl = process.env.PAPER_BANANA_SERVICE_URL;
    const apiKey = process.env.PAPER_BANANA_API_KEY;

    if (!serviceUrl) {
      return NextResponse.json(
        {
          error: 'Diagram generation service not configured',
          code: 'SERVICE_NOT_CONFIGURED',
        },
        { status: 501 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = DiagramRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const upstream = await fetch(`${serviceUrl}/api/generate/diagram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      body: JSON.stringify({ ...parsed.data, type: 'diagram' }),
      signal: AbortSignal.timeout(90_000),
    });

    const data: unknown = await upstream.json();

    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Diagram generation timed out' }, { status: 504 });
    }
    logger.error('[Generate Diagram] Error:', error);
    return NextResponse.json({ error: 'Diagram generation failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
