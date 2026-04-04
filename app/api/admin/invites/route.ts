/**
 * Admin Invite Code Management API
 *
 * POST /api/admin/invites — Create new invite codes
 * GET  /api/admin/invites — List all invite codes
 *
 * Admin-only endpoint for managing the invite-only soft launch gate.
 * Protected by verifyAdmin() — requires admin role or owner email.
 *
 * @module app/api/admin/invites/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { admin as adminRateLimit } from '@/lib/middleware/api-rate-limit';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export const runtime = 'nodejs';

// =============================================================================
// Schemas
// =============================================================================

const createInviteSchema = z.object({
  email: z.string().email().optional(),
  maxUses: z.number().int().min(1).max(100).optional().default(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  count: z.number().int().min(1).max(50).optional().default(1),
});

const listInvitesQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  status: z.enum(['active', 'used', 'expired', 'all']).optional().default('all'),
});

// =============================================================================
// Helpers
// =============================================================================

function generateInviteCode(): string {
  // Generate a readable 8-char alphanumeric code (e.g. "SX-A3B7K9")
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 for readability
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `SX-${code}`;
}

// =============================================================================
// POST — Create invite codes
// =============================================================================

export async function POST(request: NextRequest) {
  return adminRateLimit(request, async () => {
    try {
      const auth = await verifyAdmin(request);
      if (!auth.isAdmin) {
        return NextResponse.json(
          { error: auth.error || 'Admin access required' },
          { status: 403 }
        );
      }

      const body = await request.json();
      const validation = createInviteSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: validation.error.issues },
          { status: 400 }
        );
      }

      const { email, maxUses, expiresInDays, count } = validation.data;

      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const invites = [];
      for (let i = 0; i < count; i++) {
        const invite = await prisma.inviteCode.create({
          data: {
            code: generateInviteCode(),
            email: email || null,
            maxUses,
            createdBy: auth.userId || 'admin-api-key',
            expiresAt,
          },
        });
        invites.push(invite);
      }

      logger.info('admin:invites:created', {
        count: invites.length,
        createdBy: auth.userId,
        email: email || 'any',
      });

      return NextResponse.json({
        success: true,
        invites: invites.map((inv) => ({
          id: inv.id,
          code: inv.code,
          email: inv.email,
          maxUses: inv.maxUses,
          expiresAt: inv.expiresAt,
        })),
      });
    } catch (error) {
      logger.error('POST /api/admin/invites error:', error);
      return NextResponse.json(
        { error: 'Failed to create invite codes' },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// GET — List invite codes
// =============================================================================

export async function GET(request: NextRequest) {
  return adminRateLimit(request, async () => {
    try {
      const auth = await verifyAdmin(request);
      if (!auth.isAdmin) {
        return NextResponse.json(
          { error: auth.error || 'Admin access required' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(request.url);
      const params = listInvitesQuerySchema.safeParse(
        Object.fromEntries(searchParams)
      );

      if (!params.success) {
        return NextResponse.json(
          { error: 'Invalid query parameters', details: params.error.issues },
          { status: 400 }
        );
      }

      const { page, limit, status } = params.data;

      // Build where clause based on status filter
      const where: Record<string, unknown> = {};
      if (status === 'active') {
        where.isActive = true;
        where.OR = [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ];
      } else if (status === 'used') {
        where.usedAt = { not: null };
      } else if (status === 'expired') {
        where.expiresAt = { lt: new Date() };
      }

      const [invites, total] = await Promise.all([
        prisma.inviteCode.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.inviteCode.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        invites,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('GET /api/admin/invites error:', error);
      return NextResponse.json(
        { error: 'Failed to list invite codes' },
        { status: 500 }
      );
    }
  });
}
