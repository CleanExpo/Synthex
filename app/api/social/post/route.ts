/**
 * Unified Social Media Posting API
 * Handles posting to multiple social media platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { TwitterApi } from 'twitter-api-v2';

const prisma = new PrismaClient();

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
      throw new Error(`Failed to post to Twitter: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error(`Failed to post to LinkedIn: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // For other platforms, return a clear message that they need configuration
  throw new Error(`${platform} API integration not configured. Please add API credentials for ${platform}.`);
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: PostRequest = await request.json();
    const { 
      content, 
      platforms, 
      mediaUrls, 
      scheduledAt, 
      hashtags = [], 
      mentions = [],
      campaignId 
    } = body;

    // Validate required fields
    if (!content || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: 'Content and at least one platform are required' },
        { status: 400 }
      );
    }

    // Get user ID from session (mock for now)
    const userId = 'demo-user-001'; // In production, get from JWT token

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

    // Create campaign if not provided
    let finalCampaignId = campaignId;
    if (!campaignId) {
      const campaign = await prisma.campaign.create({
        data: {
          name: `Social Post - ${new Date().toLocaleDateString()}`,
          description: 'Auto-generated campaign for social media post',
          platform: platforms.join(','),
          status: 'active',
          userId
        }
      });
      finalCampaignId = campaign.id;
    }

    // Post to each platform
    const results: { platform: string; success: boolean; postId: string; platformPostId: string; url: string; message: string }[] = [];
    const errors: { platform: string; success: boolean; error: string }[] = [];

    for (const platform of platforms) {
      try {
        // Get platform connection (mock for now)
        const connection = await prisma.platformConnection.findFirst({
          where: {
            userId,
            platform,
            isActive: true
          }
        });

        // Post to platform
        const result = await postToSocialPlatform(
          platform,
          finalContent,
          mediaUrls,
          connection?.accessToken
        );

        // Save post to database
        const post = await prisma.post.create({
          data: {
            content: finalContent,
            platform,
            status: scheduledAt ? 'scheduled' : 'published',
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            publishedAt: scheduledAt ? null : new Date(),
            campaignId: finalCampaignId!,
            metadata: {
              platformPostId: result.postId,
              url: result.url,
              hashtags: processedHashtags,
              mentions,
              mediaUrls
            }
          }
        });

        results.push({
          platform,
          success: true,
          postId: post.id,
          platformPostId: result.postId,
          url: result.url,
          message: `Successfully posted to ${platform}`
        });

      } catch (error: any) {
        console.error(`Error posting to ${platform}:`, error);
        errors.push({
          platform,
          success: false,
          error: error.message || `Failed to post to ${platform}`
        });
      }
    }

    // Update campaign analytics
    if (finalCampaignId) {
      await prisma.campaign.update({
        where: { id: finalCampaignId },
        data: {
          analytics: {
            postsCreated: results.length,
            platformsUsed: platforms,
            lastPostedAt: new Date()
          }
        }
      });
    }

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

  } catch (error: any) {
    console.error('Social posting error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to post to social media',
        message: error.message 
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Get posting history
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build query
    const where: any = {};
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

  } catch (error: any) {
    console.error('Get posts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
