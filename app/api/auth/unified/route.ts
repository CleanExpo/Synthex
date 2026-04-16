import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { rateLimiters } from '@/lib/rate-limit';
import {
  generateToken,
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
  isOwnerEmail,
} from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  company: z.string().optional(),
});

/**
 * Unified Authentication Handler
 * Handles both login and signup in a single endpoint
 */
// SYN-697: 1 MB payload limit
const MAX_PAYLOAD_BYTES = 1 * 1024 * 1024;

export async function POST(request: NextRequest) {
  // Apply rate limiting for auth endpoints
  return rateLimiters.auth(request, async () => {
    try {
      // SYN-697: reject oversized payloads
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
      }

      const body = await request.json();

      // SYN-697: secondary guard when content-length header was absent
      const bodySize = Buffer.byteLength(JSON.stringify(body));
      if (bodySize > MAX_PAYLOAD_BYTES) {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
      }
      const { action } = body;

      // Handle different auth actions
      switch (action) {
        case 'login':
          return handleLogin(body);

        case 'signup':
          return handleSignup(body);

        case 'logout':
          return handleLogout();

        case 'verify':
          return handleVerify(request);

        default:
          return NextResponse.json(
            { error: 'Invalid action. Use: login, signup, logout, or verify' },
            { status: 400 }
          );
      }
    } catch (error) {
      logger.error('Auth error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      );
    }
  });
}

/**
 * Handle user login
 */
async function handleLogin(body: z.infer<typeof loginSchema>) {
  try {
    const { email, password } = loginSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        onboardingComplete: true,
        apiKeyConfigured: true,
      },
    });

    if (!user || !user.password) {
      // SYN-696: always run bcrypt to prevent timing-based user enumeration
      await bcrypt.compare(password, '$2b$10$placeholderHashForTimingAttackPrevention..');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Owner bypass: force full access for platform owner(s)
    const ownerBypass = isOwnerEmail(user.email);
    const onboardingComplete = ownerBypass ? true : user.onboardingComplete;
    const apiKeyConfigured = ownerBypass ? true : user.apiKeyConfigured;

    // Auto-fix DB flags for owner on login (fire-and-forget)
    if (ownerBypass && (!user.onboardingComplete || !user.apiKeyConfigured)) {
      prisma.user
        .update({
          where: { id: user.id },
          data: { onboardingComplete: true, apiKeyConfigured: true },
        })
        .catch(() => {
          /* non-fatal */
        });
    }

    // Generate token (include onboarding flags for middleware)
    const token = generateToken({
      userId: user.id,
      email: user.email,
      onboardingComplete,
      apiKeyConfigured,
    });

    // Return user data (without password)
    const { password: _, ...userData } = user;

    return NextResponse.json({
      user: { ...userData, onboardingComplete, apiKeyConfigured },
      token,
      message: 'Login successful',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    throw error;
  }
}

/**
 * Handle user signup
 */
async function handleSignup(body: z.infer<typeof signupSchema>) {
  try {
    const { email, password, name, company } = signupSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // SYN-696: do not reveal whether the email is already registered
      return NextResponse.json(
        { error: 'Registration failed' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        // Company can be stored in preferences JSON field if needed
        preferences: company ? { company } : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        preferences: true,
      },
    });

    // Generate token (new user: onboarding not complete)
    const token = generateToken({
      userId: user.id,
      email: user.email,
      onboardingComplete: false,
      apiKeyConfigured: false,
    });

    return NextResponse.json({
      user,
      token,
      message: 'Account created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    throw error;
  }
}

/**
 * Handle user logout
 */
async function handleLogout() {
  // For JWT-based auth, logout is handled client-side
  // Just return success
  return NextResponse.json({
    message: 'Logged out successfully',
  });
}

/**
 * Verify JWT token
 */
async function handleVerify(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);

    if (!userId) {
      return unauthorizedResponse('No valid token provided');
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        onboardingComplete: true,
        apiKeyConfigured: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      user,
    });
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: 'Invalid token' },
      { status: 401 }
    );
  }
}

// Handle GET requests (for token verification)
export async function GET(request: NextRequest) {
  return handleVerify(request);
}
// Node.js runtime required for Prisma
export const runtime = 'nodejs';
