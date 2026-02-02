/**
 * User Logout API Route
 * POST /api/auth/logout
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-this';

// Helper function to verify JWT token
async function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = await verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Delete session from database
    const deletedSession = await prisma.session.deleteMany({
      where: { 
        token,
        userId: decoded.userId 
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: decoded.userId,
        action: 'user_logout',
        resource: 'authentication',
        resourceId: decoded.userId,
        category: 'auth',
        outcome: 'success',
        details: {
          email: decoded.email
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
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = await verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Delete all sessions for this user
    const deletedSessions = await prisma.session.deleteMany({
      where: { userId: decoded.userId }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: decoded.userId,
        action: 'user_logout_all_devices',
        resource: 'authentication',
        resourceId: decoded.userId,
        category: 'auth',
        severity: 'high',
        outcome: 'success',
        details: {
          email: decoded.email,
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
