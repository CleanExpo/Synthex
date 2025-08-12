import { NextResponse } from 'next/server';

// Development/Demo login endpoint for when Supabase isn't configured
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    // Check if we're in development or if Supabase isn't configured
    const isDevMode = process.env.NODE_ENV === 'development' || 
                      !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                      process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co';
    
    if (!isDevMode) {
      return NextResponse.json({ 
        error: 'Please use standard authentication',
        redirect: '/login'
      }, { status: 403 });
    }
    
    // Allow demo login for testing when Supabase isn't configured
    if (email === 'demo@synthex.com' && password === 'demo123') {
      const demoUser = {
        id: 'demo-user-001',
        email: 'demo@synthex.com',
        user_metadata: {
          name: 'Demo User',
          avatar_url: null
        }
      };
      
      return NextResponse.json({
        user: demoUser,
        session: {
          access_token: 'demo-token-' + Date.now(),
          refresh_token: 'demo-refresh-' + Date.now(),
        },
        message: 'Demo login successful'
      });
    }
    
    return NextResponse.json({ 
      error: 'Invalid demo credentials. Use demo@synthex.com / demo123',
    }, { status: 401 });
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Authentication service error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}