import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyTokenSafe } from '@/lib/auth/jwt-utils';
import { createClient as createNoopClient } from '@/lib/platform/noop-client';

export function createServerClient() {
  const client: any = createNoopClient();
  client.auth.admin.deleteUser = async (userId: string) => {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    return { error: null };
  };
  return client;
}

export function createAuthClient() {
  return createNoopClient() as any;
}

export async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) {
    return null;
  }

  const payload = verifyTokenSafe(token);
  if (!payload?.userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true },
  });
}

export const serverDb = {
  audit: {
    async log(entry: {
      user_id?: string;
      action: string;
      resource?: string;
      resource_id?: string;
      outcome?: 'success' | 'failure';
      category?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      details?: Record<string, unknown>;
    }) {
      await prisma.auditLog.create({
        data: {
          userId: entry.user_id,
          action: entry.action,
          resource: entry.resource || 'unknown',
          resourceId: entry.resource_id,
          outcome: entry.outcome || 'success',
          category: entry.category,
          severity: entry.severity,
          details: entry.details as any,
        },
      });
    },
  },
};
