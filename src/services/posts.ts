import { PrismaClient, type Post } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
export const CreatePostSchema = z.object({
  content: z.string().min(1).max(10000),
  platform: z.enum(['instagram', 'twitter', 'linkedin', 'facebook', 'tiktok', 'youtube', 'general']),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional().default('draft'),
  scheduledAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  campaignId: z.string().optional(),
  metadata: z.any().optional()
});

export const UpdatePostSchema = CreatePostSchema.partial();

export const BatchCreatePostSchema = z.object({
  posts: z.array(CreatePostSchema).min(1).max(50)
});

export const PublishPostSchema = z.object({
  platform: z.enum(['instagram', 'twitter', 'linkedin', 'facebook', 'tiktok', 'youtube', 'general']).optional(),
  scheduledAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  publishNow: z.boolean().optional().default(false)
});

export interface PostWithCampaign extends Post {
  campaign?: {
    id: string;
    name: string;
    platform: string;
  };
}

export interface PostAnalytics {
  impressions: number;
  engagement: number;
  clicks: number;
  likes: number;
  shares: number;
  comments: number;
  reach: number;
  lastUpdated: Date;
}

export class PostService {
  /**
   * Create a new post
   */
  static async create(userId: string, data: z.infer<typeof CreatePostSchema>): Promise<Post> {
    const validated = CreatePostSchema.parse(data);
    
    // If campaignId is provided, verify ownership
    if (validated.campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: { id: validated.campaignId, userId }
      });
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }
    }
    
    return await prisma.post.create({
      data: {
        content: validated.content,
        platform: validated.platform,
        status: validated.status || 'draft',
        campaignId: validated.campaignId!,
        scheduledAt: validated.scheduledAt,
        metadata: validated.metadata || null,
        analytics: {
          impressions: 0,
          engagement: 0,
          clicks: 0,
          likes: 0,
          shares: 0,
          comments: 0,
          reach: 0,
          lastUpdated: new Date()
        }
      }
    });
  }

  /**
   * Get all posts for a user with filtering
   */
  static async getUserPosts(userId: string, options?: {
    platform?: string;
    status?: string;
    campaignId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'scheduledAt' | 'publishedAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ posts: PostWithCampaign[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = options?.sortBy || 'createdAt';
    const sortOrder = options?.sortOrder || 'desc';
    
    const where: any = {
      campaign: { userId }
    };
    
    if (options?.platform) where.platform = options.platform;
    if (options?.status) where.status = options.status;
    if (options?.campaignId) where.campaignId = options.campaignId;
    
    // Date range filtering
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }
    
    const [posts, total] = await prisma.$transaction([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              platform: true
            }
          }
        }
      }),
      prisma.post.count({ where })
    ]);
    
    return { posts, total };
  }

  /**
   * Get a single post by ID
   */
  static async getById(id: string, userId: string): Promise<PostWithCampaign | null> {
    return await prisma.post.findFirst({
      where: { 
        id,
        campaign: { userId }
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            platform: true
          }
        }
      }
    });
  }

  /**
   * Update a post
   */
  static async update(
    id: string, 
    userId: string, 
    data: z.infer<typeof UpdatePostSchema>
  ): Promise<Post> {
    const validated = UpdatePostSchema.parse(data);
    
    // Verify ownership
    const existing = await prisma.post.findFirst({
      where: { 
        id,
        campaign: { userId }
      }
    });
    
    if (!existing) {
      throw new Error('Post not found');
    }
    
    // If campaignId is being updated, verify ownership
    if (validated.campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: { id: validated.campaignId, userId }
      });
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }
    }
    
    return await prisma.post.update({
      where: { id },
      data: {
        ...validated,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Delete a post
   */
  static async delete(id: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await prisma.post.findFirst({
      where: { 
        id,
        campaign: { userId }
      }
    });
    
    if (!existing) {
      throw new Error('Post not found');
    }
    
    await prisma.post.delete({
      where: { id }
    });
  }

  /**
   * Publish a post to platform
   */
  static async publish(
    id: string, 
    userId: string, 
    publishData?: z.infer<typeof PublishPostSchema>
  ): Promise<Post> {
    const validated = publishData ? PublishPostSchema.parse(publishData) : {
      publishNow: false,
      scheduledAt: undefined,
      platform: undefined
    };
    
    // Verify ownership
    const existing = await prisma.post.findFirst({
      where: { 
        id,
        campaign: { userId }
      }
    });
    
    if (!existing) {
      throw new Error('Post not found');
    }
    
    // Determine publish time
    let publishedAt: Date | undefined;
    let status: string;
    
    if (validated.publishNow) {
      publishedAt = new Date();
      status = 'published';
    } else if (validated.scheduledAt) {
      status = 'scheduled';
    } else {
      // Default to current time if no schedule specified
      publishedAt = new Date();
      status = 'published';
    }
    
    const updateData: any = {
      status,
      updatedAt: new Date()
    };
    
    if (publishedAt) updateData.publishedAt = publishedAt;
    if (validated.scheduledAt) updateData.scheduledAt = validated.scheduledAt;
    if (validated.platform) updateData.platform = validated.platform;
    
    return await prisma.post.update({
      where: { id },
      data: updateData
    });
  }

  /**
   * Batch create posts
   */
  static async batchCreate(
    userId: string, 
    data: z.infer<typeof BatchCreatePostSchema>
  ): Promise<Post[]> {
    const validated = BatchCreatePostSchema.parse(data);
    
    // Validate all campaign IDs if provided
    const campaignIds = validated.posts
      .map(post => post.campaignId)
      .filter((id): id is string => !!id);
    
    if (campaignIds.length > 0) {
      const campaigns = await prisma.campaign.findMany({
        where: { 
          id: { in: campaignIds },
          userId 
        }
      });
      
      if (campaigns.length !== new Set(campaignIds).size) {
        throw new Error('One or more campaigns not found');
      }
    }
    
    // Create posts in transaction
    return await prisma.$transaction(
      validated.posts.map(postData => 
        prisma.post.create({
          data: {
            content: postData.content,
            platform: postData.platform,
            status: postData.status || 'draft',
            campaignId: postData.campaignId!,
            scheduledAt: postData.scheduledAt,
            metadata: postData.metadata || null,
            analytics: {
              impressions: 0,
              engagement: 0,
              clicks: 0,
              likes: 0,
              shares: 0,
              comments: 0,
              reach: 0,
              lastUpdated: new Date()
            }
          }
        })
      )
    );
  }

  /**
   * Get posts for calendar view
   */
  static async getCalendarPosts(
    userId: string,
    startDate: Date,
    endDate: Date,
    platform?: string
  ): Promise<PostWithCampaign[]> {
    const where: any = {
      campaign: { userId },
      OR: [
        {
          scheduledAt: {
            gte: startDate,
            lte: endDate
          }
        },
        {
          publishedAt: {
            gte: startDate,
            lte: endDate
          }
        }
      ]
    };
    
    if (platform) where.platform = platform;
    
    return await prisma.post.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            platform: true
          }
        }
      },
      orderBy: [
        { scheduledAt: 'asc' },
        { publishedAt: 'asc' },
        { createdAt: 'asc' }
      ]
    });
  }

  /**
   * Update post analytics
   */
  static async updateAnalytics(
    id: string, 
    analytics: Partial<PostAnalytics>
  ): Promise<Post> {
    const post = await prisma.post.findUnique({
      where: { id }
    });
    
    if (!post) {
      throw new Error('Post not found');
    }
    
    const currentAnalytics = (post.analytics as any) || {};
    
    return await prisma.post.update({
      where: { id },
      data: {
        analytics: {
          ...currentAnalytics,
          ...analytics,
          lastUpdated: new Date()
        }
      }
    });
  }

  /**
   * Get post statistics for a user
   */
  static async getStatistics(userId: string): Promise<{
    total: number;
    draft: number;
    scheduled: number;
    published: number;
    failed: number;
    totalEngagement: number;
    totalImpressions: number;
    byPlatform: Record<string, number>;
    recentActivity: Array<{
      date: string;
      count: number;
    }>;
  }> {
    const [total, draft, scheduled, published, failed, posts] = await prisma.$transaction([
      prisma.post.count({ 
        where: { campaign: { userId } } 
      }),
      prisma.post.count({ 
        where: { campaign: { userId }, status: 'draft' } 
      }),
      prisma.post.count({ 
        where: { campaign: { userId }, status: 'scheduled' } 
      }),
      prisma.post.count({ 
        where: { campaign: { userId }, status: 'published' } 
      }),
      prisma.post.count({ 
        where: { campaign: { userId }, status: 'failed' } 
      }),
      prisma.post.findMany({
        where: { campaign: { userId } },
        select: {
          platform: true,
          analytics: true,
          createdAt: true
        }
      })
    ]);
    
    // Calculate platform distribution
    const byPlatform: Record<string, number> = {};
    let totalEngagement = 0;
    let totalImpressions = 0;
    
    posts.forEach((post: { platform: string; analytics: any; createdAt: Date }) => {
      byPlatform[post.platform] = (byPlatform[post.platform] || 0) + 1;
      
      const analytics = post.analytics as any || {};
      totalEngagement += analytics.engagement || 0;
      totalImpressions += analytics.impressions || 0;
    });
    
    // Calculate recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentPosts = posts.filter((post: { platform: string; analytics: any; createdAt: Date }) => post.createdAt > sevenDaysAgo);
    const recentActivity: Array<{ date: string; count: number }> = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = recentPosts.filter((post: { platform: string; analytics: any; createdAt: Date }) => 
        post.createdAt.toISOString().split('T')[0] === dateStr
      ).length;
      
      recentActivity.push({ date: dateStr, count });
    }
    
    return {
      total,
      draft,
      scheduled,
      published,
      failed,
      totalEngagement,
      totalImpressions,
      byPlatform,
      recentActivity
    };
  }

  /**
   * Get scheduled posts that need to be published
   */
  static async getScheduledPosts(userId?: string): Promise<Post[]> {
    const now = new Date();
    
    const where: any = {
      status: 'scheduled',
      scheduledAt: {
        lte: now
      }
    };
    
    if (userId) {
      where.campaign = { userId };
    }
    
    return await prisma.post.findMany({
      where,
      include: {
        campaign: true
      }
    });
  }

  /**
   * Mark scheduled post as published
   */
  static async markAsPublished(id: string): Promise<Post> {
    return await prisma.post.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  /**
   * Mark post as failed
   */
  static async markAsFailed(id: string, errorMessage?: string): Promise<Post> {
    const updateData: any = {
      status: 'failed',
      updatedAt: new Date()
    };
    
    if (errorMessage) {
      const currentMetadata = await prisma.post.findUnique({
        where: { id },
        select: { metadata: true }
      });
      
      updateData.metadata = {
        ...(currentMetadata?.metadata as any || {}),
        error: errorMessage,
        failedAt: new Date()
      };
    }
    
    return await prisma.post.update({
      where: { id },
      data: updateData
    });
  }

  /**
   * Duplicate a post
   */
  static async duplicate(id: string, userId: string): Promise<Post> {
    const original = await prisma.post.findFirst({
      where: { 
        id,
        campaign: { userId }
      }
    });
    
    if (!original) {
      throw new Error('Post not found');
    }
    
    return await prisma.post.create({
      data: {
        content: `${original.content} (Copy)`,
        platform: original.platform,
        status: 'draft',
        campaignId: original.campaignId,
        metadata: original.metadata as any,
        analytics: {
          impressions: 0,
          engagement: 0,
          clicks: 0,
          likes: 0,
          shares: 0,
          comments: 0,
          reach: 0,
          lastUpdated: new Date()
        }
      }
    });
  }
}

export default PostService;