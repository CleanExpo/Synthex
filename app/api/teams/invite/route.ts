import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendTeamInviteEmail } from '@/lib/email';

type InvitePayload = {
  email?: string;
  role?: string;
  message?: string;
  campaignAccess?: string[] | string;
};

/**
 * POST /api/teams/invite
 * Accepts: { email, role, message?, campaignAccess? }
 * Returns: { success, data|error }
 *
 * Persists a TeamInvitation when DATABASE_URL is configured.
 * Falls back to a non-persistent response if DB is unavailable.
 */
export async function POST(req: Request) {
  try {
    let payload: InvitePayload = {};
    try {
      payload = await req.json();
    } catch {
      // allow empty body -> treat as invalid
    }

    const email = (payload.email || '').toString().trim();
    const role = (payload.role || '').toString().trim() || 'viewer';
    const message = (payload.message || '').toString();
    let campaignAccess = payload.campaignAccess;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Normalize campaignAccess to array of strings
    if (typeof campaignAccess === 'string') {
      campaignAccess = [campaignAccess];
    }
    if (!Array.isArray(campaignAccess)) {
      campaignAccess = [];
    }

    // Try to persist via Prisma if DATABASE_URL is set
    let persisted: any = null;
    const canUseDb = !!process.env.DATABASE_URL;
    if (canUseDb) {
      try {
        persisted = await (prisma as any).teamInvitation.create({
          data: {
            email,
            role,
            message,
            campaignAccess: campaignAccess as any,
            status: 'sent',
          },
        });
      } catch (e) {
        console.error('Prisma invitation create failed, falling back to non-persistent response:', e);
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
        console.error('Invite email send failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      data: invitation,
      emailQueued,
      message: persisted ? 'Invitation persisted' : 'Invitation sent',
    });
  } catch (err) {
    console.error('Invite error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to process invitation' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
