/**
 * Weekly Digest Cron Job
 *
 * GET /api/cron/weekly-digest
 * Runs Monday 8 AM UTC via Vercel Cron.
 * Generates AI weekly digests for all Business plan users.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 * - CRON_SECRET: Vercel cron secret for authorization (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { generateWeeklyDigest } from '@/lib/ai/project-manager';
import emailQueue from '@/lib/email/queue';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  // Auth (keep OUTSIDE monitor)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Sentry.withMonitor('cron-weekly-digest', async () => {
  try {
    const startTime = Date.now();

    // Get all Business/Custom plan users
    const users = await prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'trialing'] },
        plan: { in: ['business', 'custom'] },
      },
      select: { userId: true },
    });

    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let generated = 0;
    let emailsSent = 0;
    let errors = 0;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';
    const emailFrom = process.env.EMAIL_FROM || 'noreply@synthex.social';

    // Process sequentially to avoid rate limits on AI provider
    for (const user of users) {
      try {
        const digest = await generateWeeklyDigest(user.userId);

        await prisma.aIWeeklyDigest.create({
          data: {
            userId: user.userId,
            weekStart,
            weekEnd: now,
            summary: digest.summary,
            highlights: digest.highlights as Prisma.InputJsonValue,
            actionItems: digest.actionItems as Prisma.InputJsonValue,
            opportunities: digest.opportunities as Prisma.InputJsonValue,
          },
        });

        generated++;

        // Send digest email via email queue
        try {
          const userData = await prisma.user.findUnique({
            where: { id: user.userId },
            select: { email: true, name: true },
          });

          if (userData?.email) {
            const digestEmailHtml = buildDigestEmailHtml(
              userData.name || 'there',
              digest,
              appUrl
            );

            await emailQueue.enqueue({
              to: userData.email,
              from: emailFrom,
              subject: `Your Weekly Marketing Digest — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
              html: digestEmailHtml,
              metadata: {
                userId: user.userId,
                type: 'notification' as const,
              },
            });
            emailsSent++;
          }
        } catch (emailErr) {
          logger.error(`[Weekly Digest] Email failed for user ${user.userId}:`, emailErr);
          // Email failure does not crash the batch — digest was already saved
        }
      } catch (err) {
        logger.error(`[Weekly Digest] Failed for user ${user.userId}:`, err);
        errors++;
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      generated,
      emailsSent,
      errors,
      totalUsers: users.length,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('[Weekly Digest Cron] Fatal error:', error);
    return NextResponse.json(
      { error: 'Weekly digest generation failed' },
      { status: 500 }
    );
  }
  }); // end Sentry.withMonitor
}

// ============================================================================
// EMAIL TEMPLATE
// ============================================================================

interface DigestData {
  summary: string;
  highlights: Array<{ metric: string; value: string; change: string; trend: string }>;
  actionItems: Array<{ title: string; description: string; priority: string; actionUrl?: string }>;
  opportunities: Array<{ title: string; description: string; potentialImpact: string }>;
}

function buildDigestEmailHtml(name: string, digest: DigestData, appUrl: string): string {
  const trendIcon = (trend: string) => {
    if (trend === 'up') return '&#9650;'; // triangle up
    if (trend === 'down') return '&#9660;'; // triangle down
    return '&#8212;'; // em dash (flat)
  };

  const trendColor = (trend: string) => {
    if (trend === 'up') return '#22c55e';
    if (trend === 'down') return '#ef4444';
    return '#94a3b8';
  };

  const priorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      high: '#ef4444',
      medium: '#f59e0b',
      low: '#22c55e',
    };
    const color = colors[priority] || '#94a3b8';
    return `<span style="display:inline-block;background:${color};color:#fff;font-size:11px;padding:2px 8px;border-radius:4px;margin-left:8px;">${priority}</span>`;
  };

  const highlightsHtml = digest.highlights.length > 0
    ? digest.highlights.map(h => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #eee;">${h.metric}</td>
          <td style="padding:12px;border-bottom:1px solid #eee;font-weight:bold;">${h.value}</td>
          <td style="padding:12px;border-bottom:1px solid #eee;color:${trendColor(h.trend)};">${trendIcon(h.trend)} ${h.change}</td>
        </tr>
      `).join('')
    : '<tr><td style="padding:12px;color:#888;">No highlights this week.</td></tr>';

  const actionItemsHtml = digest.actionItems.length > 0
    ? digest.actionItems.map(a => `
        <li style="margin-bottom:12px;">
          <strong>${a.title}</strong>${priorityBadge(a.priority)}<br/>
          <span style="color:#555;font-size:14px;">${a.description}</span>
        </li>
      `).join('')
    : '<li style="color:#888;">No action items this week.</li>';

  const opportunitiesHtml = digest.opportunities.length > 0
    ? digest.opportunities.map(o => `
        <div style="background:#fff;padding:16px;margin:8px 0;border-radius:8px;border-left:4px solid #667eea;">
          <strong>${o.title}</strong>
          <p style="margin:4px 0 0;color:#555;font-size:14px;">${o.description}</p>
          <p style="margin:4px 0 0;color:#667eea;font-size:13px;">Potential impact: ${o.potentialImpact}</p>
        </div>
      `).join('')
    : '<p style="color:#888;">No new opportunities identified this week.</p>';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Weekly Digest</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0 0 8px;">Your Weekly Digest</h1>
            <p style="margin: 0; opacity: 0.9; font-size: 14px;">Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="margin: 0 0 12px; font-size: 18px;">Hi ${name},</h2>
            <p style="margin: 0 0 24px; color: #555;">${digest.summary}</p>

            <!-- Highlights -->
            <h3 style="margin: 0 0 12px; font-size: 16px;">Performance Highlights</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #fff; border-radius: 8px;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #64748b; border-bottom: 2px solid #e2e8f0;">Metric</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #64748b; border-bottom: 2px solid #e2e8f0;">Value</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #64748b; border-bottom: 2px solid #e2e8f0;">Change</th>
                </tr>
              </thead>
              <tbody>
                ${highlightsHtml}
              </tbody>
            </table>

            <!-- Action Items -->
            <h3 style="margin: 0 0 12px; font-size: 16px;">Action Items</h3>
            <ul style="margin: 0 0 24px; padding-left: 20px;">
              ${actionItemsHtml}
            </ul>

            <!-- Opportunities -->
            <h3 style="margin: 0 0 12px; font-size: 16px;">Opportunities</h3>
            <div style="margin-bottom: 24px;">
              ${opportunitiesHtml}
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin-top: 24px;">
              <a href="${appUrl}/dashboard" style="display: inline-block; padding: 14px 28px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Open Dashboard</a>
            </div>
          </div>

          <div style="text-align: center; margin-top: 24px; color: #999; font-size: 12px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Synthex. All rights reserved.</p>
            <p style="margin: 4px 0 0;">You receive this because you're on a Business plan.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
