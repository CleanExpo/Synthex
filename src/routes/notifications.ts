import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get notifications
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { since, limit = 50, unreadOnly } = req.query;

    // For now, return sample notifications
    const notifications = [
      {
        id: '1',
        type: 'success',
        title: 'Campaign Published Successfully!',
        message: 'Your "Summer Sale 2024" campaign is now live across all platforms.',
        read: false,
        createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
        data: { campaignId: '1' }
      },
      {
        id: '2',
        type: 'analytics',
        title: 'Weekly Performance Report Ready',
        message: 'Your weekly analytics report is ready. Total reach increased by 23%!',
        read: false,
        createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
      },
      {
        id: '3',
        type: 'warning',
        title: 'Content Scheduling Reminder',
        message: 'You have 3 posts scheduled for tomorrow. Review them before they go live.',
        read: true,
        createdAt: new Date(Date.now() - 24 * 3600000).toISOString()
      },
      {
        id: '4',
        type: 'success',
        title: 'Milestone Reached! 🎉',
        message: 'Your Instagram account just hit 10K followers!',
        read: true,
        createdAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString()
      },
      {
        id: '5',
        type: 'content',
        title: 'AI Content Generated',
        message: '5 new content variations are ready for your review.',
        read: true,
        createdAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString()
      }
    ];

    let filteredNotifications = notifications;

    // Filter by unread only
    if (unreadOnly === 'true') {
      filteredNotifications = filteredNotifications.filter(n => !n.read);
    }

    // Filter by since timestamp
    if (since) {
      const sinceDate = new Date(since as string);
      filteredNotifications = filteredNotifications.filter(n => 
        new Date(n.createdAt) > sinceDate
      );
    }

    // Limit results
    filteredNotifications = filteredNotifications.slice(0, parseInt(limit as string));

    res.json({
      data: filteredNotifications,
      unreadCount: notifications.filter(n => !n.read).length
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // TODO: Update in database
    res.json({
      message: 'Notification marked as read',
      data: { id, read: true }
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Update all notifications in database
    res.json({
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Create notification (internal use)
export async function createNotification(params: {
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'campaign' | 'content' | 'analytics';
  title: string;
  message: string;
  data?: any;
}) {
  // TODO: Implement actual notification creation in database
  console.log('Creating notification:', params);
  
  // In a real implementation, this would:
  // 1. Create notification in database
  // 2. Send real-time update via WebSocket/SSE
  // 3. Send push notification if enabled
  // 4. Send email notification if enabled
}

// Performance monitoring functions
export async function checkCampaignPerformance() {
  try {
    // Get all active campaigns
    const campaigns = await prisma.campaign.findMany({
      where: { status: 'active' },
      include: { user: true }
    });

    for (const campaign of campaigns) {
      if (campaign.analytics) {
        const analytics = campaign.analytics as any;
        
        // Check for high engagement
        if (analytics.engagement > 10) {
          await createNotification({
            userId: campaign.userId,
            type: 'success',
            title: 'High Engagement Alert! 🎉',
            message: `Your campaign "${campaign.name}" is performing exceptionally well with ${analytics.engagement}% engagement rate!`,
            data: { campaignId: campaign.id }
          });
        }
        
        // Check for milestones
        if (analytics.totalReach >= 10000 && analytics.totalReach < 10100) {
          await createNotification({
            userId: campaign.userId,
            type: 'success',
            title: 'Milestone Reached!',
            message: `"${campaign.name}" just reached 10K people!`,
            data: { campaignId: campaign.id }
          });
        }
        
        // Check for low performance
        if (analytics.engagement < 2 && analytics.totalReach > 1000) {
          await createNotification({
            userId: campaign.userId,
            type: 'warning',
            title: 'Low Engagement Warning',
            message: `Campaign "${campaign.name}" has low engagement (${analytics.engagement}%). Consider optimizing your content.`,
            data: { campaignId: campaign.id }
          });
        }
      }
    }
  } catch (error) {
    console.error('Campaign performance check error:', error);
  }
}

// Schedule reminder notifications
export async function checkScheduledPosts() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    
    // Get posts scheduled for tomorrow
    const posts = await prisma.post.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: {
          gte: tomorrow,
          lt: dayAfter
        }
      },
      include: {
        campaign: {
          include: { user: true }
        }
      }
    });
    
    // Group by user
    const postsByUser = posts.reduce((acc, post) => {
      const userId = post.campaign.userId;
      if (!acc[userId]) acc[userId] = [];
      acc[userId].push(post);
      return acc;
    }, {} as Record<string, typeof posts>);
    
    // Send notifications
    for (const [userId, userPosts] of Object.entries(postsByUser)) {
      await createNotification({
        userId,
        type: 'info',
        title: 'Content Scheduling Reminder',
        message: `You have ${userPosts.length} posts scheduled for tomorrow. Review them before they go live.`,
        data: { posts: userPosts.map(p => p.id) }
      });
    }
  } catch (error) {
    console.error('Scheduled posts check error:', error);
  }
}

export default router;