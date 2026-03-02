/**
 * Personas API
 *
 * CRUD operations for AI content personas.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/personas/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// =============================================================================
// Schemas
// =============================================================================

const createPersonaSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  tone: z.enum(['professional', 'casual', 'authoritative', 'friendly', 'humorous']).optional().default('professional'),
  style: z.enum(['formal', 'conversational', 'thought-provoking', 'educational', 'inspirational']).optional().default('formal'),
  vocabulary: z.enum(['simple', 'standard', 'technical', 'sophisticated']).optional().default('standard'),
  emotion: z.enum(['neutral', 'friendly', 'confident', 'inspiring', 'empathetic']).optional().default('neutral'),
});

const updatePersonaSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(['draft', 'training', 'active', 'archived']).optional(),
  tone: z.enum(['professional', 'casual', 'authoritative', 'friendly', 'humorous']).optional(),
  style: z.enum(['formal', 'conversational', 'thought-provoking', 'educational', 'inspirational']).optional(),
  vocabulary: z.enum(['simple', 'standard', 'technical', 'sophisticated']).optional(),
  emotion: z.enum(['neutral', 'friendly', 'confident', 'inspiring', 'empathetic']).optional(),
  trainingSourcesCount: z.number().min(0).optional(),
  trainingWordsCount: z.number().min(0).optional(),
  trainingSamplesCount: z.number().min(0).optional(),
  accuracy: z.number().min(0).max(100).optional(),
});

// =============================================================================
// Auth Helper
// =============================================================================

import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

async function getUserId(request: NextRequest): Promise<string | null> {
  return getUserIdFromRequestOrCookies(request);
}

// =============================================================================
// GET - List Personas
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const personas = await prisma.persona.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ data: personas });
  } catch (error) {
    console.error('Error fetching personas:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch personas' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Persona
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = createPersonaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;

    const persona = await prisma.persona.create({
      data: {
        ...data,
        userId,
      },
    });

    return NextResponse.json({ data: persona }, { status: 201 });
  } catch (error) {
    console.error('Error creating persona:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to create persona' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update Persona
// =============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Validation Error', message: 'Persona ID is required' },
        { status: 400 }
      );
    }

    const validation = updatePersonaSchema.safeParse(updateData);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingPersona = await prisma.persona.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingPersona || existingPersona.userId !== userId) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Persona not found' },
        { status: 404 }
      );
    }

    const data = validation.data;
    const updatePayload: Record<string, unknown> = { ...data };

    // Set lastTrained if status changes to active
    if (data.status === 'active') {
      updatePayload.lastTrained = new Date();
    }

    const persona = await prisma.persona.update({
      where: { id },
      data: updatePayload,
    });

    return NextResponse.json({ data: persona });
  } catch (error) {
    console.error('Error updating persona:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to update persona' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete Persona
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Validation Error', message: 'Persona ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingPersona = await prisma.persona.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingPersona || existingPersona.userId !== userId) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Persona not found' },
        { status: 404 }
      );
    }

    await prisma.persona.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting persona:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to delete persona' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
