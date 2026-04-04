import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { apiResponse } from '../utils/apiResponse';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * @route   POST /api/v1/mcp/sequential-thinking
 * @desc    Use sequential thinking for complex problem solving
 * @access  Private
 */
router.post('/sequential-thinking', async (req: Request, res: Response) => {
  try {
    const { thought, nextThoughtNeeded, thoughtNumber, totalThoughts, isRevision, revisesThought } = req.body;

    if (!thought || typeof nextThoughtNeeded !== 'boolean' || !thoughtNumber || !totalThoughts) {
      return apiResponse.error(res, 'Missing required parameters: thought, nextThoughtNeeded, thoughtNumber, totalThoughts', 400);
    }

    // Call the MCP sequential thinking tool
    const mcpResponse = await fetch('http://localhost:3001/mcp/sequential-thinking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'sequentialthinking',
        arguments: {
          thought,
          nextThoughtNeeded,
          thoughtNumber,
          totalThoughts,
          isRevision: isRevision || false,
          revisesThought,
          branchFromThought: req.body.branchFromThought,
          branchId: req.body.branchId,
          needsMoreThoughts: req.body.needsMoreThoughts || false
        }
      })
    });

    if (!mcpResponse.ok) {
      throw new Error(`MCP Server error: ${mcpResponse.statusText}`);
    }

    const result = await mcpResponse.json();
    
    return apiResponse.success(res, {
      reasoning: result,
      thoughtNumber,
      totalThoughts,
      isComplete: !nextThoughtNeeded,
      metadata: {
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
        processingTime: result.processingTime || null
      }
    }, 'Sequential thinking processed successfully');

  } catch (error) {
    console.error('Sequential thinking error:', error);
    return apiResponse.error(res, 'Failed to process sequential thinking');
  }
});

/**
 * @route   POST /api/v1/mcp/analyze-content
 * @desc    Analyze content using sequential thinking
 * @access  Private
 */
router.post('/analyze-content', async (req: Request, res: Response) => {
  try {
    const { content, analysisType, depth } = req.body;

    if (!content || !analysisType) {
      return apiResponse.error(res, 'Missing required parameters: content, analysisType', 400);
    }

    // Start sequential thinking analysis
    const initialThought = `I need to analyze this ${analysisType} content: "${content.substring(0, 200)}${content.length > 200 ? '...' : ''}". Let me break this down systematically.`;

    const mcpResponse = await fetch('http://localhost:3001/mcp/sequential-thinking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'sequentialthinking',
        arguments: {
          thought: initialThought,
          nextThoughtNeeded: true,
          thoughtNumber: 1,
          totalThoughts: depth || 5,
          isRevision: false
        }
      })
    });

    if (!mcpResponse.ok) {
      throw new Error(`MCP Server error: ${mcpResponse.statusText}`);
    }

    const result = await mcpResponse.json();
    
    return apiResponse.success(res, {
      analysis: result,
      contentPreview: content.substring(0, 100),
      analysisType,
      recommendations: [
        'Continue with sequential analysis',
        'Review insights for optimization opportunities',
        'Apply findings to content strategy'
      ]
    }, 'Content analysis initiated successfully');

  } catch (error) {
    console.error('Content analysis error:', error);
    return apiResponse.error(res, 'Failed to analyze content');
  }
});

/**
 * @route   GET /api/v1/mcp/status
 * @desc    Get MCP integration status
 * @access  Private
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Check if MCP servers are available
    const servers = [
      {
        name: 'Sequential Thinking',
        endpoint: 'http://localhost:3001/mcp/sequential-thinking',
        status: 'unknown',
        features: ['Complex problem solving', 'Multi-step reasoning', 'Dynamic analysis']
      },
      {
        name: 'Memory',
        endpoint: 'http://localhost:3001/mcp/memory',
        status: 'unknown',
        features: ['Knowledge graph', 'Entity relationships', 'Persistent context']
      }
    ];

    // Test server connectivity (simplified)
    for (const server of servers) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const healthCheck = await fetch(server.endpoint.replace('/sequential-thinking', '/health'), {
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        server.status = healthCheck.ok ? 'available' : 'unavailable';
      } catch {
        server.status = 'unavailable';
      }
    }

    return apiResponse.success(res, {
      servers,
      integrationStatus: servers.some(s => s.status === 'available') ? 'operational' : 'limited',
      availableFeatures: [
        'Sequential thinking and reasoning',
        'Complex problem analysis',
        'Memory-based context retention',
        'Dynamic thought processes'
      ]
    }, 'MCP integration status retrieved successfully');

  } catch (error) {
    console.error('MCP status check error:', error);
    return apiResponse.error(res, 'Failed to check MCP status');
  }
});

/**
 * @route   POST /api/v1/mcp/memory/store
 * @desc    Store information in MCP memory
 * @access  Private
 */
router.post('/memory/store', async (req: Request, res: Response) => {
  try {
    const { entities, relations, observations } = req.body;

    if (!entities && !relations && !observations) {
      return apiResponse.error(res, 'At least one of entities, relations, or observations is required', 400);
    }

    const mcpResponse = await fetch('http://localhost:3001/mcp/memory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'create_entities',
        arguments: {
          entities: entities || [],
          relations: relations || [],
          observations: observations || []
        }
      })
    });

    if (!mcpResponse.ok) {
      throw new Error(`MCP Server error: ${mcpResponse.statusText}`);
    }

    const result = await mcpResponse.json();
    
    return apiResponse.success(res, {
      stored: result,
      entityCount: entities?.length || 0,
      relationCount: relations?.length || 0,
      observationCount: observations?.length || 0
    }, 'Information stored in memory successfully');

  } catch (error) {
    console.error('Memory storage error:', error);
    return apiResponse.error(res, 'Failed to store information in memory');
  }
});

/**
 * @route   GET /api/v1/mcp/memory/search
 * @desc    Search MCP memory
 * @access  Private
 */
router.get('/memory/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;

    if (!query) {
      return apiResponse.error(res, 'Search query is required', 400);
    }

    const mcpResponse = await fetch('http://localhost:3001/mcp/memory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'search_nodes',
        arguments: {
          query: query as string
        }
      })
    });

    if (!mcpResponse.ok) {
      throw new Error(`MCP Server error: ${mcpResponse.statusText}`);
    }

    const result = await mcpResponse.json();
    
    return apiResponse.success(res, {
      results: result,
      query: query as string,
      resultCount: result?.length || 0
    }, 'Memory search completed successfully');

  } catch (error) {
    console.error('Memory search error:', error);
    return apiResponse.error(res, 'Failed to search memory');
  }
});

export default router;
