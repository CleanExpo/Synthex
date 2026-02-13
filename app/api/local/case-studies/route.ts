/**
 * Local Case Studies API — List and Create Case Studies
 *
 * GET /api/local/case-studies
 * POST /api/local/case-studies
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/local/case-studies/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

const createCaseStudySchema = z.object({
  title: z.string().min(5).max(200),
  suburb: z.string().min(2),
  city: z.string().min(2),
  state: z.string().min(2),
  postcode: z.string().min(3).max(10),
  summary: z.string().min(50),
  challenge: z.string().optional(),
  solution: z.string().optional(),
  results: z.string().optional(),
  testimonial: z.string().optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  napData: z.object({
    businessName: z.string(),
    address: z.string(),
    phone: z.string(),
    website: z.string().url().optional(),
  }).optional(),
});

function generateSlug(title: string, suburb: string): string {
  return `${title}-${suburb}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 100);
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const state = searchParams.get('state');

    const where: Record<string, unknown> = { userId };
    if (city) where.city = city;
    if (state) where.state = state;

    const caseStudies = await prisma.localCaseStudy.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ caseStudies, total: caseStudies.length });
  } catch (error) {
    console.error('List case studies error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const validation = createCaseStudySchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: 'Validation Error', details: validation.error.issues }, { status: 400 });

    const data = validation.data;
    let slug = generateSlug(data.title, data.suburb);

    const existing = await prisma.localCaseStudy.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const caseStudy = await prisma.localCaseStudy.create({
      data: {
        userId,
        title: data.title,
        slug,
        suburb: data.suburb,
        city: data.city,
        state: data.state,
        postcode: data.postcode,
        summary: data.summary,
        challenge: data.challenge || null,
        solution: data.solution || null,
        results: data.results || null,
        testimonial: data.testimonial || null,
        coordinates: data.coordinates as any || null,
        napData: data.napData as any || null,
        beforeImages: [],
        afterImages: [],
        diagrams: [],
      },
    });

    return NextResponse.json(caseStudy, { status: 201 });
  } catch (error) {
    console.error('Create case study error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
