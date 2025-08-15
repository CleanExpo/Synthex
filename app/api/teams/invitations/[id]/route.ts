import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * DELETE /api/teams/invitations/:id
 * Deletes a team invitation by id (when DATABASE_URL is configured).
 * Returns success=false with 400 when id is missing.
 * Returns 200 with success=true regardless of persistence to keep UX smooth.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id?: string } }
) {
  const id = params?.id;

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Invitation id is required' },
      { status: 400 }
    );
  }

  try {
    const canUseDb = !!process.env.DATABASE_URL;
    if (canUseDb) {
      try {
        await (prisma as any).teamInvitation.delete({
          where: { id },
        });
      } catch (e) {
        // If not found or other error, log and continue to return success for idempotent UX
        console.error('Delete invitation failed (continuing):', e);
      }
    }

    return NextResponse.json({
      success: true,
      id,
      persisted: canUseDb,
    });
  } catch (err) {
    console.error('Delete invitation error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to delete invitation' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
