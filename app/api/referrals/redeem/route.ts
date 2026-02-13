/**
 * Referral Redeem API
 *
 * POST /api/referrals/redeem - Redeem referral code during signup
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import prisma from '@/lib/prisma';

const RedeemSchema = z.object({
  code: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse({ error: 'User ID not found' }, 401);
    }

    const body = await request.json();
    const validation = RedeemSchema.safeParse(body);

    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid referral code' },
        400
      );
    }

    const { code } = validation.data;

    // Find referral by code
    const referral = await prisma.referral.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!referral) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid referral code' },
        404
      );
    }

    if (referral.refereeId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'This referral code has already been redeemed' },
        409
      );
    }

    // Can't refer yourself
    if (referral.referrerId === userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Cannot redeem your own referral code' },
        400
      );
    }

    // Link referral to new user
    await prisma.referral.update({
      where: { code: code.toUpperCase() },
      data: {
        refereeId: userId,
        status: 'signed_up',
        signedUpAt: new Date(),
        refereeRewarded: true, // Award referee immediately
      },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      message: 'Referral code redeemed successfully',
      reward: {
        type: referral.rewardType,
        amount: referral.rewardAmount,
      },
    });
  } catch (error) {
    console.error('Referral redeem POST error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to redeem referral code' },
      500
    );
  }
}
