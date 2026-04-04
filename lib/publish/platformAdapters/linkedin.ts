/**
 * LinkedIn platform adapter — lib/publish/platformAdapters/linkedin.ts
 *
 * Publishes a text share via the LinkedIn UGC Posts API v2.
 * Requires a User/Organisation access token with w_member_social scope.
 *
 * Endpoint: POST /ugcPosts
 * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
 *
 * @task SYN-523
 */

import { logger } from '@/lib/logger';
import type { PublishResult } from './instagram';

const LINKEDIN_API = 'https://api.linkedin.com/v2';

export interface LinkedInPublishInput {
  accessToken: string;
  /** URN of the author — either a person or organisation URN
   *  Person:       'urn:li:person:{id}'
   *  Organisation: 'urn:li:organization:{id}'
   *  Derived from PlatformConnection.profileId
   */
  authorUrn: string;
  text: string;
  /** Optional article link to attach */
  articleUrl?: string;
  articleTitle?: string;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function publishToLinkedIn(
  input: LinkedInPublishInput
): Promise<PublishResult> {
  const { accessToken, authorUrn, text, articleUrl, articleTitle } = input;

  try {
    // Build share content
    const shareContent: Record<string, unknown> = {
      shareCommentary: {
        text,
      },
      shareMediaCategory: articleUrl ? 'ARTICLE' : 'NONE',
    };

    if (articleUrl) {
      shareContent.media = [
        {
          status: 'READY',
          originalUrl: articleUrl,
          title: articleTitle ? { text: articleTitle } : undefined,
        },
      ];
    }

    const body = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': shareContent,
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const res = await fetch(`${LINKEDIN_API}/ugcPosts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      logger.warn('linkedin: ugcPosts failed', {
        status: res.status,
        body: err.slice(0, 300),
      });
      return {
        success: false,
        error: `LinkedIn post failed (${res.status}): ${err.slice(0, 200)}`,
      };
    }

    // LinkedIn returns the post ID in the X-RestLi-Id header
    const platformPostId =
      res.headers.get('x-restli-id') ??
      res.headers.get('X-RestLi-Id') ??
      undefined;

    logger.info('linkedin: post published', { authorUrn, platformPostId });

    return { success: true, platformPostId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('linkedin: unexpected error', { error: err });
    return { success: false, error: message };
  }
}
