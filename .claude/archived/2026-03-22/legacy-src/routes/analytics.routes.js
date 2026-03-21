/**
 * Analytics Routes
 * Endpoints for analytics dashboard and metrics
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const analyticsController = require('../controllers/analytics.controller');
const { authenticate, authorize } = require('../middleware/auth');
const rateLimiter = require('../middleware/rate-limiter');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get real-time metrics
router.get('/metrics/realtime',
  authenticate,
  rateLimiter.standard,
  analyticsController.getRealTimeMetrics
);

// Get historical analytics
router.get('/metrics/historical',
  authenticate,
  rateLimiter.standard,
  [
    query('startDate').isISO8601().toDate(),
    query('endDate').isISO8601().toDate(),
    query('metrics').optional().isArray(),
    query('interval').optional().isIn(['hour', 'day', 'week', 'month'])
  ],
  validate,
  analyticsController.getHistoricalMetrics
);

// Get platform-specific analytics
router.get('/metrics/platform/:platform',
  authenticate,
  rateLimiter.standard,
  [
    param('platform').isIn(['tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'youtube']),
    query('period').optional().isIn(['day', 'week', 'month', 'year'])
  ],
  validate,
  analyticsController.getPlatformMetrics
);

// Track custom event
router.post('/events/track',
  authenticate,
  rateLimiter.standard,
  [
    body('eventType').notEmpty().isString(),
    body('eventData').isObject(),
    body('platform').optional().isString(),
    body('metadata').optional().isObject()
  ],
  validate,
  analyticsController.trackEvent
);

// Get predictive analytics
router.get('/predictive/:model',
  authenticate,
  rateLimiter.standard,
  [
    param('model').isIn(['engagement', 'growth', 'churn', 'revenue']),
    query('horizon').optional().isInt({ min: 1, max: 365 })
  ],
  validate,
  analyticsController.getPredictiveAnalytics
);

// Get funnel analytics
router.get('/funnels/:funnelId',
  authenticate,
  rateLimiter.standard,
  [
    param('funnelId').isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validate,
  analyticsController.getFunnelAnalytics
);

// Create custom dashboard
router.post('/dashboards',
  authenticate,
  rateLimiter.standard,
  [
    body('name').notEmpty().isString(),
    body('widgets').isArray(),
    body('layout').optional().isObject(),
    body('isPublic').optional().isBoolean()
  ],
  validate,
  analyticsController.createDashboard
);

// Get dashboard
router.get('/dashboards/:dashboardId',
  authenticate,
  rateLimiter.standard,
  [
    param('dashboardId').isUUID()
  ],
  validate,
  analyticsController.getDashboard
);

// Update dashboard
router.put('/dashboards/:dashboardId',
  authenticate,
  rateLimiter.standard,
  [
    param('dashboardId').isUUID(),
    body('name').optional().isString(),
    body('widgets').optional().isArray(),
    body('layout').optional().isObject()
  ],
  validate,
  analyticsController.updateDashboard
);

// Delete dashboard
router.delete('/dashboards/:dashboardId',
  authenticate,
  rateLimiter.standard,
  [
    param('dashboardId').isUUID()
  ],
  validate,
  analyticsController.deleteDashboard
);

// Export analytics data
router.post('/export',
  authenticate,
  rateLimiter.strict,
  [
    body('format').isIn(['csv', 'excel', 'json', 'pdf']),
    body('metrics').isArray(),
    body('startDate').isISO8601().toDate(),
    body('endDate').isISO8601().toDate(),
    body('email').optional().isEmail()
  ],
  validate,
  analyticsController.exportAnalytics
);

// Get aggregated metrics
router.get('/metrics/aggregate',
  authenticate,
  rateLimiter.standard,
  [
    query('groupBy').isIn(['hour', 'day', 'week', 'month', 'platform', 'content_type']),
    query('metrics').isArray(),
    query('filters').optional().isObject()
  ],
  validate,
  analyticsController.getAggregatedMetrics
);

// Webhooks for third-party analytics
router.post('/webhooks/:provider',
  rateLimiter.webhook,
  [
    param('provider').isIn(['google', 'mixpanel', 'segment', 'amplitude'])
  ],
  validate,
  analyticsController.handleWebhook
);

module.exports = router;