/**
 * XML Sitemap Configuration
 *
 * Generates a dynamic sitemap for all public-facing pages. Dashboard, API,
 * and authentication routes are excluded since they require authentication
 * or are not useful for search indexing.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

/**
 * Static public pages with their SEO priority and change frequency.
 * Ordered by priority (highest first).
 */
const STATIC_PAGES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  // Core marketing pages
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/features', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/pricing', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/demo', changeFrequency: 'monthly', priority: 0.8 },

  // Content & resources
  { path: '/blog', changeFrequency: 'daily', priority: 0.8 },
  { path: '/case-studies', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/changelog', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/roadmap', changeFrequency: 'weekly', priority: 0.5 },

  // Support & docs
  { path: '/contact', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/support', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/docs', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/api-reference', changeFrequency: 'weekly', priority: 0.5 },

  // Company
  { path: '/careers', changeFrequency: 'monthly', priority: 0.5 },

  // Legal
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/security', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return STATIC_PAGES.map(({ path, changeFrequency, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
