/**
 * User Login API Route
 * POST /api/auth/login
 *
 * FIXED: Now uses Supabase Auth for password verification
 * instead of bcrypt against Prisma User.password field.
 * This aligns with signup which stores passwords in Supabase.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase-client';

// JWT Secret - CRITICAL: Never use fallback in production
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

const JWT_SECRET = getJWTSecret();

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user in Prisma to get user ID and check OAuth
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        authProvider: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user registered with OAuth (should use OAuth flow)
    if (user.authProvider && user.authProvider !== 'local' && user.authProvider !== 'email') {
      return NextResponse.json(
        { error: `Please login with ${user.authProvider}` },
        { status: 400 }
      );
    }

    // Verify password using Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user) {
      // Log failed login attempt
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'login_failed',
          resource: 'authentication',
          category: 'auth',
          outcome: 'failure',
          details: {
            email: user.email,
            reason: authError?.message || 'invalid_password'
          }
        }
      });

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      },
      JWT_SECRET,
      { 
        expiresIn: '7d' 
      }
    );

    // Create or update session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Delete existing sessions for this user
    await prisma.session.deleteMany({
      where: { userId: user.id }
    });

    // Create new session
    await prisma.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt
      }
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Log successful login
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'user_login',
        resource: 'authentication',
        resourceId: user.id,
        category: 'auth',
        outcome: 'success',
        details: {
          email: user.email,
          authProvider: 'local'
        }
      }
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
  // Note: Using connection pooling, no need for prisma.$disconnect()
}
