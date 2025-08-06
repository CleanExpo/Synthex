import { type Campaign } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// Validation schemas
export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  platform: z.enum(['instagram', 'twitter', 'linkedin', 'facebook', 'tiktok', 'youtube', 'general']),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional().default('draft'),
  content: z.any().optional(),
  settings: z.any().optional()
});

export const UpdateCampaignSchema = CreateCampaignSchema.partial();

export interface CampaignWithStats extends Campaign {
  postCount?: number;
  scheduledCount?: number;
  publishedCount?: number;
}

export class CampaignService {
  /**
   * Create a new campaign
   */
  static async create(userId: string, data: z.infer<typeof CreateCampaignSchema>): Promise<Campaign> {
    const validated = CreateCampaignSchema.parse(data);
    
    return await (prisma as any).campaign.create({
      data: {
        ...validated,
        userId,
        analytics: {
          impressions: 0,
          engagement: 0,
          clicks: 0,
          conversions: 0
        }
      }
    });
  }

  /**
   * Get all campaigns for a user
   */
  static async getUserCampaigns(userId: string, options?: {
    status?: string;
    platform?: string;
    page?: number;
    limit?: number;
  }): Promise<{ campaigns: CampaignWithStats[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;
    
    const where: any = { userId };
    if (options?.status) where.status = options.status;
    if (options?.platform) where.platform = options.platform;
    
    const [campaigns, total] = await (prisma as any).$transaction([
      (prisma as any).campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { posts: true }
          }
        }
      }),
      (prisma as any).campaign.count({ where })
    ]);
    
    // Add post statistics
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign: Campaign & { _count: { posts: number } }) => {
        const [scheduledCount, publishedCount] = await (prisma as any).$transaction([
          (prisma as any).post.count({
            where: { campaignId: campaign.id, status: 'scheduled' }
          }),
          (prisma as any).post.count({
            where: { campaignId: campaign.id, status: 'published' }
          })
        ]);
        
        return {
          ...campaign,
          postCount: campaign._count.posts,
          scheduledCount,
          publishedCount
        };
      })
    );
    
    return { campaigns: campaignsWithStats, total };
  }

  /**
   * Get a single campaign by ID
   */
  static async getById(id: string, userId: string): Promise<CampaignWithStats | null> {
    const campaign = await (prisma as any).campaign.findFirst({
      where: { id, userId },
      include: {
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
    
    if (!campaign) return null;
    
    const [postCount, scheduledCount, publishedCount] = await (prisma as any).$transaction([
      (prisma as any).post.count({ where: { campaignId: id } }),
      (prisma as any).post.count({ where: { campaignId: id, status: 'scheduled' } }),
      (prisma as any).post.count({ where: { campaignId: id, status: 'published' } })
    ]);
    
    return {
      ...campaign,
      postCount,
      scheduledCount,
      publishedCount
    };
  }

  /**
   * Update a campaign
   */
  static async update(
    id: string, 
    userId: string, 
    data: z.infer<typeof UpdateCampaignSchema>
  ): Promise<Campaign> {
    const validated = UpdateCampaignSchema.parse(data);
    
    // Verify ownership
    const existing = await (prisma as any).campaign.findFirst({
      where: { id, userId }
    });
    
    if (!existing) {
      throw new Error('Campaign not found');
    }
    
    return await (prisma as any).campaign.update({
      where: { id },
      data: {
        ...validated,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Delete a campaign
   */
  static async delete(id: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await (prisma as any).campaign.findFirst({
      where: { id, userId }
    });
    
    if (!existing) {
      throw new Error('Campaign not found');
    }
    
    // Delete campaign (posts will cascade)
    await (prisma as any).campaign.delete({
      where: { id }
    });
  }

  /**
   * Update campaign analytics
   */
  static async updateAnalytics(
    id: string, 
    analytics: {
      impressions?: number;
      engagement?: number;
      clicks?: number;
      conversions?: number;
    }
  ): Promise<Campaign> {
    const campaign = await (prisma as any).campaign.findUnique({
      where: { id }
    });
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    const currentAnalytics = (campaign.analytics as any) || {};
    
    return await (prisma as any).campaign.update({
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
   * Get campaign statistics
   */
  static async getStatistics(userId: string): Promise<{
    total: number;
    active: number;
    draft: number;
    completed: number;
    totalPosts: number;
    scheduledPosts: number;
    publishedPosts: number;
  }> {
    const [total, active, draft, completed, totalPosts, scheduledPosts, publishedPosts] = await (prisma as any).$transaction([
      (prisma as any).campaign.count({ where: { userId } }),
      (prisma as any).campaign.count({ where: { userId, status: 'active' } }),
      (prisma as any).campaign.count({ where: { userId, status: 'draft' } }),
      (prisma as any).campaign.count({ where: { userId, status: 'completed' } }),
      (prisma as any).post.count({ 
        where: { campaign: { userId } } 
      }),
      (prisma as any).post.count({ 
        where: { campaign: { userId }, status: 'scheduled' } 
      }),
      (prisma as any).post.count({ 
        where: { campaign: { userId }, status: 'published' } 
      })
    ]);
    
    return {
      total,
      active,
      draft,
      completed,
      totalPosts,
      scheduledPosts,
      publishedPosts
    };
  }

  /**
   * Clone a campaign
   */
  static async clone(id: string, userId: string): Promise<Campaign> {
    const original = await (prisma as any).campaign.findFirst({
      where: { id, userId }
    });
    
    if (!original) {
      throw new Error('Campaign not found');
    }
    
    return await (prisma as any).campaign.create({
      data: {
        name: `${original.name} (Copy)`,
        description: original.description,
        platform: original.platform,
        status: 'draft',
        content: original.content as any,
        settings: original.settings as any,
        userId,
        analytics: {
          impressions: 0,
          engagement: 0,
          clicks: 0,
          conversions: 0
        }
      }
    });
  }
}

export default CampaignService;