/**
 * E-E-A-T Score API — Score content against Google's E-E-A-T framework
 *
 * POST /api/eeat/score
 * Body: { content: string, authorInfo?: {...}, url?: string, contentType?: string }
 * Returns: Full EEATAnalysisResult
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * FAILURE MODE: Service will not start if missing
 *
 * @module app/api/eeat/score/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { scoreEEAT } from '@/lib/eeat/eeat-scorer';
import type { ContentType } from '@/lib/eeat/types';

const eeatSchema = z.object({
  content: z.string().min(100, 'Content must be at least 100 characters for meaningful scoring'),
  authorInfo: z.object({
    name: z.string(),
    credentials: z.array(z.object({
      type: z.string(),
      title: z.string(),
      institution: z.string().optional(),
      year: z.number().optional(),
    })).optional(),
    socialLinks: z.record(z.string()).optional(),
    bio: z.string().optional(),
  }).optional(),
  url: z.string().url().optional(),
  contentType: z.enum(['article', 'product', 'service', 'ymyl', 'general']).optional().default('general'),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = eeatSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { content, authorInfo, url, contentType } = validation.data;

    // Run E-E-A-T analysis
    const result = await scoreEEAT({
      content,
      authorInfo,
      url,
      contentType: contentType as ContentType,
    });

    // Store as SEO audit
    await prisma.sEOAudit.create({
      data: {
        userId,
        url: url || 'inline-content',
        auditType: 'eeat',
        overallScore: result.score.overall,
        eeatScore: result.score as any,
        recommendations: result.recommendations as any,
        rawData: {
          experienceSignals: result.experienceSignals,
          expertiseSignals: result.expertiseSignals,
          authoritySignals: result.authoritySignals,
          trustSignals: result.trustSignals,
          aiDetection: result.aiDetection,
          tier: result.tier,
        } as any,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('E-E-A-T score error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to score content' },
      { status: 500 }
    );
  }
}
