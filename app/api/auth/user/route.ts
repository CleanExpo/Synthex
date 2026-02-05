/**
 * Get Current User API Route
 * GET /api/auth/user
 * PUT /api/auth/user
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// JWT Secret - CRITICAL: Never use fallback
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}


// Validation schema for user update
const userUpdateSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(100, 'Name too long').optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    language: z.string().max(10).optional(),
    timezone: z.string().max(50).optional(),
  }).passthrough().optional(),
}).strict();

// Helper function to verify JWT token
async function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, getJWTSecret()) as { userId?: string; sub?: string; email?: string };
    // Handle both formats: { userId, email } from login route and { sub } from signInFlow
    return {
      userId: decoded.userId || decoded.sub,
      email: decoded.email
    };
  } catch (error) {
    return null;
  }
}

// Demo user data for when database is unavailable
const DEMO_USER = {
  id: 'demo-user-001',
  email: 'demo@synthex.com',
  name: 'Demo User',
  avatar: null,
  emailVerified: true,
  createdAt: new Date('2024-01-01'),
  lastLogin: new Date(),
  preferences: { theme: 'dark' },
  organizationId: null,
  organization: null,
  _count: { campaigns: 5, projects: 3, notifications: 2 }
};

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header OR auth-token cookie
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth-token')?.value;

    let token: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    } else if (cookieToken) {
      token = cookieToken;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      );
    }

    // Verify token
    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Handle demo user without database access
    if (decoded.userId === 'demo-user-001' || decoded.email === 'demo@synthex.com') {
      return NextResponse.json({
        success: true,
        user: {
          ...DEMO_USER,
          unreadNotifications: DEMO_USER._count.notifications,
          totalCampaigns: DEMO_USER._count.campaigns,
          totalProjects: DEMO_USER._count.projects
        }
      });
    }

    // For real users, try database lookup with graceful fallback
    try {
      // Check if session exists and is valid
      const session = await prisma.session.findUnique({
        where: { token }
      });

      if (!session || session.expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Session expired' },
          { status: 401 }
        );
      }

      // Get user data
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          emailVerified: true,
          createdAt: true,
          lastLogin: true,
          preferences: true,
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true
            }
          },
          // Include counts for related data
          _count: {
            select: {
              campaigns: true,
              projects: true,
              notifications: {
                where: { read: false }
              }
            }
          }
        }
      });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Return user data
      return NextResponse.json({
        success: true,
        user: {
          ...user,
          unreadNotifications: user._count.notifications,
          totalCampaigns: user._count.campaigns,
          totalProjects: user._count.projects
        }
      });
    } catch (dbError) {
      // Database unavailable - return basic user info from token
      console.error('Database unavailable:', dbError);
      return NextResponse.json({
        success: true,
        user: {
          id: decoded.userId,
          email: decoded.email || 'unknown',
          name: decoded.email?.split('@')[0] || 'User',
          avatar: null,
          emailVerified: true,
          createdAt: new Date(),
          lastLogin: new Date(),
          preferences: { theme: 'dark' },
          organizationId: null,
          organization: null,
          unreadNotifications: 0,
          totalCampaigns: 0,
          totalProjects: 0
        }
      });
    }

  } catch (error: unknown) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Update Current User API Route
 * PUT /api/auth/user
 */
export async function PUT(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json();
    const validationResult = userUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { name, preferences } = validationResult.data;

    // Update user with validated data
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(preferences !== undefined && { preferences: preferences as object })
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        emailVerified: true,
        preferences: true
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: decoded.userId,
        action: 'user_profile_update',
        resource: 'user',
        resourceId: decoded.userId,
        category: 'data',
        outcome: 'success',
        details: {
          updatedFields: Object.keys(body)
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error: unknown) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update user data' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
