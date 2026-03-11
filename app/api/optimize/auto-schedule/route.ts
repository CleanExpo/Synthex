/**
 * Auto-Schedule Optimization API
 *
 * @description ML-based optimal posting time predictions and auto-scheduling
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Falls back to industry-standard optimal times
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import { postingTimePredictor, Platform } from '@/lib/ml/posting-time-predictor';
import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { isSurfaceAvailable } from '@/lib/bayesian/feature-limits';
import { getContentSchedulingWeights } from '@/lib/bayesian/surfaces/content-scheduling';
import { registerObservationSilently } from '@/lib/bayesian/fallback';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Request validation schemas
const OptimalTimesSchema = z.object({
  platform: z.enum(['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'youtube']),
  timezone: z.string().default('UTC'),
});

const MultiPlatformSchema = z.object({
  platforms: z.array(z.enum(['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'youtube'])).min(1),
  timezone: z.string().default('UTC'),
});

const WeeklyScheduleSchema = z.object({
  platform: z.enum(['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'youtube']),
  postsPerWeek: z.number().min(1).max(30).default(7),
  timezone: z.string().default('UTC'),
});

const PredictEngagementSchema = z.object({
  platform: z.enum(['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'youtube']),
  scheduledTime: z.string().datetime(),
  timezone: z.string().default('UTC'),
});

const AutoSchedulePostsSchema = z.object({
  postIds: z.array(z.string()).min(1).max(50),
  platforms: z.array(z.enum(['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'youtube'])).min(1),
  timezone: z.string().default('UTC'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minIntervalHours: z.number().min(1).max(48).default(4), // Minimum hours between posts
});

/**
 * GET /api/optimize/auto-schedule
 * Get optimal posting times
 */
export async function GET(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const action = searchParams.get('action') || 'optimal';

    switch (action) {
      case 'optimal': {
        // Get optimal times for a single platform
        const platform = searchParams.get('platform') as Platform;
        const timezone = searchParams.get('timezone') || 'UTC';

        if (!platform) {
          return APISecurityChecker.createSecureResponse(
            { error: 'Platform parameter required' },
            400
          );
        }

        // Resolve plan for BO surface gating
        const userRecord = await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true, plan: true },
        });
        const orgId = userRecord?.organizationId ?? userId;
        const plan  = (userRecord?.plan ?? 'free').toLowerCase();

        const schedulingWeightsResult = isSurfaceAvailable(plan, 'content_scheduling')
          ? await getContentSchedulingWeights(orgId)
          : undefined;

        const result = await postingTimePredictor.getOptimalTimes(
          userId,
          platform,
          timezone,
          schedulingWeightsResult?.weights,
        );

        // Register BO observation (fire-and-forget)
        if (schedulingWeightsResult?.source === 'bo') {
          const topScore = result.topSlot?.score ?? 0;
          void registerObservationSilently(
            'content_scheduling',
            orgId,
            {
              historicalWeight:   schedulingWeightsResult.weights.historicalWeight,
              industryWeight:     schedulingWeightsResult.weights.industryWeight,
              recencyBonus:       schedulingWeightsResult.weights.recencyBonus,
              peakHourMultiplier: schedulingWeightsResult.weights.peakHourMultiplier,
              weekendDiscount:    schedulingWeightsResult.weights.weekendDiscount,
            },
            topScore / 100,
            { platform, methodology: result.methodology },
          );
        }

        return APISecurityChecker.createSecureResponse({
          platform: result.platform,
          timezone: result.timezone,
          topSlot: result.topSlot,
          slots: result.slots,
          nextOptimalTime: result.nextOptimalTime.toISOString(),
          basedOnDataPoints: result.basedOnDataPoints,
          methodology: result.methodology,
        });
      }

      case 'multi-platform': {
        // Get optimal times for multiple platforms
        const platformsParam = searchParams.get('platforms');
        const timezone = searchParams.get('timezone') || 'UTC';

        if (!platformsParam) {
          return APISecurityChecker.createSecureResponse(
            { error: 'Platforms parameter required' },
            400
          );
        }

        const platforms = platformsParam.split(',') as Platform[];
        const results = await postingTimePredictor.getOptimalTimesMultiPlatform(userId, platforms, timezone);

        const response: Record<string, unknown> = {};
        results.forEach((result, platform) => {
          response[platform] = {
            topSlot: result.topSlot,
            slots: result.slots.slice(0, 5), // Top 5 per platform
            nextOptimalTime: result.nextOptimalTime.toISOString(),
            methodology: result.methodology,
          };
        });

        return APISecurityChecker.createSecureResponse({
          timezone,
          platforms: response,
        });
      }

      case 'weekly': {
        // Get weekly schedule recommendations
        const platform = searchParams.get('platform') as Platform;
        const postsPerWeek = parseInt(searchParams.get('postsPerWeek') || '7', 10);
        const timezone = searchParams.get('timezone') || 'UTC';

        if (!platform) {
          return APISecurityChecker.createSecureResponse(
            { error: 'Platform parameter required' },
            400
          );
        }

        const schedule = await postingTimePredictor.getWeeklySchedule(
          userId,
          platform,
          postsPerWeek,
          timezone
        );

        return APISecurityChecker.createSecureResponse({
          platform,
          timezone,
          postsPerWeek,
          scheduledTimes: schedule.map(t => t.toISOString()),
        });
      }

      case 'predict': {
        // Predict engagement for a specific time
        const platform = searchParams.get('platform') as Platform;
        const scheduledTime = searchParams.get('scheduledTime');
        const timezone = searchParams.get('timezone') || 'UTC';

        if (!platform || !scheduledTime) {
          return APISecurityChecker.createSecureResponse(
            { error: 'Platform and scheduledTime parameters required' },
            400
          );
        }

        const prediction = await postingTimePredictor.predictEngagementScore(
          userId,
          platform,
          new Date(scheduledTime),
          timezone
        );

        return APISecurityChecker.createSecureResponse({
          platform,
          scheduledTime,
          timezone,
          ...prediction,
        });
      }

      default:
        return APISecurityChecker.createSecureResponse(
          { error: 'Invalid action' },
          400
        );
    }
  } catch (error: unknown) {
    logger.error('Auto-schedule GET error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * POST /api/optimize/auto-schedule
 * Auto-schedule posts at optimal times
 */
export async function POST(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;

  try {
    const body = await request.json();
    const validated = AutoSchedulePostsSchema.parse(body);

    // Get optimal times for each platform
    const platformTimes = await postingTimePredictor.getOptimalTimesMultiPlatform(
      userId,
      validated.platforms as Platform[],
      validated.timezone
    );

    // Calculate schedule start
    const startDate = validated.startDate ? new Date(validated.startDate) : new Date();
    const endDate = validated.endDate ? new Date(validated.endDate) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // Default to 1 week

    // Generate optimal schedule
    const scheduledPosts: Array<{
      postId: string;
      platform: Platform;
      scheduledTime: string;
      engagementScore: number;
    }> = [];

    const usedTimes: Date[] = [];
    const minInterval = validated.minIntervalHours * 60 * 60 * 1000;

    for (const postId of validated.postIds) {
      // Fetch post to determine content type and platforms
      const { data: post } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('id', postId)
        .eq('user_id', userId)
        .single();

      if (!post) continue;

      const postPlatform = post.platform as Platform;

      // Skip if platform not in requested list
      if (!validated.platforms.includes(postPlatform)) continue;

      const platformResult = platformTimes.get(postPlatform);
      if (!platformResult) continue;

      // Find best available time slot
      let bestTime: Date | null = null;
      let bestScore = 0;

      for (const slot of platformResult.slots) {
        // Calculate next occurrence of this slot
        const candidateTime = new Date(startDate);
        const daysUntil = (slot.day - candidateTime.getDay() + 7) % 7;
        candidateTime.setDate(candidateTime.getDate() + daysUntil);
        candidateTime.setHours(slot.hour, 0, 0, 0);

        // Ensure it's within date range
        while (candidateTime < startDate) {
          candidateTime.setDate(candidateTime.getDate() + 7);
        }

        if (candidateTime > endDate) continue;

        // Check if slot is available (respects minimum interval)
        const isAvailable = !usedTimes.some(
          t => Math.abs(t.getTime() - candidateTime.getTime()) < minInterval
        );

        if (isAvailable && slot.score > bestScore) {
          bestTime = candidateTime;
          bestScore = slot.score;
        }
      }

      if (bestTime) {
        // Update post with scheduled time
        await supabase
          .from('scheduled_posts')
          .update({
            scheduled_time: bestTime.toISOString(),
            status: 'scheduled',
            optimization_metadata: {
              auto_scheduled: true,
              engagement_score: bestScore,
              methodology: platformResult.methodology,
              scheduled_at: new Date().toISOString(),
            },
          })
          .eq('id', postId)
          .eq('user_id', userId);

        usedTimes.push(bestTime);

        scheduledPosts.push({
          postId,
          platform: postPlatform,
          scheduledTime: bestTime.toISOString(),
          engagementScore: bestScore,
        });
      }
    }

    // Audit log
    await auditLogger.logData(
      'update',
      'post',
      undefined,
      userId,
      'success',
      {
        action: 'AUTO_SCHEDULE',
        totalPosts: validated.postIds.length,
        scheduledCount: scheduledPosts.length,
        platforms: validated.platforms,
        timezone: validated.timezone,
      }
    );

    return APISecurityChecker.createSecureResponse({
      success: true,
      totalRequested: validated.postIds.length,
      totalScheduled: scheduledPosts.length,
      scheduledPosts,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Auto-schedule POST error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * PUT /api/optimize/auto-schedule
 * Update auto-schedule settings
 */
export async function PUT(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;

  try {
    const body = await request.json();

    const settingsSchema = z.object({
      enabled: z.boolean().optional(),
      defaultTimezone: z.string().optional(),
      platformSettings: z.record(z.object({
        enabled: z.boolean().optional(),
        postsPerWeek: z.number().min(0).max(30).optional(),
        minIntervalHours: z.number().min(1).max(48).optional(),
        preferredDays: z.array(z.number().min(0).max(6)).optional(),
        preferredHours: z.array(z.number().min(0).max(23)).optional(),
      })).optional(),
    });

    const validated = settingsSchema.parse(body);

    // Update user settings
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        auto_schedule_settings: validated,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }

    return APISecurityChecker.createSecureResponse({
      success: true,
      settings: validated,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Auto-schedule PUT error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}
