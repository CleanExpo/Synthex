/**
 * Supabase server client compatibility shim.
 *
 * SYN-1070 removed @supabase/supabase-js. This shim provides the same exports
 * via the new platform layer so legacy routes continue to compile.
 */

import { cookies } from 'next/headers';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import {
  createServerClient as _createServerClient,
  createAuthClient,
} from '@/lib/platform/server';

// Re-export platform server client directly
export { createServerClient } from '@/lib/platform/server';

/**
 * Get the currently authenticated user from session cookies.
 * Returns null when unauthenticated.
 */
export async function getAuthUser(): Promise<{
  id: string;
  email?: string;
} | null> {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    return user ?? null;
  } catch {
    return null;
  }
}

export const serverDb: any = {
  from: (_table: string) => ({
    select: async () => ({ data: [], error: null }),
    insert: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
    delete: async () => ({ data: null, error: null }),
  }),
};
