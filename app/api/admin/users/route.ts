/**
 * Admin Users Management API
 *
 * Provides admin-only endpoints for user management including
 * listing, status updates, and user details.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - ADMIN_API_KEY (SECRET)
 *
 * @module app/api/admin/users/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { admin as adminRateLimit } from '@/lib/middleware/api-rate-limit';

// =============================================================================
// Schemas
// =============================================================================

const listUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  search: z.string().max(200).optional(),
  verified: z.enum(['true', 'false', 'all']).optional().default('all'),
  sortBy: z.enum(['createdAt', 'email', 'name', 'lastLogin']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const updateUserStatusSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['suspend', 'activate', 'delete']),
  reason: z.string().max(500).optional(),
});

// =============================================================================
// Admin Auth
// =============================================================================

async function verifyAdmin(request: NextRequest): Promise<{
  isAdmin: boolean;
  userId?: string;
  error?: string;
}> {
  // Check for admin API key
  const apiKey = request.headers.get('x-admin-api-key');
  if (apiKey && apiKey === process.env.ADMIN_API_KEY) {
    return { isAdmin: true };
  }

  // Check for JWT token with admin role
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { isAdmin: false, error: 'Authentication required' };
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { verifyToken } = await import('@/lib/auth/jwt-utils');
    const decoded = verifyToken(token) as {
      userId: string;
      role?: string;
    };

    // Check if user is admin via preferences JSON field
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, preferences: true },
    });

    const prefs = user?.preferences as { role?: string } | null;
    if (!user || (prefs?.role !== 'admin' && prefs?.role !== 'superadmin')) {
      return { isAdmin: false, userId: decoded.userId, error: 'Admin access required' };
    }

    return { isAdmin: true, userId: decoded.userId };
  } catch {
    return { isAdmin: false, error: 'Invalid token' };
  }
}

// =============================================================================
// GET - List Users
// =============================================================================

export async function GET(request: NextRequest) {
  // Distributed rate limiting via Upstash Redis
  return adminRateLimit(request, async () => {
  try {
    const auth = await verifyAdmin(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: auth.error || 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      query[key] = value;
    });

    const validation = listUsersQuerySchema.safeParse(query);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { page, limit, search, verified, sortBy, sortOrder } = validation.data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (verified !== 'all') {
      where.emailVerified = verified === 'true';
    }

    // Get total count
    const total = await prisma.user.count({ where });

    // Get users
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        emailVerified: true,
        authProvider: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
      orderBy: { [sortBy === 'lastLogin' ? 'lastLogin' : sortBy]: sortOrder },
      skip,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + users.length < total,
      },
    });
  } catch (error: unknown) {
    console.error('Admin list users error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process request') },
      { status: 500 }
    );
  }
  });
}

// =============================================================================
// POST - Update User Status
// =============================================================================

export async function POST(request: NextRequest) {
  // Distributed rate limiting via Upstash Redis
  return adminRateLimit(request, async () => {
  try {
    const auth = await verifyAdmin(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: auth.error || 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateUserStatusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { userId, action, reason } = validation.data;

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, preferences: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Not Found', message: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent modifying superadmins
    const targetPrefs = targetUser.preferences as { role?: string } | null;
    if (targetPrefs?.role === 'superadmin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Cannot modify superadmin users' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'suspend': {
        // Get current preferences and update status
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { preferences: true },
        });
        const currentPrefs = (currentUser?.preferences as Record<string, unknown>) || {};

        await prisma.user.update({
          where: { id: userId },
          data: {
            preferences: {
              ...currentPrefs,
              status: 'suspended',
            },
            updatedAt: new Date(),
          },
        });

        // Invalidate all sessions
        await prisma.session.deleteMany({
          where: { userId },
        });

        // Log audit event
        await prisma.auditLog.create({
          data: {
            userId: auth.userId || 'system',
            action: 'user_suspended',
            resource: 'user',
            resourceId: userId,
            details: { reason, targetEmail: targetUser.email },
            severity: 'high',
            category: 'admin',
            outcome: 'success',
          },
        });

        return NextResponse.json({
          success: true,
          message: 'User suspended successfully',
        });
      }

      case 'activate': {
        // Get current preferences and update status
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { preferences: true },
        });
        const currentPrefs = (currentUser?.preferences as Record<string, unknown>) || {};

        await prisma.user.update({
          where: { id: userId },
          data: {
            preferences: {
              ...currentPrefs,
              status: 'active',
            },
            updatedAt: new Date(),
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: auth.userId || 'system',
            action: 'user_activated',
            resource: 'user',
            resourceId: userId,
            details: { targetEmail: targetUser.email },
            severity: 'medium',
            category: 'admin',
            outcome: 'success',
          },
        });

        return NextResponse.json({
          success: true,
          message: 'User activated successfully',
        });
      }

      case 'delete': {
        // Get current preferences and update status
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { preferences: true },
        });
        const currentPrefs = (currentUser?.preferences as Record<string, unknown>) || {};

        // Soft delete - mark as deleted in preferences
        await prisma.user.update({
          where: { id: userId },
          data: {
            preferences: {
              ...currentPrefs,
              status: 'deleted',
            },
            email: `deleted_${Date.now()}_${targetUser.email}`,
            updatedAt: new Date(),
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: auth.userId || 'system',
            action: 'user_deleted',
            resource: 'user',
            resourceId: userId,
            details: { reason, targetEmail: targetUser.email },
            severity: 'critical',
            category: 'admin',
            outcome: 'success',
          },
        });

        return NextResponse.json({
          success: true,
          message: 'User deleted successfully',
        });
      }

      default:
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error('Admin update user error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process request') },
      { status: 500 }
    );
  }
  });
}

export const runtime = 'nodejs';
