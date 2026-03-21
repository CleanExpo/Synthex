/**
 * Mobile API Routes
 * Endpoints for mobile device management and sync
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const mobileController = require('../controllers/mobile.controller');
const { authenticate, authorizeDevice } = require('../middleware/auth');
const rateLimiter = require('../middleware/rate-limiter');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Register device
router.post('/devices/register',
  authenticate,
  rateLimiter.standard,
  [
    body('platform').isIn(['ios', 'android', 'web']),
    body('deviceName').optional().isString(),
    body('deviceModel').optional().isString(),
    body('osVersion').optional().isString(),
    body('appVersion').notEmpty().isString(),
    body('pushToken').optional().isString(),
    body('capabilities').optional().isObject()
  ],
  validate,
  mobileController.registerDevice
);

// Get user devices
router.get('/devices',
  authenticate,
  rateLimiter.standard,
  [
    query('platform').optional().isIn(['ios', 'android', 'web']),
    query('status').optional().isIn(['active', 'inactive', 'logged_out', 'wiped'])
  ],
  validate,
  mobileController.getDevices
);

// Get device details
router.get('/devices/:deviceId',
  authenticate,
  authorizeDevice,
  rateLimiter.standard,
  [
    param('deviceId').isString()
  ],
  validate,
  mobileController.getDevice
);

// Update device
router.put('/devices/:deviceId',
  authenticate,
  authorizeDevice,
  rateLimiter.standard,
  [
    param('deviceId').isString(),
    body('deviceName').optional().isString(),
    body('pushToken').optional().isString(),
    body('appVersion').optional().isString(),
    body('config').optional().isObject()
  ],
  validate,
  mobileController.updateDevice
);

// Logout device
router.post('/devices/:deviceId/logout',
  authenticate,
  authorizeDevice,
  rateLimiter.standard,
  [
    param('deviceId').isString()
  ],
  validate,
  mobileController.logoutDevice
);

// Remote wipe device
router.post('/devices/:deviceId/wipe',
  authenticate,
  rateLimiter.strict,
  [
    param('deviceId').isString(),
    body('confirmation').equals('WIPE_DEVICE')
  ],
  validate,
  mobileController.wipeDevice
);

// Send push notification
router.post('/notifications/send',
  authenticate,
  rateLimiter.standard,
  [
    body('deviceId').optional().isString(),
    body('userId').optional().isUUID(),
    body('title').notEmpty().isString(),
    body('body').notEmpty().isString(),
    body('data').optional().isObject(),
    body('priority').optional().isIn(['urgent', 'high', 'normal', 'low']),
    body('category').optional().isString()
  ],
  validate,
  mobileController.sendNotification
);

// Get notifications
router.get('/notifications',
  authenticate,
  rateLimiter.standard,
  [
    query('deviceId').optional().isString(),
    query('read').optional().isBoolean(),
    query('category').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  mobileController.getNotifications
);

// Mark notification as read
router.put('/notifications/:notificationId/read',
  authenticate,
  rateLimiter.standard,
  [
    param('notificationId').isUUID()
  ],
  validate,
  mobileController.markAsRead
);

// Mark all notifications as read
router.put('/notifications/read-all',
  authenticate,
  rateLimiter.standard,
  mobileController.markAllAsRead
);

// Delete notification
router.delete('/notifications/:notificationId',
  authenticate,
  rateLimiter.standard,
  [
    param('notificationId').isUUID()
  ],
  validate,
  mobileController.deleteNotification
);

// Sync data
router.post('/sync',
  authenticate,
  authorizeDevice,
  rateLimiter.sync,
  [
    body('deviceId').notEmpty().isString(),
    body('lastSyncAt').optional().isISO8601(),
    body('changes').isArray(),
    body('conflictResolution').optional().isIn(['server-wins', 'client-wins', 'merge'])
  ],
  validate,
  mobileController.syncData
);

// Get sync status
router.get('/sync/status',
  authenticate,
  authorizeDevice,
  rateLimiter.standard,
  [
    query('deviceId').notEmpty().isString()
  ],
  validate,
  mobileController.getSyncStatus
);

// Get pending sync items
router.get('/sync/pending',
  authenticate,
  authorizeDevice,
  rateLimiter.standard,
  [
    query('deviceId').notEmpty().isString(),
    query('type').optional().isString()
  ],
  validate,
  mobileController.getPendingSync
);

// Resolve sync conflict
router.post('/sync/conflicts/:conflictId/resolve',
  authenticate,
  rateLimiter.standard,
  [
    param('conflictId').isUUID(),
    body('resolution').isIn(['server', 'client', 'merge']),
    body('mergedData').optional().isObject()
  ],
  validate,
  mobileController.resolveSyncConflict
);

// Get device settings
router.get('/devices/:deviceId/settings',
  authenticate,
  authorizeDevice,
  rateLimiter.standard,
  [
    param('deviceId').isString()
  ],
  validate,
  mobileController.getDeviceSettings
);

// Update device settings
router.put('/devices/:deviceId/settings',
  authenticate,
  authorizeDevice,
  rateLimiter.standard,
  [
    param('deviceId').isString(),
    body('notificationsEnabled').optional().isBoolean(),
    body('offlineModeEnabled').optional().isBoolean(),
    body('biometricEnabled').optional().isBoolean(),
    body('theme').optional().isIn(['light', 'dark', 'system']),
    body('language').optional().isString(),
    body('dataUsage').optional().isIn(['wifi-only', 'cellular', 'all']),
    body('autoSync').optional().isBoolean(),
    body('syncInterval').optional().isInt({ min: 1, max: 1440 })
  ],
  validate,
  mobileController.updateDeviceSettings
);

// Create mobile session
router.post('/sessions',
  rateLimiter.auth,
  [
    body('deviceId').notEmpty().isString(),
    body('email').isEmail(),
    body('password').notEmpty().isString()
  ],
  validate,
  mobileController.createSession
);

// Refresh session
router.post('/sessions/refresh',
  rateLimiter.auth,
  [
    body('deviceId').notEmpty().isString(),
    body('refreshToken').notEmpty().isString()
  ],
  validate,
  mobileController.refreshSession
);

// End session
router.delete('/sessions/:sessionId',
  authenticate,
  rateLimiter.standard,
  [
    param('sessionId').isUUID()
  ],
  validate,
  mobileController.endSession
);

// Get app configuration
router.get('/config',
  authenticate,
  rateLimiter.standard,
  [
    query('platform').isIn(['ios', 'android', 'web']),
    query('version').notEmpty().isString()
  ],
  validate,
  mobileController.getAppConfig
);

// Check for app updates
router.get('/updates/check',
  authenticate,
  rateLimiter.standard,
  [
    query('platform').isIn(['ios', 'android']),
    query('currentVersion').notEmpty().isString()
  ],
  validate,
  mobileController.checkForUpdates
);

// Get offline data package
router.get('/offline/package',
  authenticate,
  authorizeDevice,
  rateLimiter.strict,
  [
    query('deviceId').notEmpty().isString(),
    query('lastSync').optional().isISO8601()
  ],
  validate,
  mobileController.getOfflinePackage
);

module.exports = router;