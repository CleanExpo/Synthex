/**
 * White-label Routes
 * Endpoints for multi-tenant and white-label management
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const whiteLabelController = require('../controllers/white-label.controller');
const { authenticate, authorizeTenant, authorizeAdmin } = require('../middleware/auth');
const rateLimiter = require('../middleware/rate-limiter');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Create tenant
router.post('/tenants',
  authenticate,
  authorizeAdmin,
  rateLimiter.strict,
  [
    body('name').notEmpty().isString(),
    body('companyName').notEmpty().isString(),
    body('subdomain').notEmpty().matches(/^[a-z0-9-]+$/),
    body('customDomain').optional().isFQDN(),
    body('tier').isIn(['starter', 'professional', 'enterprise']),
    body('config').isObject(),
    body('adminEmail').isEmail()
  ],
  validate,
  whiteLabelController.createTenant
);

// Get all tenants
router.get('/tenants',
  authenticate,
  authorizeAdmin,
  rateLimiter.standard,
  [
    query('status').optional().isIn(['provisioning', 'active', 'suspended', 'terminated']),
    query('tier').optional().isString(),
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  whiteLabelController.getTenants
);

// Get tenant details
router.get('/tenants/:tenantId',
  authenticate,
  authorizeTenant,
  rateLimiter.standard,
  [
    param('tenantId').isString()
  ],
  validate,
  whiteLabelController.getTenant
);

// Update tenant
router.put('/tenants/:tenantId',
  authenticate,
  authorizeTenant(['owner', 'admin']),
  rateLimiter.standard,
  [
    param('tenantId').isString(),
    body('name').optional().isString(),
    body('companyName').optional().isString(),
    body('customDomain').optional().isFQDN(),
    body('config').optional().isObject()
  ],
  validate,
  whiteLabelController.updateTenant
);

// Suspend tenant
router.post('/tenants/:tenantId/suspend',
  authenticate,
  authorizeAdmin,
  rateLimiter.strict,
  [
    param('tenantId').isString(),
    body('reason').notEmpty().isString()
  ],
  validate,
  whiteLabelController.suspendTenant
);

// Reactivate tenant
router.post('/tenants/:tenantId/reactivate',
  authenticate,
  authorizeAdmin,
  rateLimiter.strict,
  [
    param('tenantId').isString()
  ],
  validate,
  whiteLabelController.reactivateTenant
);

// Terminate tenant
router.delete('/tenants/:tenantId',
  authenticate,
  authorizeAdmin,
  rateLimiter.strict,
  [
    param('tenantId').isString(),
    body('confirmation').equals('DELETE_TENANT'),
    body('backupData').optional().isBoolean()
  ],
  validate,
  whiteLabelController.terminateTenant
);

// Get tenant branding
router.get('/tenants/:tenantId/branding',
  rateLimiter.standard,
  [
    param('tenantId').isString()
  ],
  validate,
  whiteLabelController.getBranding
);

// Update tenant branding
router.put('/tenants/:tenantId/branding',
  authenticate,
  authorizeTenant(['owner', 'admin']),
  rateLimiter.standard,
  [
    param('tenantId').isString(),
    body('logoUrl').optional().isURL(),
    body('faviconUrl').optional().isURL(),
    body('primaryColor').optional().matches(/^#[0-9A-F]{6}$/i),
    body('secondaryColor').optional().matches(/^#[0-9A-F]{6}$/i),
    body('accentColor').optional().matches(/^#[0-9A-F]{6}$/i),
    body('fontHeading').optional().isString(),
    body('fontBody').optional().isString(),
    body('customCss').optional().isString()
  ],
  validate,
  whiteLabelController.updateBranding
);

// Get tenant features
router.get('/tenants/:tenantId/features',
  authenticate,
  authorizeTenant,
  rateLimiter.standard,
  [
    param('tenantId').isString()
  ],
  validate,
  whiteLabelController.getFeatures
);

// Update tenant features
router.put('/tenants/:tenantId/features',
  authenticate,
  authorizeTenant(['owner']),
  rateLimiter.standard,
  [
    param('tenantId').isString(),
    body('features').isObject()
  ],
  validate,
  whiteLabelController.updateFeatures
);

// Get tenant API keys
router.get('/tenants/:tenantId/api-keys',
  authenticate,
  authorizeTenant(['owner', 'admin']),
  rateLimiter.standard,
  [
    param('tenantId').isString(),
    query('type').optional().isIn(['master', 'read', 'write', 'custom'])
  ],
  validate,
  whiteLabelController.getApiKeys
);

// Create tenant API key
router.post('/tenants/:tenantId/api-keys',
  authenticate,
  authorizeTenant(['owner', 'admin']),
  rateLimiter.strict,
  [
    param('tenantId').isString(),
    body('name').notEmpty().isString(),
    body('type').isIn(['read', 'write', 'custom']),
    body('permissions').optional().isArray(),
    body('rateLimit').optional().isInt({ min: 1, max: 10000 }),
    body('expiresAt').optional().isISO8601()
  ],
  validate,
  whiteLabelController.createApiKey
);

// Revoke API key
router.delete('/tenants/:tenantId/api-keys/:keyId',
  authenticate,
  authorizeTenant(['owner', 'admin']),
  rateLimiter.standard,
  [
    param('tenantId').isString(),
    param('keyId').isString()
  ],
  validate,
  whiteLabelController.revokeApiKey
);

// Configure SSO
router.post('/tenants/:tenantId/sso',
  authenticate,
  authorizeTenant(['owner']),
  rateLimiter.strict,
  [
    param('tenantId').isString(),
    body('provider').isIn(['saml', 'oauth', 'ldap', 'custom']),
    body('config').isObject(),
    body('enabled').isBoolean()
  ],
  validate,
  whiteLabelController.configureSso
);

// Get SSO configuration
router.get('/tenants/:tenantId/sso',
  authenticate,
  authorizeTenant(['owner', 'admin']),
  rateLimiter.standard,
  [
    param('tenantId').isString()
  ],
  validate,
  whiteLabelController.getSsoConfig
);

// Test SSO configuration
router.post('/tenants/:tenantId/sso/test',
  authenticate,
  authorizeTenant(['owner', 'admin']),
  rateLimiter.standard,
  [
    param('tenantId').isString()
  ],
  validate,
  whiteLabelController.testSsoConfig
);

// Get tenant usage
router.get('/tenants/:tenantId/usage',
  authenticate,
  authorizeTenant,
  rateLimiter.standard,
  [
    param('tenantId').isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('metrics').optional().isArray()
  ],
  validate,
  whiteLabelController.getUsage
);

// Get tenant billing
router.get('/tenants/:tenantId/billing',
  authenticate,
  authorizeTenant(['owner', 'billing']),
  rateLimiter.standard,
  [
    param('tenantId').isString()
  ],
  validate,
  whiteLabelController.getBilling
);

// Update billing
router.put('/tenants/:tenantId/billing',
  authenticate,
  authorizeTenant(['owner']),
  rateLimiter.strict,
  [
    param('tenantId').isString(),
    body('tier').optional().isIn(['starter', 'professional', 'enterprise']),
    body('paymentMethod').optional().isObject()
  ],
  validate,
  whiteLabelController.updateBilling
);

// Create custom module
router.post('/tenants/:tenantId/modules',
  authenticate,
  authorizeTenant(['owner', 'admin']),
  rateLimiter.strict,
  [
    param('tenantId').isString(),
    body('name').notEmpty().isString(),
    body('type').isString(),
    body('config').isObject(),
    body('version').optional().isString()
  ],
  validate,
  whiteLabelController.createModule
);

// Get custom modules
router.get('/tenants/:tenantId/modules',
  authenticate,
  authorizeTenant,
  rateLimiter.standard,
  [
    param('tenantId').isString(),
    query('status').optional().isIn(['inactive', 'deploying', 'active', 'failed', 'deprecated'])
  ],
  validate,
  whiteLabelController.getModules
);

// Deploy module
router.post('/tenants/:tenantId/modules/:moduleId/deploy',
  authenticate,
  authorizeTenant(['owner', 'admin']),
  rateLimiter.strict,
  [
    param('tenantId').isString(),
    param('moduleId').isString()
  ],
  validate,
  whiteLabelController.deployModule
);

// Export tenant data
router.post('/tenants/:tenantId/export',
  authenticate,
  authorizeTenant(['owner']),
  rateLimiter.strict,
  [
    param('tenantId').isString(),
    body('format').isIn(['json', 'csv', 'zip']),
    body('includeUsers').optional().isBoolean(),
    body('includeContent').optional().isBoolean(),
    body('includeAnalytics').optional().isBoolean()
  ],
  validate,
  whiteLabelController.exportTenantData
);

module.exports = router;