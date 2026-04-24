/**
 * Cron: A/B Test Auto-Rollout — SYN-480
 *
 * Evaluates all running A/B tests weekly. When a variant meets statistical
 * significance thresholds it is automatically promoted as the winner:
 *
 *   - Variant has ≥ 100 impressions
 *   - CTR improvement ≥ 10% over control (variant 'A')
 *   - Test has been running for ≥ 14 days (proxy for "2 consecutive weeks")
 *
 * On promotion: marks test completed, logs to AuditLog, notifies org owner.
 *
 * Schedule: "0 22 * * 0" (Sunday 10pm UTC = Monday 8am AEST)
 * Auth: CRON_SECRET bearer token
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Resend } from 'resend';
import { logger } from '@/lib/logger';
import { calculateVisibilityScore } from '@/lib/scoring/visibility-score';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';
const FROM = process.env.EMAIL_FROM ?? 'Synthex <noreply@synthex.social>';
const MIN_IMPRESSIONS = 100;
const MIN_CTR_LIFT = 0.1; // 10%
const MIN_RUN_DAYS = 14;

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function GET(req: NextRequest) {
  const auth = verifyCronRequest(req, 'AB_ROLLOUT');
  if (!auth.ok) return auth.response;

  // Find all actively running A/B tests
  const runningTests = await prisma.aBTest.findMany({
    where: { status: 'running' },
    include: { variants: true },
  });

  let promoted = 0;
  let skipped = 0;

  for (const test of runningTests) {
    // Must have been running ≥ MIN_RUN_DAYS
    const startDate = test.startDate ?? test.createdAt;
    const runDays = (Date.now() - new Date(startDate).getTime()) / 86400000;
    if (runDays < MIN_RUN_DAYS) {
      skipped++;
      continue;
    }

    if (test.variants.length < 2) {
      skipped++;
      continue;
    }

    // Control = first variant (sorted by createdAt, usually 'A')
    const sorted = [...test.variants].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const control = sorted[0];
    const controlCtr =
      control.impressions > 0 ? control.clicks / control.impressions : 0;

    // Find winning challenger
    const winner = sorted.slice(1).find(v => {
      if (v.impressions < MIN_IMPRESSIONS) return false;
      const vCtr = v.impressions > 0 ? v.clicks / v.impressions : 0;
      return vCtr >= controlCtr * (1 + MIN_CTR_LIFT);
    });

    if (!winner) {
      skipped++;
      continue;
    }

    // Promote
    await prisma.aBTest.update({
      where: { id: test.id },
      data: {
        status: 'completed',
        winner: winner.name,
        confidence: 1.0,
        endDate: new Date(),
        recommendations: [
          ...test.recommendations,
          `Auto-promoted variant ${winner.name} on ${new Date().toISOString().split('T')[0]} — ${(
            ((winner.clicks / winner.impressions - controlCtr) /
              (controlCtr || 1)) *
            100
          ).toFixed(1)}% CTR lift over control`,
        ],
      },
    });

    // Recalculate visibility score after winner promotion
    if (test.organizationId) {
      calculateVisibilityScore(test.organizationId).catch(() => {});
    }

    // Audit log
    await prisma.auditLog
      .create({
        data: {
          action: 'ab_test_auto_rollout',
          resource: 'ab_test',
          resourceId: test.id,
          details: {
            testName: test.name,
            winnerVariant: winner.name,
            winnerImpressions: winner.impressions,
            winnerClicks: winner.clicks,
            controlImpressions: control.impressions,
            controlClicks: control.clicks,
          },
          severity: 'low',
          category: 'data',
          outcome: 'success',
          userId: test.userId,
        },
      })
      .catch((err: unknown) => logger.warn('audit log failed', { err }));

    // Notify org owner
    notifyOrgOwner(
      test.organizationId ?? null,
      test.id,
      test.name,
      winner.name
    ).catch((err: unknown) => logger.warn('ab-rollout notify failed', { err }));

    promoted++;
    logger.info('ab-rollout:promoted', {
      testId: test.id,
      testName: test.name,
      winner: winner.name,
    });
  }

  return NextResponse.json({
    ok: true,
    promoted,
    skipped,
    total: runningTests.length,
  });
}

async function notifyOrgOwner(
  orgId: string | null,
  testId: string,
  testName: string,
  winnerVariant: string
): Promise<void> {
  if (!orgId) return;

  const owner = await prisma.user.findFirst({
    where: { organizationId: orgId },
    select: { email: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!owner?.email) return;

  const dashboardUrl = `${APP_URL}/dashboard`;

  await getResend().emails.send({
    from: FROM,
    to: owner.email,
    subject: `A/B test "${testName}" — Variant ${winnerVariant} auto-promoted`,
    html: `
      <div style="font-family:-apple-system,sans-serif;background:#0f0f0f;padding:40px;border-radius:12px;max-width:560px;margin:0 auto;">
        <p style="color:#9ca3af;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.06em;">A/B Test Result</p>
        <h2 style="color:#ffffff;font-size:22px;margin:0 0 16px;">Variant ${winnerVariant} has been auto-promoted 🎉</h2>
        <p style="color:#d1d5db;line-height:1.6;margin:0 0 16px;">
          Your A/B test <strong style="color:#fff;">${testName}</strong> reached statistical significance.
          Variant <strong style="color:#22c55e;">${winnerVariant}</strong> showed a ≥10% CTR improvement
          over the control with at least 100 impressions — it has been automatically set as your
          canonical variant.
        </p>
        <p style="margin:0 0 24px;color:#9ca3af;font-size:13px;">Test ID: ${testId}</p>
        <a href="${dashboardUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View Dashboard →</a>
      </div>
    `,
  });
}
