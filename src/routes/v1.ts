import { Router } from 'express';
import authRoutes from './auth';
import campaignRoutes from './campaigns';
import contentRoutes from './content';
import analyticsRoutes from './analytics';
import notificationRoutes from './notifications';
import teamRoutes from './team';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/content', contentRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/team', teamRoutes);

// API v1 info
router.get('/', (req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      campaigns: '/api/v1/campaigns',
      content: '/api/v1/content',
      analytics: '/api/v1/analytics',
      notifications: '/api/v1/notifications',
      team: '/api/v1/team'
    }
  });
});

export default router;