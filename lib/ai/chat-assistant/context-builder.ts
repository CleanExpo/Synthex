/**
 * AI Chat Assistant Context Builder
 *
 * Builds a lightweight context snapshot for the chat assistant.
 * Much simpler than the full PM context — only 5-10 data points.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import prisma from '@/lib/prisma';

export interface ChatContext {
  userName: string | null;
  platforms: string[];
  recentPosts: string[];
  preferences: {
    primaryPlatform?: string;
    contentFocus?: string;
  };
}

/**
 * Build a lightweight context snapshot for the chat assistant.
 * Faster and smaller than the PM context (~5-10 data points).
 */
export async function buildChatContext(userId: string): Promise<ChatContext> {
  // Run queries in parallel for speed
  const [user, platforms, recentPosts] = await Promise.all([
    // 1. Basic user info (name only)
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
      },
    }),

    // 2. Connected platforms (names only, active ones)
    prisma.platformConnection.findMany({
      where: { userId, isActive: true },
      select: {
        platform: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // 3. Recent posts (just titles/snippets, last 5)
    prisma.platformPost.findMany({
      where: {
        connection: { userId },
        publishedAt: { not: null },
      },
      select: {
        content: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    }),
  ]);

  // Extract platform names
  const platformNames = platforms.map((p) => p.platform);

  // Extract post snippets (first 60 chars of each)
  const postSnippets = recentPosts.map((p) => {
    const content = p.content.trim();
    return content.length > 60 ? content.substring(0, 60) + '...' : content;
  });

  // Determine primary platform (most recently connected active platform)
  const primaryPlatform = platformNames.length > 0 ? platformNames[0] : undefined;

  return {
    userName: user?.name || null,
    platforms: platformNames,
    recentPosts: postSnippets,
    preferences: {
      primaryPlatform,
    },
  };
}

/**
 * Serialize chat context to a compact string for system prompt injection.
 * Much shorter than PM context — targets ~200-300 tokens.
 */
export function serializeChatContext(context: ChatContext): string {
  const parts: string[] = [];

  // User greeting
  if (context.userName) {
    parts.push(`User: ${context.userName}`);
  }

  // Connected platforms
  if (context.platforms.length > 0) {
    parts.push(`Connected platforms: ${context.platforms.join(', ')}`);
  } else {
    parts.push('No social platforms connected yet');
  }

  // Recent post activity
  if (context.recentPosts.length > 0) {
    parts.push(`Recent posts: ${context.recentPosts.length} published`);
    // Include first 2 post snippets for context
    const snippets = context.recentPosts
      .slice(0, 2)
      .map((s, i) => `  ${i + 1}. "${s}"`)
      .join('\n');
    parts.push(snippets);
  } else {
    parts.push('No posts published yet — user is getting started');
  }

  // Primary platform hint
  if (context.preferences.primaryPlatform) {
    parts.push(`Primary platform: ${context.preferences.primaryPlatform}`);
  }

  return `## User Context\n${parts.join('\n')}`;
}
