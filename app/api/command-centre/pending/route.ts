/**
 * Command Centre — Pending Approvals API
 *
 * GET /api/command-centre/pending
 * Returns draft posts from autopilot that need human review.
 *
 * @module app/api/command-centre/pending/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get('limit') ?? '10'))
  );

  // Find draft posts from autopilot campaigns
  const pendingPosts = await prisma.post.findMany({
    where: {
      campaign: { organizationId },
      status: 'draft',
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      content: true,
      platform: true,
      status: true,
      scheduledAt: true,
      metadata: true,
      createdAt: true,
      campaign: {
        select: { id: true, name: true },
      },
    },
  });

  // Filter to autopilot-sourced posts
  const autopilotPending = pendingPosts.filter(p => {
    const meta = p.metadata as Record<string, unknown> | null;
    return meta?.source === 'autopilot';
  });

  return NextResponse.json({
    items: autopilotPending.map(p => {
      const meta = p.metadata as Record<string, unknown> | null;
      return {
        id: p.id,
        content: p.content,
        platform: p.platform,
        status: p.status,
        scheduledAt: p.scheduledAt,
        createdAt: p.createdAt,
        campaignName: p.campaign.name,
        score: meta?.scoreOverall ?? null,
        theme: meta?.theme ?? null,
        qualityDecision: meta?.qualityDecision ?? null,
      };
    }),
    total: autopilotPending.length,
  });
}
