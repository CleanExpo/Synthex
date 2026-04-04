/**
 * Competitor Analysis Routes
 * Endpoints for competitor tracking and analysis
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const competitorController = require('../controllers/competitor.controller');
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

// Add competitor
router.post('/competitors',
  authenticate,
  rateLimiter.standard,
  [
    body('name').notEmpty().isString(),
    body('domain').optional().isFQDN(),
    body('platforms').isArray(),
    body('platforms.*.platform').isIn(['tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'youtube']),
    body('platforms.*.handle').notEmpty().isString(),
    body('trackingConfig').optional().isObject()
  ],
  validate,
  competitorController.addCompetitor
);

// Get competitors
router.get('/competitors',
  authenticate,
  rateLimiter.standard,
  [
    query('active').optional().isBoolean(),
    query('platform').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  validate,
  competitorController.getCompetitors
);

// Get competitor details
router.get('/competitors/:competitorId',
  authenticate,
  rateLimiter.standard,
  [
    param('competitorId').isUUID()
  ],
  validate,
  competitorController.getCompetitor
);

// Update competitor
router.put('/competitors/:competitorId',
  authenticate,
  rateLimiter.standard,
  [
    param('competitorId').isUUID(),
    body('name').optional().isString(),
    body('domain').optional().isFQDN(),
    body('platforms').optional().isArray(),
    body('trackingConfig').optional().isObject(),
    body('active').optional().isBoolean()
  ],
  validate,
  competitorController.updateCompetitor
);

// Remove competitor
router.delete('/competitors/:competitorId',
  authenticate,
  rateLimiter.standard,
  [
    param('competitorId').isUUID()
  ],
  validate,
  competitorController.removeCompetitor
);

// Track competitor content
router.post('/competitors/:competitorId/track',
  authenticate,
  rateLimiter.standard,
  [
    param('competitorId').isUUID(),
    body('platform').isIn(['tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'youtube']),
    body('contentUrl').optional().isURL(),
    body('metrics').optional().isObject()
  ],
  validate,
  competitorController.trackContent
);

// Get competitor metrics
router.get('/competitors/:competitorId/metrics',
  authenticate,
  rateLimiter.standard,
  [
    param('competitorId').isUUID(),
    query('platform').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('metrics').optional().isArray()
  ],
  validate,
  competitorController.getCompetitorMetrics
);

// Get competitor content
router.get('/competitors/:competitorId/content',
  authenticate,
  rateLimiter.standard,
  [
    param('competitorId').isUUID(),
    query('platform').optional().isString(),
    query('contentType').optional().isString(),
    query('sortBy').optional().isIn(['date', 'engagement', 'views', 'shares']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  competitorController.getCompetitorContent
);

// Compare competitors
router.post('/compare',
  authenticate,
  rateLimiter.standard,
  [
    body('competitorIds').isArray().isLength({ min: 2, max: 10 }),
    body('metrics').isArray(),
    body('platform').optional().isString(),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601()
  ],
  validate,
  competitorController.compareCompetitors
);

// Get industry benchmarks
router.get('/benchmarks',
  authenticate,
  rateLimiter.standard,
  [
    query('industry').optional().isString(),
    query('platform').optional().isString(),
    query('metrics').optional().isArray()
  ],
  validate,
  competitorController.getBenchmarks
);

// Get trending content
router.get('/trending',
  authenticate,
  rateLimiter.standard,
  [
    query('platform').optional().isString(),
    query('timeframe').optional().isIn(['day', 'week', 'month']),
    query('contentType').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  validate,
  competitorController.getTrendingContent
);

// Get content gaps
router.get('/gaps',
  authenticate,
  rateLimiter.standard,
  [
    query('competitorIds').optional().isArray(),
    query('platform').optional().isString(),
    query('analysisType').optional().isIn(['content', 'keywords', 'topics', 'audience'])
  ],
  validate,
  competitorController.getContentGaps
);

// Get competitive insights
router.get('/insights',
  authenticate,
  rateLimiter.standard,
  [
    query('competitorId').optional().isUUID(),
    query('insightType').optional().isIn(['strategy', 'performance', 'opportunities', 'threats']),
    query('platform').optional().isString()
  ],
  validate,
  competitorController.getCompetitiveInsights
);

// Create alert
router.post('/alerts',
  authenticate,
  rateLimiter.standard,
  [
    body('name').notEmpty().isString(),
    body('type').isIn(['content', 'metric', 'milestone', 'mention']),
    body('conditions').isObject(),
    body('competitorIds').optional().isArray(),
    body('platforms').optional().isArray(),
    body('notificationChannels').isArray()
  ],
  validate,
  competitorController.createAlert
);

// Get alerts
router.get('/alerts',
  authenticate,
  rateLimiter.standard,
  [
    query('active').optional().isBoolean(),
    query('type').optional().isString()
  ],
  validate,
  competitorController.getAlerts
);

// Update alert
router.put('/alerts/:alertId',
  authenticate,
  rateLimiter.standard,
  [
    param('alertId').isUUID(),
    body('name').optional().isString(),
    body('conditions').optional().isObject(),
    body('active').optional().isBoolean()
  ],
  validate,
  competitorController.updateAlert
);

// Delete alert
router.delete('/alerts/:alertId',
  authenticate,
  rateLimiter.standard,
  [
    param('alertId').isUUID()
  ],
  validate,
  competitorController.deleteAlert
);

// Get SWOT analysis
router.get('/swot/:competitorId',
  authenticate,
  rateLimiter.standard,
  [
    param('competitorId').isUUID(),
    query('platform').optional().isString()
  ],
  validate,
  competitorController.getSwotAnalysis
);

// Export competitor data
router.post('/export',
  authenticate,
  rateLimiter.strict,
  [
    body('competitorIds').isArray(),
    body('format').isIn(['csv', 'excel', 'json', 'pdf']),
    body('dataTypes').isArray(),
    body('dateRange').optional().isObject()
  ],
  validate,
  competitorController.exportCompetitorData
);

// Refresh competitor data
router.post('/competitors/:competitorId/refresh',
  authenticate,
  rateLimiter.strict,
  [
    param('competitorId').isUUID(),
    body('platforms').optional().isArray()
  ],
  validate,
  competitorController.refreshCompetitorData
);

// Get market share analysis
router.get('/market-share',
  authenticate,
  rateLimiter.standard,
  [
    query('platform').optional().isString(),
    query('metric').optional().isIn(['followers', 'engagement', 'content', 'reach'])
  ],
  validate,
  competitorController.getMarketShare
);

module.exports = router;