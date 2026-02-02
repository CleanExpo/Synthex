/**
 * User Login API Route
 * POST /api/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-this';

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

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
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

    // Check if user registered with OAuth
    if (user.authProvider !== 'local') {
      return NextResponse.json(
        { error: `Please login with ${user.authProvider}` },
        { status: 400 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
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
            reason: 'invalid_password'
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
  } finally {
    await prisma.$disconnect();
  }
}
