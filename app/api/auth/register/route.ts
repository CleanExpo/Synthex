/**
 * User Registration Endpoint with Prisma
 * Handles new user registration with database integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { emailService } from '@/lib/email/email-service';

const prisma = new PrismaClient();

// Input validation schema
const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password too long')
});

// Generate verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate JWT token
function generateToken(userId: string): string {
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';
  return jwt.sign(
    {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    },
    JWT_SECRET
  );
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = signupSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid input', 
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    const { name, email, password } = validationResult.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { 
          success: false,
          error: 'An account with this email already exists' 
        },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user in database
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        emailVerified: false,
        verificationCode,
        verificationExpires,
        authProvider: 'local'
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });

    // Generate session token
    const token = generateToken(newUser.id);

    // Create session in database
    await prisma.session.create({
      data: {
        token,
        userId: newUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    // Log signup in audit log (if you have audit log table)
    try {
      await prisma.auditLog.create({
        data: {
          userId: newUser.id,
          action: 'user_signup',
          resource: 'authentication',
          resourceId: newUser.id,
          outcome: 'success',
          category: 'auth',
          details: {
            email,
            provider: 'local',
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (auditError) {
      // Audit log is optional, continue if it fails
      console.log('Audit log skipped:', auditError);
    }

    // Send verification email
    try {
      await emailService.sendVerificationEmail(newUser.id, email, name || undefined);
      console.log(`[EMAIL] Verification email sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue anyway - user can request a new verification email
    }
    
    // For development, also log the verification code
    if (process.env.NODE_ENV === 'development') {
      console.log(`
        ================================================
        VERIFICATION CODE FOR ${email}: ${verificationCode}
        ================================================
      `);
    }

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      },
      message: 'Account created successfully! Please check your email to verify your account.',
      requiresVerification: true,
      // In development, include verification code in response
      ...(process.env.NODE_ENV === 'development' && { 
        devVerificationCode: verificationCode 
      })
    });

    // Set auth cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    return response;

  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      return NextResponse.json(
        { 
          success: false,
          error: 'An account with this email already exists' 
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'An unexpected error occurred. Please try again.' 
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}