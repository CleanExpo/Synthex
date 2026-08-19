/**
 * PR Distribution Submit (Phase 93) + AT-014 export gate
 *
 * POST /api/pr/press-releases/[id]/distribute
 *
 * Creates or updates PRDistribution records for the selected channels.
 * For the self-hosted channel, also publishes the release (status → published).
 *
 * Fail closed: release must already be `approved` (or `published`) and the
 * caller must pass posts:approve | organization:manage.
 *
 * @module app/api/pr/press-releases/[id]/distribute/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { orgIdScope } from '@/lib/auth/org-id-scope';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { enforceAgencyPermission } from '@/lib/agency/agency-api-auth';
import { DISTRIBUTION_CHANNELS } from '@/lib/pr/distribution-channels';
import {
  isPrExportCleared,
  PR_EXPORT_APPROVE_PERMISSIONS,
  prExportBlockedResponse,
} from '@/lib/pr/export-gate';

// ─── Validation ────────────────────────────────────────────────────────────────

const VALID_CHANNEL_IDS = DISTRIBUTION_CHANNELS.map(c => c.id) as [
  string,
  ...string[],
];

const DistributeSchema = z.object({
  channels: z.array(z.enum(VALID_CHANNEL_IDS)).min(1),
});

// ─── POST /api/pr/press-releases/[id]/distribute ──────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organisation context' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify ownership (org-scoped)
    const release = await prisma.pressRelease.findFirst({
      where: { id, ...orgIdScope(organizationId, userId) },
      select: { id: true, slug: true, orgId: true, status: true },
    });

    if (!release) {
      return NextResponse.json(
        { error: 'Press release not found' },
        { status: 404 }
      );
    }

    // AT-014: fail closed until owner/admin clearance (status approved|published)
    if (!isPrExportCleared(release.status)) {
      return prExportBlockedResponse(release.status);
    }

    const permDenied = await enforceAgencyPermission(
      userId,
      organizationId,
      PR_EXPORT_APPROVE_PERMISSIONS
    );
    if (permDenied) return permDenied;

    const body = await request.json();
    const parsed = DistributeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { channels } = parsed.data;
    const now = new Date();

    // Upsert a PRDistribution record for each channel
    const distributions = await Promise.all(
      channels.map(async channel => {
        return prisma.pRDistribution.upsert({
          where: {
            // Use a fallback unique key since Prisma upsert requires a unique field.
            // We create based on existing record lookup then update or create.
            id: await getExistingDistributionId(id, channel),
          },
          update: {
            status: 'submitted',
            submittedAt: now,
          },
          create: {
            releaseId: id,
            channel,
            status: 'submitted',
            submittedAt: now,
          },
        });
      })
    );

    // For self-hosted channel: publish the release
    let publicUrl: string | null = null;
    if (channels.includes('self-hosted')) {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';
      publicUrl = `${appUrl}/newsroom/${release.orgId}/${release.slug}`;

      await prisma.pressRelease.update({
        where: { id: release.id },
        data: {
          status: 'published',
          publishedAt: release.status !== 'published' ? now : undefined,
        },
      });

      // Mark self-hosted distribution as published
      const selfHosted = distributions.find(d => d.channel === 'self-hosted');
      if (selfHosted) {
        await prisma.pRDistribution.update({
          where: { id: selfHosted.id },
          data: {
            status: 'published',
            publishedAt: now,
            channelUrl: publicUrl,
          },
        });
      }
    }

    return NextResponse.json({ distributions, publicUrl });
  } catch (error) {
    console.error('[PR distribute POST]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the id of an existing PRDistribution for a given release + channel,
 * or a placeholder that causes Prisma upsert to always create.
 */
async function getExistingDistributionId(
  releaseId: string,
  channel: string
): Promise<string> {
  const existing = await prisma.pRDistribution.findFirst({
    where: { releaseId, channel },
    select: { id: true },
  });
  return existing?.id ?? `__new__${releaseId}__${channel}`;
}
