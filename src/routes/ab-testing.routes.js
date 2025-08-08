/**
 * A/B Testing Routes
 * Endpoints for experiment management and analysis
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const abTestingController = require('../controllers/ab-testing.controller');
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

// Create new experiment
router.post('/experiments',
  authenticate,
  rateLimiter.standard,
  [
    body('name').notEmpty().isString(),
    body('type').isIn(['simple', 'multivariate', 'sequential']),
    body('variants').isArray().isLength({ min: 2 }),
    body('trafficAllocation').optional().isObject(),
    body('targetingRules').optional().isObject(),
    body('successMetrics').isArray(),
    body('duration').optional().isInt({ min: 1 })
  ],
  validate,
  abTestingController.createExperiment
);

// Get all experiments
router.get('/experiments',
  authenticate,
  rateLimiter.standard,
  [
    query('status').optional().isIn(['draft', 'running', 'paused', 'completed']),
    query('platform').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  abTestingController.getExperiments
);

// Get experiment details
router.get('/experiments/:experimentId',
  authenticate,
  rateLimiter.standard,
  [
    param('experimentId').isUUID()
  ],
  validate,
  abTestingController.getExperiment
);

// Update experiment
router.put('/experiments/:experimentId',
  authenticate,
  rateLimiter.standard,
  [
    param('experimentId').isUUID(),
    body('name').optional().isString(),
    body('variants').optional().isArray(),
    body('trafficAllocation').optional().isObject(),
    body('targetingRules').optional().isObject()
  ],
  validate,
  abTestingController.updateExperiment
);

// Start experiment
router.post('/experiments/:experimentId/start',
  authenticate,
  authorize(['admin', 'manager']),
  rateLimiter.standard,
  [
    param('experimentId').isUUID()
  ],
  validate,
  abTestingController.startExperiment
);

// Pause experiment
router.post('/experiments/:experimentId/pause',
  authenticate,
  authorize(['admin', 'manager']),
  rateLimiter.standard,
  [
    param('experimentId').isUUID()
  ],
  validate,
  abTestingController.pauseExperiment
);

// Stop experiment
router.post('/experiments/:experimentId/stop',
  authenticate,
  authorize(['admin', 'manager']),
  rateLimiter.standard,
  [
    param('experimentId').isUUID()
  ],
  validate,
  abTestingController.stopExperiment
);

// Get experiment results
router.get('/experiments/:experimentId/results',
  authenticate,
  rateLimiter.standard,
  [
    param('experimentId').isUUID(),
    query('confidence').optional().isFloat({ min: 0.8, max: 0.99 }),
    query('method').optional().isIn(['bayesian', 'frequentist'])
  ],
  validate,
  abTestingController.getExperimentResults
);

// Track conversion
router.post('/conversions',
  authenticate,
  rateLimiter.high,
  [
    body('experimentId').isUUID(),
    body('variantId').isString(),
    body('userId').optional().isUUID(),
    body('conversionType').isString(),
    body('value').optional().isFloat({ min: 0 }),
    body('metadata').optional().isObject()
  ],
  validate,
  abTestingController.trackConversion
);

// Get variant assignment
router.get('/assignments/:userId',
  authenticate,
  rateLimiter.high,
  [
    param('userId').isUUID(),
    query('experimentId').optional().isUUID()
  ],
  validate,
  abTestingController.getVariantAssignment
);

// Override variant assignment (for QA)
router.post('/assignments/override',
  authenticate,
  authorize(['admin', 'qa']),
  rateLimiter.standard,
  [
    body('userId').isUUID(),
    body('experimentId').isUUID(),
    body('variantId').isString()
  ],
  validate,
  abTestingController.overrideAssignment
);

// Calculate sample size
router.post('/calculate/sample-size',
  authenticate,
  rateLimiter.standard,
  [
    body('baselineConversion').isFloat({ min: 0, max: 1 }),
    body('minimumDetectableEffect').isFloat({ min: 0.01, max: 1 }),
    body('statisticalPower').optional().isFloat({ min: 0.5, max: 0.99 }),
    body('significanceLevel').optional().isFloat({ min: 0.01, max: 0.1 })
  ],
  validate,
  abTestingController.calculateSampleSize
);

// Get statistical significance
router.post('/calculate/significance',
  authenticate,
  rateLimiter.standard,
  [
    body('controlConversions').isInt({ min: 0 }),
    body('controlVisitors').isInt({ min: 1 }),
    body('variantConversions').isInt({ min: 0 }),
    body('variantVisitors').isInt({ min: 1 }),
    body('method').optional().isIn(['z-test', 't-test', 'chi-square'])
  ],
  validate,
  abTestingController.calculateSignificance
);

// Clone experiment
router.post('/experiments/:experimentId/clone',
  authenticate,
  rateLimiter.standard,
  [
    param('experimentId').isUUID(),
    body('name').notEmpty().isString()
  ],
  validate,
  abTestingController.cloneExperiment
);

// Archive experiment
router.post('/experiments/:experimentId/archive',
  authenticate,
  authorize(['admin', 'manager']),
  rateLimiter.standard,
  [
    param('experimentId').isUUID()
  ],
  validate,
  abTestingController.archiveExperiment
);

// Export experiment data
router.post('/experiments/:experimentId/export',
  authenticate,
  rateLimiter.strict,
  [
    param('experimentId').isUUID(),
    body('format').isIn(['csv', 'json', 'pdf']),
    body('includeRawData').optional().isBoolean()
  ],
  validate,
  abTestingController.exportExperiment
);

module.exports = router;