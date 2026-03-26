import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getUserIdFromCookies, isOwnerEmail } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

const monitoringEventSchema = z
  .object({
    sessionId: z.string().min(1, 'Session ID is required'),
    userId: z.string().optional(),
    timestamp: z.string().optional(),
    type: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    errors: z.array(z.any()).optional(),
    actions: z.array(z.any()).optional(),
  })
  .passthrough();

export async function POST(request: NextRequest) {
  try {
    // Auth guard — require authentication before accepting audit log writes
    const authUserId = await getUserIdFromCookies().catch(() => null);
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const rawBody = await request.json();
    const validation = monitoringEventSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const body = validation.data;

    // Use the verified auth user ID — prevents userId spoofing in logs
    const verifiedUserId = authUserId;

    // Persist client errors to AuditLog — survives Lambda cold starts
    if (body.errors && body.errors.length > 0) {
      const auditRows = body.errors.map((error: Record<string, unknown>) => ({
        action: 'client_error',
        resource: 'browser',
        details: {
          message: String(error.message ?? 'Unknown error'),
          stack: error.stack != null ? String(error.stack) : null,
          url:
            (error.context as Record<string, unknown>)?.url != null
              ? String((error.context as Record<string, unknown>).url)
              : null,
          sessionId: body.sessionId,
          timestamp: error.timestamp != null ? String(error.timestamp) : null,
          userAgent: error.userAgent != null ? String(error.userAgent) : null,
        } satisfies Prisma.InputJsonObject,
        severity: 'high',
        category: 'system',
        outcome: 'failure',
        userId: verifiedUserId,
      }));

      // fire-and-forget — don't block the response on DB write
      prisma.auditLog.createMany({ data: auditRows }).catch(err => {
        logger.error('[monitoring] Failed to persist error to AuditLog:', err);
      });

      // Also log to Vercel Runtime Logs (visible in Vercel dashboard)
      for (const error of body.errors) {
        logger.error('[client-error]', {
          message: String(error.message ?? 'Unknown error'),
          url: (error.context as Record<string, unknown>)?.url,
          userId: verifiedUserId,
          sessionId: body.sessionId,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error processing monitoring events:', error);
    return NextResponse.json(
      { error: 'Failed to process events' },
      { status: 500 }
    );
  }
}

// GET: query recent client errors from AuditLog (owner only)
export async function GET(request: NextRequest) {
  const authUserId = await getUserIdFromCookies().catch(() => null);
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUserId },
    select: { email: true },
  });
  if (!user?.email || !isOwnerEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const errors = await prisma.auditLog.findMany({
    where: { action: 'client_error', category: 'system' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, details: true, createdAt: true, userId: true },
  });

  return NextResponse.json({ errors });
}
