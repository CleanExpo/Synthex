import express, { Request, Response } from 'express';
import { ApiRes } from '../utils/apiResponse';

const router = express.Router();

// Dashboard statistics endpoint
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    // Mock data for now - replace with real data from your database
    const stats = {
      totalCampaigns: 12,
      activeCampaigns: 8,
      totalPosts: 245,
      scheduledPosts: 18,
      totalProjects: 5,
      activeProjects: 3,
      totalUsers: 1,
      apiCalls: 1247,
      successRate: 96.8,
      growthRate: 15.2
    };

    ApiRes.success(res, stats, 'Dashboard statistics retrieved successfully');
  } catch (error) {
    console.error('Dashboard statistics error:', error);
    ApiRes.error(res, 'Failed to retrieve dashboard statistics', 500);
  }
});

// Dashboard metrics endpoint
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as string) || '7d';
    
    // Mock metrics data based on timeframe
    const metrics = {
      timeframe,
      conversions: generateMetrics(30, 100, 150),
      impressions: generateMetrics(100, 1000, 1500),
      clicks: generateMetrics(20, 200, 300),
      engagement: generateMetrics(5, 50, 80),
      revenue: generateMetrics(100, 1000, 2000),
      labels: generateLabels(timeframe)
    };

    ApiRes.success(res, metrics, 'Dashboard metrics retrieved successfully');
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    ApiRes.error(res, 'Failed to retrieve dashboard metrics', 500);
  }
});

// Dashboard activity endpoint
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const recentActivity = [
      {
        id: 1,
        type: 'campaign_created',
        title: 'New Campaign Created',
        description: 'Created "Summer Product Launch" campaign',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        status: 'success'
      },
      {
        id: 2,
        type: 'post_scheduled',
        title: 'Post Scheduled',
        description: 'Scheduled 3 posts for Instagram',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        status: 'success'
      },
      {
        id: 3,
        type: 'api_integration',
        title: 'API Connected',
        description: 'OpenRouter API successfully configured',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
        status: 'success'
      },
      {
        id: 4,
        type: 'content_generated',
        title: 'Content Generated',
        description: 'Generated 5 marketing variations using AI',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
        status: 'success'
      },
      {
        id: 5,
        type: 'project_updated',
        title: 'Project Updated',
        description: 'Updated "Brand Awareness" project settings',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        status: 'info'
      }
    ];

    ApiRes.success(res, recentActivity, 'Dashboard activity retrieved successfully');
  } catch (error) {
    console.error('Dashboard activity error:', error);
    ApiRes.error(res, 'Failed to retrieve dashboard activity', 500);
  }
});

// Quick actions endpoint
router.get('/quick-actions', async (req: Request, res: Response) => {
  try {
    const quickActions = [
      {
        id: 'create_campaign',
        title: 'Create Campaign',
        description: 'Start a new marketing campaign',
        icon: '🚀',
        action: '/campaigns/create',
        enabled: true
      },
      {
        id: 'generate_content',
        title: 'Generate Content',
        description: 'Create AI-powered marketing content',
        icon: '✨',
        action: '/api/openrouter/marketing/generate',
        enabled: true
      },
      {
        id: 'schedule_posts',
        title: 'Schedule Posts',
        description: 'Schedule content across platforms',
        icon: '📅',
        action: '/posts/schedule',
        enabled: true
      },
      {
        id: 'analyze_performance',
        title: 'View Analytics',
        description: 'Check campaign performance',
        icon: '📊',
        action: '/analytics',
        enabled: true
      }
    ];

    ApiRes.success(res, quickActions, 'Quick actions retrieved successfully');
  } catch (error) {
    console.error('Dashboard quick actions error:', error);
    ApiRes.error(res, 'Failed to retrieve quick actions', 500);
  }
});

// Helper functions
function generateMetrics(min: number, max: number, peak: number): number[] {
  const points = 30;
  const data = [];
  for (let i = 0; i < points; i++) {
    const trend = Math.sin((i / points) * Math.PI) * (peak - min) + min;
    const noise = (Math.random() - 0.5) * (max - min) * 0.1;
    data.push(Math.round(Math.max(min, trend + noise)));
  }
  return data;
}

function generateLabels(timeframe: string): string[] {
  const now = new Date();
  const labels = [];
  let days = 7;
  
  if (timeframe === '30d') days = 30;
  else if (timeframe === '90d') days = 90;
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  
  // For longer timeframes, show fewer labels
  if (days > 30) {
    return labels.filter((_, index) => index % 3 === 0);
  }
  
  return labels;
}

export default router;