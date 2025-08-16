/**
 * Unified Social Media Posting API
 * Handles posting to multiple social media platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

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

// Mock function to simulate posting to social media
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

  // In production, this would make actual API calls to each platform
  // For now, we'll simulate success
  console.log(`[SOCIAL] Posting to ${platform}:`, { 
    content: content.substring(0, 100) + '...', 
    mediaCount: mediaUrls?.length || 0 
  });

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Return mock response
  return {
    platform,
    postId: `${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    url: `https://${platform}.com/posts/mock-${Date.now()}`,
    publishedAt: new Date().toISOString(),
    status: 'published'
  };
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
    const results = [];
    const errors = [];

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