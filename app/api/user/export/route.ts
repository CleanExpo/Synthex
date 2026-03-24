/**
 * GDPR Data Export Endpoint — Art. 20 (Right to Data Portability)
 *
 * POST /api/user/export
 *
 * Returns a complete JSON dump of all personal data the platform holds for the
 * authenticated user. No request body required — the user is identified by their
 * auth token / cookie.
 *
 * Rate-limited to 5 requests per minute (authStrict preset).
 *
 * Data included:
 *   - User profile (no encrypted API keys, no reset tokens)
 *   - Campaigns owned by the user
 *   - Posts belonging to those campaigns
 *   - Platform connections (platform name and status only — tokens omitted)
 *   - User settings / preferences
 *   - Subscription information
 *
 * @module app/api/user/export
 */

import { NextRequest, NextResponse } from 'next/server';

import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import prisma from '@/lib/prisma';
import { authStrict } from '@/lib/rate-limit';
import { logAuditEvent } from '@/lib/audit/audit-logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportProfile {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  createdAt: Date;
  company: string | null;
  jobRole: string | null;
  bio: string | null;
  phone: string | null;
  website: string | null;
  timezone: string;
  authProvider: string;
  emailVerified: boolean | null;
  subscription: ExportSubscription | null;
}

interface ExportSubscription {
  plan: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialStart: Date | null;
  trialEnd: Date | null;
}

interface ExportCampaign {
  id: string;
  name: string;
  description: string | null;
  platform: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ExportPost {
  id: string;
  campaignId: string;
  content: string;
  platform: string;
  status: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
}

interface ExportPlatformConnection {
  platform: string;
  accountName: string | null;
  isActive: boolean;
  createdAt: Date;
}

interface ExportSettings {
  preferences: unknown;
  settings: unknown;
}

interface DataExport {
  exportedAt: string;
  userId: string;
  profile: ExportProfile;
  campaigns: ExportCampaign[];
  posts: ExportPost[];
  platformConnections: ExportPlatformConnection[];
  settings: ExportSettings | null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  return authStrict(request, async () => {
    // 1. Authenticate
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // Audit: record that a data export was requested (GDPR Art. 20 compliance trail)
    await logAuditEvent({
      event: 'account.data_exported',
      userId,
      metadata: { format: 'json' },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    // 2. Fetch all user data in parallel
    const [user, campaigns, platformConnections] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          createdAt: true,
          company: true,
          jobRole: true,
          bio: true,
          phone: true,
          website: true,
          timezone: true,
          authProvider: true,
          emailVerified: true,
          preferences: true,
          settings: true,
        },
      }),

      prisma.campaign.findMany({
        where: { userId, deletedAt: null },
        select: {
          id: true,
          name: true,
          description: true,
          platform: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }),

      prisma.platformConnection.findMany({
        where: { userId, deletedAt: null },
        select: {
          platform: true,
          profileName: true,
          isActive: true,
          createdAt: true,
          // accessToken and refreshToken are intentionally omitted —
          // they are encrypted and not human-readable personal data
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. Fetch posts for the campaigns we already retrieved
    const campaignIds = campaigns.map(c => c.id);
    const posts =
      campaignIds.length > 0
        ? await prisma.post.findMany({
            where: { campaignId: { in: campaignIds }, deletedAt: null },
            select: {
              id: true,
              campaignId: true,
              content: true,
              platform: true,
              status: true,
              scheduledAt: true,
              publishedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10000,
          })
        : [];

    // 4. Fetch subscription separately (1:1 relation stored by userId)
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        plan: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        trialStart: true,
        trialEnd: true,
      },
    });

    // 5. Assemble the export object
    const exportProfile: ExportProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      createdAt: user.createdAt,
      company: user.company,
      jobRole: user.jobRole,
      bio: user.bio,
      phone: user.phone,
      website: user.website,
      timezone: user.timezone,
      authProvider: user.authProvider,
      emailVerified: user.emailVerified,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            trialStart: subscription.trialStart,
            trialEnd: subscription.trialEnd,
          }
        : null,
    };

    const exportPlatformConnections: ExportPlatformConnection[] =
      platformConnections.map(pc => ({
        platform: pc.platform,
        accountName: pc.profileName,
        isActive: pc.isActive,
        createdAt: pc.createdAt,
      }));

    const exportSettings: ExportSettings | null =
      user.preferences !== null || user.settings !== null
        ? { preferences: user.preferences, settings: user.settings }
        : null;

    const dataExport: DataExport = {
      exportedAt: new Date().toISOString(),
      userId,
      profile: exportProfile,
      campaigns,
      posts,
      platformConnections: exportPlatformConnections,
      settings: exportSettings,
    };

    return NextResponse.json(dataExport, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="synthex-data-export-${userId}-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  });
}
