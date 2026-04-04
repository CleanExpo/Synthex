import { Router, Request, Response } from 'express';
import { mcpIntegration } from '../services/mcp-integration';
import { ttdRd } from '../services/ttd-rd-framework';

const router = Router();

router.post('/mcp/sequential-think', async (req: Request, res: Response) => {
  try {
    const { problem, steps } = req.body;
    
    if (!problem || !steps || !Array.isArray(steps)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Problem and steps array are required'
      });
    }
    
    const results = await mcpIntegration.sequentialThink(problem, steps);
    
    res.json({
      success: true,
      problem,
      steps,
      results
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Sequential thinking failed',
      message: error.message
    });
  }
});

router.post('/ttd/create-tests', async (req: Request, res: Response) => {
  try {
    const { featureName, testCases } = req.body;
    
    if (!featureName || !testCases || !Array.isArray(testCases)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Feature name and test cases array are required'
      });
    }
    
    const testFile = await ttdRd.createTestFirst(featureName, testCases);
    
    res.json({
      success: true,
      featureName,
      testFile,
      message: 'Test file created successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Test creation failed',
      message: error.message
    });
  }
});

router.post('/ttd/implement-feature', async (req: Request, res: Response) => {
  try {
    const { featureName, implementation } = req.body;
    
    if (!featureName || !implementation) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Feature name and implementation are required'
      });
    }
    
    const success = await ttdRd.implementFeature(featureName, implementation);
    
    res.json({
      success,
      featureName,
      message: success ? 'Feature implemented and tests passed' : 'Implementation failed tests'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Feature implementation failed',
      message: error.message
    });
  }
});

router.post('/ttd/rapid-deploy', async (req: Request, res: Response) => {
  try {
    const { environment, autoRollback, healthCheckUrl, maxDeployTime } = req.body;
    
    if (!environment) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Environment is required'
      });
    }
    
    const config = {
      environment: environment as 'development' | 'staging' | 'production',
      autoRollback: autoRollback ?? true,
      healthCheckUrl,
      maxDeployTime: maxDeployTime || 300000
    };
    
    const success = await ttdRd.rapidDeploy(config);
    
    res.json({
      success,
      config,
      message: success ? 'Deployment successful' : 'Deployment failed'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Deployment failed',
      message: error.message
    });
  }
});

router.post('/ttd/integrate-mcp', async (req: Request, res: Response) => {
  try {
    const { featureName } = req.body;
    
    if (!featureName) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Feature name is required'
      });
    }
    
    const results = await ttdRd.integrateWithMCP(featureName);
    
    res.json({
      success: true,
      featureName,
      results,
      message: 'MCP integration completed'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'MCP integration failed',
      message: error.message
    });
  }
});

router.get('/mcp/status', async (req: Request, res: Response) => {
  try {
    res.json({
      status: 'active',
      providers: ['sequential-thinking'],
      message: 'MCP integration is operational'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Status check failed',
      message: error.message
    });
  }
});

export default router;