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
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import prisma from '@/lib/prisma';
import { email as emailService } from '@/lib/email/index';
import { logger } from '@/lib/logger';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
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

    // Retrieve or lazily generate a stored random referral code for this user
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    let personalCode = userRecord?.referralCode ?? null;
    if (!personalCode) {
      // Generate a cryptographically random code and persist it
      personalCode = generateReferralCode();
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: personalCode },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';
    const referralLink = `${appUrl}/ref/${personalCode}`;

    // Stats
    const stats = {
      totalSent: referrals.length,
      signedUp: referrals.filter(r =>
        ['signed_up', 'converted'].includes(r.status)
      ).length,
      converted: referrals.filter(r => r.status === 'converted').length,
      rewardsEarned: referrals
        .filter(r => r.referrerRewarded)
        .reduce((sum, r) => sum + (r.rewardAmount || 0), 0),
    };

    return APISecurityChecker.createSecureResponse({
      success: true,
      referralCode: personalCode,
      referralLink,
      referrals,
      stats,
    });
  } catch (error) {
    logger.error('Referrals GET error:', error);
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
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
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

    // Guard against loop exhaustion — ensure the final code is actually free
    const isCodeTaken = await prisma.referral.findUnique({ where: { code } });
    if (isCodeTaken) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Could not generate a unique invite code. Please try again.' },
        500
      );
    }

    // Fetch referrer name in parallel while creating the referral record.
    // Wrap prisma.referral.create in a try/catch to handle the P2002 unique
    // constraint violation that can occur in a race condition where two
    // concurrent requests slip past the optimistic findFirst guard above.
    let referral: Awaited<ReturnType<typeof prisma.referral.create>>;
    let referrer: { name: string | null } | null;

    try {
      [referral, referrer] = await Promise.all([
        prisma.referral.create({
          data: {
            referrerId: userId,
            refereeEmail: email,
            code,
            status: 'sent',
            rewardType: 'credits',
            rewardAmount: 500, // 500 bonus AI credits for both parties
          },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        }),
      ]);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        return APISecurityChecker.createSecureResponse(
          {
            error: 'An invitation has already been sent to this email address.',
          },
          409
        );
      }
      throw error; // re-throw non-constraint errors to the outer catch
    }

    const referrerName = referrer?.name || 'A SYNTHEX user';
    // HTML-escape the referrer name before interpolating into the email body
    // to prevent XSS if a user has set a malicious display name.
    const safeReferrerName = escapeHtml(referrerName);
    const signupUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social'}/signup?ref=${code}`;

    // Send referral invite email — non-blocking so referral succeeds even if email fails
    emailService
      .send({
        to: email,
        subject: `${safeReferrerName} invited you to SYNTHEX`,
        html: `<p>Hi there!</p><p>${safeReferrerName} has invited you to join SYNTHEX. Sign up with your referral link to receive 500 bonus AI credits: <a href="${signupUrl}">${signupUrl}</a></p>`,
        text: `${referrerName} invited you to join SYNTHEX! Sign up here to get 500 bonus AI credits: ${signupUrl}`,
        type: 'transactional',
      })
      .catch((err: unknown) =>
        logger.error('[referrals] Failed to send invite email:', err)
      );

    return APISecurityChecker.createSecureResponse({
      success: true,
      referral: {
        id: referral.id,
        code: referral.code,
        email: referral.refereeEmail,
        link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social'}/signup?ref=${code}`,
      },
    });
  } catch (error) {
    logger.error('Referrals POST error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to create referral' },
      500
    );
  }
}

export const runtime = 'nodejs';
