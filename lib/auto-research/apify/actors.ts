/**
 * Apify Actor Registry
 *
 * Maps each supported platform to its Apify actor ID and provides
 * typed input builder functions.
 */

import type { SupportedPlatform } from './types';

export interface ActorConfig {
  actorId: string;
  buildInput: (options: ActorInputOptions) => Record<string, unknown>;
}

export interface ActorInputOptions {
  /** Number of posts to scrape per run */
  limit: number;
  /** Optional search query / hashtags / keywords */
  query?: string[];
}

export const ACTOR_REGISTRY: Record<SupportedPlatform, ActorConfig> = {
  instagram: {
    actorId: 'apify/instagram-scraper',
    buildInput: ({ limit, query }) => ({
      resultsLimit: limit,
      hashtags: query ?? ['marketing', 'socialmedia', 'contentmarketing'],
      scrapeType: 'posts',
      expandOwners: false,
    }),
  },
  tiktok: {
    actorId: 'apify/tiktok-scraper',
    buildInput: ({ limit, query }) => ({
      resultsPerPage: limit,
      searchQueries: query ?? [
        'marketing tips',
        'social media growth',
        'content creation',
      ],
      scrapeType: 'search',
    }),
  },
  linkedin: {
    actorId: 'apify/linkedin-post-search-scraper',
    buildInput: ({ limit, query }) => ({
      searchQuery: (query ?? ['marketing automation', 'content strategy'])[0],
      resultsLimit: limit,
    }),
  },
  twitter: {
    actorId: 'apify/twitter-scraper',
    buildInput: ({ limit, query }) => ({
      searchTerms: query ?? ['#marketing', '#contentmarketing', '#socialmedia'],
      maxItems: limit,
      twitterHandles: [],
      conversationIds: [],
    }),
  },
  facebook: {
    actorId: 'apify/facebook-posts-scraper',
    buildInput: ({ limit, query }) => ({
      startUrls: [],
      maxPosts: limit,
      searchQuery: (query ?? ['digital marketing'])[0],
    }),
  },
  google: {
    actorId: 'apify/google-search-scraper',
    buildInput: ({ limit, query }) => ({
      queries: (
        query ?? ['AI marketing tools 2026', 'social media trends 2026']
      ).join('\n'),
      resultsPerPage: Math.min(limit, 100),
      countryCode: 'au',
      languageCode: 'en',
    }),
  },
};
