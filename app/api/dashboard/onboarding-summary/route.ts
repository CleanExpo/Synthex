/**
 * Dashboard Onboarding Summary API
 *
 * GET /api/dashboard/onboarding-summary
 *
 * Returns a lightweight summary of the user's onboarding analysis,
 * optimised for the dashboard WelcomeCard. Extracts key fields from
 * OnboardingProgress.auditData without sending the full payload.
 *
 * @module app/api/dashboard/onboarding-summary/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    // Find the user's org
    const org = await prisma.organization.findFirst({
      where: { users: { some: { id: userId } } },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json({ exists: false });
    }

    // Fetch onboarding progress + user name in parallel
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

    if (!progress || !progress.auditData) {
      return NextResponse.json({ exists: false });
    }

    // Extract key fields from the full auditData JSON
    const audit = progress.auditData as Record<string, unknown>;

    // SEO and health metrics
    const seoScore = (audit.seoScore as number) ?? (audit.seo_score as number) ?? null;
    const pageSpeedMobile = (audit.pageSpeedMobile as number) ?? (audit.pagespeed_mobile as number) ?? null;
    const pageSpeedDesktop = (audit.pageSpeedDesktop as number) ?? (audit.pagespeed_desktop as number) ?? null;

    // Brand and content
    const keyTopics = (audit.keyTopics as string[]) ?? (audit.key_topics as string[]) ?? [];
    const targetAudience = (audit.targetAudience as string) ?? (audit.target_audience as string) ?? null;
    const suggestedTone = (audit.suggestedTone as string) ?? (audit.suggested_tone as string) ?? null;
    const brandColours = (audit.brandColours as string[]) ?? (audit.brand_colours as string[]) ?? (audit.brandColors as string[]) ?? [];
    const industry = (audit.industry as string) ?? null;

    // Social profiles detected
    const socialProfiles = (audit.socialProfiles as Array<{ platform: string; url: string; verified?: boolean }>)
      ?? (audit.social_profiles as Array<{ platform: string; url: string; verified?: boolean }>)
      ?? [];
    const detectedPlatforms = socialProfiles.map((p) => p.platform).filter(Boolean);

    // Quick wins from analysis
    const quickWins = (audit.quickWins as string[]) ?? (audit.quick_wins as string[]) ?? [];

    return NextResponse.json({
      exists: true,
      userName: user?.name ?? null,
      businessName: progress.businessName,
      website: progress.website,
      postingMode: progress.postingMode,
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
