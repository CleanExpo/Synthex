import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

/**
 * XML Sitemap — generated at request time via Next.js MetadataRoute.
 * app/sitemap.xml/route.ts is neutralised to prevent route conflict.
 *
 * Priority guide:
 *   1.0 — Homepage
 *   0.9 — Primary pillar pages (high conversion, high keyword value)
 *   0.8 — Secondary pillar/compare/feature pages
 *   0.7 — Standard marketing + signup
 *   0.6 — Blog index + individual posts
 *   0.5–0.6 — Support, contact, utility
 *   0.3 — Legal
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // Fetch published blog posts for dynamic entries
  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: 'published' },
      select: { slug: true, publishedAt: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
    });

    blogEntries = posts.map(post => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: (
        post.updatedAt ??
        post.publishedAt ??
        new Date()
      ).toISOString(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));
  } catch {
    // Non-fatal — sitemap degrades gracefully if DB is unavailable
    blogEntries = [];
  }

  return [
    // ── Core ───────────────────────────────────────────────────
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },

    // ── Primary Pillar Pages ───────────────────────────────────
    {
      url: `${BASE_URL}/agencies`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/features/ai-content`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/features/platforms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },

    // ── Compare / Competitor Pages ─────────────────────────────
    {
      url: `${BASE_URL}/compare/hootsuite`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },

    // ── Standard Marketing Pages ───────────────────────────────
    {
      url: `${BASE_URL}/features`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/demo`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/signup`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },

    // ── Blog ───────────────────────────────────────────────────
    {
      url: `${BASE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // Per-post entries (dynamic from DB)
    ...blogEntries,

    // ── Utility ────────────────────────────────────────────────
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },

    // ── Legal ──────────────────────────────────────────────────
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
