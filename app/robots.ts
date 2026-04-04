/**
 * Robots.txt Configuration
 *
 * Allows all crawlers including AI search engines (GPTBot, PerplexityBot,
 * ClaudeBot, Google-Extended, anthropic-ai, CCBot) to index public routes.
 * Blocks access to API, dashboard, internal Next.js, and auth routes which
 * are not useful for search indexing.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */

import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

/** Routes that should never be indexed by any crawler */
const DISALLOWED_ROUTES = ['/api/', '/dashboard/', '/_next/', '/login', '/signup', '/onboarding/'];

/** Routes restricted for AI-specific crawlers (auth pages are less relevant) */
const AI_CRAWLER_DISALLOWED = ['/api/', '/dashboard/', '/_next/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED_ROUTES,
      },
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: AI_CRAWLER_DISALLOWED,
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: AI_CRAWLER_DISALLOWED,
      },
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: AI_CRAWLER_DISALLOWED,
      },
      {
        userAgent: 'anthropic-ai',
        allow: '/',
        disallow: AI_CRAWLER_DISALLOWED,
      },
      {
        userAgent: 'CCBot',
        allow: '/',
        disallow: AI_CRAWLER_DISALLOWED,
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: AI_CRAWLER_DISALLOWED,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
