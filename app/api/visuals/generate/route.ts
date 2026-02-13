/**
 * Visual Generation API — Generate visuals via Paper Banana
 *
 * POST /api/visuals/generate
 * Body: { type, prompt, data?, style?, useQualityGate?, minQuality? }
 * Returns: VisualAssetResult
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - PAPER_BANANA_SERVICE_URL (INTERNAL)
 * - PAPER_BANANA_API_KEY (SECRET)
 *
 * @module app/api/visuals/generate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { createVisualAsset } from '@/lib/services/visual-asset-manager';
import { isConfigured } from '@/lib/services/paper-banana-client';

const generateSchema = z.object({
  type: z.enum(['diagram', 'plot', 'infographic', 'before_after']),
  prompt: z.string().min(10).max(2000),
  data: z.record(z.unknown()).optional(),
  style: z.string().optional(),
  reportId: z.number().int().optional(),
  useQualityGate: z.boolean().optional().default(true),
  minQuality: z.number().min(0).max(100).optional().default(70),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
    }

    if (!isConfigured()) {
      return NextResponse.json({
        error: 'Service Unavailable',
        message: 'Paper Banana service is not configured. Set PAPER_BANANA_SERVICE_URL and PAPER_BANANA_API_KEY.',
      }, { status: 503 });
    }

    const body = await request.json();
    const validation = generateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation Error', details: validation.error.issues }, { status: 400 });
    }

    const data = validation.data;

    const result = await createVisualAsset({
      userId,
      reportId: data.reportId,
      type: data.type,
      prompt: data.prompt,
      data: data.data,
      style: data.style,
      useQualityGate: data.useQualityGate,
      minQuality: data.minQuality,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Visual generation error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to generate visual' }, { status: 500 });
  }
}
