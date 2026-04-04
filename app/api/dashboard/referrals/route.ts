/**
 * app/api/dashboard/referrals/route.ts
 *
 * Dashboard: Referral program — referred users, earnings, link performance.
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

    let referralCode = '';
    let referredUsers: Array<{
      id: string;
      email?: string | null;
      joinedAt?: Date | string | null;
      status?: string | null;
      earnings?: number | null;
    }> = [];
    let totalEarnings = 0;
    let pendingPayout = 0;

    try {
      const prismaAny = prisma as unknown as Record<
        string,
        {
          findFirst?: (
            args: unknown
          ) => Promise<{ referralCode?: string | null } | null>;
          findMany?: (args: unknown) => Promise<typeof referredUsers>;
        }
      >;

      const userRecord = await prismaAny.user?.findFirst?.({
        where: { id: userId },
        select: { referralCode: true },
      } as unknown as Record<string, unknown>);
      referralCode =
        (userRecord as { referralCode?: string | null } | null)?.referralCode ??
        '';

      const referred =
        (await prismaAny.referral?.findMany?.({
          where: { referrerId: userId },
          orderBy: { joinedAt: 'desc' },
          take: 50,
        } as unknown as Record<string, unknown>)) ?? [];
      referredUsers = referred as typeof referredUsers;

      const payoutRecord = await prismaAny.referralPayout?.findFirst?.({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      } as unknown as Record<string, unknown>);
      const payout = payoutRecord as
        | { totalEarnings?: number; pendingAmount?: number }
        | null
        | undefined;
      totalEarnings = payout?.totalEarnings ?? 0;
      pendingPayout = payout?.pendingAmount ?? 0;
    } catch {
      // Models may not exist yet
    }

    const activeReferrals = referredUsers.filter(
      r => r.status === 'active'
    ).length;

    const data = {
      referralCode: referralCode || `REF-${userId.slice(0, 8).toUpperCase()}`,
      referralLink: `https://synthex.app/r/${referralCode || userId.slice(0, 8)}`,
      totalReferrals: referredUsers.length,
      activeReferrals,
      totalEarnings,
      pendingPayout,
      referredUsers: referredUsers.map(r => ({
        id: r.id,
        email: r.email ?? '***@***.com',
        joinedAt: r.joinedAt
          ? new Date(r.joinedAt).toISOString()
          : new Date().toISOString(),
        status: (r.status as 'pending' | 'active' | 'converted') ?? 'pending',
        earnings: r.earnings ?? 0,
      })),
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=120, stale-while-revalidate=30',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard/referrals]', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
