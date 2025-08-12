/**
 * Browser-specific Supabase Client
 * This client is specifically for browser-side operations with proper session management
 */

// @ts-ignore - SSR package types might not be fully compatible
import { createBrowserClient } from '@supabase/ssr';

// Ensure we have the required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

// Create a browser-specific Supabase client with proper session handling
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'synthex-auth-token',
        cookieOptions: {
          name: 'synthex-auth',
          lifetime: 60 * 60 * 24 * 7, // 1 week
          domain: '',
          path: '/',
          sameSite: 'lax',
        },
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'X-Client-Info': 'synthex-platform',
        },
      },
    }
  );
}

// Create a singleton instance for the browser
let browserClient: ReturnType<typeof createSupabaseBrowser> | undefined;

export function getSupabaseBrowser() {
  if (!browserClient && typeof window !== 'undefined') {
    browserClient = createSupabaseBrowser();
  }
  return browserClient;
}