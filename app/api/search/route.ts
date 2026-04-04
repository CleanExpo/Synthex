/**
 * Global Search Route
 *
 * Searches campaigns and posts for the authenticated user.
 *
 * @route POST /api/search?q=<query>
 *
 * Body: { type?: string[]; tags?: string[] }
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { RateLimiter } from '@/lib/rate-limit';

// ─── Zod schema ─────────────────────────────────────────────────────────────

const searchBodySchema = z.object({
  type: z.array(z.enum(['campaign', 'content'])).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
});

// ─── Rate limiter — 30 req/min ──────────────────────────────────────────────

const rateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  identifier: (req: NextRequest) => {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    return `search:${ip}`;
  },
});

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: 'content' | 'campaign';
  url: string;
  tags?: string[];
  date?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const rateResult = await rateLimiter.check(request);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: new Date(rateResult.resetTime).toISOString() },
        { status: 429, headers: { ...RateLimiter.createHeaders(rateResult) } }
      );
    }

    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const organizationId = await getEffectiveOrganizationId(userId);
    const orgFilter = organizationId ? { organizationId } : { userId };

    // Parse and validate optional filters from body
    let typeFilter: string[] = [];
    try {
      const body = await request.json();
      const parsed = searchBodySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation error', details: parsed.error.issues },
          { status: 400 }
        );
      }
      if (parsed.data.type) typeFilter = parsed.data.type;
    } catch {
      // Body is optional — empty body is fine
    }

    const results: SearchResult[] = [];

    // Search campaigns unless filtered to content-only
    if (typeFilter.length === 0 || typeFilter.includes('campaign')) {
      const campaigns = await prisma.campaign.findMany({
        where: {
          ...orgFilter,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          platform: true,
          status: true,
          createdAt: true,
        },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      });

      for (const c of campaigns) {
        results.push({
          id: c.id,
          title: c.name,
          description: c.description ?? undefined,
          type: 'campaign',
          url: `/dashboard/campaigns/${c.id}`,
          tags: [c.platform, c.status],
          date: c.createdAt.toISOString(),
        });
      }
    }

    // Search posts (via campaigns owned by the user/org)
    if (typeFilter.length === 0 || typeFilter.includes('content')) {
      const posts = await prisma.post.findMany({
        where: {
          campaign: { ...orgFilter },
          content: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          content: true,
          platform: true,
          status: true,
          createdAt: true,
          campaignId: true,
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      for (const p of posts) {
        const excerpt = p.content.length > 80 ? `${p.content.slice(0, 80)}…` : p.content;
        results.push({
          id: p.id,
          title: excerpt,
          type: 'content',
          url: `/dashboard/campaigns/${p.campaignId}`,
          tags: [p.platform, p.status],
          date: p.createdAt.toISOString(),
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    logger.error('[Search] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
