import { Router, Request, Response } from 'express';
import { mleStarFramework } from '../services/mle-star-framework';
import { mcpContext7 } from '../services/mcp-context7-integration';

const router = Router();

// MLE Star Evaluation Endpoints
router.post('/evaluate/scoping', async (req: Request, res: Response) => {
  try {
    const { projectDetails } = req.body;
    const result = await mleStarFramework.evaluateScoping(projectDetails);
    
    res.json({
      success: true,
      dimension: 'Scoping',
      result
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Scoping evaluation failed',
      message: error.message
    });
  }
});

router.post('/evaluate/training', async (req: Request, res: Response) => {
  try {
    const { modelConfig } = req.body;
    const result = await mleStarFramework.evaluateTraining(modelConfig);
    
    res.json({
      success: true,
      dimension: 'Training',
      result
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Training evaluation failed',
      message: error.message
    });
  }
});

router.post('/evaluate/analysis', async (req: Request, res: Response) => {
  try {
    const { modelMetrics } = req.body;
    const result = await mleStarFramework.evaluateAnalysis(modelMetrics);
    
    res.json({
      success: true,
      dimension: 'Analysis',
      result
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Analysis evaluation failed',
      message: error.message
    });
  }
});

router.post('/evaluate/reliability', async (req: Request, res: Response) => {
  try {
    const { deploymentConfig } = req.body;
    const result = await mleStarFramework.evaluateReliability(deploymentConfig);
    
    res.json({
      success: true,
      dimension: 'Reliability',
      result
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Reliability evaluation failed',
      message: error.message
    });
  }
});

router.post('/evaluate/excellence', async (req: Request, res: Response) => {
  try {
    const { projectArtifacts } = req.body;
    const result = await mleStarFramework.evaluateExcellence(projectArtifacts);
    
    res.json({
      success: true,
      dimension: 'Excellence',
      result
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Excellence evaluation failed',
      message: error.message
    });
  }
});

router.get('/score', async (req: Request, res: Response) => {
  try {
    const score = await mleStarFramework.calculateOverallScore();
    
    res.json({
      success: true,
      score,
      interpretation: {
        overall: score.overall >= 80 ? 'Excellent' : 
                score.overall >= 60 ? 'Good' : 
                score.overall >= 40 ? 'Needs Improvement' : 'Poor',
        productionReady: score.overall >= 70
      }
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Score calculation failed',
      message: error.message
    });
  }
});

// ML Pipeline Endpoints
router.post('/pipeline/create', async (req: Request, res: Response) => {
  try {
    const { name, config } = req.body;
    
    if (!name) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Pipeline name is required'
      });
    }
    
    const pipeline = await mleStarFramework.createMLPipeline(name, config || {});
    
    res.json({
      success: true,
      pipeline
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Pipeline creation failed',
      message: error.message
    });
  }
});

router.post('/pipeline/execute/:pipelineId', async (req: Request, res: Response) => {
  try {
    const { pipelineId } = req.params;
    const results = await mleStarFramework.executePipeline(pipelineId);
    
    res.json({
      success: true,
      pipelineId,
      results
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Pipeline execution failed',
      message: error.message
    });
  }
});

// Model Training Endpoints
router.post('/model/train', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    const model = await mleStarFramework.trainMarketingModel(config);
    
    res.json({
      success: true,
      model
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Model training failed',
      message: error.message
    });
  }
});

router.get('/report', async (req: Request, res: Response) => {
  try {
    const report = await mleStarFramework.generateMLEReport();
    
    res.json({
      success: true,
      report
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Report generation failed',
      message: error.message
    });
  }
});

// Context7 Integration Endpoints
router.post('/context7/update', async (req: Request, res: Response) => {
  try {
    const { windowId, content, priority } = req.body;
    
    if (!windowId || windowId < 1 || windowId > 7) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Window ID must be between 1 and 7'
      });
    }
    
    await mcpContext7.updateContext(windowId, content, priority || 0);
    
    res.json({
      success: true,
      windowId,
      message: 'Context updated successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Context update failed',
      message: error.message
    });
  }
});

router.post('/context7/sequential-think', async (req: Request, res: Response) => {
  try {
    const { problem, steps } = req.body;
    
    if (!problem || !steps || !Array.isArray(steps)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Problem and steps array are required'
      });
    }
    
    const result = await mcpContext7.sequentialThinkWithContext(problem, steps);
    
    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Sequential thinking failed',
      message: error.message
    });
  }
});

router.post('/context7/integrate-mle', async (req: Request, res: Response) => {
  try {
    const { modelConfig } = req.body;
    
    if (!modelConfig) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Model configuration is required'
      });
    }
    
    const result = await mcpContext7.integrateWithMLEStar(modelConfig);
    
    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'MLE integration failed',
      message: error.message
    });
  }
});

router.get('/context7/report', async (req: Request, res: Response) => {
  try {
    const report = await mcpContext7.generateContextReport();
    
    res.json({
      success: true,
      report
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Report generation failed',
      message: error.message
    });
  }
});

// Initialize Context7 providers
router.post('/context7/initialize', async (req: Request, res: Response) => {
  try {
    await mcpContext7.initializeProviders();
    
    res.json({
      success: true,
      message: 'Context7 providers initialized'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Initialization failed',
      message: error.message
    });
  }
});

export default router;