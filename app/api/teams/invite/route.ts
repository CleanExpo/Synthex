import { NextResponse } from 'next/server';

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
 * This is a functional stub: it validates input and echoes a success response.
 * Replace with real invitation logic (DB writes, email, etc.) as needed.
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

    // Simulate invitation creation
    const invitation = {
      id: `invite_${Date.now()}`,
      email,
      role,
      message,
      campaignAccess,
      status: 'sent',
      sentAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: invitation,
      message: 'Invitation sent',
    });
  } catch (err) {
    console.error('Invite error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to process invitation' },
      { status: 500 }
    );
  }
}
