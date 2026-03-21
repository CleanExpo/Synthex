/**
 * Content Library Routes
 * Endpoints for content management and organization
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const libraryController = require('../controllers/library.controller');
const { authenticate, authorize } = require('../middleware/auth');
const rateLimiter = require('../middleware/rate-limiter');
const multer = require('multer');

// File upload configuration
const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Create content item
router.post('/items',
  authenticate,
  rateLimiter.standard,
  [
    body('title').notEmpty().isString().isLength({ max: 255 }),
    body('content').notEmpty().isObject(),
    body('type').isIn(['post', 'image', 'video', 'template', 'document']),
    body('tags').optional().isArray(),
    body('collections').optional().isArray(),
    body('metadata').optional().isObject(),
    body('permissions').optional().isObject()
  ],
  validate,
  libraryController.createItem
);

// Get library items
router.get('/items',
  authenticate,
  rateLimiter.standard,
  [
    query('type').optional().isString(),
    query('tags').optional().isArray(),
    query('collection').optional().isUUID(),
    query('search').optional().isString(),
    query('featured').optional().isBoolean(),
    query('sortBy').optional().isIn(['title', 'created', 'updated', 'usage']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  libraryController.getItems
);

// Get item details
router.get('/items/:itemId',
  authenticate,
  rateLimiter.standard,
  [
    param('itemId').isUUID()
  ],
  validate,
  libraryController.getItem
);

// Update item
router.put('/items/:itemId',
  authenticate,
  rateLimiter.standard,
  [
    param('itemId').isUUID(),
    body('title').optional().isString().isLength({ max: 255 }),
    body('content').optional().isObject(),
    body('tags').optional().isArray(),
    body('metadata').optional().isObject()
  ],
  validate,
  libraryController.updateItem
);

// Delete item
router.delete('/items/:itemId',
  authenticate,
  rateLimiter.standard,
  [
    param('itemId').isUUID()
  ],
  validate,
  libraryController.deleteItem
);

// Create collection
router.post('/collections',
  authenticate,
  rateLimiter.standard,
  [
    body('name').notEmpty().isString().isLength({ max: 255 }),
    body('description').optional().isString(),
    body('type').isIn(['manual', 'smart', 'dynamic']),
    body('config').optional().isObject(),
    body('visibility').optional().isIn(['private', 'team', 'public'])
  ],
  validate,
  libraryController.createCollection
);

// Get collections
router.get('/collections',
  authenticate,
  rateLimiter.standard,
  [
    query('type').optional().isString(),
    query('visibility').optional().isString(),
    query('search').optional().isString()
  ],
  validate,
  libraryController.getCollections
);

// Get collection details
router.get('/collections/:collectionId',
  authenticate,
  rateLimiter.standard,
  [
    param('collectionId').isUUID()
  ],
  validate,
  libraryController.getCollection
);

// Update collection
router.put('/collections/:collectionId',
  authenticate,
  rateLimiter.standard,
  [
    param('collectionId').isUUID(),
    body('name').optional().isString(),
    body('description').optional().isString(),
    body('config').optional().isObject()
  ],
  validate,
  libraryController.updateCollection
);

// Delete collection
router.delete('/collections/:collectionId',
  authenticate,
  rateLimiter.standard,
  [
    param('collectionId').isUUID()
  ],
  validate,
  libraryController.deleteCollection
);

// Add items to collection
router.post('/collections/:collectionId/items',
  authenticate,
  rateLimiter.standard,
  [
    param('collectionId').isUUID(),
    body('itemIds').isArray().isLength({ min: 1 })
  ],
  validate,
  libraryController.addToCollection
);

// Remove items from collection
router.delete('/collections/:collectionId/items',
  authenticate,
  rateLimiter.standard,
  [
    param('collectionId').isUUID(),
    body('itemIds').isArray().isLength({ min: 1 })
  ],
  validate,
  libraryController.removeFromCollection
);

// Upload media asset
router.post('/assets/upload',
  authenticate,
  rateLimiter.upload,
  upload.single('file'),
  [
    body('type').isIn(['image', 'video', 'audio', 'document']),
    body('libraryId').optional().isUUID()
  ],
  validate,
  libraryController.uploadAsset
);

// Get media assets
router.get('/assets',
  authenticate,
  rateLimiter.standard,
  [
    query('type').optional().isString(),
    query('libraryId').optional().isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  libraryController.getAssets
);

// Delete asset
router.delete('/assets/:assetId',
  authenticate,
  rateLimiter.standard,
  [
    param('assetId').isUUID()
  ],
  validate,
  libraryController.deleteAsset
);

// Search library
router.get('/search',
  authenticate,
  rateLimiter.standard,
  [
    query('q').notEmpty().isString(),
    query('type').optional().isArray(),
    query('tags').optional().isArray(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601()
  ],
  validate,
  libraryController.searchLibrary
);

// Get item versions
router.get('/items/:itemId/versions',
  authenticate,
  rateLimiter.standard,
  [
    param('itemId').isUUID()
  ],
  validate,
  libraryController.getVersions
);

// Restore version
router.post('/items/:itemId/versions/:versionNumber/restore',
  authenticate,
  rateLimiter.standard,
  [
    param('itemId').isUUID(),
    param('versionNumber').isInt({ min: 1 })
  ],
  validate,
  libraryController.restoreVersion
);

// Duplicate item
router.post('/items/:itemId/duplicate',
  authenticate,
  rateLimiter.standard,
  [
    param('itemId').isUUID(),
    body('title').optional().isString()
  ],
  validate,
  libraryController.duplicateItem
);

// Share item
router.post('/items/:itemId/share',
  authenticate,
  rateLimiter.standard,
  [
    param('itemId').isUUID(),
    body('recipients').isArray(),
    body('permissions').optional().isObject(),
    body('expiresAt').optional().isISO8601()
  ],
  validate,
  libraryController.shareItem
);

// Get shared items
router.get('/shared',
  authenticate,
  rateLimiter.standard,
  [
    query('sharedBy').optional().isUUID(),
    query('sharedWith').optional().isUUID()
  ],
  validate,
  libraryController.getSharedItems
);

// Export library
router.post('/export',
  authenticate,
  rateLimiter.strict,
  [
    body('format').isIn(['json', 'csv', 'zip']),
    body('itemIds').optional().isArray(),
    body('collectionIds').optional().isArray(),
    body('includeAssets').optional().isBoolean()
  ],
  validate,
  libraryController.exportLibrary
);

// Import library
router.post('/import',
  authenticate,
  rateLimiter.strict,
  upload.single('file'),
  [
    body('format').isIn(['json', 'csv', 'zip']),
    body('overwrite').optional().isBoolean()
  ],
  validate,
  libraryController.importLibrary
);

// Get library statistics
router.get('/stats',
  authenticate,
  rateLimiter.standard,
  libraryController.getLibraryStats
);

module.exports = router;