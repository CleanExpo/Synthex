/**
 * Prompt Generator API (Phase 96)
 *
 * POST /api/prompts/generate — Generate prompt templates for an entity
 *
 * Pure computation — no DB writes, no AI calls.
 * Returns 20–30 prompt templates the user can then choose to track.
 *
 * @module app/api/prompts/generate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { generatePrompts } from '@/lib/prompts/prompt-generator';

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_ENTITY_TYPES = ['brand', 'product', 'service', 'person', 'location'] as const;

const GenerateSchema = z.object({
  entityName: z.string().min(1).max(200),
  entityType: z.enum(VALID_ENTITY_TYPES),
  topic:      z.string().min(1).max(200),
  location:   z.string().max(200).optional(),
});

// ─── POST /api/prompts/generate ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body   = await request.json();
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { entityName, entityType, topic, location } = parsed.data;

    const templates = generatePrompts(entityName, entityType, topic, location);

    return NextResponse.json({
      templates,
      count: templates.length,
      entityName,
      entityType,
      topic,
      location: location ?? null,
    });
  } catch (err) {
    console.error('[POST /api/prompts/generate]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
