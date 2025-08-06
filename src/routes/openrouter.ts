import express, { Request, Response } from 'express';
import { openRouterService, OPENROUTER_MODELS } from '../services/openrouter';
import { contentLogger } from '../services/contentLogger';
import { authenticateToken, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { authService } from '../services/auth';

const router = express.Router();

// Type definitions for request bodies
interface ChatRequest {
  message: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

interface MarketingContentRequest {
  prompt: string;
  contentType?: 'social_post' | 'email' | 'blog' | 'ad_copy' | 'general';
  model?: string;
  temperature?: number;
}

interface OptimizeContentRequest {
  content: string;
  platform?: string;
  goals?: string[];
}

interface VariationsRequest {
  prompt: string;
  count?: number;
  contentType?: 'social_post' | 'email' | 'blog' | 'ad_copy';
}

/**
 * GET /api/openrouter/status
 * Check OpenRouter configuration status
 */
router.get('/status', optionalAuth, async (req: Request, res: Response) => {
  try {
    const isSystemConfigured = openRouterService.isConfigured();
    const modelInfo = openRouterService.getModelInfo();
    
    let userApiKey: string | undefined;
    let hasUserApiKey = false;
    
    if ((req as AuthenticatedRequest).user) {
      const apiKeys = await authService.getUserApiKeys((req as AuthenticatedRequest).user!.id);
      userApiKey = apiKeys.openrouterApiKey;
      hasUserApiKey = !!userApiKey;
    }
    
    res.json({
      systemConfigured: isSystemConfigured,
      userConfigured: hasUserApiKey,
      configured: isSystemConfigured || hasUserApiKey,
      defaultModel: OPENROUTER_MODELS.HORIZON_BETA,
      modelInfo,
      message: (isSystemConfigured || hasUserApiKey)
        ? 'OpenRouter is properly configured and ready to use'
        : req.user 
          ? 'Please add your OpenRouter API key in your account settings'
          : 'OpenRouter API key not configured. Please login and add your API key.'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check OpenRouter status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/openrouter/models
 * Get available OpenRouter models
 */
router.get('/models', (req: Request, res: Response) => {
  try {
    const models = Object.entries(OPENROUTER_MODELS).map(([key, value]) => ({
      id: value,
      name: key.toLowerCase().replace(/_/g, ' '),
      info: openRouterService.getModelInfo(value)
    }));

    res.json({
      models,
      recommended: OPENROUTER_MODELS.HORIZON_BETA,
      total: models.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/openrouter/chat
 * Send a chat message to OpenRouter
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, model, temperature, max_tokens }: ChatRequest = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required',
        message: 'Please provide a message in the request body'
      });
    }

    const response = await openRouterService.chat([
      { role: 'user', content: message }
    ], {
      model: model || OPENROUTER_MODELS.HORIZON_BETA,
      temperature,
      max_tokens
    });

    res.json({
      response: response.choices[0]?.message?.content || 'No response',
      model: response.model,
      usage: response.usage,
      id: response.id
    });
  } catch (error) {
    res.status(500).json({
      error: 'Chat request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/openrouter/marketing/generate
 * Generate marketing content
 */
router.post('/marketing/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, contentType, model, temperature }: MarketingContentRequest = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: 'Prompt is required',
        message: 'Please provide a prompt for content generation'
      });
    }

    const startTime = Date.now();
    const content = await openRouterService.generateMarketingContent(
      prompt,
      contentType || 'general',
      { model, temperature }
    );
    const processingTime = Date.now() - startTime;

    // Log the generation
    const logId = await contentLogger.logGeneration(
      prompt,
      contentType || 'general',
      content,
      {
        model: model || OPENROUTER_MODELS.HORIZON_BETA,
        processingTime,
        ipAddress: req.ip
      }
    );

    res.json({
      content,
      prompt,
      contentType: contentType || 'general',
      model: model || OPENROUTER_MODELS.HORIZON_BETA,
      timestamp: new Date().toISOString(),
      logId
    });
  } catch (error) {
    res.status(500).json({
      error: 'Content generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/openrouter/marketing/optimize
 * Optimize existing marketing content
 */
router.post('/marketing/optimize', async (req: Request, res: Response) => {
  try {
    const { content, platform, goals }: OptimizeContentRequest = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Content is required',
        message: 'Please provide content to optimize'
      });
    }

    const startTime = Date.now();
    const optimization = await openRouterService.optimizeContent(
      content,
      platform || 'general',
      goals || ['engagement', 'conversions']
    );
    const processingTime = Date.now() - startTime;

    // Log the optimization
    const logId = await contentLogger.logOptimization(
      content,
      platform || 'general',
      goals || ['engagement', 'conversions'],
      optimization,
      {
        processingTime,
        ipAddress: req.ip
      }
    );

    res.json({
      original: content,
      optimization,
      platform: platform || 'general',
      goals: goals || ['engagement', 'conversions'],
      timestamp: new Date().toISOString(),
      logId
    });
  } catch (error) {
    res.status(500).json({
      error: 'Content optimization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/openrouter/marketing/variations
 * Generate multiple content variations
 */
router.post('/marketing/variations', async (req: Request, res: Response) => {
  try {
    const { prompt, count, contentType }: VariationsRequest = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: 'Prompt is required',
        message: 'Please provide a prompt for variation generation'
      });
    }

    const startTime = Date.now();
    const variations = await openRouterService.generateVariations(
      prompt,
      count || 3,
      contentType || 'social_post'
    );
    const processingTime = Date.now() - startTime;

    // Log the variations
    const logId = await contentLogger.logVariations(
      prompt,
      count || 3,
      contentType || 'social_post',
      variations,
      {
        processingTime,
        ipAddress: req.ip
      }
    );

    res.json({
      prompt,
      variations,
      count: variations.length,
      contentType: contentType || 'social_post',
      timestamp: new Date().toISOString(),
      logId
    });
  } catch (error) {
    res.status(500).json({
      error: 'Variation generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/openrouter/test
 * Test OpenRouter connectivity with a simple request
 */
router.get('/test', async (req: Request, res: Response) => {
  try {
    if (!openRouterService.isConfigured()) {
      return res.status(400).json({
        error: 'OpenRouter not configured',
        message: 'Please set OPENROUTER_API_KEY in your .env file'
      });
    }

    const testResponse = await openRouterService.chat([
      { role: 'user', content: 'Hello! Please respond with a brief greeting.' }
    ], {
      model: OPENROUTER_MODELS.HORIZON_BETA,
      max_tokens: 50
    });

    res.json({
      success: true,
      message: 'OpenRouter connection test successful',
      response: testResponse.choices[0]?.message?.content,
      model: testResponse.model,
      usage: testResponse.usage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'OpenRouter connection test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/openrouter/logs/recent
 * Get recent content generation logs
 */
router.get('/logs/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const logs = contentLogger.getRecentLogs(limit);
    
    res.json({
      logs,
      count: logs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/openrouter/logs/stats
 * Get content generation statistics
 */
router.get('/logs/stats', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const stats = await contentLogger.getStatistics(days);
    
    res.json({
      stats,
      period: `Last ${days} days`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/openrouter/logs/:id
 * Get specific log entry by ID
 */
router.get('/logs/:id', async (req: Request, res: Response) => {
  try {
    const log = await contentLogger.getLogById(req.params.id);
    
    if (!log) {
      return res.status(404).json({
        error: 'Log not found',
        message: `No log entry found with ID: ${req.params.id}`
      });
    }
    
    res.json(log);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve log',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
