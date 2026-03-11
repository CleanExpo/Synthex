/**
 * PR Journalist CRM — Journalists List & Create (Phase 92)
 *
 * GET  /api/pr/journalists — List journalist contacts (filter by beat/tier)
 * POST /api/pr/journalists — Create a journalist contact
 *
 * @module app/api/pr/journalists/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── Validation ────────────────────────────────────────────────────────────────

const CreateJournalistSchema = z.object({
  name:           z.string().min(1).max(200),
  outlet:         z.string().min(1).max(200),
  outletDomain:   z.string().min(1).max(200),
  email:          z.string().email().optional(),
  title:          z.string().max(200).optional(),
  location:       z.string().max(200).optional(),
  beats:          z.array(z.string()).optional().default([]),
  twitterHandle:  z.string().max(100).optional(),
  linkedinUrl:    z.string().url().optional(),
  notes:          z.string().max(5000).optional(),
  tier:           z.enum(['cold', 'warm', 'hot', 'advocate']).optional().default('cold'),
  lastContactedAt: z.string().datetime().optional(),
});

// ─── GET /api/pr/journalists ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const beat = searchParams.get('beat');
    const tier = searchParams.get('tier');
    const search = searchParams.get('q');

    const contacts = await prisma.journalistContact.findMany({
      where: {
        orgId: userId,
        doNotContact: false,
        ...(tier ? { tier } : {}),
        ...(beat ? { beats: { has: beat } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { outlet: { contains: search, mode: 'insensitive' } },
                { outletDomain: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { pitches: true } },
      },
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('[PR journalists GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/pr/journalists ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreateJournalistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const contact = await prisma.journalistContact.create({
      data: {
        userId,
        orgId: userId,
        name:           data.name,
        outlet:         data.outlet,
        outletDomain:   data.outletDomain,
        email:          data.email,
        title:          data.title,
        location:       data.location,
        beats:          data.beats,
        twitterHandle:  data.twitterHandle,
        linkedinUrl:    data.linkedinUrl,
        notes:          data.notes,
        tier:           data.tier,
        lastContactedAt: data.lastContactedAt ? new Date(data.lastContactedAt) : undefined,
      },
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error('[PR journalists POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
