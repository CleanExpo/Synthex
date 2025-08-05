import { Router } from 'express';
import authRouter from '../auth';
import openrouterRouter from '../openrouter';
import mcpTtdRouter from '../mcp-ttd';
import mleStarRouter from '../mle-star';
import enhancementRouter from '../enhancement-research';
import campaignsRouter from '../campaigns';
import projectsRouter from '../projects';
import postsRouter from '../posts';

const router = Router();

// API v1 routes
router.use('/auth', authRouter);
router.use('/openrouter', openrouterRouter);
router.use('/mcp-ttd', mcpTtdRouter);
router.use('/mle-star', mleStarRouter);
router.use('/enhancement', enhancementRouter);
router.use('/campaigns', campaignsRouter);
router.use('/projects', projectsRouter);
router.use('/posts', postsRouter);

// API v1 info endpoint
router.get('/', (req, res) => {
  res.json({
    version: 'v1',
    status: 'active',
    endpoints: {
      auth: '/api/v1/auth',
      openrouter: '/api/v1/openrouter',
      'mcp-ttd': '/api/v1/mcp-ttd',
      'mle-star': '/api/v1/mle-star',
      enhancement: '/api/v1/enhancement',
      campaigns: '/api/v1/campaigns',
      projects: '/api/v1/projects',
      posts: '/api/v1/posts'
    },
    documentation: '/api-docs'
  });
});

export default router;