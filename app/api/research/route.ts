/**
 * Research Reports API — List and Create Research Reports
 *
 * GET /api/research — List user's research reports
 * POST /api/research — Create a new research report
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/research/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

const createReportSchema = z.object({
  title: z.string().min(5).max(200),
  executiveSummary: z.string().optional(),
  methodology: z.string().optional(),
  findings: z.array(z.object({
    title: z.string(),
    description: z.string(),
    data: z.record(z.unknown()).optional(),
  })).optional(),
  dataSources: z.array(z.object({
    name: z.string(),
    url: z.string().url().optional(),
    type: z.string().optional(),
  })).optional(),
});

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;

    const reports = await prisma.gEOResearchReport.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { visuals: true } } },
    });

    return NextResponse.json({ reports, total: reports.length });
  } catch (error) {
    console.error('List research reports error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createReportSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation Error', details: validation.error.issues }, { status: 400 });
    }

    const data = validation.data;
    let slug = generateSlug(data.title);

    const existing = await prisma.gEOResearchReport.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const report = await prisma.gEOResearchReport.create({
      data: {
        userId,
        title: data.title,
        slug,
        status: 'draft',
        executiveSummary: data.executiveSummary || null,
        methodology: data.methodology || null,
        findings: data.findings as any || [],
        dataSources: data.dataSources as any || [],
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Create research report error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
