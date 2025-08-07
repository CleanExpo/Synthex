import express, { Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { DashboardService } from '../services/dashboard-service';

const router = express.Router();

/**
 * GET /api/v1/dashboard/stats
 * Get comprehensive dashboard statistics
 */
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const stats = await DashboardService.getDashboardStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
});

/**
 * GET /api/v1/dashboard/activity
 * Get recent activity feed
 */
router.get('/activity', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const activity = await DashboardService.getRecentActivity(userId, limit);
    
    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Activity feed error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity feed'
    });
  }
});

/**
 * GET /api/v1/dashboard/performance
 * Get performance metrics
 */
router.get('/performance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const timeRange = (req.query.range as string) || '30d';
    
    const metrics = await DashboardService.getPerformanceMetrics(userId, timeRange);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics'
    });
  }
});

/**
 * GET /api/v1/dashboard/usage
 * Get usage vs tier limits
 */
router.get('/usage', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const tier = user.preferences?.tier || 'starter';
    
    const usage = await DashboardService.getUsageVsTierLimits(user.id, tier);
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Usage tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage data'
    });
  }
});

/**
 * GET /api/v1/dashboard/insights
 * Get AI-powered insights
 */
router.get('/insights', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const insights = await DashboardService.getQuickInsights(userId);
    
    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate insights'
    });
  }
});

/**
 * GET /api/v1/dashboard/summary
 * Get complete dashboard summary (all data in one call)
 */
router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const userId = user.id;
    const tier = user.preferences?.tier || 'starter';
    
    // Fetch all dashboard data in parallel
    const [stats, activity, performance, usage, insights] = await Promise.all([
      DashboardService.getDashboardStats(userId),
      DashboardService.getRecentActivity(userId, 5),
      DashboardService.getPerformanceMetrics(userId, '7d'),
      DashboardService.getUsageVsTierLimits(userId, tier),
      DashboardService.getQuickInsights(userId)
    ]);
    
    res.json({
      success: true,
      data: {
        stats,
        activity,
        performance,
        usage,
        insights,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tier,
          preferences: user.preferences
        }
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard summary'
    });
  }
});

export default router;