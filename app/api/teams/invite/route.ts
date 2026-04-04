import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { sendTeamInviteEmail } from '@/lib/email';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1).max(50).optional(),
  message: z.string().max(2000).optional(),
  campaignAccess: z.union([z.array(z.string()), z.string()]).optional(),
});

/**
 * POST /api/teams/invite
 * Accepts: { email, role, message?, campaignAccess? }
 * Returns: { success, data|error }
 *
 * REQUIRES AUTHENTICATION - Only authenticated users can send invitations.
 *
 * Persists a TeamInvitation when DATABASE_URL is configured.
 * Falls back to a non-persistent response if DB is unavailable.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token verification (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */
export async function POST(req: NextRequest) {
  // Security check - requires authentication with write permissions
  const security = await APISecurityChecker.check(
    req,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { success: false, error: security.error || 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  try {
    let rawPayload: unknown = {};
    try {
      rawPayload = await req.json();
    } catch {
      // allow empty body -> treat as invalid below
    }

    const parsed = InviteSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const email = parsed.data.email;
    const role = parsed.data.role?.trim() || 'viewer';
    const message = parsed.data.message || '';

    // Normalize campaignAccess to array of strings
    let campaignAccess: string[];
    const rawAccess = parsed.data.campaignAccess;
    if (typeof rawAccess === 'string') {
      campaignAccess = [rawAccess];
    } else if (Array.isArray(rawAccess)) {
      campaignAccess = rawAccess;
    } else {
      campaignAccess = [];
    }

    // Try to persist via Prisma if DATABASE_URL is set
    interface TeamInvitation {
      id: string;
      email: string;
      role: string;
      message?: string;
      campaignAccess: string[];
      status: string;
      userId: string;
      createdAt: Date;
    }
    interface PrismaWithTeamInvitation {
      teamInvitation?: {
        create: (args: {
          data: Record<string, unknown>;
        }) => Promise<TeamInvitation>;
      };
    }
    let persisted: TeamInvitation | null = null;
    const canUseDb = !!process.env.DATABASE_URL;
    if (canUseDb) {
      try {
        const teamInvitationModel = (
          prisma as unknown as PrismaWithTeamInvitation
        ).teamInvitation;
        if (teamInvitationModel) {
          persisted = await teamInvitationModel.create({
            data: {
              email,
              role,
              message,
              campaignAccess: campaignAccess,
              status: 'sent',
              userId: security.context.userId, // Track who sent the invitation
            },
          });
        }
      } catch (e) {
        logger.error(
          'Prisma invitation create failed, falling back to non-persistent response:',
          e
        );
      }
    }

    const invitation = persisted || {
      id: `invite_${Date.now()}`,
      email,
      role,
      message,
      campaignAccess,
      status: 'sent',
      sentAt: new Date().toISOString(),
    };

    // Best-effort email dispatch if provider is configured; do not fail request on email error
    let emailQueued = false;
    if (process.env.EMAIL_PROVIDER && process.env.EMAIL_FROM) {
      try {
        await sendTeamInviteEmail({
          to: email,
          role,
          message,
          inviterName: undefined,
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
        });
        emailQueued = true;
      } catch (e) {
        logger.error('Invite email send failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      data: invitation,
      emailQueued,
      message: persisted ? 'Invitation persisted' : 'Invitation sent',
    });
  } catch (err) {
    logger.error('Invite error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to process invitation' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
