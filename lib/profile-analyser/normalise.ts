/**
 * Defensive parsing of Apify LinkedIn / Facebook actor payloads.
 * Actors change field names often — pick the first finite/non-empty value.
 */

export type PostType = 'text' | 'image' | 'video' | 'link';

export interface NormalisedPost {
  text: string;
  likes: number;
  comments: number;
  shares: number;
  postedAt: string;
  type: PostType;
}

export interface NormalisedProfile {
  displayName: string;
  headline?: string;
  followers: number;
  connections?: number;
  posts: NormalisedPost[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function pickNumber(...vals: unknown[]): number {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v.replace(/,/g, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

export function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function classifyPostType(post: Record<string, unknown>): PostType {
  const type = pickString(
    post.type,
    post.postType,
    post.contentType,
    post.mediaType
  ).toLowerCase();
  if (
    type.includes('video') ||
    type.includes('reel') ||
    type.includes('live')
  ) {
    return 'video';
  }
  if (
    type.includes('image') ||
    type.includes('photo') ||
    type.includes('article') ||
    type.includes('document')
  ) {
    return 'image';
  }
  if (type.includes('link') || type.includes('share') || type.includes('url')) {
    return 'link';
  }
  if (post.videoUrl || post.video || post.isVideo) return 'video';
  if (
    (Array.isArray(post.images) && post.images.length > 0) ||
    post.imageUrl ||
    post.image ||
    post.photo
  ) {
    return 'image';
  }
  if (post.link || post.sharedPost || post.articleUrl) return 'link';
  return 'text';
}

export function normalisePost(raw: unknown): NormalisedPost | null {
  if (!isRecord(raw)) return null;
  const text = pickString(
    raw.text,
    raw.postText,
    raw.commentary,
    raw.message,
    raw.content,
    raw.caption
  );
  const likes = pickNumber(
    raw.totalReactionCount,
    raw.likesCount,
    raw.likes,
    raw.numLikes,
    raw.reactionCount,
    isRecord(raw.likes) ? raw.likes.count : undefined,
    isRecord(raw.reactions) ? raw.reactions.likes : undefined
  );
  const comments = pickNumber(
    raw.commentsCount,
    raw.comments,
    raw.numComments,
    raw.commentCount,
    isRecord(raw.comments) ? raw.comments.count : undefined
  );
  const shares = pickNumber(
    raw.repostsCount,
    raw.sharesCount,
    raw.shares,
    raw.numShares,
    raw.shareCount,
    isRecord(raw.shares) ? raw.shares.count : undefined
  );
  const postedAt = pickString(
    raw.postedAt,
    raw.postDate,
    raw.date,
    raw.time,
    raw.timestamp,
    raw.publishedAt,
    raw.createdAt
  );

  if (!text && likes === 0 && comments === 0 && !postedAt) return null;

  return {
    text,
    likes,
    comments,
    shares,
    postedAt,
    type: classifyPostType(raw),
  };
}

function nestedPosts(item: Record<string, unknown>): NormalisedPost[] {
  const buckets = [
    item.posts,
    item.latestPosts,
    item.recentPosts,
    item.updates,
    item.items,
  ];
  for (const bucket of buckets) {
    const posts = asArray(bucket)
      .map(normalisePost)
      .filter((p): p is NormalisedPost => p !== null);
    if (posts.length) return posts;
  }
  return [];
}

export function normaliseLinkedInItems(items: unknown[]): NormalisedProfile {
  const records = items.filter(isRecord);
  const first = records[0] ?? {};

  const nested = nestedPosts(first);
  const asPosts = records
    .map(normalisePost)
    .filter((p): p is NormalisedPost => p !== null);
  const posts = nested.length ? nested : asPosts;

  const displayName = pickString(
    first.fullName,
    first.name,
    `${pickString(first.firstName)} ${pickString(first.lastName)}`.trim(),
    first.publicIdentifier
  );

  const headline = pickString(
    first.headline,
    first.occupation,
    first.about,
    first.summary
  );

  const followers = pickNumber(
    first.followersCount,
    first.followerCount,
    first.followers,
    first.connections
  );
  const connections = pickNumber(
    first.connectionsCount,
    first.connections,
    first.connectionCount
  );

  return {
    displayName: displayName || 'LinkedIn profile',
    headline: headline || undefined,
    followers,
    connections: connections || undefined,
    posts,
  };
}

export function normaliseFacebookItems(items: unknown[]): NormalisedProfile {
  const records = items.filter(isRecord);
  const first = records[0] ?? {};

  const nested = nestedPosts(first);
  const asPosts = records
    .map(normalisePost)
    .filter((p): p is NormalisedPost => p !== null);
  const posts = nested.length ? nested : asPosts;

  const displayName = pickString(
    first.pageName,
    first.name,
    first.title,
    first.pageTitle,
    first.facebookId
  );

  const headline = pickString(first.about, first.category, first.intro);

  const followers = pickNumber(
    first.pageFollowers,
    first.followers,
    first.followersCount,
    first.likes,
    first.pageLikes,
    first.likesCount
  );

  return {
    displayName: displayName || 'Facebook page',
    headline: headline || undefined,
    followers,
    posts,
  };
}
