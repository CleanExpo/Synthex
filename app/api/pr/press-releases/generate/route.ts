/**
 * PR Press Release AI Generator (Phase 93)
 *
 * POST /api/pr/press-releases/generate
 *
 * Generates press release content via OpenRouter AI.
 * Returns generated content for user review — does NOT save to DB.
 * The client calls POST /api/pr/press-releases to save after review.
 *
 * @module app/api/pr/press-releases/generate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { generatePressRelease } from '@/lib/pr/ai-generator';

// ─── Validation ────────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  brandName:      z.string().min(1).max(200),
  angle:          z.string().min(1).max(500),
  keyFacts:       z.array(z.string().min(1).max(500)).min(1).max(10),
  targetAudience: z.string().min(1).max(300),
  quoteName:      z.string().min(1).max(200),
  quoteText:      z.string().min(1).max(1000),
  contactInfo: z.object({
    name:  z.string().max(200).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
  }).optional(),
  category: z.enum(['funding', 'product', 'partnership', 'award', 'other']).optional(),
  location: z.string().max(200).optional(),
  /** Optional user-supplied OpenRouter API key (BYOK) */
  byokApiKey: z.string().optional(),
});

// ─── POST /api/pr/press-releases/generate ─────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { byokApiKey, ...generationInput } = parsed.data;

    const result = await generatePressRelease(generationInput, byokApiKey);

    return NextResponse.json({ generated: result });
  } catch (error) {
    console.error('[PR generate POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
