/**
 * SEO Audits Cron Job
 *
 * GET /api/cron/seo-audits
 * Runs daily at 3 AM UTC via Vercel Cron.
 * Executes scheduled SEO audits, detects regressions, and sends email alerts.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - CRON_SECRET: Vercel cron secret for authorization (SECRET)
 * - GOOGLE_PAGESPEED_API_KEY: PageSpeed Insights API key (PUBLIC, optional)
 * - EMAIL_FROM: Sender email address (PUBLIC)
 * - NEXT_PUBLIC_APP_URL: App URL for dashboard links (PUBLIC)
 */

import { NextRequest, NextResponse } from 'next/server';
import emailQueue from '@/lib/email/queue';
import { logger } from '@/lib/logger';
import {
  getAllTargetsDueForAudit,
  runScheduledAudit,
  detectRegression,
  storeAuditResult,
  buildAlertEmail,
} from '@/lib/seo/audit-scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  // Cron authentication
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startTime = Date.now();

    // Get all targets due for audit
    const targets = await getAllTargetsDueForAudit();

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        auditsRun: 0,
        regressionsDetected: 0,
        emailsSent: 0,
        errors: 0,
        durationMs: Date.now() - startTime,
      });
    }

    let auditsRun = 0;
    let regressionsDetected = 0;
    let emailsSent = 0;
    let errors = 0;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';
    const emailFrom = process.env.EMAIL_FROM || 'noreply@synthex.social';

    // Process targets sequentially to avoid PageSpeed API rate limits
    for (const target of targets) {
      try {
        // Run the audit
        const result = await runScheduledAudit(target.url);
        auditsRun++;

        // Get user info from target (included in query)
        const user = (target as unknown as { user: { id: string; email: string | null; name: string | null } }).user;

        // Store result
        await storeAuditResult(user.id, target, result);

        // Check for regression
        const regression = detectRegression(target, result.score);

        if (regression.regressed) {
          regressionsDetected++;

          // Send alert email
          if (user.email) {
            try {
              const emailHtml = buildAlertEmail(
                user.name || 'there',
                {
                  targetName: target.name,
                  url: target.url,
                  oldScore: regression.oldScore,
                  newScore: regression.newScore,
                  dropPercent: regression.dropPercent,
                  topIssues: result.issues,
                  dashboardUrl: `${appUrl}/dashboard/seo/audits`,
                }
              );

              await emailQueue.enqueue({
                to: user.email,
                from: emailFrom,
                subject: `SEO Alert: ${target.name} score dropped ${regression.dropPercent}%`,
                html: emailHtml,
                metadata: {
                  userId: user.id,
                  type: 'notification' as const,
                },
              });
              emailsSent++;
            } catch (emailErr) {
              logger.error(`[SEO Audits Cron] Email failed for target ${target.id}:`, emailErr);
              // Email failure does not stop batch processing
            }
          }
        }

        // Small delay between audits to respect PageSpeed API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        logger.error(`[SEO Audits Cron] Failed for target ${target.id}:`, err);
        errors++;
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      auditsRun,
      regressionsDetected,
      emailsSent,
      errors,
      totalTargets: targets.length,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('[SEO Audits Cron] Fatal error:', error);
    return NextResponse.json(
      { error: 'Scheduled SEO audits failed' },
      { status: 500 }
    );
  }
}
