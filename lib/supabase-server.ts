/**
 * Supabase server client compatibility shim.
 *
 * SYN-1070 removed @supabase/supabase-js. getAuthUser() is real (JWT cookie +
 * Prisma). The Supabase-style query client has no backing store, so
 * createServerClient() and serverDb throw SupabaseClientRemovedError instead
 * of returning empty data or dropping writes.
 */

import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';

/** Thrown by every call into the removed Supabase-style query client. */
export class SupabaseClientRemovedError extends Error {
  readonly code = 'FEATURE_NOT_PROVISIONED';
  constructor(what: string) {
    super(
      `FEATURE_NOT_PROVISIONED: ${what} is unavailable; the Supabase client was removed (SYN-1070). Use prisma from '@/lib/prisma'.`
    );
    this.name = 'SupabaseClientRemovedError';
  }
}

export function createServerClient(): never {
  throw new SupabaseClientRemovedError('createServerClient()');
}

/**
 * Get the currently authenticated user from session cookies.
 * Returns null when unauthenticated. Database errors propagate rather than
 * masquerading as "not signed in".
 */
export async function getAuthUser(): Promise<{
  id: string;
  email?: string;
} | null> {
  const userId = await getUserIdFromCookies();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
}

function removed(table: string, op: string) {
  return async (): Promise<never> => {
    throw new SupabaseClientRemovedError(`serverDb.from('${table}').${op}()`);
  };
}

export const serverDb = {
  from: (table: string) => ({
    select: removed(table, 'select'),
    insert: removed(table, 'insert'),
    update: removed(table, 'update'),
    delete: removed(table, 'delete'),
  }),
};
