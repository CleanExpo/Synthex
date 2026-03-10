/**
 * Admin Audit Log API
 *
 * Provides access to system audit logs for admin users.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - ADMIN_API_KEY (SECRET)
 *
 * @module app/api/admin/audit-log/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { admin as adminRateLimit } from '@/lib/middleware/api-rate-limit';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { logger } from '@/lib/logger';

// =============================================================================
// Schemas
// =============================================================================

const auditLogQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  userId: z.string().uuid().optional(),
  action: z.string().max(100).optional(),
  resource: z.string().max(100).optional(),
  category: z.enum(['auth', 'admin', 'content', 'billing', 'system', 'all']).optional().default('all'),
  severity: z.enum(['low', 'medium', 'high', 'critical', 'all']).optional().default('all'),
  outcome: z.enum(['success', 'failure', 'all']).optional().default('all'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// =============================================================================
// GET - Query Audit Logs
// =============================================================================

export async function GET(request: NextRequest) {
  // Distributed rate limiting via Upstash Redis
  return adminRateLimit(request, async () => {
  try {
    const auth = await verifyAdmin(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: auth.error || 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      query[key] = value;
    });

    const validation = auditLogQuerySchema.safeParse(query);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      page,
      limit,
      userId,
      action,
      resource,
      category,
      severity,
      outcome,
      startDate,
      endDate,
      sortOrder,
    } = validation.data;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    if (resource) {
      where.resource = resource;
    }

    if (category !== 'all') {
      where.category = category;
    }

    if (severity !== 'all') {
      where.severity = severity;
    }

    if (outcome !== 'all') {
      where.outcome = outcome;
    }

    if (startDate || endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate);
      }
      where.createdAt = dateFilter;
    }

    // Get total count
    const total = await prisma.auditLog.count({ where });

    // Get logs
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: sortOrder },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Get summary statistics
    const stats = await prisma.auditLog.groupBy({
      by: ['severity'],
      _count: { severity: true },
      where: startDate || endDate ? where : undefined,
    });

    const severityStats = stats.reduce((acc, stat) => {
      acc[stat.severity] = stat._count.severity;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: logs,
      stats: {
        severity: severityStats,
        total,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + logs.length < total,
      },
    });
  } catch (error: unknown) {
    logger.error('Admin audit log error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process audit log request') },
      { status: 500 }
    );
  }
  });
}

export const runtime = 'nodejs';
