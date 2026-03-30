// SYN-525: Post performance sync — detects first win and creates notification
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import {
  detectFirstWin,
  WinMetric,
  PostPerformance,
  ClientBaseline,
} from '@/lib/notifications/detect-first-win';
import { createFirstWinNotification } from '@/lib/notifications/create-first-win-notification';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface SyncPayload {
  postId: string;
  postedAt: string; // ISO string
  metric: WinMetric;
  value: number;
}

const VALID_METRICS: WinMetric[] = [
  'reach',
  'engagement_rate',
  'click_through',
  'saves',
  'impressions',
];

// Map WinMetric → the analytics JSON key stored in Prisma
const ANALYTICS_KEY: Record<WinMetric, string> = {
  reach: 'reach',
  engagement_rate: 'engagement',
  click_through: 'clicks',
  saves: 'saves',
  impressions: 'impressions',
};

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as SyncPayload;
    const { postId, postedAt, metric, value } = body;

    if (!postId || !metric || value === undefined || value === null) {
      return NextResponse.json(
        { error: 'Missing required fields: postId, metric, value' },
        { status: 400 }
      );
    }

    if (!VALID_METRICS.includes(metric)) {
      return NextResponse.json(
        { error: `Invalid metric: ${metric}` },
        { status: 400 }
      );
    }

    // Idempotency guard — skip if user already has first win (Supabase check)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: userData } = await supabase
        .from('users')
        .select('first_win_detected')
        .eq('id', userId)
        .single();
      if (userData?.first_win_detected) {
        return NextResponse.json({ status: 'already_won' });
      }
    }

    // Compute 30-day rolling average for this user + metric from Prisma post analytics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const analyticsKey = ANALYTICS_KEY[metric];

    const posts = await prisma.post.findMany({
      where: {
        campaign: { userId },
        status: 'published',
        publishedAt: { gte: thirtyDaysAgo },
        NOT: { id: postId },
      },
      select: { analytics: true },
      take: 200,
    });

    const metricValues = posts
      .map((p) => {
        const analytics = p.analytics as Record<string, number> | null;
        return analytics?.[analyticsKey] ?? 0;
      })
      .filter((v) => v > 0);

    const rollingAverage =
      metricValues.length > 0
        ? metricValues.reduce((sum, v) => sum + v, 0) / metricValues.length
        : 0;

    const postPerformance: PostPerformance = {
      postId,
      postedAt: new Date(postedAt),
      metric,
      value,
    };

    const baseline: ClientBaseline = {
      userId,
      metric,
      rollingAverage,
      firstWinDetected: false,
    };

    const winEvent = detectFirstWin(postPerformance, baseline);

    if (!winEvent) {
      return NextResponse.json({
        status: 'no_win',
        rollingAverage,
        threshold: Math.round(rollingAverage * 1.3),
      });
    }

    // createFirstWinNotification never throws — fire and await
    await createFirstWinNotification(winEvent);

    logger.info(
      `[post-performance-sync] First win: user=${userId} post=${postId} +${winEvent.improvementPct}% ${metric}`
    );

    return NextResponse.json({
      status: 'first_win_detected',
      improvementPct: winEvent.improvementPct,
      metric: winEvent.metric,
      actualValue: winEvent.actualValue,
      baselineValue: winEvent.baselineValue,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[post-performance-sync] POST error:', msg);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
