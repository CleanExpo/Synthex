import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/teams/invitations
 * Returns a list of team invitations (most recent first).
 * If DATABASE_URL is not configured, returns an empty list.
 */
export async function GET() {
  try {
    const canUseDb = !!process.env.DATABASE_URL;
    if (!canUseDb) {
      return NextResponse.json({
        success: true,
        data: [],
        persisted: false,
      });
    }

    // List invitations (limit reasonable default)
    const invitations = await (prisma as any).teamInvitation.findMany({
      orderBy: { sentAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      data: invitations,
      persisted: true,
    });
  } catch (err) {
    console.error('List invitations error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
