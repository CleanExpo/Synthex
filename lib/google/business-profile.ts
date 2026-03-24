/**
 * Google Business Profile Service
 *
 * Per-business GBP access using OAuth tokens stored in PlatformConnection.
 * Manages locations, reviews, posts, insights, photos, and categories.
 *
 * @module lib/google/business-profile
 */

import { getOAuthAccessToken } from '@/lib/google/google-auth';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface GBPLocationSummary {
  name: string; // Resource name: accounts/{id}/locations/{id}
  locationName: string;
  address?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  primaryPhone?: string;
  websiteUri?: string;
  primaryCategory?: {
    displayName: string;
    categoryId?: string;
  };
  additionalCategories?: Array<{
    displayName: string;
    categoryId?: string;
  }>;
  regularHours?: {
    periods: Array<{
      openDay: string;
      openTime: string;
      closeDay: string;
      closeTime: string;
    }>;
  };
  metadata?: {
    mapsUri?: string;
    newReviewUri?: string;
  };
  openInfo?: {
    status: string;
  };
  storefrontAddress?: Record<string, unknown>;
}

export interface GBPReview {
  name: string; // Resource name
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export interface GBPInsights {
  searchViews?: number;
  mapsViews?: number;
  websiteClicks?: number;
  phoneClicks?: number;
  directionClicks?: number;
}

export interface GBPPost {
  name?: string;
  summary: string;
  callToAction?: {
    actionType: string;
    url?: string;
  };
  media?: Array<{
    mediaFormat: string;
    sourceUrl: string;
  }>;
  topicType?: string;
  event?: {
    title: string;
    schedule: {
      startDate: { year: number; month: number; day: number };
      endDate: { year: number; month: number; day: number };
    };
  };
}

// ============================================================================
// Constants
// ============================================================================

const GBP_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const GBP_ACCOUNT_API = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const DEFAULT_TIMEOUT = 30_000;

const STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

// ============================================================================
// Account Discovery
// ============================================================================

/**
 * List all GBP accounts accessible by the authenticated user.
 */
async function listAccounts(connectionId: string): Promise<string[]> {
  const accessToken = await getOAuthAccessToken(connectionId);

  const response = await fetch(`${GBP_ACCOUNT_API}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GBP listAccounts failed (${response.status}): ${error}`);
  }

  const data = await response.json();
  return (data.accounts || []).map((a: { name: string }) => a.name);
}

// ============================================================================
// Locations
// ============================================================================

/**
 * List all GBP locations across all accounts.
 */
export async function listLocations(
  connectionId: string
): Promise<GBPLocationSummary[]> {
  const accounts = await listAccounts(connectionId);
  const accessToken = await getOAuthAccessToken(connectionId);
  const allLocations: GBPLocationSummary[] = [];

  for (const account of accounts) {
    try {
      const response = await fetch(
        `${GBP_API_BASE}/${account}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,metadata,categories`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
        }
      );

      if (!response.ok) {
        logger.warn(
          `GBP listLocations for ${account} failed: ${response.status}`
        );
        continue;
      }

      const data = await response.json();
      for (const loc of data.locations || []) {
        allLocations.push({
          name: loc.name,
          locationName: loc.title || loc.name,
          address: loc.storefrontAddress,
          primaryPhone: loc.phoneNumbers?.primaryPhone,
          websiteUri: loc.websiteUri,
          primaryCategory: loc.categories?.primaryCategory,
          additionalCategories: loc.categories?.additionalCategories,
          regularHours: loc.regularHours,
          metadata: loc.metadata,
        });
      }
    } catch (error) {
      logger.error(`GBP listLocations error for ${account}:`, error);
    }
  }

  return allLocations;
}

/**
 * Get detailed information for a specific location.
 */
export async function getLocationDetails(
  connectionId: string,
  locationName: string
): Promise<GBPLocationSummary> {
  const accessToken = await getOAuthAccessToken(connectionId);

  const response = await fetch(
    `${GBP_API_BASE}/${locationName}?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,specialHours,metadata,categories,openInfo`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `GBP getLocationDetails failed (${response.status}): ${error}`
    );
  }

  const loc = await response.json();
  return {
    name: loc.name,
    locationName: loc.title || loc.name,
    address: loc.storefrontAddress,
    primaryPhone: loc.phoneNumbers?.primaryPhone,
    websiteUri: loc.websiteUri,
    primaryCategory: loc.categories?.primaryCategory,
    additionalCategories: loc.categories?.additionalCategories,
    regularHours: loc.regularHours,
    metadata: loc.metadata,
    openInfo: loc.openInfo,
  };
}

/**
 * Update a location's details (hours, categories, etc.).
 */
export async function updateLocation(
  connectionId: string,
  locationName: string,
  data: Partial<
    Pick<GBPLocationSummary, 'regularHours' | 'primaryPhone' | 'websiteUri'>
  >
): Promise<GBPLocationSummary> {
  const accessToken = await getOAuthAccessToken(connectionId);

  const updateMask: string[] = [];
  if (data.regularHours) updateMask.push('regularHours');
  if (data.primaryPhone) updateMask.push('phoneNumbers.primaryPhone');
  if (data.websiteUri) updateMask.push('websiteUri');

  const body: Record<string, unknown> = {};
  if (data.regularHours) body.regularHours = data.regularHours;
  if (data.primaryPhone)
    body.phoneNumbers = { primaryPhone: data.primaryPhone };
  if (data.websiteUri) body.websiteUri = data.websiteUri;

  const response = await fetch(
    `${GBP_API_BASE}/${locationName}?updateMask=${updateMask.join(',')}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GBP updateLocation failed (${response.status}): ${error}`);
  }

  const loc = await response.json();
  return {
    name: loc.name,
    locationName: loc.title || loc.name,
    address: loc.storefrontAddress,
    primaryPhone: loc.phoneNumbers?.primaryPhone,
    websiteUri: loc.websiteUri,
    primaryCategory: loc.categories?.primaryCategory,
    regularHours: loc.regularHours,
    metadata: loc.metadata,
  };
}

// ============================================================================
// Reviews
// ============================================================================

/**
 * Get reviews for a location (paginated).
 */
export async function getReviews(
  connectionId: string,
  locationName: string,
  options?: { pageSize?: number; pageToken?: string }
): Promise<{
  reviews: GBPReview[];
  nextPageToken?: string;
  averageRating?: number;
  totalReviewCount?: number;
}> {
  const accessToken = await getOAuthAccessToken(connectionId);

  const params = new URLSearchParams();
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.pageToken) params.set('pageToken', options.pageToken);

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/reviews?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GBP getReviews failed (${response.status}): ${error}`);
  }

  const data = await response.json();

  return {
    reviews: (data.reviews || []).map((r: Record<string, unknown>) => ({
      name: r.name as string,
      reviewId: r.reviewId as string,
      reviewer: r.reviewer as GBPReview['reviewer'],
      starRating: r.starRating as GBPReview['starRating'],
      comment: r.comment as string | undefined,
      createTime: r.createTime as string,
      updateTime: r.updateTime as string,
      reviewReply: r.reviewReply as GBPReview['reviewReply'] | undefined,
    })),
    nextPageToken: data.nextPageToken,
    averageRating: data.averageRating,
    totalReviewCount: data.totalReviewCount,
  };
}

/**
 * Reply to a review.
 */
export async function replyToReview(
  connectionId: string,
  reviewName: string,
  replyText: string
): Promise<void> {
  const accessToken = await getOAuthAccessToken(connectionId);

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ comment: replyText }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GBP replyToReview failed (${response.status}): ${error}`);
  }
}

/**
 * Delete a review reply.
 */
export async function deleteReviewReply(
  connectionId: string,
  reviewName: string
): Promise<void> {
  const accessToken = await getOAuthAccessToken(connectionId);

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `GBP deleteReviewReply failed (${response.status}): ${error}`
    );
  }
}

// ============================================================================
// Google Posts
// ============================================================================

/**
 * Create a Google Post for a location.
 */
export async function createPost(
  connectionId: string,
  locationName: string,
  post: GBPPost
): Promise<GBPPost> {
  const accessToken = await getOAuthAccessToken(connectionId);

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(post),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GBP createPost failed (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * List Google Posts for a location.
 */
export async function listPosts(
  connectionId: string,
  locationName: string,
  options?: { pageSize?: number; pageToken?: string }
): Promise<{ posts: GBPPost[]; nextPageToken?: string }> {
  const accessToken = await getOAuthAccessToken(connectionId);

  const params = new URLSearchParams();
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.pageToken) params.set('pageToken', options.pageToken);

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/localPosts?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GBP listPosts failed (${response.status}): ${error}`);
  }

  const data = await response.json();
  return {
    posts: data.localPosts || [],
    nextPageToken: data.nextPageToken,
  };
}

// ============================================================================
// Insights / Performance Metrics
// ============================================================================

/**
 * Get performance insights for a location.
 * Uses the Business Profile Performance API.
 */
export async function getInsights(
  connectionId: string,
  locationName: string,
  dateRange?: { startDate: string; endDate: string }
): Promise<GBPInsights> {
  const accessToken = await getOAuthAccessToken(connectionId);

  // Use Performance API for daily metrics
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const startDate =
    dateRange?.startDate || thirtyDaysAgo.toISOString().split('T')[0];
  const endDate = dateRange?.endDate || now.toISOString().split('T')[0];

  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

  const metrics = [
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    'WEBSITE_CLICKS',
    'CALL_CLICKS',
    'BUSINESS_DIRECTION_REQUESTS',
  ];

  try {
    const response = await fetch(
      `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dailyMetrics: metrics,
          dailyRange: {
            startDate: { year: startYear, month: startMonth, day: startDay },
            endDate: { year: endYear, month: endMonth, day: endDay },
          },
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
      }
    );

    if (!response.ok) {
      logger.warn(
        `GBP getInsights failed (${response.status}), returning empty insights`
      );
      return {};
    }

    const data = await response.json();
    const results = data.multiDailyMetricTimeSeries || [];

    // Aggregate metrics across the date range
    let searchViews = 0;
    let mapsViews = 0;
    let websiteClicks = 0;
    let phoneClicks = 0;
    let directionClicks = 0;

    for (const series of results) {
      const metric = series.dailyMetric;
      const total = (
        series.dailyMetricTimeSeries?.timeSeries?.datedValues || []
      ).reduce(
        (sum: number, v: { value?: string }) =>
          sum + parseInt(v.value || '0', 10),
        0
      );

      if (metric?.includes('SEARCH')) searchViews += total;
      if (metric?.includes('MAPS')) mapsViews += total;
      if (metric === 'WEBSITE_CLICKS') websiteClicks = total;
      if (metric === 'CALL_CLICKS') phoneClicks = total;
      if (metric === 'BUSINESS_DIRECTION_REQUESTS') directionClicks = total;
    }

    return {
      searchViews,
      mapsViews,
      websiteClicks,
      phoneClicks,
      directionClicks,
    };
  } catch (error) {
    logger.error('GBP getInsights error:', error);
    return {};
  }
}

// ============================================================================
// Photos
// ============================================================================

/**
 * List photos for a location.
 */
export async function listPhotos(
  connectionId: string,
  locationName: string
): Promise<
  Array<{
    name: string;
    mediaFormat: string;
    sourceUrl?: string;
    thumbnailUrl?: string;
  }>
> {
  const accessToken = await getOAuthAccessToken(connectionId);

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    }
  );

  if (!response.ok) {
    logger.warn(`GBP listPhotos failed (${response.status})`);
    return [];
  }

  const data = await response.json();
  return (data.mediaItems || []).map((m: Record<string, unknown>) => ({
    name: m.name as string,
    mediaFormat: m.mediaFormat as string,
    sourceUrl: m.sourceUrl as string | undefined,
    thumbnailUrl: m.thumbnailUrl as string | undefined,
  }));
}

/**
 * Upload a photo to a GBP location via a public source URL (SYN-481).
 * The image must already be hosted at a publicly accessible HTTPS URL.
 */
export async function uploadPhoto(
  connectionId: string,
  locationName: string,
  sourceUrl: string,
  category: string = 'ADDITIONAL'
): Promise<{ name: string; mediaFormat: string; sourceUrl: string }> {
  const accessToken = await getOAuthAccessToken(connectionId);

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        mediaFormat: 'PHOTO',
        sourceUrl,
        category,
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GBP uploadPhoto failed (${response.status}): ${error}`);
  }

  return response.json();
}

// ============================================================================
// Categories
// ============================================================================

/**
 * Search available GMB categories.
 */
export async function getCategories(
  query: string,
  regionCode: string = 'AU',
  languageCode: string = 'en'
): Promise<Array<{ displayName: string; categoryId: string }>> {
  // Categories endpoint does not require OAuth — uses API key or public
  const response = await fetch(
    `${GBP_API_BASE}/categories?regionCode=${regionCode}&languageCode=${languageCode}&filter=${encodeURIComponent(query)}&view=FULL`,
    { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) }
  );

  if (!response.ok) {
    logger.warn(`GBP getCategories failed (${response.status})`);
    return [];
  }

  const data = await response.json();
  return (data.categories || []).map((c: Record<string, unknown>) => ({
    displayName: c.displayName as string,
    categoryId: c.name as string,
  }));
}

// ============================================================================
// Helpers
// ============================================================================

export function starRatingToNumber(rating: string): number {
  return STAR_RATING_MAP[rating] ?? 0;
}
