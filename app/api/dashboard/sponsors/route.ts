/**
 * app/api/dashboard/sponsors/route.ts
 *
 * Dashboard: Sponsorship deals and revenue tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prisma } = await import('@/lib/prisma');

    let deals: Array<{
      id: string;
      companyName?: string | null;
      logoUrl?: string | null;
      dealValue?: number | null;
      currency?: string | null;
      status?: string | null;
      startDate?: Date | string | null;
      endDate?: Date | string | null;
      platform?: string | null;
      deliverables?: unknown;
      contactEmail?: string | null;
    }> = [];

    try {
      const prismaAny = prisma as unknown as Record<
        string,
        {
          findMany: (args: unknown) => Promise<typeof deals>;
        }
      >;
      deals =
        (await (
          prismaAny.sponsorDeal ??
          prismaAny.sponsorship ??
          prismaAny.sponsor
        )?.findMany({
          where: { userId },
          orderBy: { startDate: 'desc' },
          take: 50,
        })) ?? [];
    } catch {
      // Model may not exist yet
    }

    const activeDeals = deals.filter(d => d.status === 'active').length;
    const pendingDeals = deals.filter(
      d => d.status === 'pending' || d.status === 'negotiating'
    ).length;
    const totalRevenue = deals
      .filter(d => d.status === 'active' || d.status === 'completed')
      .reduce((s, d) => s + (d.dealValue ?? 0), 0);

    const data = {
      totalRevenue,
      activeDeals,
      pendingDeals,
      deals: deals.map(d => ({
        id: d.id,
        companyName: d.companyName ?? 'Unknown Company',
        logoUrl: d.logoUrl ?? undefined,
        dealValue: d.dealValue ?? 0,
        currency: d.currency ?? 'USD',
        status:
          (d.status as 'active' | 'pending' | 'completed' | 'negotiating') ??
          'pending',
        startDate: d.startDate
          ? new Date(d.startDate).toISOString()
          : new Date().toISOString(),
        endDate: d.endDate ? new Date(d.endDate).toISOString() : undefined,
        platform: d.platform ?? 'Unknown',
        deliverables: Array.isArray(d.deliverables) ? d.deliverables : [],
        contactEmail: d.contactEmail ?? undefined,
      })),
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard/sponsors]', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
