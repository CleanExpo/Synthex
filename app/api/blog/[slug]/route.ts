/**
 * GET /api/blog/[slug]
 *
 * Returns the full content of a single published blog post.
 * Also increments the view counter asynchronously.
 * Public endpoint — no authentication required.
 *
 * @task UNI-1643
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const revalidate = 3600; // 1-hour ISR per post

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const post = await prisma.blogPost.findFirst({
      where: { slug, status: 'published' },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        author: true,
        category: true,
        tags: true,
        ogImage: true,
        ogImageAlt: true,
        seoTitle: true,
        seoDescription: true,
        readTime: true,
        wordCount: true,
        publishedAt: true,
        updatedAt: true,
        aiGenerated: true,
        views: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Increment view counter fire-and-forget (non-blocking)
    prisma.blogPost
      .update({
        where: { id: post.id },
        data: { views: { increment: 1 } },
      })
      .catch(() => undefined); // never fail the request over a counter update

    return NextResponse.json(post);
  } catch (err) {
    logger.error('GET /api/blog/[slug] failed', { error: err, slug });
    return NextResponse.json(
      { error: 'Failed to fetch post' },
      { status: 500 }
    );
  }
}
