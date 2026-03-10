/**
 * Competitor Alerts API Route
 *
 * @description Manage competitor alerts:
 * - GET: List alerts
 * - PATCH: Mark alerts as read/dismissed
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * FAILURE MODE: Returns 500 on database errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateAlertsSchema = z.object({
  alertIds: z.array(z.string()).min(1),
  action: z.enum(['read', 'dismiss', 'unread']),
  actionTaken: z.string().max(1000).optional(),
});

// ============================================================================
// TYPES
// ============================================================================

/** Competitor alert record */
interface CompetitorAlertRecord {
  id: string;
  userId: string;
  competitorId: string;
  alertType: string;
  severity: string;
  isRead: boolean;
  isDismissed?: boolean;
  readAt?: Date;
  actionTaken?: string;
  createdAt: Date;
  competitor?: { id: string; name: string; logoUrl?: string };
}

/** Alert where clause */
interface AlertWhereClause {
  userId: string;
  competitorId?: string;
  alertType?: string;
  isRead?: boolean;
  severity?: string;
}

/** Extended prisma client for alert operations */
interface PrismaWithAlerts {
  competitorAlert?: {
    findMany: (args: Record<string, unknown>) => Promise<CompetitorAlertRecord[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
}

// ============================================================================
// GET /api/competitors/alerts
// List alerts
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const { searchParams } = new URL(request.url);

    const competitorId = searchParams.get('competitorId');
    const alertType = searchParams.get('type');
    const isRead = searchParams.get('read');
    const severity = searchParams.get('severity');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    const where: AlertWhereClause = { userId };
    if (competitorId) where.competitorId = competitorId;
    if (alertType) where.alertType = alertType;
    if (isRead !== null) where.isRead = isRead === 'true';
    if (severity) where.severity = severity;

    const extendedPrisma = prisma as unknown as PrismaWithAlerts;
    const [alerts, total, unreadCount] = await Promise.all([
      extendedPrisma.competitorAlert?.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          competitor: {
            select: { id: true, name: true, logoUrl: true },
          },
        },
      }) || [],
      extendedPrisma.competitorAlert?.count({ where }) || 0,
      extendedPrisma.competitorAlert?.count({
        where: { userId, isRead: false },
      }) || 0,
    ]);

    // Group alerts by type for summary
    const alertsByType = (alerts || []).reduce((acc: Record<string, number>, alert: CompetitorAlertRecord) => {
      acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      alerts,
      total,
      unreadCount,
      summary: alertsByType,
      hasMore: (alerts?.length || 0) === limit,
    });
  } catch (error) {
    logger.error('List alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/competitors/alerts
// Update alert status (read/dismiss)
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const body = await request.json();

    // Validate input
    const validation = updateAlertsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { alertIds, action, actionTaken } = validation.data;

    // Build update data based on action
    const updateData: {
      isRead?: boolean;
      isDismissed?: boolean;
      readAt?: Date | null;
      actionTaken?: string;
    } = {};
    switch (action) {
      case 'read':
        updateData.isRead = true;
        updateData.readAt = new Date();
        break;
      case 'dismiss':
        updateData.isDismissed = true;
        updateData.isRead = true;
        updateData.readAt = new Date();
        if (actionTaken) updateData.actionTaken = actionTaken;
        break;
      case 'unread':
        updateData.isRead = false;
        updateData.readAt = null;
        break;
    }

    // Update alerts (only for this user)
    const extendedPrisma = prisma as unknown as PrismaWithAlerts;
    const result = await extendedPrisma.competitorAlert?.updateMany({
      where: {
        id: { in: alertIds },
        userId,
      },
      data: updateData,
    });

    return NextResponse.json({
      message: `${result?.count || 0} alert(s) updated`,
      action,
      updatedCount: result?.count || 0,
    });
  } catch (error) {
    logger.error('Update alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to update alerts' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
