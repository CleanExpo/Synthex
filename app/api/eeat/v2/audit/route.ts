/**
 * E-E-A-T Score Builder Audit API (Phase 90)
 *
 * POST /api/eeat/v2/audit — run 20-point E-E-A-T audit, optionally saving to DB
 * GET  /api/eeat/v2/audit — fetch the current user's saved EEATAudit records
 *
 * @module app/api/eeat/v2/audit/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { scoreEEATContent } from '@/lib/eeat/content-scorer';
import { generateEEATAssets } from '@/lib/eeat/asset-generator';
import { logger } from '@/lib/logger';

// ─── Rate limiter — 30 req/min ────────────────────────────────────────────────

const rateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  identifier: (req: NextRequest) => {
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown';
    return `eeat-v2-audit:${ip}`;
  },
});

// ─── Validation schema ────────────────────────────────────────────────────────

const PostSchema = z.object({
  text: z.string().min(1, 'Content is required'),
  contentUrl: z.string().url().optional(),
  save: z.boolean().optional().default(false),
  generateAssets: z.boolean().optional().default(false),
});

// ─── POST — run audit ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorised', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Rate limit
    const rateLimitResult = await rateLimiter.check(request);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again shortly.' },
        { status: 429 }
      );
    }

    // 3. Validate body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { text, contentUrl, save, generateAssets } = parsed.data;

    // 4. Run E-E-A-T audit (synchronous, pure TypeScript)
    const audit = scoreEEATContent(text);

    // 5. Optionally generate asset plan
    const assets = generateAssets ? generateEEATAssets(audit) : undefined;

    // 6. Optionally persist
    let auditId: string | undefined;
    if (save) {
      const record = await prisma.eEATAudit.create({
        data: {
          userId,
          orgId: userId, // fallback to userId for solo users
          contentText: text,
          contentUrl: contentUrl ?? null,
          experienceScore: audit.experience.score,
          expertiseScore: audit.expertise.score,
          authorityScore: audit.authority.score,
          trustScore: audit.trust.score,
          overallScore: audit.overallScore,
          auditResult: audit as unknown as Prisma.InputJsonValue,
          assetPlan: assets ? (assets as unknown as Prisma.InputJsonValue) : undefined,
        },
      });
      auditId = record.id;
    }

    return NextResponse.json({
      audit,
      ...(assets ? { assets } : {}),
      ...(auditId ? { auditId } : {}),
    });
  } catch (error) {
    logger.error('E-E-A-T v2 audit error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to run E-E-A-T audit' },
      { status: 500 }
    );
  }
}

// ─── GET — fetch saved audit history ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Auth
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorised', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Fetch audits for this user (most recent first, limit 50)
    const audits = await prisma.eEATAudit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        overallScore: true,
        experienceScore: true,
        expertiseScore: true,
        authorityScore: true,
        trustScore: true,
        contentUrl: true,
        contentText: true,
        createdAt: true,
        auditResult: true,
      },
    });

    return NextResponse.json({ audits });
  } catch (error) {
    logger.error('E-E-A-T v2 audit history error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch audit history' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
