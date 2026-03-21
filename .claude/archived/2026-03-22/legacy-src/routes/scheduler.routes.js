/**
 * Advanced Scheduler Routes
 * Endpoints for content scheduling and optimal timing
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const schedulerController = require('../controllers/scheduler.controller');
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

// Schedule content
router.post('/schedule',
  authenticate,
  rateLimiter.standard,
  [
    body('contentId').notEmpty().isString(),
    body('publishAt').isISO8601().toDate(),
    body('platform').isIn(['tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'youtube']),
    body('timezone').optional().isString(),
    body('recurring').optional().isObject(),
    body('config').optional().isObject()
  ],
  validate,
  schedulerController.scheduleContent
);

// Get scheduled content
router.get('/scheduled',
  authenticate,
  rateLimiter.standard,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('platform').optional().isString(),
    query('status').optional().isIn(['scheduled', 'publishing', 'published', 'failed', 'cancelled']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  schedulerController.getScheduledContent
);

// Get schedule details
router.get('/scheduled/:scheduleId',
  authenticate,
  rateLimiter.standard,
  [
    param('scheduleId').isUUID()
  ],
  validate,
  schedulerController.getSchedule
);

// Update schedule
router.put('/scheduled/:scheduleId',
  authenticate,
  rateLimiter.standard,
  [
    param('scheduleId').isUUID(),
    body('publishAt').optional().isISO8601().toDate(),
    body('timezone').optional().isString(),
    body('config').optional().isObject()
  ],
  validate,
  schedulerController.updateSchedule
);

// Cancel schedule
router.delete('/scheduled/:scheduleId',
  authenticate,
  rateLimiter.standard,
  [
    param('scheduleId').isUUID()
  ],
  validate,
  schedulerController.cancelSchedule
);

// Get optimal posting times
router.get('/optimal-times',
  authenticate,
  rateLimiter.standard,
  [
    query('platform').isIn(['tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'youtube']),
    query('timezone').optional().isString(),
    query('audience').optional().isString(),
    query('contentType').optional().isString()
  ],
  validate,
  schedulerController.getOptimalTimes
);

// Calculate optimal time for specific content
router.post('/optimal-times/calculate',
  authenticate,
  rateLimiter.standard,
  [
    body('platform').isIn(['tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'youtube']),
    body('contentType').isString(),
    body('targetAudience').optional().isObject(),
    body('historicalData').optional().isArray(),
    body('timezone').optional().isString()
  ],
  validate,
  schedulerController.calculateOptimalTime
);

// Create recurring schedule
router.post('/recurring',
  authenticate,
  rateLimiter.standard,
  [
    body('pattern').isIn(['daily', 'weekly', 'biweekly', 'monthly', 'custom']),
    body('intervalValue').optional().isInt({ min: 1 }),
    body('daysOfWeek').optional().isArray(),
    body('timeOfDay').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('endType').isIn(['never', 'date', 'occurrences']),
    body('endDate').optional().isISO8601(),
    body('maxOccurrences').optional().isInt({ min: 1 }),
    body('contentTemplate').optional().isObject()
  ],
  validate,
  schedulerController.createRecurringSchedule
);

// Get recurring schedules
router.get('/recurring',
  authenticate,
  rateLimiter.standard,
  [
    query('active').optional().isBoolean(),
    query('pattern').optional().isString()
  ],
  validate,
  schedulerController.getRecurringSchedules
);

// Update recurring schedule
router.put('/recurring/:scheduleId',
  authenticate,
  rateLimiter.standard,
  [
    param('scheduleId').isUUID(),
    body('pattern').optional().isString(),
    body('intervalValue').optional().isInt({ min: 1 }),
    body('daysOfWeek').optional().isArray(),
    body('timeOfDay').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('active').optional().isBoolean()
  ],
  validate,
  schedulerController.updateRecurringSchedule
);

// Pause recurring schedule
router.post('/recurring/:scheduleId/pause',
  authenticate,
  rateLimiter.standard,
  [
    param('scheduleId').isUUID()
  ],
  validate,
  schedulerController.pauseRecurringSchedule
);

// Resume recurring schedule
router.post('/recurring/:scheduleId/resume',
  authenticate,
  rateLimiter.standard,
  [
    param('scheduleId').isUUID()
  ],
  validate,
  schedulerController.resumeRecurringSchedule
);

// Get schedule calendar view
router.get('/calendar',
  authenticate,
  rateLimiter.standard,
  [
    query('startDate').isISO8601().toDate(),
    query('endDate').isISO8601().toDate(),
    query('platform').optional().isString(),
    query('view').optional().isIn(['day', 'week', 'month'])
  ],
  validate,
  schedulerController.getCalendarView
);

// Check for scheduling conflicts
router.post('/conflicts/check',
  authenticate,
  rateLimiter.standard,
  [
    body('publishAt').isISO8601().toDate(),
    body('platform').isString(),
    body('duration').optional().isInt({ min: 0 })
  ],
  validate,
  schedulerController.checkConflicts
);

// Resolve scheduling conflict
router.post('/conflicts/:conflictId/resolve',
  authenticate,
  rateLimiter.standard,
  [
    param('conflictId').isUUID(),
    body('resolution').isIn(['reschedule', 'merge', 'cancel', 'ignore'])
  ],
  validate,
  schedulerController.resolveConflict
);

// Bulk schedule
router.post('/bulk',
  authenticate,
  authorize(['pro', 'enterprise']),
  rateLimiter.strict,
  [
    body('schedules').isArray().isLength({ min: 1, max: 100 }),
    body('schedules.*.contentId').notEmpty().isString(),
    body('schedules.*.publishAt').isISO8601(),
    body('schedules.*.platform').isString()
  ],
  validate,
  schedulerController.bulkSchedule
);

// Get scheduling analytics
router.get('/analytics',
  authenticate,
  rateLimiter.standard,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('platform').optional().isString(),
    query('metrics').optional().isArray()
  ],
  validate,
  schedulerController.getSchedulingAnalytics
);

// Export schedule
router.post('/export',
  authenticate,
  rateLimiter.strict,
  [
    body('format').isIn(['csv', 'ics', 'json']),
    body('startDate').isISO8601().toDate(),
    body('endDate').isISO8601().toDate(),
    body('platforms').optional().isArray()
  ],
  validate,
  schedulerController.exportSchedule
);

// Import schedule
router.post('/import',
  authenticate,
  rateLimiter.strict,
  [
    body('format').isIn(['csv', 'ics', 'json']),
    body('data').notEmpty(),
    body('overwrite').optional().isBoolean()
  ],
  validate,
  schedulerController.importSchedule
);

module.exports = router;