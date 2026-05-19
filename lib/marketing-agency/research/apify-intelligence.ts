export type ApifyResearchPlatform =
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'google';

export interface ApifyCreativeRecord {
  platform: ApifyResearchPlatform;
  sourceUrl?: string;
  author?: string;
  content: string;
  postedAt?: string;
  impressions?: number;
  views?: number;
  averageWatchTimeSec?: number;
  durationSec?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  engagement: number;
  rawMetricKeys: string[];
}

export interface RankedApifyCreativeSet {
  highestImpressions: ApifyCreativeRecord[];
  highestViews: ApifyCreativeRecord[];
  longestWatchSignals: ApifyCreativeRecord[];
  highestEngagement: ApifyCreativeRecord[];
}

export interface ApifyDesignInsight {
  title: string;
  rationale: string;
  sourceRecord?: ApifyCreativeRecord;
}

const CONTENT_KEYS = [
  'content',
  'text',
  'caption',
  'description',
  'message',
  'postText',
  'title',
];

const URL_KEYS = ['url', 'postUrl', 'link', 'videoUrl', 'displayUrl'];
const AUTHOR_KEYS = ['authorHandle', 'ownerUsername', 'pageName', 'profileName'];
const DATE_KEYS = ['timestamp', 'createdAt', 'date', 'postedAt', 'publishedAt'];

const IMPRESSION_KEYS = [
  'impressions',
  'impressionCount',
  'impressionsCount',
  'reach',
];

const VIEW_KEYS = [
  'viewCount',
  'views',
  'videoViewCount',
  'videoViews',
  'playCount',
  'videoPlayCount',
];

const WATCH_TIME_KEYS = [
  'averageWatchTime',
  'averageWatchTimeSec',
  'avgWatchTime',
  'avgWatchTimeSec',
  'watchTime',
  'watchTimeSec',
];

const DURATION_KEYS = ['duration', 'durationSec', 'videoDuration'];
const LIKE_KEYS = ['likes', 'likesCount', 'likeCount'];
const COMMENT_KEYS = ['comments', 'commentsCount', 'commentCount'];
const SHARE_KEYS = ['shares', 'sharesCount', 'shareCount'];
const SAVE_KEYS = ['saves', 'savesCount', 'saveCount'];
const ENGAGEMENT_KEYS = ['engagement', 'engagementCount', 'totalEngagement'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;

  const cleaned = value.replace(/,/g, '').trim().toLowerCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!match) return undefined;

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return undefined;
  if (match[2] === 'k') return Math.round(base * 1000);
  if (match[2] === 'm') return Math.round(base * 1000000);
  return base;
}

function firstString(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function firstNestedString(
  item: Record<string, unknown>,
  paths: string[][]
): string | undefined {
  for (const path of paths) {
    let current: unknown = item;
    for (const key of path) {
      if (!isRecord(current)) {
        current = undefined;
        break;
      }
      current = current[key];
    }
    if (typeof current === 'string' && current.trim()) return current.trim();
  }
  return undefined;
}

function firstNumber(item: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNumber(item[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function firstNestedNumber(
  item: Record<string, unknown>,
  paths: string[][]
): number | undefined {
  for (const path of paths) {
    let current: unknown = item;
    for (const key of path) {
      if (!isRecord(current)) {
        current = undefined;
        break;
      }
      current = current[key];
    }
    const value = toNumber(current);
    if (value !== undefined) return value;
  }
  return undefined;
}

function metricKeys(item: Record<string, unknown>): string[] {
  return Object.keys(item).filter(key => {
    const normalized = key.toLowerCase();
    return (
      normalized.includes('view') ||
      normalized.includes('impression') ||
      normalized.includes('like') ||
      normalized.includes('comment') ||
      normalized.includes('share') ||
      normalized.includes('save') ||
      normalized.includes('engagement') ||
      normalized.includes('watch')
    );
  });
}

export function normalizeApifyCreativeRecord(
  platform: ApifyResearchPlatform,
  item: Record<string, unknown>
): ApifyCreativeRecord {
  const likes = firstNumber(item, LIKE_KEYS);
  const comments = firstNumber(item, COMMENT_KEYS);
  const shares = firstNumber(item, SHARE_KEYS);
  const saves = firstNumber(item, SAVE_KEYS);
  const summedEngagement = [likes, comments, shares, saves].reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0
  );
  const engagement =
    firstNumber(item, ENGAGEMENT_KEYS) ??
    summedEngagement;

  const impressions =
    firstNumber(item, IMPRESSION_KEYS) ??
    firstNestedNumber(item, [
      ['stats', 'impressions'],
      ['statistics', 'impressions'],
      ['analytics', 'impressions'],
    ]);

  const views =
    firstNumber(item, VIEW_KEYS) ??
    firstNestedNumber(item, [
      ['stats', 'views'],
      ['stats', 'viewCount'],
      ['statistics', 'playCount'],
      ['videoStats', 'viewCount'],
      ['analytics', 'views'],
    ]);

  return {
    platform,
    sourceUrl: firstString(item, URL_KEYS),
    author:
      firstString(item, AUTHOR_KEYS) ??
      firstNestedString(item, [
        ['author', 'username'],
        ['author', 'name'],
        ['owner', 'username'],
        ['page', 'name'],
      ]),
    content: firstString(item, CONTENT_KEYS) ?? '',
    postedAt: firstString(item, DATE_KEYS),
    impressions,
    views,
    averageWatchTimeSec:
      firstNumber(item, WATCH_TIME_KEYS) ??
      firstNestedNumber(item, [
        ['stats', 'averageWatchTime'],
        ['analytics', 'averageWatchTime'],
      ]),
    durationSec: firstNumber(item, DURATION_KEYS),
    likes,
    comments,
    shares,
    saves,
    engagement,
    rawMetricKeys: metricKeys(item),
  };
}

function byMetric(
  records: ApifyCreativeRecord[],
  selector: (record: ApifyCreativeRecord) => number | undefined
): ApifyCreativeRecord[] {
  return [...records]
    .filter(record => selector(record) !== undefined)
    .sort((a, b) => (selector(b) ?? 0) - (selector(a) ?? 0))
    .slice(0, 10);
}

export function rankApifyCreativeRecords(
  records: ApifyCreativeRecord[]
): RankedApifyCreativeSet {
  return {
    highestImpressions: byMetric(records, record => record.impressions),
    highestViews: byMetric(records, record => record.views),
    longestWatchSignals: byMetric(
      records,
      record => record.averageWatchTimeSec ?? record.durationSec
    ),
    highestEngagement: byMetric(records, record => record.engagement),
  };
}

export function deriveApifyDesignInsights(
  ranked: RankedApifyCreativeSet
): ApifyDesignInsight[] {
  const insights: ApifyDesignInsight[] = [];
  const topView = ranked.highestViews[0];
  const topImpression = ranked.highestImpressions[0];
  const topWatch = ranked.longestWatchSignals[0];
  const topEngagement = ranked.highestEngagement[0];

  if (topView) {
    insights.push({
      title: 'Build first-frame variants from the highest-view hook',
      rationale: `Top view signal came from ${topView.author ?? topView.platform}; adapt the opening visual language without copying the asset.`,
      sourceRecord: topView,
    });
  }

  if (topImpression) {
    insights.push({
      title: 'Treat high-impression creative as placement proof',
      rationale: `Highest impression signal suggests this topic/format is being distributed broadly; use it to choose aspect ratio and headline density.`,
      sourceRecord: topImpression,
    });
  }

  if (topWatch) {
    insights.push({
      title: 'Use longer-watch records to pace proof scenes',
      rationale: 'Longer watch-time or duration signals justify adding a slower proof beat after the first hook.',
      sourceRecord: topWatch,
    });
  }

  if (topEngagement) {
    insights.push({
      title: 'Promote high-engagement comments into test hypotheses',
      rationale: `Highest engagement signal should inform the next A/B test, especially if comments or shares outpace views.`,
      sourceRecord: topEngagement,
    });
  }

  return insights;
}
