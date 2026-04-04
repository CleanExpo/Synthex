/**
 * GET /api/blog
 *
 * Returns a paginated list of published blog posts.
 * Public endpoint — no authentication required.
 *
 * Query params:
 *   page     — 1-based page (default 1)
 *   limit    — posts per page (default 12, max 50)
 *   category — filter by category slug (optional)
 *   q        — full-text search on title + excerpt (optional)
 *
 * @task UNI-1643
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const revalidate = 300; // 5-minute ISR for the list

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get('limit') ?? '12'))
  );
  const category = searchParams.get('category') ?? undefined;
  const q = searchParams.get('q')?.trim() ?? undefined;
  const skip = (page - 1) * limit;

  const where = {
    status: 'published',
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { excerpt: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  try {
    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          author: true,
          category: true,
          tags: true,
          ogImage: true,
          readTime: true,
          publishedAt: true,
          aiGenerated: true,
        },
      }),

      prisma.blogPost.count({ where }),
    ]);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('GET /api/blog failed', { error: err });
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
