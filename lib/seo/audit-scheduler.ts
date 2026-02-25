/**
 * SEO Audit Scheduler Service
 *
 * Helper functions for scheduled SEO audits:
 * - Query targets due for audit based on frequency
 * - Run audit using PageSpeed Insights API
 * - Detect score regressions
 * - Build alert email templates
 *
 * ENVIRONMENT VARIABLES (OPTIONAL):
 * - GOOGLE_PAGESPEED_API_KEY: For higher rate limits (PUBLIC, optional)
 */

import { prisma } from '@/lib/prisma';
import type { ScheduledAuditTarget, SEOAudit } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface AuditResult {
  url: string;
  score: number;
  lighthouse: {
    performance: number;
    seo: number;
    accessibility: number;
    bestPractices: number;
  };
  issues: Array<{
    severity: string;
    title: string;
    description: string;
    recommendation: string;
  }>;
  timestamp: string;
}

export interface RegressionResult {
  regressed: boolean;
  dropPercent: number;
  oldScore: number;
  newScore: number;
}

// ============================================================================
// TARGET QUERYING
// ============================================================================

/**
 * Get targets due for audit based on frequency.
 * A target is due if:
 * - lastRunAt is null (never run), OR
 * - lastRunAt + frequency interval < now
 */
export async function getTargetsDueForAudit(
  frequency: 'daily' | 'weekly' | 'monthly'
): Promise<ScheduledAuditTarget[]> {
  const now = new Date();
  let cutoff: Date;

  switch (frequency) {
    case 'daily':
      cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      break;
    case 'weekly':
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      break;
    case 'monthly':
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      break;
  }

  return prisma.scheduledAuditTarget.findMany({
    where: {
      enabled: true,
      frequency,
      OR: [
        { lastRunAt: null }, // Never run
        { lastRunAt: { lt: cutoff } }, // Due for re-run
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Get all enabled targets due for audit (all frequencies).
 * Called by the cron job to process all due targets.
 */
export async function getAllTargetsDueForAudit(): Promise<ScheduledAuditTarget[]> {
  const [daily, weekly, monthly] = await Promise.all([
    getTargetsDueForAudit('daily'),
    getTargetsDueForAudit('weekly'),
    getTargetsDueForAudit('monthly'),
  ]);

  return [...daily, ...weekly, ...monthly];
}

// ============================================================================
// AUDIT EXECUTION
// ============================================================================

/**
 * Run SEO audit for a target using PageSpeed Insights API.
 * Simplified version focused on score extraction for scheduled audits.
 */
export async function runScheduledAudit(url: string): Promise<AuditResult> {
  const issues: AuditResult['issues'] = [];

  let performanceScore = 0;
  let accessibilityScore = 0;
  let seoScore = 0;
  let bestPracticesScore = 0;

  try {
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
    const psiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    psiUrl.searchParams.set('url', url);
    psiUrl.searchParams.set('strategy', 'mobile');
    psiUrl.searchParams.set('category', 'PERFORMANCE');
    psiUrl.searchParams.set('category', 'ACCESSIBILITY');
    psiUrl.searchParams.set('category', 'SEO');
    psiUrl.searchParams.set('category', 'BEST_PRACTICES');
    if (apiKey) psiUrl.searchParams.set('key', apiKey);

    const psiRes = await fetch(psiUrl.toString(), { signal: AbortSignal.timeout(30000) });

    if (psiRes.ok) {
      const psi = await psiRes.json();

      // Extract Lighthouse scores
      const categories = psi.lighthouseResult?.categories;
      performanceScore = Math.round((categories?.performance?.score || 0) * 100);
      accessibilityScore = Math.round((categories?.accessibility?.score || 0) * 100);
      seoScore = Math.round((categories?.seo?.score || 0) * 100);
      bestPracticesScore = Math.round((categories?.['best-practices']?.score || 0) * 100);

      // Extract failed audits as issues (for email)
      const audits = psi.lighthouseResult?.audits || {};
      for (const [, audit] of Object.entries(audits) as [string, Record<string, unknown>][]) {
        if ((audit.score as number | null) !== null && (audit.score as number) < 0.5 && audit.title) {
          const severity = (audit.score as number) === 0 ? 'critical' : 'major';
          issues.push({
            severity,
            title: audit.title as string,
            description: ((audit.description as string) || '').replace(/<[^>]*>/g, '').slice(0, 200),
            recommendation: `Improve ${audit.title}`,
          });
        }
      }
    }
  } catch (error) {
    console.warn('PageSpeed Insights API failed:', error);
  }

  // Calculate composite score
  const overallScore = seoScore > 0
    ? Math.round((performanceScore * 0.3 + seoScore * 0.4 + accessibilityScore * 0.15 + bestPracticesScore * 0.15))
    : 0;

  return {
    url,
    score: overallScore,
    lighthouse: {
      performance: performanceScore,
      seo: seoScore,
      accessibility: accessibilityScore,
      bestPractices: bestPracticesScore,
    },
    issues: issues.slice(0, 10), // Top 10 issues
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// REGRESSION DETECTION
// ============================================================================

/**
 * Detect if score has regressed (dropped) by the alert threshold.
 */
export function detectRegression(
  target: ScheduledAuditTarget,
  newScore: number
): RegressionResult {
  const oldScore = target.lastScore ?? 0;
  const dropPercent = oldScore > 0 ? Math.round(((oldScore - newScore) / oldScore) * 100) : 0;

  return {
    regressed: dropPercent >= target.alertThreshold,
    dropPercent,
    oldScore,
    newScore,
  };
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

interface AlertEmailData {
  targetName: string;
  url: string;
  oldScore: number;
  newScore: number;
  dropPercent: number;
  topIssues: AuditResult['issues'];
  dashboardUrl: string;
}

/**
 * Build HTML email for SEO regression alert.
 */
export function buildAlertEmail(
  userName: string,
  data: AlertEmailData
): string {
  const issuesHtml = data.topIssues.length > 0
    ? data.topIssues.slice(0, 3).map(issue => `
        <div style="background: #fff; padding: 12px; margin: 8px 0; border-radius: 6px; border-left: 4px solid ${issue.severity === 'critical' ? '#ef4444' : '#f59e0b'};">
          <strong style="color: ${issue.severity === 'critical' ? '#ef4444' : '#f59e0b'};">${issue.severity.toUpperCase()}</strong>
          <p style="margin: 4px 0 0; font-weight: bold;">${issue.title}</p>
          <p style="margin: 4px 0 0; color: #555; font-size: 14px;">${issue.description}</p>
        </div>
      `).join('')
    : '<p style="color: #888;">No critical issues identified.</p>';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SEO Score Alert</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0 0 8px;">&#9888; SEO Score Alert</h1>
            <p style="margin: 0; opacity: 0.9; font-size: 14px;">${data.targetName}</p>
          </div>

          <!-- Content -->
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="margin: 0 0 12px; font-size: 18px;">Hi ${userName},</h2>
            <p style="margin: 0 0 24px; color: #555;">
              Your SEO score for <strong>${data.targetName}</strong> has dropped significantly.
            </p>

            <!-- Score Change -->
            <div style="background: #fff; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
              <div style="font-size: 48px; font-weight: bold;">
                <span style="color: #22c55e;">${data.oldScore}</span>
                <span style="color: #888; margin: 0 8px;">→</span>
                <span style="color: #ef4444;">${data.newScore}</span>
              </div>
              <p style="margin: 8px 0 0; color: #ef4444; font-weight: bold;">
                &#9660; ${data.dropPercent}% drop
              </p>
            </div>

            <!-- URL -->
            <p style="margin: 0 0 16px;">
              <strong>URL:</strong> <a href="${data.url}" style="color: #667eea;">${data.url}</a>
            </p>

            <!-- Top Issues -->
            <h3 style="margin: 0 0 12px; font-size: 16px;">Top Issues to Address</h3>
            <div style="margin-bottom: 24px;">
              ${issuesHtml}
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin-top: 24px;">
              <a href="${data.dashboardUrl}" style="display: inline-block; padding: 14px 28px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Full Audit Report</a>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 24px; color: #999; font-size: 12px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Synthex. All rights reserved.</p>
            <p style="margin: 4px 0 0;">You receive this because you have scheduled SEO audits enabled.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Store audit result and update target's lastRunAt and lastScore.
 */
export async function storeAuditResult(
  userId: string,
  target: ScheduledAuditTarget,
  result: AuditResult
): Promise<SEOAudit> {
  // Create audit record
  const audit = await prisma.sEOAudit.create({
    data: {
      userId,
      url: target.url,
      auditType: 'scheduled',
      overallScore: result.score,
      technicalScore: result.lighthouse,
      recommendations: result.issues,
      rawData: JSON.parse(JSON.stringify(result)),
    },
  });

  // Update target
  await prisma.scheduledAuditTarget.update({
    where: { id: target.id },
    data: {
      lastRunAt: new Date(),
      lastScore: result.score,
    },
  });

  return audit;
}
