/**
 * PR Distribution Submit (Phase 93)
 *
 * POST /api/pr/press-releases/[id]/distribute
 *
 * Creates or updates PRDistribution records for the selected channels.
 * For the self-hosted channel, also publishes the release (status → published).
 *
 * @module app/api/pr/press-releases/[id]/distribute/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { DISTRIBUTION_CHANNELS } from '@/lib/pr/distribution-channels';

// ─── Validation ────────────────────────────────────────────────────────────────

const VALID_CHANNEL_IDS = DISTRIBUTION_CHANNELS.map((c) => c.id) as [string, ...string[]];

const DistributeSchema = z.object({
  channels: z.array(z.enum(VALID_CHANNEL_IDS)).min(1),
});

// ─── POST /api/pr/press-releases/[id]/distribute ──────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const release = await prisma.pressRelease.findFirst({
      where: { id, orgId: userId },
      select: { id: true, slug: true, orgId: true, status: true },
    });

    if (!release) {
      return NextResponse.json({ error: 'Press release not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = DistributeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { channels } = parsed.data;
    const now = new Date();

    // Upsert a PRDistribution record for each channel
    const distributions = await Promise.all(
      channels.map(async (channel) => {
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
      }),
    );

    // For self-hosted channel: publish the release
    let publicUrl: string | null = null;
    if (channels.includes('self-hosted')) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.app';
      publicUrl = `${appUrl}/newsroom/${release.orgId}/${release.slug}`;

      await prisma.pressRelease.update({
        where: { id: release.id },
        data: {
          status: 'published',
          publishedAt: release.status !== 'published' ? now : undefined,
        },
      });

      // Mark self-hosted distribution as published
      const selfHosted = distributions.find((d) => d.channel === 'self-hosted');
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the id of an existing PRDistribution for a given release + channel,
 * or a placeholder that causes Prisma upsert to always create.
 */
async function getExistingDistributionId(releaseId: string, channel: string): Promise<string> {
  const existing = await prisma.pRDistribution.findFirst({
    where: { releaseId, channel },
    select: { id: true },
  });
  return existing?.id ?? `__new__${releaseId}__${channel}`;
}
