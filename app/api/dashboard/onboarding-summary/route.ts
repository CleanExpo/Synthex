/**
 * Dashboard Onboarding Summary API
 *
 * GET /api/dashboard/onboarding-summary
 *
 * Returns a lightweight summary of the user's onboarding analysis,
 * optimised for the dashboard WelcomeCard. Prefers Organization columns
 * (durable) and falls back to OnboardingProgress.auditData.
 *
 * @module app/api/dashboard/onboarding-summary/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { brandColourListFromAudit } from '@/lib/onboarding/org-profile-from-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const org = await prisma.organization.findFirst({
      where: { users: { some: { id: userId } } },
      select: {
        id: true,
        name: true,
        website: true,
        industry: true,
        description: true,
        primaryColor: true,
        socialHandles: true,
        aiGeneratedData: true,
      },
    });

    if (!org) {
      return NextResponse.json({ exists: false });
    }

    const [progress, user] = await Promise.all([
      prisma.onboardingProgress.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: org.id,
          },
        },
        select: {
          businessName: true,
          website: true,
          auditData: true,
          postingMode: true,
          socialProfileUrls: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
    ]);

    const audit =
      (progress?.auditData as Record<string, unknown> | null) ?? null;
    const ai =
      org.aiGeneratedData &&
      typeof org.aiGeneratedData === 'object' &&
      !Array.isArray(org.aiGeneratedData)
        ? (org.aiGeneratedData as Record<string, unknown>)
        : null;

    const hasIdentity =
      Boolean(org.name) ||
      Boolean(progress?.businessName) ||
      Boolean(audit) ||
      Boolean(ai);

    if (!hasIdentity) {
      return NextResponse.json({ exists: false });
    }

    const seoScore =
      (typeof ai?.seoScore === 'number' ? ai.seoScore : null) ??
      (typeof audit?.seoScore === 'number' ? audit.seoScore : null) ??
      (typeof audit?.seo_score === 'number' ? audit.seo_score : null);

    const pageSpeed =
      (ai?.pageSpeed as Record<string, number> | null) ??
      (audit?.pageSpeed as Record<string, number> | null) ??
      null;
    const pageSpeedMobile =
      pageSpeed?.mobile ??
      (typeof audit?.pageSpeedMobile === 'number'
        ? audit.pageSpeedMobile
        : null) ??
      (typeof audit?.pagespeed_mobile === 'number'
        ? audit.pagespeed_mobile
        : null);
    const pageSpeedDesktop =
      pageSpeed?.desktop ??
      (typeof audit?.pageSpeedDesktop === 'number'
        ? audit.pageSpeedDesktop
        : null) ??
      (typeof audit?.pagespeed_desktop === 'number'
        ? audit.pagespeed_desktop
        : null);

    const keyTopics =
      (Array.isArray(ai?.keyTopics) ? (ai.keyTopics as string[]) : null) ??
      (Array.isArray(audit?.keyTopics)
        ? (audit.keyTopics as string[])
        : null) ??
      (Array.isArray(audit?.key_topics)
        ? (audit.key_topics as string[])
        : []) ??
      [];

    const targetAudience =
      (typeof ai?.targetAudience === 'string' ? ai.targetAudience : null) ??
      (typeof audit?.targetAudience === 'string'
        ? audit.targetAudience
        : null) ??
      (typeof audit?.target_audience === 'string'
        ? audit.target_audience
        : null);

    const suggestedTone =
      (typeof ai?.suggestedTone === 'string' ? ai.suggestedTone : null) ??
      (typeof audit?.suggestedTone === 'string' ? audit.suggestedTone : null) ??
      (typeof audit?.suggested_tone === 'string' ? audit.suggested_tone : null);

    const brandColours = brandColourListFromAudit(
      (ai?.brandColours as
        | { primary?: string; secondary?: string; accent?: string }
        | string[]
        | null) ??
        (audit?.brandColours as
          | { primary?: string; secondary?: string; accent?: string }
          | string[]
          | null) ??
        (audit?.brand_colours as string[] | null) ??
        (audit?.brandColors as string[] | null) ??
        (org.primaryColor ? [org.primaryColor] : null)
    );

    const industry =
      org.industry ??
      (typeof ai?.industry === 'string' ? ai.industry : null) ??
      (typeof audit?.industry === 'string' ? audit.industry : null);

    const socialProfiles =
      (audit?.socialProfiles as Array<{
        platform: string;
        url: string;
        verified?: boolean;
      }>) ??
      (audit?.social_profiles as Array<{
        platform: string;
        url: string;
        verified?: boolean;
      }>) ??
      [];

    const handlesFromOrg =
      org.socialHandles &&
      typeof org.socialHandles === 'object' &&
      !Array.isArray(org.socialHandles)
        ? Object.keys(org.socialHandles as Record<string, string>)
        : [];

    const detectedPlatforms =
      socialProfiles.map(p => p.platform).filter(Boolean).length > 0
        ? socialProfiles.map(p => p.platform).filter(Boolean)
        : handlesFromOrg;

    const quickWins =
      (Array.isArray(ai?.quickWins) ? (ai.quickWins as string[]) : null) ??
      (Array.isArray(audit?.quickWins)
        ? (audit.quickWins as string[])
        : null) ??
      (Array.isArray(audit?.quick_wins)
        ? (audit.quick_wins as string[])
        : []) ??
      [];

    return NextResponse.json({
      exists: true,
      userName: user?.name ?? null,
      businessName: progress?.businessName ?? org.name,
      website: progress?.website ?? org.website,
      description: org.description,
      postingMode: progress?.postingMode ?? null,
      seoScore,
      pageSpeedMobile,
      pageSpeedDesktop,
      keyTopics: keyTopics.slice(0, 5),
      targetAudience,
      suggestedTone,
      brandColours: brandColours.slice(0, 5),
      industry,
      detectedPlatforms,
      quickWins: quickWins.slice(0, 3),
    });
  } catch (error) {
    console.error('[dashboard/onboarding-summary GET]', error);
    return NextResponse.json({ exists: false });
  }
}
