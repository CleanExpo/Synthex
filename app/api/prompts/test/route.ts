/**
 * Prompt Test API (Phase 96)
 *
 * POST /api/prompts/test — Test a tracked prompt against Claude AI
 *
 * Rate limited: 10 tests per hour per user (keyed by userId).
 * Saves the result to PromptResult and updates the PromptTracker status.
 *
 * @module app/api/prompts/test/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { testPrompt } from '@/lib/prompts/prompt-tester';

// ─── In-memory rate store (10 tests/hour per userId) ─────────────────────────

const promptTestStore = new Map<string, { count: number; resetAt: number }>();
const MAX_TESTS_PER_HOUR = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = promptTestStore.get(userId);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
  }

  if (entry.count >= MAX_TESTS_PER_HOUR) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  promptTestStore.set(userId, entry);

  return {
    allowed: true,
    remaining: MAX_TESTS_PER_HOUR - entry.count,
    resetAt: entry.resetAt,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

const TestSchema = z.object({
  trackerId: z.string().min(1),
});

// ─── POST /api/prompts/test ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // ── Rate limit check ──
    const rl = checkRateLimit(userId);
    if (!rl.allowed) {
      const retryAfterSec = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'Rate limit exceeded — maximum 10 prompt tests per hour',
          retryAfter: retryAfterSec,
          resetAt: new Date(rl.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(MAX_TESTS_PER_HOUR),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rl.resetAt).toISOString(),
          },
        }
      );
    }

    // ── Validate body ──
    const body   = await request.json();
    const parsed = TestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { trackerId } = parsed.data;

    // ── Fetch tracker (verify ownership) ──
    const tracker = await prisma.promptTracker.findFirst({
      where: { id: trackerId, userId },
    });
    if (!tracker) {
      return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
    }

    // ── Run prompt test ──
    const testResult = await testPrompt(tracker.promptText, tracker.entityName);

    // ── Save result + update tracker in a transaction ──
    const [result] = await prisma.$transaction([
      prisma.promptResult.create({
        data: {
          trackerId,
          aiResponse:       testResult.response,
          brandMentioned:   testResult.brandMentioned,
          brandPosition:    testResult.brandPosition,
          mentionContext:   testResult.mentionContext,
          competitorsFound: testResult.competitorsFound,
          responseQuality:  testResult.responseQuality,
        },
      }),
      prisma.promptTracker.update({
        where: { id: trackerId },
        data: {
          status:               'tested',
          brandMentioned:       testResult.brandMentioned,
          brandPosition:        testResult.brandPosition,
          competitorsMentioned: testResult.competitorsFound,
          lastTestedAt:         new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      result,
      brandMentioned:   testResult.brandMentioned,
      brandPosition:    testResult.brandPosition,
      mentionContext:   testResult.mentionContext,
      competitorsFound: testResult.competitorsFound,
      responseQuality:  testResult.responseQuality,
      remaining:        rl.remaining,
    });
  } catch (err) {
    console.error('[POST /api/prompts/test]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
