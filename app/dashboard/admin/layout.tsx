/**
 * Admin Layout — Owner-Only Route Guard
 *
 * Server component that protects all /dashboard/admin/* routes.
 * Redirects to /dashboard if the current user is not a platform owner.
 *
 * Auth path:
 *   1. Read auth-token httpOnly cookie
 *   2. Decode JWT → userId
 *   3. Look up user email in Prisma
 *   4. Check isOwnerEmail()
 */

import { redirect } from 'next/navigation';
import { getUserIdFromCookies, verifyTokenSafe } from '@/lib/auth/jwt-utils';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the auth-token httpOnly cookie
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    redirect('/dashboard');
  }

  // Decode JWT without re-importing — verifyTokenSafe returns null on failure
  const payload = verifyTokenSafe(token);

  if (!payload?.userId) {
    redirect('/dashboard');
  }

  // Look up user email from DB to ensure it hasn't changed since JWT was issued
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { email: true },
  });

  if (!user || !isOwnerEmail(user.email)) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
