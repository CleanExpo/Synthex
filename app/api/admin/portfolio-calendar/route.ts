/**
 * Admin API: Unite Group portfolio marketing calendar
 *
 * GET  /api/admin/portfolio-calendar — every portfolio brand's draft slots for
 *      the 4 weeks, plus the read-only setup checks.
 * POST /api/admin/portfolio-calendar — { action: 'preview' | 'apply' } runs the
 *      brand setup and draft calendar (preview writes nothing). Undo is not
 *      offered here: it runs only from scripts/seed-portfolio-marketing-calendar.ts
 *      --undo against the manifest the operator saved, so no request body can
 *      name rows to delete.
 *
 * OWNER-ONLY via isOwnerEmail(). Writes only draft CalendarPost rows and brand
 * data; never changes calendar mode, live tier or publishing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';
import {
  applyPortfolioSetup,
  verifyPortfolioSetup,
  type PortfolioManifest,
} from '@/lib/marketing-calendar/portfolio-seed';
import { PORTFOLIO_CALENDAR_TAG } from '@/lib/marketing-calendar/portfolio-plan';
import { loadWorkspaceOrgs } from '@/lib/marketing-calendar/workspace';
import {
  PORTFOLIO_BRANDS,
  PORTFOLIO_WEEK_STARTS,
} from '@/lib/marketing-calendar/portfolio-brands';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function requireOwner(
  request: NextRequest,
  policy: (typeof DEFAULT_POLICIES)[keyof typeof DEFAULT_POLICIES]
): Promise<{ userId: string } | { error: NextResponse }> {
  const security = await APISecurityChecker.check(request, policy);
  if (!security.allowed) {
    return {
      error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    };
  }
  const userId = security.context.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user || !isOwnerEmail(user.email)) {
    return {
      error: NextResponse.json(
        { error: 'Owner access required' },
        { status: 403 }
      ),
    };
  }
  return { userId };
}

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('preview') }),
  z.object({ action: z.literal('apply') }),
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireOwner(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
  if ('error' in auth) return auth.error;

  // Workspace members only: an org that merely shares a brand slug is not read.
  const orgs = [...(await loadWorkspaceOrgs()).values()];
  const slugOf = new Map(orgs.map(o => [o.id, o.slug]));
  const posts = await prisma.calendarPost.findMany({
    where: {
      tags: { has: PORTFOLIO_CALENDAR_TAG },
      organizationId: { in: orgs.map(o => o.id) },
    },
    select: {
      id: true,
      title: true,
      status: true,
      platforms: true,
      scheduledFor: true,
      mediaUrls: true,
      organizationId: true,
      metadata: true,
    },
    orderBy: { scheduledFor: 'asc' },
  });
  const verify = await verifyPortfolioSetup();

  return NextResponse.json({
    weeks: PORTFOLIO_WEEK_STARTS,
    brands: PORTFOLIO_BRANDS.map(b => ({
      orgSlug: b.orgSlug,
      label: b.label,
      colour: b.colours.primary,
      videosPerWeek: b.videosPerWeek,
      heldReason: b.publicContentHeldReason ?? null,
      live: b.liveStatus.live,
    })),
    slots: posts.map(p => {
      const m = (p.metadata ?? {}) as Record<string, unknown>;
      return {
        id: p.id,
        orgSlug: slugOf.get(p.organizationId) ?? null,
        title: p.title,
        status: p.status,
        platforms: p.platforms,
        scheduledFor: p.scheduledFor.toISOString(),
        scheduledLocal: m.scheduledLocal ?? null,
        weekStart: m.weekStart ?? null,
        slotKey: m.slotKey ?? null,
        slotKind: m.slotKind ?? null,
        approvalState: m.approvalState ?? null,
        videoStatus:
          (m.videoDelivery as { status?: string } | null)?.status ?? null,
        mediaUrl: p.mediaUrls[0] ?? null,
      };
    }),
    verify,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireOwner(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if ('error' in auth) return auth.error;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const write = parsed.data.action === 'apply';
    const manifest = await applyPortfolioSetup({
      write,
      ownerUserId: auth.userId,
    });
    if (write) {
      logger.info('[portfolio-calendar] setup applied', {
        userId: auth.userId,
        posts: manifest.calendarPosts.length,
        orgsCreated: manifest.createdOrganizations.length,
      });
    }
    return NextResponse.json({ manifest });
  } catch (err) {
    const partial = (err as { manifest?: PortfolioManifest }).manifest ?? null;
    logger.error('[portfolio-calendar] failed', {
      userId: auth.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    // The partial manifest is returned so whatever was written can be undone.
    return NextResponse.json(
      {
        error: 'Portfolio calendar setup failed',
        message: err instanceof Error ? err.message : 'unknown',
        manifest: partial,
      },
      { status: 500 }
    );
  }
}
