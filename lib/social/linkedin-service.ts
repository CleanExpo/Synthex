/**
 * LinkedIn Platform Service
 *
 * @description LinkedIn API integration for syncing analytics, posts, and profiles
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - LINKEDIN_CLIENT_ID: LinkedIn app client ID (SECRET)
 * - LINKEDIN_CLIENT_SECRET: LinkedIn app client secret (SECRET)
 *
 * User credentials are stored per-user in the database (PlatformConnection)
 *
 * FAILURE MODE: Service will return error results, never throws for sync operations
 */

import {
  BasePlatformService,
  PlatformCredentials,
  SyncAnalyticsResult,
  SyncPostsResult,
  SyncProfileResult,
  PostContent,
  PostResult,
  PlatformError,
} from './base-platform-service';
import { logger } from '@/lib/logger';

// ============================================================================
// LINKEDIN API RESPONSE TYPES
// ============================================================================

/** LinkedIn profile response from /me endpoint */
interface LinkedInProfileResponse {
  id: string;
  firstName?: {
    localized?: Record<string, string>;
  };
  lastName?: {
    localized?: Record<string, string>;
  };
  vanityName?: string;
  profilePicture?: {
    'displayImage~'?: {
      elements?: LinkedInImageElement[];
    };
  };
}

/** LinkedIn image element in profile picture */
interface LinkedInImageElement {
  identifiers?: Array<{ identifier?: string }>;
  data?: {
    'com.linkedin.digitalmedia.mediaartifact.StillImage'?: {
      storageSize?: { width?: number };
    };
  };
}

/** LinkedIn network size response */
interface NetworkSizeResponse {
  firstDegreeSize?: number;
}

/** LinkedIn connections response */
interface ConnectionsResponse {
  _total?: number;
}

/** LinkedIn shares response */
interface SharesResponse {
  elements?: ShareElement[];
  paging?: {
    start?: number;
    count?: number;
    total?: number;
  };
}

/** LinkedIn share/post element */
interface ShareElement {
  id: string;
  activity: string;
  text?: { text?: string };
  commentary?: string;
  content?: {
    contentEntities?: ContentEntity[];
  };
  created?: { time?: number };
  lastModified?: { time?: number };
}

/** LinkedIn content entity (media) */
interface ContentEntity {
  entityLocation?: string;
}

/** LinkedIn social actions statistics response */
interface SocialActionsStatsResponse {
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  impressionCount?: number;
  clickCount?: number;
}

/** LinkedIn email response */
interface EmailResponse {
  elements?: Array<{
    'handle~'?: {
      emailAddress?: string;
    };
  }>;
}

/** LinkedIn UGC post creation payload */
interface UgcPostPayload {
  author: string;
  lifecycleState: string;
  specificContent: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: {
        text: string;
      };
      shareMediaCategory: string;
      media?: Array<{
        status: string;
        originalUrl?: string;
        media?: string;
      }>;
    };
  };
  visibility: {
    'com.linkedin.ugc.MemberNetworkVisibility': string;
  };
}

/** LinkedIn UGC post creation response */
interface UgcPostResponse {
  id: string;
}

/** LinkedIn assets registerUpload response */
interface RegisterUploadResponse {
  value?: {
    asset?: string;
    uploadMechanism?: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'?: {
        uploadUrl?: string;
        headers?: Record<string, string>;
      };
    };
  };
}

/** LinkedIn asset status response from GET /assets/{id} */
interface AssetStatusResponse {
  recipes?: Array<{ recipe?: string; status?: string }>;
  status?: string;
}

/**
 * Hosts image bytes may be fetched from at publish time. Post media URLs are
 * already persisted server-side (post metadata) — this is defence-in-depth so
 * the publish path can never be steered at an arbitrary URL.
 */
const ALLOWED_IMAGE_MEDIA_HOSTS = ['res.cloudinary.com'];

/**
 * Hosts video bytes may be fetched from at publish time. Same defence-in-depth
 * as images, plus Supabase storage — generated videos are persisted to the
 * `generated-videos` bucket (lib/services/ai/video/artifact-store.ts) and
 * published from its public URL.
 */
const ALLOWED_VIDEO_MEDIA_HOSTS = ['res.cloudinary.com'];
const ALLOWED_VIDEO_MEDIA_HOST_SUFFIX = '.supabase.co';

/** File extensions treated as native video for LinkedIn publishing. */
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm'];

/** True when a publish-time image URL is https on an allowed media host. */
export function isAllowedLinkedInImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      ALLOWED_IMAGE_MEDIA_HOSTS.includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/** True when a publish-time video URL is https on an allowed media host. */
export function isAllowedLinkedInVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (ALLOWED_VIDEO_MEDIA_HOSTS.includes(parsed.hostname) ||
        parsed.hostname.endsWith(ALLOWED_VIDEO_MEDIA_HOST_SUFFIX))
    );
  } catch {
    return false;
  }
}

/** True when a media URL points at a video file (by extension). */
export function isLinkedInVideoMediaUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/** Post metrics structure */
interface LinkedInPostMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  clicks: number;
}

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const LINKEDIN_API_REST = 'https://api.linkedin.com/rest';
/**
 * LinkedIn versioned-API date (YYYYMM). LinkedIn sunsets versions ~12 months
 * after release, so a stale value is rejected. 202401 (Jan 2024) was ~2.5y old.
 * Review quarterly against https://learn.microsoft.com/linkedin/marketing/versioning
 * TODO(linkedin): migrate createPost from legacy /ugcPosts to the /rest/posts
 * Posts API (author/commentary/distribution schema); validate against LinkedIn's
 * Community Management review sandbox before flipping (endpoint is review-gated).
 */
const LINKEDIN_VERSION = '202606';

export class LinkedInService extends BasePlatformService {
  readonly platform = 'linkedin';

  /** Bounded video-asset processing poll: 60 × 5s ≈ 5 minutes. */
  protected videoPollAttempts = 60;
  protected videoPollIntervalMs = 5000;

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    useRestApi: boolean = false
  ): Promise<T> {
    // Ensure token is valid before making request (auto-refresh if needed)
    await this.ensureValidToken();

    if (!this.credentials?.accessToken) {
      throw new PlatformError('linkedin', 'No access token configured');
    }

    const baseUrl = useRestApi ? LINKEDIN_API_REST : LINKEDIN_API_BASE;
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.credentials.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': LINKEDIN_VERSION,
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Update rate limits
      const rateLimitHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith('x-li-')) {
          rateLimitHeaders[key] = value;
        }
      });
      this.updateRateLimits(endpoint, rateLimitHeaders);

      // Check for token expiry (401 Unauthorized)
      if (response.status === 401) {
        logger.warn(
          '[linkedin] Token expired during request, attempting refresh...',
          {
            endpoint,
            status: response.status,
          }
        );

        // Try to refresh and retry
        if (this.credentials?.refreshToken) {
          try {
            await this.refreshToken();
            // Retry request with new token
            const retryHeaders: Record<string, string> = {
              ...headers,
              Authorization: `Bearer ${this.credentials.accessToken}`,
            };
            const retryResponse = await fetch(url, {
              ...options,
              headers: retryHeaders,
            });

            if (!retryResponse.ok) {
              const errorBody = await retryResponse.text();
              throw new PlatformError(
                'linkedin',
                `API request failed after token refresh: ${retryResponse.status} - ${errorBody}`,
                retryResponse.status
              );
            }

            // Update rate limits from retry response
            retryResponse.headers.forEach((value, key) => {
              if (key.toLowerCase().startsWith('x-li-')) {
                rateLimitHeaders[key] = value;
              }
            });
            this.updateRateLimits(endpoint, rateLimitHeaders);

            return await retryResponse.json();
          } catch (refreshError) {
            logger.error('[linkedin] Token refresh failed during retry', {
              error: refreshError,
            });
            throw new PlatformError(
              'linkedin',
              'Token expired and refresh failed. Please re-authenticate.',
              401
            );
          }
        }
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new PlatformError(
          'linkedin',
          `API request failed: ${response.status} - ${errorBody}`,
          response.status
        );
      }

      return await response.json();
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      throw new PlatformError(
        'linkedin',
        error instanceof Error ? error.message : String(error),
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Override canRefreshToken to check for refresh token availability
   */
  protected override canRefreshToken(): boolean {
    return !!this.credentials?.refreshToken;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      await this.makeRequest('/me');
      return true;
    } catch (error) {
      logger.error('LinkedIn credentials validation failed', { error });
      return false;
    }
  }

  async refreshToken(): Promise<PlatformCredentials> {
    if (!this.credentials?.refreshToken) {
      throw new PlatformError('linkedin', 'No refresh token available');
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new PlatformError(
        'linkedin',
        'LinkedIn OAuth credentials not configured'
      );
    }

    try {
      const response = await fetch(
        'https://www.linkedin.com/oauth/v2/accessToken',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.credentials.refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        }
      );

      if (!response.ok) {
        throw new PlatformError(
          'linkedin',
          'Token refresh failed',
          response.status
        );
      }

      const data = await response.json();

      const newCredentials: PlatformCredentials = {
        ...this.credentials,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.credentials.refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };

      this.credentials = newCredentials;
      return newCredentials;
    } catch (error: unknown) {
      throw new PlatformError(
        'linkedin',
        `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async syncAnalytics(days: number = 30): Promise<SyncAnalyticsResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          metrics: { impressions: 0, engagements: 0, followers: 0 },
          period: { start: new Date(), end: new Date() },
          error: 'Service not configured',
        };
      }

      const endDate = new Date();
      const startDate = new Date(
        endDate.getTime() - days * 24 * 60 * 60 * 1000
      );

      // Get profile for person URN
      const profile = await this.makeRequest<LinkedInProfileResponse>('/me');
      const personUrn = `urn:li:person:${profile.id}`;

      // Get follower statistics
      let followers = 0;
      try {
        const networkInfo = await this.makeRequest<NetworkSizeResponse>(
          `/networkSizes/${encodeURIComponent(personUrn)}?edgeType=CompanyFollowedByMember`
        );
        followers = networkInfo.firstDegreeSize || 0;
      } catch {
        // Fallback - connections count
        const connections = await this.makeRequest<ConnectionsResponse>(
          '/connections?q=viewer&count=0'
        );
        followers = connections._total || 0;
      }

      // Get share statistics (posts analytics)
      let impressions = 0;
      let engagements = 0;
      const dailyBreakdown: Array<{
        date: string;
        impressions: number;
        engagements: number;
      }> = [];

      try {
        // Get recent shares/posts
        const shares = await this.makeRequest<SharesResponse>(
          `/shares?q=owners&owners=${encodeURIComponent(personUrn)}&count=50`
        );

        // Aggregate metrics from posts
        if (shares.elements) {
          for (const share of shares.elements) {
            try {
              const stats = await this.makeRequest<SocialActionsStatsResponse>(
                `/socialActions/${encodeURIComponent(share.activity)}/statistics`
              );
              impressions += stats.impressionCount || 0;
              engagements +=
                (stats.likeCount || 0) +
                (stats.commentCount || 0) +
                (stats.shareCount || 0);
            } catch {
              // Skip posts without accessible stats
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to fetch LinkedIn share statistics', { error });
      }

      return {
        success: true,
        metrics: {
          impressions,
          engagements,
          followers,
          following: 0,
          posts: 0,
          likes: 0,
          comments: 0,
          shares: 0,
        },
        period: {
          start: startDate,
          end: endDate,
        },
        breakdown: {
          daily: dailyBreakdown,
        },
      };
    } catch (error: unknown) {
      logger.error('LinkedIn analytics sync failed', { error });
      return {
        success: false,
        metrics: { impressions: 0, engagements: 0, followers: 0 },
        period: { start: new Date(), end: new Date() },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async syncPosts(
    limit: number = 20,
    cursor?: string
  ): Promise<SyncPostsResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          posts: [],
          total: 0,
          hasMore: false,
          error: 'Service not configured',
        };
      }

      // Get profile for person URN
      const profile = await this.makeRequest<LinkedInProfileResponse>('/me');
      const personUrn = `urn:li:person:${profile.id}`;

      // Build query with pagination
      let endpoint = `/shares?q=owners&owners=${encodeURIComponent(personUrn)}&count=${limit}`;
      if (cursor) {
        endpoint += `&start=${cursor}`;
      }

      const response = await this.makeRequest<SharesResponse>(endpoint);

      const posts = await Promise.all(
        (response.elements || []).map(async (share: ShareElement) => {
          // Get engagement stats for each post
          let likes = 0,
            comments = 0,
            shares = 0,
            impressions = 0;

          try {
            const stats = await this.makeRequest<SocialActionsStatsResponse>(
              `/socialActions/${encodeURIComponent(share.activity)}/statistics`
            );
            likes = stats.likeCount || 0;
            comments = stats.commentCount || 0;
            shares = stats.shareCount || 0;
            impressions = stats.impressionCount || 0;
          } catch {
            // Stats not available
          }

          return {
            id: share.id,
            platformId: share.activity,
            content: share.text?.text || share.commentary || '',
            mediaUrls:
              share.content?.contentEntities
                ?.map((e: ContentEntity) => e.entityLocation)
                .filter((url): url is string => url !== undefined) || [],
            publishedAt: new Date(
              share.created?.time || share.lastModified?.time || Date.now()
            ),
            metrics: {
              likes,
              comments,
              shares,
              impressions,
            },
            url: `https://www.linkedin.com/feed/update/${share.activity}`,
          };
        })
      );

      const nextCursor =
        response.paging?.start !== undefined &&
        response.paging?.count !== undefined
          ? String(response.paging.start + response.paging.count)
          : undefined;

      return {
        success: true,
        posts,
        total: response.paging?.total || posts.length,
        hasMore: !!nextCursor && posts.length === limit,
        cursor: nextCursor,
      };
    } catch (error: unknown) {
      logger.error('LinkedIn posts sync failed', { error });
      return {
        success: false,
        posts: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async syncProfile(): Promise<SyncProfileResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          profile: {
            id: '',
            username: '',
            displayName: '',
            followers: 0,
            following: 0,
            postsCount: 0,
          },
          error: 'Service not configured',
        };
      }

      // Get basic profile
      const profile = await this.makeRequest<LinkedInProfileResponse>(
        '/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams),vanityName)'
      );

      // Get email if available
      let email = '';
      try {
        const emailResponse = await this.makeRequest<EmailResponse>(
          '/emailAddress?q=members&projection=(elements*(handle~))'
        );
        email = emailResponse.elements?.[0]?.['handle~']?.emailAddress || '';
      } catch {
        // Email not accessible
      }

      // Get network size
      let followers = 0;
      try {
        const personUrn = `urn:li:person:${profile.id}`;
        const networkInfo = await this.makeRequest<NetworkSizeResponse>(
          `/networkSizes/${encodeURIComponent(personUrn)}?edgeType=CompanyFollowedByMember`
        );
        followers = networkInfo.firstDegreeSize || 0;
      } catch {
        // Fallback to connections
        try {
          const connections = await this.makeRequest<ConnectionsResponse>(
            '/connections?q=viewer&count=0'
          );
          followers = connections._total || 0;
        } catch {
          // No connection count available
        }
      }

      // Extract profile picture URL
      let avatarUrl = '';
      if (profile.profilePicture?.['displayImage~']?.elements) {
        const images = profile.profilePicture['displayImage~'].elements;
        const largestImage = images.sort(
          (a: LinkedInImageElement, b: LinkedInImageElement) =>
            (b.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']
              ?.storageSize?.width || 0) -
            (a.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']
              ?.storageSize?.width || 0)
        )[0];
        avatarUrl = largestImage?.identifiers?.[0]?.identifier || '';
      }

      // Get first and last name
      const firstName =
        profile.firstName?.localized?.[
          Object.keys(profile.firstName?.localized || {})[0]
        ] || '';
      const lastName =
        profile.lastName?.localized?.[
          Object.keys(profile.lastName?.localized || {})[0]
        ] || '';

      return {
        success: true,
        profile: {
          id: profile.id,
          username: profile.vanityName || profile.id,
          displayName: `${firstName} ${lastName}`.trim(),
          bio: '', // LinkedIn doesn't expose bio in basic API
          avatarUrl,
          followers,
          following: 0, // LinkedIn doesn't expose following count
          postsCount: 0, // Would need separate query
          verified: false,
          url: `https://www.linkedin.com/in/${profile.vanityName || profile.id}`,
        },
      };
    } catch (error: unknown) {
      logger.error('LinkedIn profile sync failed', { error });
      return {
        success: false,
        profile: {
          id: '',
          username: '',
          displayName: '',
          followers: 0,
          following: 0,
          postsCount: 0,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async createPost(content: PostContent): Promise<PostResult> {
    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'Service not configured' };
      }

      // Determine author URN:
      // - If platformUserId is a purely numeric string it is a LinkedIn organisation page ID
      //   (e.g. "112760720") and we post as that company page (requires w_organization_social).
      // - Otherwise we post as the authenticated member's personal profile.
      let authorUrn: string;
      const storedUserId = this.credentials?.platformUserId;
      if (storedUserId && /^\d+$/.test(storedUserId)) {
        // Company page posting — use organisation URN
        authorUrn = `urn:li:organization:${storedUserId}`;
        logger.info('[linkedin] Posting as organisation', {
          organizationUrn: authorUrn,
        });
      } else {
        // Personal profile posting — fetch current member ID
        const profile = await this.makeRequest<LinkedInProfileResponse>('/me');
        authorUrn = `urn:li:person:${profile.id}`;
      }

      // Build post payload
      const postPayload: UgcPostPayload = {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content.text,
            },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility':
            content.visibility === 'connections' ? 'CONNECTIONS' : 'PUBLIC',
        },
      };

      // Attach media. Media wins over a bare link (a UGC post carries one
      // media category); a post with neither stays text-only ('NONE').
      const mediaUrls = content.mediaUrls ?? [];
      const videoUrls = mediaUrls.filter(isLinkedInVideoMediaUrl);

      if (videoUrls.length > 0) {
        // A UGC post carries exactly one media category — fail loud rather
        // than silently dropping approved creative.
        if (videoUrls.length !== mediaUrls.length) {
          return {
            success: false,
            error:
              'LinkedIn post cannot mix video and image media — post one video, or images only.',
          };
        }
        if (videoUrls.length > 1) {
          return {
            success: false,
            error: `LinkedIn allows exactly one video per post — ${videoUrls.length} were supplied.`,
          };
        }

        const videoUrl = videoUrls[0];
        if (!isAllowedLinkedInVideoUrl(videoUrl)) {
          return {
            success: false,
            error: `LinkedIn video upload blocked for non-allowlisted media URL: ${videoUrl}`,
          };
        }

        const share =
          postPayload.specificContent['com.linkedin.ugc.ShareContent'];
        share.shareMediaCategory = 'VIDEO';
        const asset = await this.uploadVideoAsset(authorUrn, videoUrl);
        share.media = [{ status: 'READY', media: asset }];
      } else if (mediaUrls.length > 0) {
        const disallowed = mediaUrls.filter(
          url => !isAllowedLinkedInImageUrl(url)
        );
        if (disallowed.length > 0) {
          // Fail loud — silently dropping approved creative is the defect
          // this path exists to fix.
          return {
            success: false,
            error: `LinkedIn image upload blocked for non-allowlisted media URL(s): ${disallowed.join(', ')}`,
          };
        }

        const share =
          postPayload.specificContent['com.linkedin.ugc.ShareContent'];
        share.shareMediaCategory = 'IMAGE';
        share.media = [];
        for (const mediaUrl of mediaUrls) {
          const asset = await this.uploadImageAsset(authorUrn, mediaUrl);
          share.media.push({ status: 'READY', media: asset });
        }
      } else if (content.linkUrl) {
        postPayload.specificContent[
          'com.linkedin.ugc.ShareContent'
        ].shareMediaCategory = 'ARTICLE';
        postPayload.specificContent['com.linkedin.ugc.ShareContent'].media = [
          {
            status: 'READY',
            originalUrl: content.linkUrl,
          },
        ];
      }

      // Create the post
      const response = await this.makeRequest<UgcPostResponse>('/ugcPosts', {
        method: 'POST',
        body: JSON.stringify(postPayload),
      });

      return {
        success: true,
        postId: response.id,
        url: `https://www.linkedin.com/feed/update/${response.id}`,
      };
    } catch (error: unknown) {
      logger.error('LinkedIn post creation failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Upload one image to LinkedIn's asset store and return its
   * digitalmediaAsset URN — the legacy /v2/assets registerUpload flow, the
   * same API surface as the /v2/ugcPosts call it feeds. Throws PlatformError
   * on any failure so createPost reports it instead of posting imageless.
   */
  private async uploadImageAsset(
    authorUrn: string,
    imageUrl: string
  ): Promise<string> {
    const register = await this.makeRequest<RegisterUploadResponse>(
      '/assets?action=registerUpload',
      {
        method: 'POST',
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: authorUrn,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        }),
      }
    );

    const asset = register.value?.asset;
    const uploadRequest =
      register.value?.uploadMechanism?.[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ];
    const uploadUrl = uploadRequest?.uploadUrl;
    if (!asset || !uploadUrl) {
      throw new PlatformError(
        'linkedin',
        'registerUpload returned no asset or upload URL'
      );
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new PlatformError(
        'linkedin',
        `Failed to fetch image bytes (${imageResponse.status}) from ${imageUrl}`
      );
    }
    const imageBytes = await imageResponse.arrayBuffer();

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.credentials?.accessToken ?? ''}`,
        'Content-Type':
          imageResponse.headers.get('content-type') ??
          'application/octet-stream',
        ...(uploadRequest.headers ?? {}),
      },
      body: imageBytes,
    });
    if (!uploadResponse.ok) {
      throw new PlatformError(
        'linkedin',
        `Image upload failed (${uploadResponse.status}) for ${imageUrl}`
      );
    }

    return asset;
  }

  /**
   * Upload one video to LinkedIn's asset store and return its
   * digitalmediaAsset URN — the same /v2/assets registerUpload flow as images,
   * with one critical difference: LinkedIn transcodes video asynchronously, so
   * the asset must be polled until its recipe reports AVAILABLE. Publishing a
   * still-PROCESSING asset yields a post with a broken player. Throws
   * PlatformError on any failure so createPost reports it instead of posting
   * videoless.
   */
  private async uploadVideoAsset(
    authorUrn: string,
    videoUrl: string
  ): Promise<string> {
    const register = await this.makeRequest<RegisterUploadResponse>(
      '/assets?action=registerUpload',
      {
        method: 'POST',
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
            owner: authorUrn,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        }),
      }
    );

    const asset = register.value?.asset;
    const uploadRequest =
      register.value?.uploadMechanism?.[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ];
    const uploadUrl = uploadRequest?.uploadUrl;
    if (!asset || !uploadUrl) {
      throw new PlatformError(
        'linkedin',
        'registerUpload returned no asset or upload URL'
      );
    }

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new PlatformError(
        'linkedin',
        `Failed to fetch video bytes (${videoResponse.status}) from ${videoUrl}`
      );
    }
    const videoBytes = await videoResponse.arrayBuffer();

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.credentials?.accessToken ?? ''}`,
        'Content-Type':
          videoResponse.headers.get('content-type') ??
          'application/octet-stream',
        ...(uploadRequest.headers ?? {}),
      },
      body: videoBytes,
    });
    if (!uploadResponse.ok) {
      throw new PlatformError(
        'linkedin',
        `Video upload failed (${uploadResponse.status}) for ${videoUrl}`
      );
    }

    await this.waitForVideoAssetAvailable(asset, videoUrl);
    return asset;
  }

  /**
   * Poll GET /assets/{id} until the video recipe reports AVAILABLE. Bounded —
   * a stuck or failed transcode fails the post loudly with LinkedIn's own
   * status rather than publishing an unplayable share.
   */
  private async waitForVideoAssetAvailable(
    assetUrn: string,
    videoUrl: string
  ): Promise<void> {
    const assetId = assetUrn.split(':').pop() ?? '';
    let lastStatus = 'UNKNOWN';

    for (let attempt = 0; attempt < this.videoPollAttempts; attempt++) {
      const asset = await this.makeRequest<AssetStatusResponse>(
        `/assets/${encodeURIComponent(assetId)}`
      );
      lastStatus = asset.recipes?.[0]?.status ?? asset.status ?? 'UNKNOWN';

      if (lastStatus === 'AVAILABLE') {
        return;
      }
      if (lastStatus !== 'PROCESSING' && lastStatus !== 'WAITING_UPLOAD') {
        throw new PlatformError(
          'linkedin',
          `Video asset processing failed (${lastStatus}) for ${videoUrl}`
        );
      }

      await new Promise(resolve =>
        setTimeout(resolve, this.videoPollIntervalMs)
      );
    }

    throw new PlatformError(
      'linkedin',
      `Video asset did not become AVAILABLE within ${this.videoPollAttempts} polls (last status: ${lastStatus}) for ${videoUrl}`
    );
  }

  async deletePost(postId: string): Promise<boolean> {
    try {
      if (!this.isConfigured()) {
        return false;
      }

      await this.makeRequest(`/ugcPosts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
      });

      return true;
    } catch (error: unknown) {
      logger.error('LinkedIn post deletion failed', { error, postId });
      return false;
    }
  }

  async getPostMetrics(postId: string): Promise<LinkedInPostMetrics | null> {
    try {
      if (!this.isConfigured()) {
        return null;
      }

      const stats = await this.makeRequest<SocialActionsStatsResponse>(
        `/socialActions/${encodeURIComponent(postId)}/statistics`
      );

      return {
        likes: stats.likeCount || 0,
        comments: stats.commentCount || 0,
        shares: stats.shareCount || 0,
        impressions: stats.impressionCount || 0,
        clicks: stats.clickCount || 0,
      };
    } catch (error: unknown) {
      logger.error('LinkedIn post metrics fetch failed', { error, postId });
      return null;
    }
  }
}

// Export singleton instance
export const linkedInService = new LinkedInService();
