/**
 * Reporting Routes
 * Endpoints for automated reporting and insights
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const reportingController = require('../controllers/reporting.controller');
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

// Create report
router.post('/reports',
  authenticate,
  rateLimiter.standard,
  [
    body('name').notEmpty().isString(),
    body('type').isIn(['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom']),
    body('config').isObject(),
    body('metrics').isArray(),
    body('filters').optional().isObject(),
    body('formats').optional().isArray(),
    body('recipients').optional().isArray()
  ],
  validate,
  reportingController.createReport
);

// Get reports
router.get('/reports',
  authenticate,
  rateLimiter.standard,
  [
    query('type').optional().isString(),
    query('status').optional().isIn(['pending', 'generating', 'completed', 'failed', 'cancelled']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  reportingController.getReports
);

// Get report details
router.get('/reports/:reportId',
  authenticate,
  rateLimiter.standard,
  [
    param('reportId').isString()
  ],
  validate,
  reportingController.getReport
);

// Generate report now
router.post('/reports/:reportId/generate',
  authenticate,
  rateLimiter.strict,
  [
    param('reportId').isString()
  ],
  validate,
  reportingController.generateReport
);

// Download report
router.get('/reports/:reportId/download',
  authenticate,
  rateLimiter.download,
  [
    param('reportId').isString(),
    query('format').optional().isIn(['pdf', 'excel', 'csv', 'html'])
  ],
  validate,
  reportingController.downloadReport
);

// Delete report
router.delete('/reports/:reportId',
  authenticate,
  rateLimiter.standard,
  [
    param('reportId').isString()
  ],
  validate,
  reportingController.deleteReport
);

// Create report schedule
router.post('/schedules',
  authenticate,
  rateLimiter.standard,
  [
    body('reportType').notEmpty().isString(),
    body('config').isObject(),
    body('cronExpression').matches(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/),
    body('timezone').optional().isString(),
    body('recipients').isArray(),
    body('enabled').optional().isBoolean()
  ],
  validate,
  reportingController.createSchedule
);

// Get schedules
router.get('/schedules',
  authenticate,
  rateLimiter.standard,
  [
    query('enabled').optional().isBoolean(),
    query('reportType').optional().isString()
  ],
  validate,
  reportingController.getSchedules
);

// Update schedule
router.put('/schedules/:scheduleId',
  authenticate,
  rateLimiter.standard,
  [
    param('scheduleId').isString(),
    body('config').optional().isObject(),
    body('cronExpression').optional().matches(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/),
    body('recipients').optional().isArray(),
    body('enabled').optional().isBoolean()
  ],
  validate,
  reportingController.updateSchedule
);

// Delete schedule
router.delete('/schedules/:scheduleId',
  authenticate,
  rateLimiter.standard,
  [
    param('scheduleId').isString()
  ],
  validate,
  reportingController.deleteSchedule
);

// Get insights
router.get('/insights',
  authenticate,
  rateLimiter.standard,
  [
    query('type').optional().isString(),
    query('category').optional().isString(),
    query('actionable').optional().isBoolean(),
    query('minImpact').optional().isInt({ min: 1, max: 10 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  validate,
  reportingController.getInsights
);

// Get insight details
router.get('/insights/:insightId',
  authenticate,
  rateLimiter.standard,
  [
    param('insightId').isString()
  ],
  validate,
  reportingController.getInsight
);

// Act on insight
router.post('/insights/:insightId/actions',
  authenticate,
  rateLimiter.standard,
  [
    param('insightId').isString(),
    body('action').notEmpty().isString(),
    body('parameters').optional().isObject()
  ],
  validate,
  reportingController.actOnInsight
);

// Dismiss insight
router.post('/insights/:insightId/dismiss',
  authenticate,
  rateLimiter.standard,
  [
    param('insightId').isString(),
    body('reason').optional().isString()
  ],
  validate,
  reportingController.dismissInsight
);

// Get report templates
router.get('/templates',
  authenticate,
  rateLimiter.standard,
  [
    query('type').optional().isString(),
    query('isPublic').optional().isBoolean()
  ],
  validate,
  reportingController.getTemplates
);

// Create report template
router.post('/templates',
  authenticate,
  rateLimiter.standard,
  [
    body('name').notEmpty().isString(),
    body('description').optional().isString(),
    body('type').notEmpty().isString(),
    body('sections').isArray(),
    body('filters').optional().isObject(),
    body('visualizations').optional().isObject(),
    body('isPublic').optional().isBoolean()
  ],
  validate,
  reportingController.createTemplate
);

// Update template
router.put('/templates/:templateId',
  authenticate,
  rateLimiter.standard,
  [
    param('templateId').isString(),
    body('name').optional().isString(),
    body('description').optional().isString(),
    body('sections').optional().isArray(),
    body('filters').optional().isObject(),
    body('visualizations').optional().isObject()
  ],
  validate,
  reportingController.updateTemplate
);

// Delete template
router.delete('/templates/:templateId',
  authenticate,
  rateLimiter.standard,
  [
    param('templateId').isString()
  ],
  validate,
  reportingController.deleteTemplate
);

// Create export job
router.post('/export',
  authenticate,
  rateLimiter.strict,
  [
    body('exportType').isIn(['data', 'report', 'analytics', 'library', 'all']),
    body('format').isIn(['json', 'csv', 'excel', 'pdf', 'zip']),
    body('config').optional().isObject(),
    body('filters').optional().isObject()
  ],
  validate,
  reportingController.createExportJob
);

// Get export jobs
router.get('/export/jobs',
  authenticate,
  rateLimiter.standard,
  [
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled']),
    query('exportType').optional().isString()
  ],
  validate,
  reportingController.getExportJobs
);

// Get export job status
router.get('/export/jobs/:jobId',
  authenticate,
  rateLimiter.standard,
  [
    param('jobId').isString()
  ],
  validate,
  reportingController.getExportJob
);

// Download export
router.get('/export/jobs/:jobId/download',
  authenticate,
  rateLimiter.download,
  [
    param('jobId').isString()
  ],
  validate,
  reportingController.downloadExport
);

// Cancel export job
router.post('/export/jobs/:jobId/cancel',
  authenticate,
  rateLimiter.standard,
  [
    param('jobId').isString()
  ],
  validate,
  reportingController.cancelExportJob
);

// Get report recipients
router.get('/recipients',
  authenticate,
  rateLimiter.standard,
  reportingController.getRecipients
);

// Add recipient
router.post('/recipients',
  authenticate,
  rateLimiter.standard,
  [
    body('email').isEmail(),
    body('name').optional().isString(),
    body('deliveryMethod').optional().isIn(['email', 'webhook', 'slack', 'teams', 'api'])
  ],
  validate,
  reportingController.addRecipient
);

// Remove recipient
router.delete('/recipients/:recipientId',
  authenticate,
  rateLimiter.standard,
  [
    param('recipientId').isString()
  ],
  validate,
  reportingController.removeRecipient
);

// Test report delivery
router.post('/test-delivery',
  authenticate,
  rateLimiter.standard,
  [
    body('recipientEmail').isEmail(),
    body('deliveryMethod').isIn(['email', 'webhook', 'slack', 'teams'])
  ],
  validate,
  reportingController.testDelivery
);

module.exports = router;