import { NextResponse } from 'next/server';

// Development-only login endpoint for testing
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const { email, password } = await request.json();

    // Simple dev credentials check
    const validCredentials = [
      { email: 'test@example.com', password: 'password', name: 'Test User' },
      { email: 'demo@synthex.com', password: 'demo123!', name: 'Demo User' },
      { email: 'admin@synthex.com', password: 'admin2024!', name: 'Admin' }
    ];

    const user = validCredentials.find(u => u.email === email && u.password === password);

    if (user) {
      const mockSession = {
        access_token: 'dev-token-' + Date.now(),
        refresh_token: 'dev-refresh-' + Date.now(),
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'dev-' + email.split('@')[0],
          email: user.email,
          user_metadata: {
            name: user.name,
            avatar_url: null
          },
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString()
        }
      };

      const response = NextResponse.json({
        success: true,
        user: mockSession.user,
        session: mockSession,
      });

      // Set auth cookie
      response.cookies.set('synthex-auth', mockSession.access_token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      });

      return response;
    }

    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}