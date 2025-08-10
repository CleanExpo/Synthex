import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client configured for server-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  
  // Get the pathname of the request (e.g. /, /dashboard)
  const pathname = request.nextUrl.pathname;
  
  // If Supabase is not configured, allow all routes
  if (!supabase) {
    console.warn('Supabase not configured - allowing all routes');
    return res;
  }
  
  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute) {
    // Get the access token from cookies
    const accessToken = request.cookies.get('sb-access-token')?.value;
    const refreshToken = request.cookies.get('sb-refresh-token')?.value;
    
    if (!accessToken && !refreshToken) {
      // Redirect to login if no tokens
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    try {
      // Verify the session
      if (accessToken) {
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        
        if (error || !user) {
          // Invalid token, redirect to login
          return NextResponse.redirect(new URL('/login', request.url));
        }
      }
    } catch (error) {
      // Error verifying session, redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  // Allow access to public routes or authenticated protected routes
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};