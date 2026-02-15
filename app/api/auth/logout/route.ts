/**
 * User Logout API Route
 * POST /api/auth/logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies, verifyTokenSafe, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    // Extract raw token for session deletion
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : request.cookies.get('auth-token')?.value;
    const tokenPayload = token ? verifyTokenSafe(token) : null;

    // Delete session from database
    const deletedSession = token ? await prisma.session.deleteMany({
      where: {
        token,
        userId
      }
    }) : { count: 0 };

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'user_logout',
        resource: 'authentication',
        resourceId: userId,
        category: 'auth',
        outcome: 'success',
        details: {
          email: tokenPayload?.email || ''
        }
      }
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Logout successful',
      sessionsDeleted: deletedSession.count
    });

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed. Please try again.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Logout from all devices (clear all sessions)
 * DELETE /api/auth/logout
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate the request
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : request.cookies.get('auth-token')?.value;
    const tokenPayload = token ? verifyTokenSafe(token) : null;

    // Delete all sessions for this user
    const deletedSessions = await prisma.session.deleteMany({
      where: { userId }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'user_logout_all_devices',
        resource: 'authentication',
        resourceId: userId,
        category: 'auth',
        severity: 'high',
        outcome: 'success',
        details: {
          email: tokenPayload?.email || '',
          sessionsDeleted: deletedSessions.count
        }
      }
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Logged out from all devices successfully',
      sessionsDeleted: deletedSessions.count
    });

  } catch (error) {
    console.error('Logout all devices error:', error);
    return NextResponse.json(
      { error: 'Failed to logout from all devices' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export const runtime = 'nodejs';
