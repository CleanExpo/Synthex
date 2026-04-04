/**
 * AI Content Generation Routes
 * Endpoints for AI-powered content creation
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const aiContentController = require('../controllers/ai-content.controller');
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

// Generate content
router.post('/generate',
  authenticate,
  rateLimiter.ai,
  [
    body('prompt').notEmpty().isString().isLength({ max: 5000 }),
    body('type').isIn(['post', 'caption', 'story', 'article', 'email', 'ad', 'script']),
    body('platform').optional().isIn(['tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'youtube', 'general']),
    body('tone').optional().isIn(['professional', 'casual', 'friendly', 'authoritative', 'humorous', 'inspirational']),
    body('length').optional().isIn(['short', 'medium', 'long']),
    body('keywords').optional().isArray(),
    body('language').optional().isString(),
    body('variations').optional().isInt({ min: 1, max: 10 })
  ],
  validate,
  aiContentController.generateContent
);

// Generate variations
router.post('/variations',
  authenticate,
  rateLimiter.ai,
  [
    body('originalContent').notEmpty().isString(),
    body('count').isInt({ min: 1, max: 10 }),
    body('variationType').optional().isIn(['tone', 'length', 'style', 'perspective']),
    body('preserveKeywords').optional().isBoolean()
  ],
  validate,
  aiContentController.generateVariations
);

// Improve content
router.post('/improve',
  authenticate,
  rateLimiter.ai,
  [
    body('content').notEmpty().isString(),
    body('improvementType').isIn(['grammar', 'clarity', 'engagement', 'seo', 'all']),
    body('targetAudience').optional().isString(),
    body('goals').optional().isArray()
  ],
  validate,
  aiContentController.improveContent
);

// Generate hashtags
router.post('/hashtags',
  authenticate,
  rateLimiter.standard,
  [
    body('content').notEmpty().isString(),
    body('platform').isIn(['tiktok', 'instagram', 'twitter', 'linkedin']),
    body('count').optional().isInt({ min: 1, max: 30 }),
    body('includeNiche').optional().isBoolean(),
    body('includeTrending').optional().isBoolean()
  ],
  validate,
  aiContentController.generateHashtags
);

// Generate captions
router.post('/captions',
  authenticate,
  rateLimiter.ai,
  [
    body('mediaDescription').notEmpty().isString(),
    body('platform').isIn(['tiktok', 'instagram', 'facebook', 'youtube']),
    body('style').optional().isIn(['descriptive', 'storytelling', 'call-to-action', 'question']),
    body('includeEmojis').optional().isBoolean(),
    body('maxLength').optional().isInt({ min: 10, max: 2200 })
  ],
  validate,
  aiContentController.generateCaptions
);

// Generate scripts
router.post('/scripts',
  authenticate,
  rateLimiter.ai,
  [
    body('topic').notEmpty().isString(),
    body('duration').isInt({ min: 15, max: 600 }),
    body('format').isIn(['narrative', 'tutorial', 'review', 'vlog', 'interview']),
    body('includeHooks').optional().isBoolean(),
    body('includeCTA').optional().isBoolean()
  ],
  validate,
  aiContentController.generateScript
);

// Translate content
router.post('/translate',
  authenticate,
  rateLimiter.standard,
  [
    body('content').notEmpty().isString(),
    body('targetLanguage').isString().isLength({ min: 2, max: 5 }),
    body('sourceLanguage').optional().isString().isLength({ min: 2, max: 5 }),
    body('preserveFormatting').optional().isBoolean()
  ],
  validate,
  aiContentController.translateContent
);

// Analyze content
router.post('/analyze',
  authenticate,
  rateLimiter.standard,
  [
    body('content').notEmpty().isString(),
    body('metrics').optional().isArray(),
    body('includeSentiment').optional().isBoolean(),
    body('includeReadability').optional().isBoolean(),
    body('includeSEO').optional().isBoolean()
  ],
  validate,
  aiContentController.analyzeContent
);

// Get content templates
router.get('/templates',
  authenticate,
  rateLimiter.standard,
  [
    query('type').optional().isString(),
    query('platform').optional().isString(),
    query('category').optional().isString()
  ],
  validate,
  aiContentController.getTemplates
);

// Save content template
router.post('/templates',
  authenticate,
  rateLimiter.standard,
  [
    body('name').notEmpty().isString(),
    body('type').isString(),
    body('template').notEmpty().isString(),
    body('variables').optional().isArray(),
    body('category').optional().isString(),
    body('isPublic').optional().isBoolean()
  ],
  validate,
  aiContentController.saveTemplate
);

// Generate from template
router.post('/templates/:templateId/generate',
  authenticate,
  rateLimiter.ai,
  [
    param('templateId').isUUID(),
    body('variables').isObject()
  ],
  validate,
  aiContentController.generateFromTemplate
);

// Get AI providers status
router.get('/providers/status',
  authenticate,
  rateLimiter.standard,
  aiContentController.getProvidersStatus
);

// Switch AI provider
router.post('/providers/switch',
  authenticate,
  authorize(['admin']),
  rateLimiter.standard,
  [
    body('provider').isIn(['openai', 'anthropic', 'google', 'custom']),
    body('model').optional().isString()
  ],
  validate,
  aiContentController.switchProvider
);

// Get generation history
router.get('/history',
  authenticate,
  rateLimiter.standard,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('type').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  aiContentController.getHistory
);

// Rate content
router.post('/rate/:contentId',
  authenticate,
  rateLimiter.standard,
  [
    param('contentId').isUUID(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('feedback').optional().isString()
  ],
  validate,
  aiContentController.rateContent
);

// Batch generate
router.post('/batch',
  authenticate,
  authorize(['pro', 'enterprise']),
  rateLimiter.strict,
  [
    body('requests').isArray().isLength({ min: 1, max: 50 }),
    body('requests.*.prompt').notEmpty().isString(),
    body('requests.*.type').isString()
  ],
  validate,
  aiContentController.batchGenerate
);

module.exports = router;