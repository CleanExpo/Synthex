/**
 * Buffer Integration Service
 *
 * @description Manages Buffer API interactions for scheduling and analytics.
 * Uses fetch() directly - no SDKs.
 *
 * API Reference: https://api.bufferapp.com/1/
 */

import type {
  IntegrationCredentials,
  BufferProfile,
  BufferPost,
  BufferAnalytics,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const BUFFER_API_BASE = 'https://api.bufferapp.com/1';

// ============================================================================
// SERVICE
// ============================================================================

export class BufferService {
  private credentials: IntegrationCredentials;

  constructor(credentials: IntegrationCredentials) {
    this.credentials = credentials;
  }

  /**
   * Validate the current credentials by making a test API call
   */
  async validateCredentials(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${BUFFER_API_BASE}/user.json?access_token=${this.credentials.accessToken}`
      );

      if (response.ok) {
        return { valid: true };
      }

      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: 'Invalid or expired access token' };
      }

      return { valid: false, error: `Buffer API returned status ${response.status}` };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Buffer',
      };
    }
  }

  /**
   * Get all social media profiles connected to the Buffer account
   */
  async getProfiles(): Promise<BufferProfile[]> {
    const response = await fetch(
      `${BUFFER_API_BASE}/profiles.json?access_token=${this.credentials.accessToken}`
    );

    if (!response.ok) {
      await this.handleApiError(response, 'Failed to get profiles');
    }

    const data = await response.json();
    const profiles = Array.isArray(data) ? data : [];

    return profiles.map((profile: Record<string, unknown>) => ({
      id: profile.id as string,
      service: (profile.service as string) || '',
      serviceUsername: (profile.service_username as string) || '',
      avatar: (profile.avatar_https as string) || (profile.avatar as string) || '',
      isDisabled: (profile.disabled as boolean) || false,
      counts: {
        sent: ((profile.counts as Record<string, number>)?.sent as number) || 0,
        pending: ((profile.counts as Record<string, number>)?.pending as number) || 0,
        draft: ((profile.counts as Record<string, number>)?.draft as number) || 0,
      },
    }));
  }

  /**
   * Get the pending post queue for a specific profile
   */
  async getQueue(profileId: string): Promise<BufferPost[]> {
    const response = await fetch(
      `${BUFFER_API_BASE}/profiles/${profileId}/updates/pending.json?access_token=${this.credentials.accessToken}`
    );

    if (!response.ok) {
      await this.handleApiError(response, 'Failed to get queue');
    }

    const data = await response.json();
    const updates = (data.updates as Record<string, unknown>[]) || [];

    return updates.map((update: Record<string, unknown>) => ({
      id: update.id as string,
      profileId: (update.profile_id as string) || profileId,
      text: (update.text as string) || '',
      status: (update.status as BufferPost['status']) || 'buffer',
      scheduledAt: (update.scheduled_at as string) || undefined,
      sentAt: (update.sent_at as string) || undefined,
      media: (update.media as BufferPost['media']) || undefined,
    }));
  }

  /**
   * Add a post to the Buffer queue for a specific profile
   */
  async addToQueue(
    profileId: string,
    post: { text: string; media?: { link: string }[]; scheduledAt?: string }
  ): Promise<BufferPost> {
    const body: Record<string, unknown> = {
      text: post.text,
      profile_ids: [profileId],
      access_token: this.credentials.accessToken,
    };

    if (post.media && post.media.length > 0) {
      body.media = { link: post.media[0].link };
    }

    if (post.scheduledAt) {
      body.scheduled_at = post.scheduledAt;
    }

    const response = await fetch(`${BUFFER_API_BASE}/updates/create.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(
        Object.entries(body).reduce(
          (acc, [key, value]) => {
            if (typeof value === 'string') {
              acc[key] = value;
            } else {
              acc[key] = JSON.stringify(value);
            }
            return acc;
          },
          {} as Record<string, string>
        )
      ).toString(),
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Failed to add to queue');
    }

    const data = await response.json();
    const update = (data.update as Record<string, unknown>) || data;

    return {
      id: (update.id as string) || '',
      profileId,
      text: (update.text as string) || post.text,
      status: (update.status as BufferPost['status']) || 'buffer',
      scheduledAt: (update.scheduled_at as string) || post.scheduledAt,
      sentAt: undefined,
      media: (update.media as BufferPost['media']) || undefined,
    };
  }

  /**
   * Get analytics for a specific profile over a time period
   */
  async getAnalytics(profileId: string, days: number = 30): Promise<BufferAnalytics> {
    const response = await fetch(
      `${BUFFER_API_BASE}/profiles/${profileId}/updates/sent.json?access_token=${this.credentials.accessToken}&count=100`
    );

    if (!response.ok) {
      await this.handleApiError(response, 'Failed to get analytics');
    }

    const data = await response.json();
    const updates = (data.updates as Record<string, unknown>[]) || [];

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentUpdates = updates.filter((u: Record<string, unknown>) => {
      const sentAt = u.sent_at as string;
      return sentAt && new Date(sentAt) >= cutoffDate;
    });

    const totalEngagement = recentUpdates.reduce(
      (sum: number, u: Record<string, unknown>) => {
        const stats = u.statistics as Record<string, number> | undefined;
        return (
          sum +
          (stats?.clicks || 0) +
          (stats?.favorites || 0) +
          (stats?.retweets || 0) +
          (stats?.mentions || 0)
        );
      },
      0
    );

    return {
      profileId,
      period: `${days} days`,
      totalPosts: recentUpdates.length,
      totalEngagement,
      averageEngagement:
        recentUpdates.length > 0 ? totalEngagement / recentUpdates.length : 0,
      topPost: recentUpdates.length > 0
        ? {
            id: (recentUpdates[0].id as string) || '',
            profileId,
            text: (recentUpdates[0].text as string) || '',
            status: 'sent',
            sentAt: (recentUpdates[0].sent_at as string) || undefined,
          }
        : undefined,
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async handleApiError(response: Response, context: string): Promise<never> {
    let message = context;
    try {
      const errorData = await response.json();
      message = `${context}: ${errorData.message || errorData.error || response.statusText}`;
    } catch {
      message = `${context}: ${response.statusText}`;
    }
    throw new Error(message);
  }
}
