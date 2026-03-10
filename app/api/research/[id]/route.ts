/**
 * Research Report API — Get, Update, Delete single report
 *
 * GET /api/research/:id
 * PATCH /api/research/:id
 * DELETE /api/research/:id
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/research/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const updateReportSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  status: z.enum(['draft', 'review', 'published']).optional(),
  executiveSummary: z.string().optional(),
  methodology: z.string().optional(),
  findings: z.array(z.object({
    title: z.string(),
    description: z.string(),
    data: z.record(z.unknown()).optional(),
  })).optional(),
  fullContent: z.string().optional(),
  dataSources: z.array(z.object({ name: z.string(), url: z.string().url().optional(), type: z.string().optional() })).optional(),
  citations: z.array(z.object({ text: z.string(), source: z.string(), url: z.string().url().optional() })).optional(),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  sasScore: z.number().min(0).max(10).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const reportId = parseInt(id, 10);
    if (isNaN(reportId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const report = await prisma.gEOResearchReport.findFirst({
      where: { id: reportId, userId },
      include: { visuals: true },
    });

    if (!report) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    return NextResponse.json(report);
  } catch (error) {
    logger.error('Get report error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });

    const { id } = await params;
    const reportId = parseInt(id, 10);
    if (isNaN(reportId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const existing = await prisma.gEOResearchReport.findFirst({ where: { id: reportId, userId } });
    if (!existing) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    const body = await request.json();
    const validation = updateReportSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: 'Validation Error', details: validation.error.issues }, { status: 400 });

    const data = validation.data;
    const updated = await prisma.gEOResearchReport.update({
      where: { id: reportId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.status && { status: data.status }),
        ...(data.executiveSummary !== undefined && { executiveSummary: data.executiveSummary }),
        ...(data.methodology !== undefined && { methodology: data.methodology }),
        ...(data.findings && { findings: data.findings as any }),
        ...(data.fullContent !== undefined && { fullContent: data.fullContent }),
        ...(data.dataSources && { dataSources: data.dataSources as any }),
        ...(data.citations && { citations: data.citations as any }),
        ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
        ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
        ...(data.sasScore !== undefined && { sasScore: data.sasScore }),
        ...(data.status === 'published' && { publishedAt: new Date() }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Update report error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });

    const { id } = await params;
    const reportId = parseInt(id, 10);
    if (isNaN(reportId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const existing = await prisma.gEOResearchReport.findFirst({ where: { id: reportId, userId } });
    if (!existing) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    await prisma.gEOResearchReport.delete({ where: { id: reportId } });
    return NextResponse.json({ success: true, message: 'Research report deleted' });
  } catch (error) {
    logger.error('Delete report error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
