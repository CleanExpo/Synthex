/**
 * Optional LinkedIn post search for auto-research.
 *
 * The default actor stays apify/linkedin-post-search-scraper.
 * Set SYNTHEX_LINKEDIN_POST_SEARCH_ACTOR to johnvc/linkedin-post-search-api
 * to send a keyword body and map rows onto ScrapedPost.
 */

export interface LinkedInActorConfig {
  actorId: string;
  buildInput: (options: { limit: number; query?: string[] }) => Record<string, unknown>;
}

export const OPTIONAL_LINKEDIN_POST_SEARCH_ACTOR =
  'johnvc/linkedin-post-search-api';
export const LINKEDIN_POST_SEARCH_ACTOR_ENV =
  'SYNTHEX_LINKEDIN_POST_SEARCH_ACTOR';

const MAX_POSTS_PER_KEYWORD = 1000;

export interface LinkedInPostSearchCall {
  actorId: string;
  input: Record<string, unknown>;
  optional: boolean;
}

/** Same fields auto-research already reads from a scraped post. */
export interface LinkedInResearchPost {
  platform: 'linkedin';
  url: string;
  content: string;
  engagementCount: number;
  likesCount?: number;
  commentsCount?: number;
  timestamp: string;
  authorHandle?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function linkedInPostSearchCall(
  envValue: string | undefined,
  options: { limit: number; query?: string[] },
  current: LinkedInActorConfig
): LinkedInPostSearchCall {
  const defaults = current.buildInput(options);
  if (envValue !== OPTIONAL_LINKEDIN_POST_SEARCH_ACTOR) {
    return {
      actorId: current.actorId,
      input: defaults,
      optional: false,
    };
  }

  const phrase =
    typeof defaults.searchQuery === 'string' && defaults.searchQuery.trim()
      ? defaults.searchQuery
      : 'marketing automation';
  const requested =
    typeof defaults.resultsLimit === 'number' &&
    Number.isFinite(defaults.resultsLimit)
      ? Math.trunc(defaults.resultsLimit)
      : 50;
  const maxPostsPerKeyword = Math.min(
    MAX_POSTS_PER_KEYWORD,
    Math.max(1, requested)
  );

  return {
    actorId: OPTIONAL_LINKEDIN_POST_SEARCH_ACTOR,
    optional: true,
    input: {
      keywords: [phrase],
      maxPostsPerKeyword,
    },
  };
}

export function linkedInSearchPosts(
  items: unknown[],
  optional: boolean
): LinkedInResearchPost[] {
  if (!optional) return items as LinkedInResearchPost[];

  const posts: ScrapedPost[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    if (item.result_type === 'error') continue;
    const content = typeof item.text === 'string' ? item.text : '';
    const url = typeof item.postUrl === 'string' ? item.postUrl : '';
    if (!content && !url) continue;
    const likesCount = asCount(item.numLikes);
    const commentsCount = asCount(item.numComments);
    posts.push({
      platform: 'linkedin',
      url,
      content,
      engagementCount: likesCount + commentsCount,
      likesCount,
      commentsCount,
      timestamp: typeof item.datePosted === 'string' ? item.datePosted : '',
      authorHandle:
        typeof item.authorName === 'string' ? item.authorName : undefined,
    });
  }
  return posts;
}
