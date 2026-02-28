/**
 * Unified Social Media Posting API
 * Handles posting to multiple social media platforms
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - FIELD_ENCRYPTION_KEY: 32-byte hex key for token encryption (CRITICAL)
 *
 * NOTE: OAuth tokens are encrypted at rest using AES-256-GCM
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { TwitterApi } from 'twitter-api-v2';
import { getUserIdFromCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { decryptField } from '@/lib/security/field-encryption';
import { getEffectiveOrganizationId } from '@/lib/multi-business';

const socialPostSchema = z.object({
  content: z.string().min(1),
  platforms: z.array(z.string()).min(1),
  mediaUrls: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
  hashtags: z.array(z.string()).optional().default([]),
  mentions: z.array(z.string()).optional().default([]),
  campaignId: z.string().optional(),
});

// Platform posting configurations
const PLATFORM_CONFIGS = {
  twitter: {
    maxLength: 280,
    supportsImages: true,
    supportsVideos: true,
    hashtagLimit: 30,
    apiEndpoint: 'https://api.twitter.com/2/tweets'
  },
  linkedin: {
    maxLength: 3000,
    supportsImages: true,
    supportsVideos: true,
    hashtagLimit: 30,
    apiEndpoint: 'https://api.linkedin.com/v2/shares'
  },
  instagram: {
    maxLength: 2200,
    supportsImages: true,
    supportsVideos: true,
    hashtagLimit: 30,
    requiresImage: true,
    apiEndpoint: 'https://graph.instagram.com/v12.0'
  },
  facebook: {
    maxLength: 63206,
    supportsImages: true,
    supportsVideos: true,
    hashtagLimit: 100,
    apiEndpoint: 'https://graph.facebook.com/v12.0'
  },
  tiktok: {
    maxLength: 2200,
    supportsImages: false,
    supportsVideos: true,
    hashtagLimit: 100,
    requiresVideo: true,
    apiEndpoint: 'https://open-api.tiktok.com'
  }
};

interface PostRequest {
  content: string;
  platforms: string[];
  mediaUrls?: string[];
  scheduledAt?: string;
  hashtags?: string[];
  mentions?: string[];
  campaignId?: string;
}

// Real function to post to social media platforms
async function postToSocialPlatform(
  platform: string, 
  content: string, 
  mediaUrls?: string[],
  accessToken?: string
) {
  const config = PLATFORM_CONFIGS[platform as keyof typeof PLATFORM_CONFIGS];
  
  if (!config) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  // Validate content length
  if (content.length > config.maxLength) {
    throw new Error(`Content exceeds ${platform} character limit of ${config.maxLength}`);
  }

  // Handle Twitter/X posting
  if (platform === 'twitter') {
    try {
      const twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
      });

      // Post tweet
      const tweet = await twitterClient.v2.tweet(content);
      
      return {
        platform,
        postId: tweet.data.id,
        url: `https://twitter.com/i/web/status/${tweet.data.id}`,
        publishedAt: new Date().toISOString(),
        status: 'published'
      };
    } catch (error) {
      console.error('Twitter API error:', error);
      throw new Error(`Failed to post to Twitter: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error'}`);
    }
  }
  
  // Handle LinkedIn posting
  if (platform === 'linkedin' && process.env.LINKEDIN_ACCESS_TOKEN) {
    try {
      const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          author: `urn:li:person:${process.env.LINKEDIN_PERSON_ID}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: content
              },
              shareMediaCategory: 'NONE'
            }
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        platform,
        postId: data.id,
        url: data.id,
        publishedAt: new Date().toISOString(),
        status: 'published'
      };
    } catch (error) {
      console.error('LinkedIn API error:', error);
      throw new Error(`Failed to post to LinkedIn: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error'}`);
    }
  }

  // For other platforms, return a clear message that they need configuration
  throw new Error(`${platform} API integration not configured. Please add API credentials for ${platform}.`);
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and get user ID
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return unauthorizedResponse();
    }

    // Get org scope for multi-business support
    const organizationId = await getEffectiveOrganizationId(userId);

    // Parse and validate request body
    const rawBody = await request.json();
    const validation = socialPostSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const {
      content,
      platforms,
      mediaUrls,
      scheduledAt,
      hashtags,
      mentions,
      campaignId
    } = validation.data;

    // Process hashtags
    const processedHashtags = hashtags.map(tag => 
      tag.startsWith('#') ? tag : `#${tag}`
    );

    // Add hashtags to content if not already included
    let finalContent = content;
    const hashtagString = processedHashtags.join(' ');
    if (hashtagString && !content.includes(hashtagString)) {
      finalContent = `${content}\n\n${hashtagString}`;
    }

    // Post to each platform (external API calls — must happen outside transaction)
    const platformResults: { platform: string; postId: string; url: string }[] = [];
    const errors: { platform: string; success: boolean; error: string }[] = [];

    for (const platform of platforms) {
      try {
        // Get platform connection (scoped by organization)
        const connection = await prisma.platformConnection.findFirst({
          where: {
            userId,
            platform,
            organizationId: organizationId ?? null,
            isActive: true
          }
        });

        // Decrypt access token if connection exists
        const decryptedAccessToken = connection?.accessToken
          ? decryptField(connection.accessToken)
          : undefined;

        // Post to platform (external API call)
        const result = await postToSocialPlatform(
          platform,
          finalContent,
          mediaUrls,
          decryptedAccessToken || undefined
        );

        platformResults.push({
          platform,
          postId: result.postId,
          url: result.url,
        });

      } catch (error: unknown) {
        console.error(`Error posting to ${platform}:`, error);
        errors.push({
          platform,
          success: false,
          error: error instanceof Error ? error.message : String(error) || `Failed to post to ${platform}`
        });
      }
    }

    // Persist all DB writes atomically: campaign creation + post records + analytics
    const { finalCampaignId, results } = await prisma.$transaction(async (tx) => {
      // Create campaign if not provided
      let txCampaignId = campaignId;
      if (!campaignId) {
        const campaign = await tx.campaign.create({
          data: {
            name: `Social Post - ${new Date().toLocaleDateString()}`,
            description: 'Auto-generated campaign for social media post',
            platform: platforms.join(','),
            status: 'active',
            userId
          }
        });
        txCampaignId = campaign.id;
      }

      // Save all successful platform posts to database
      const postResults: { platform: string; success: boolean; postId: string; platformPostId: string; url: string; message: string }[] = [];

      for (const result of platformResults) {
        const post = await tx.post.create({
          data: {
            content: finalContent,
            platform: result.platform,
            status: scheduledAt ? 'scheduled' : 'published',
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            publishedAt: scheduledAt ? null : new Date(),
            campaignId: txCampaignId!,
            metadata: {
              platformPostId: result.postId,
              url: result.url,
              hashtags: processedHashtags,
              mentions,
              mediaUrls
            }
          }
        });

        postResults.push({
          platform: result.platform,
          success: true,
          postId: post.id,
          platformPostId: result.postId,
          url: result.url,
          message: `Successfully posted to ${result.platform}`
        });
      }

      // Update campaign analytics
      if (txCampaignId) {
        await tx.campaign.update({
          where: { id: txCampaignId },
          data: {
            analytics: {
              postsCreated: postResults.length,
              platformsUsed: platforms,
              lastPostedAt: new Date()
            }
          }
        });
      }

      return { finalCampaignId: txCampaignId, results: postResults };
    });

    // Return response
    return NextResponse.json({
      success: errors.length === 0,
      message: `Posted to ${results.length} of ${platforms.length} platforms`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      campaign: {
        id: finalCampaignId,
        postsCreated: results.length
      }
    });

  } catch (error: unknown) {
    console.error('Social posting error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to post to social media',
        message: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

// Get posting history
export async function GET(request: NextRequest) {
  try {
    // Check authentication and get user ID
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return unauthorizedResponse();
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build query
    const where: Record<string, unknown> = {};
    if (platform) where.platform = platform;
    if (status) where.status = status;

    // Get posts from database
    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        campaign: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Get platform statistics
    const stats = await prisma.post.groupBy({
      by: ['platform', 'status'],
      _count: {
        id: true
      }
    });

    return NextResponse.json({
      posts,
      stats: stats.map(s => ({
        platform: s.platform,
        status: s.status,
        count: s._count.id
      })),
      total: posts.length
    });

  } catch (error: unknown) {
    console.error('Get posts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
