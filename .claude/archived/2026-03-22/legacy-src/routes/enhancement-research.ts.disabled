import { Router, Request, Response } from 'express';
import { enhancementResearch } from '../services/product-enhancement-research';
import { analyticsDashboard } from '../services/analytics-dashboard';

const router = Router();

router.get('/research/capabilities', async (req: Request, res: Response) => {
  try {
    const capabilities = await enhancementResearch.analyzeCurrentCapabilities();
    res.json({
      success: true,
      capabilities
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to analyze capabilities',
      message: error.message
    });
  }
});

router.get('/research/trends', async (req: Request, res: Response) => {
  try {
    const trends = await enhancementResearch.researchMarketTrends();
    res.json({
      success: true,
      trends
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to research trends',
      message: error.message
    });
  }
});

router.post('/research/define-tests', async (req: Request, res: Response) => {
  try {
    const tests = await enhancementResearch.defineEnhancementTests();
    res.json({
      success: true,
      tests,
      count: tests.length
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to define tests',
      message: error.message
    });
  }
});

router.get('/research/priorities', async (req: Request, res: Response) => {
  try {
    const priorities = await enhancementResearch.prioritizeEnhancements();
    res.json({
      success: true,
      priorities
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to prioritize enhancements',
      message: error.message
    });
  }
});

router.get('/research/implementation-plan', async (req: Request, res: Response) => {
  try {
    const plan = await enhancementResearch.createImplementationPlan();
    res.json({
      success: true,
      plan
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to create implementation plan',
      message: error.message
    });
  }
});

router.get('/research/insights', async (req: Request, res: Response) => {
  try {
    const insights = await enhancementResearch.generateInsights();
    res.json({
      success: true,
      insights
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to generate insights',
      message: error.message
    });
  }
});

router.get('/research/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await enhancementResearch.generateMetrics();
    res.json({
      success: true,
      metrics
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to generate metrics',
      message: error.message
    });
  }
});

router.get('/research/roadmap', async (req: Request, res: Response) => {
  try {
    const roadmap = await enhancementResearch.createRoadmap();
    res.json({
      success: true,
      roadmap
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to create roadmap',
      message: error.message
    });
  }
});

router.post('/research/implement/:enhancementId', async (req: Request, res: Response) => {
  try {
    const { enhancementId } = req.params;
    const result = await enhancementResearch.implementPriorityEnhancement(enhancementId);
    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to implement enhancement',
      message: error.message
    });
  }
});

router.post('/analytics/aggregate', async (req: Request, res: Response) => {
  try {
    const { platforms, timeRange } = req.body;
    const metrics = await analyticsDashboard.aggregateMetrics(platforms, timeRange);
    res.json({
      success: true,
      metrics
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to aggregate metrics',
      message: error.message
    });
  }
});

router.post('/analytics/predict', async (req: Request, res: Response) => {
  try {
    const { historicalData, model } = req.body;
    const prediction = await analyticsDashboard.predictPerformance(historicalData, model);
    res.json({
      success: true,
      prediction
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to predict performance',
      message: error.message
    });
  }
});

router.post('/analytics/trending', async (req: Request, res: Response) => {
  try {
    const { posts, threshold } = req.body;
    const trending = await analyticsDashboard.identifyTrendingContent(posts || [], threshold);
    res.json({
      success: true,
      trending
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to identify trending content',
      message: error.message
    });
  }
});

router.get('/analytics/insights', async (req: Request, res: Response) => {
  try {
    const insights = await analyticsDashboard.generateRealTimeInsights();
    res.json({
      success: true,
      insights
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to generate insights',
      message: error.message
    });
  }
});

router.post('/analytics/visualize', async (req: Request, res: Response) => {
  try {
    const { data, type } = req.body;
    const visualization = await analyticsDashboard.createVisualization(data, type || 'chart');
    res.json({
      success: true,
      visualization
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to create visualization',
      message: error.message
    });
  }
});

export default router;