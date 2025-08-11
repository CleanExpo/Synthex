import { NextResponse } from 'next/server';
import { auth } from '@/lib/supabase-client';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Development mode: Check local database first
    if (process.env.NODE_ENV === 'development') {
      try {
        // Try to authenticate with local Prisma database
        const user = await prisma.user.findUnique({
          where: { email }
        });

        if (user) {
          // Verify password
          const isValid = await bcrypt.compare(password, user.password);
          
          if (isValid) {
            // Create a mock session for development
            const mockSession = {
              access_token: 'dev-token-' + Date.now(),
              refresh_token: 'dev-refresh-' + Date.now(),
              expires_in: 3600,
              token_type: 'bearer',
              user: {
                id: user.id,
                email: user.email,
                user_metadata: {
                  name: user.name,
                  avatar_url: user.avatar
                },
                app_metadata: {},
                aud: 'authenticated',
                created_at: user.createdAt?.toISOString()
              }
            };

            // Set cookie for session
            const response = NextResponse.json({
              success: true,
              user: mockSession.user,
              session: mockSession,
            });

            // Set a simple auth cookie for development
            response.cookies.set('synthex-auth', mockSession.access_token, {
              httpOnly: true,
              secure: false,
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7, // 1 week
              path: '/'
            });

            return response;
          }
        }
      } catch (prismaError) {
        console.log('Prisma auth attempt failed, falling back to Supabase');
      }
    }

    // Fall back to Supabase authentication
    const data = await auth.signIn(email, password);

    return NextResponse.json({
      success: true,
      user: data.user,
      session: data.session,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error.message || 'Invalid credentials' },
      { status: 401 }
    );
  }
}