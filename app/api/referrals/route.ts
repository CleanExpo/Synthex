/**
 * Referrals API
 *
 * GET /api/referrals - Generate referral code + list referrals & stats
 * POST /api/referrals - Send invite email with referral code
 *
 * Code format: SYN-XXXX (4 random alphanumeric chars)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import prisma from '@/lib/prisma';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes confusing chars I/O/0/1
  const bytes = randomBytes(4); // Cryptographically secure random bytes
  let code = 'SYN-';
  for (let i = 0; i < 4; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
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

    // Get existing referrals
    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        refereeEmail: true,
        status: true,
        referrerRewarded: true,
        rewardType: true,
        rewardAmount: true,
        createdAt: true,
        signedUpAt: true,
        convertedAt: true,
      },
    });

    // Generate a referral code if user doesn't have one yet
    let activeCode = referrals.find(
      (r) => r.status === 'sent' || r.status === 'clicked'
    )?.code;

    if (!activeCode) {
      // Create a reusable code for the user
      let code: string;
      let attempts = 0;
      do {
        code = generateReferralCode();
        attempts++;
      } while (
        attempts < 10 &&
        (await prisma.referral.findUnique({ where: { code } }))
      );
      activeCode = code;
    }

    // Stats
    const stats = {
      totalSent: referrals.length,
      signedUp: referrals.filter((r) => ['signed_up', 'converted'].includes(r.status)).length,
      converted: referrals.filter((r) => r.status === 'converted').length,
      rewardsEarned: referrals
        .filter((r) => r.referrerRewarded)
        .reduce((sum, r) => sum + (r.rewardAmount || 0), 0),
    };

    return APISecurityChecker.createSecureResponse({
      success: true,
      referralCode: activeCode,
      referralLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.ai'}/signup?ref=${activeCode}`,
      referrals,
      stats,
    });
  } catch (error) {
    console.error('Referrals GET error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch referrals' },
      500
    );
  }
}

const InviteSchema = z.object({
  email: z.string().email(),
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
    const validation = InviteSchema.safeParse(body);

    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid email address' },
        400
      );
    }

    const { email } = validation.data;

    // Check if already referred
    const existing = await prisma.referral.findFirst({
      where: { referrerId: userId, refereeEmail: email },
    });

    if (existing) {
      return APISecurityChecker.createSecureResponse(
        { error: 'This email has already been referred' },
        409
      );
    }

    // Generate unique code
    let code: string;
    let attempts = 0;
    do {
      code = generateReferralCode();
      attempts++;
    } while (
      attempts < 10 &&
      (await prisma.referral.findUnique({ where: { code } }))
    );

    const referral = await prisma.referral.create({
      data: {
        referrerId: userId,
        refereeEmail: email,
        code,
        status: 'sent',
        rewardType: 'credits',
        rewardAmount: 500, // 500 bonus AI credits for both parties
      },
    });

    // TODO(UNI-475): Send referral invite email once email provider is wired up in lib/email-service.ts
    // emailService.sendReferralInvite(email, code, referrerName);

    return APISecurityChecker.createSecureResponse({
      success: true,
      referral: {
        id: referral.id,
        code: referral.code,
        email: referral.refereeEmail,
        link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.ai'}/signup?ref=${code}`,
      },
    });
  } catch (error) {
    console.error('Referrals POST error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to create referral' },
      500
    );
  }
}

export const runtime = 'nodejs';
