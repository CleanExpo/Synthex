/**
 * Generate Calendars Cron Job
 *
 * GET /api/cron/generate-calendars
 * Runs Sunday 08:00 UTC (≈ Sunday 18:00 AEDT) via Vercel Cron.
 * Generates next-week content calendars for all eligible organisations.
 *
 * Eligibility: organisation must have ≥3 completed AIWeeklyDigest records.
 * Ineligible orgs are skipped silently (cold-start gate).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection
 * - OPENROUTER_API_KEY: AI provider key
 * - CRON_SECRET: Vercel cron authorisation secret
 *
 * @task SYN-521
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateWeeklyCalendar } from '@/lib/calendar/generateWeeklyCalendar';
import { InsufficientDigestsError } from '@/lib/calendar/types';
import type { CalendarGenerationResult } from '@/lib/calendar/types';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — 7 AI calls × ~8s each × N orgs

export async function GET(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const auth = verifyCronRequest(request, 'GENERATE_CALENDARS');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  logger.info('cron:generate-calendars:start', {
    timestamp: new Date().toISOString(),
  });

  try {
    // ── Find eligible organisations ───────────────────────────────────────
    // Step 1: get user IDs with active/trialing subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'trialing', 'past_due'] },
      },
      select: { userId: true },
    });
    const subscribedUserIds = subscriptions.map(s => s.userId);

    // Step 2: resolve those users to their org IDs
    const orgUsers = await prisma.user.findMany({
      where: {
        id: { in: subscribedUserIds },
        organizationId: { not: null },
      },
      select: { organizationId: true },
    });

    // Unique org IDs
    const orgIdSet = new Set<string>();
    for (const u of orgUsers) {
      if (u.organizationId) orgIdSet.add(u.organizationId);
    }
    const orgIds = [...orgIdSet];

    logger.info('cron:generate-calendars:orgs', { count: orgIds.length });

    let generated = 0;
    let skippedColdStart = 0;
    let errors = 0;
    const results: CalendarGenerationResult[] = [];

    // ── Process sequentially (AI rate limit safety) ───────────────────────
    for (const organizationId of orgIds) {
      try {
        const result = await generateWeeklyCalendar(organizationId);
        results.push(result);
        if (result.success) {
          generated++;
        } else {
          errors++;
          logger.warn('cron:generate-calendars:failed', {
            organizationId,
            reason: result.reason,
          });
        }
      } catch (err) {
        if (err instanceof InsufficientDigestsError) {
          skippedColdStart++;
          logger.info('cron:generate-calendars:cold-start-skip', {
            organizationId,
            digestCount: err.actual,
            required: err.required,
          });
        } else {
          errors++;
          logger.error('cron:generate-calendars:unexpected-error', {
            organizationId,
            error: err,
          });
        }
      }
    }

    const duration = Date.now() - startTime;

    logger.info('cron:generate-calendars:done', {
      total: orgIds.length,
      generated,
      skippedColdStart,
      errors,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalOrgs: orgIds.length,
        generated,
        skippedColdStart,
        errors,
        durationMs: duration,
      },
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('cron:generate-calendars:fatal', {
      error: err,
      durationMs: duration,
    });
    return NextResponse.json(
      { error: 'Calendar generation cron failed', details: String(err) },
      { status: 500 }
    );
  }
}
