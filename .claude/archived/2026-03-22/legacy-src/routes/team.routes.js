/**
 * Team Collaboration Routes
 * Endpoints for team management and collaboration
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const teamController = require('../controllers/team.controller');
const { authenticate, authorize, checkTeamAccess } = require('../middleware/auth');
const rateLimiter = require('../middleware/rate-limiter');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Create team
router.post('/',
  authenticate,
  rateLimiter.standard,
  [
    body('name').notEmpty().isString().isLength({ min: 2, max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
    body('type').optional().isIn(['marketing', 'content', 'social', 'enterprise']),
    body('settings').optional().isObject()
  ],
  validate,
  teamController.createTeam
);

// Get user's teams
router.get('/my-teams',
  authenticate,
  rateLimiter.standard,
  [
    query('role').optional().isIn(['owner', 'admin', 'manager', 'editor', 'viewer', 'contributor']),
    query('active').optional().isBoolean()
  ],
  validate,
  teamController.getMyTeams
);

// Get team details
router.get('/:teamId',
  authenticate,
  checkTeamAccess(),
  rateLimiter.standard,
  [
    param('teamId').isUUID()
  ],
  validate,
  teamController.getTeam
);

// Update team
router.put('/:teamId',
  authenticate,
  checkTeamAccess(['owner', 'admin']),
  rateLimiter.standard,
  [
    param('teamId').isUUID(),
    body('name').optional().isString().isLength({ min: 2, max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
    body('settings').optional().isObject()
  ],
  validate,
  teamController.updateTeam
);

// Delete team
router.delete('/:teamId',
  authenticate,
  checkTeamAccess(['owner']),
  rateLimiter.strict,
  [
    param('teamId').isUUID()
  ],
  validate,
  teamController.deleteTeam
);

// Get team members
router.get('/:teamId/members',
  authenticate,
  checkTeamAccess(),
  rateLimiter.standard,
  [
    param('teamId').isUUID(),
    query('role').optional().isString(),
    query('status').optional().isIn(['active', 'inactive', 'pending'])
  ],
  validate,
  teamController.getMembers
);

// Add team member
router.post('/:teamId/members',
  authenticate,
  checkTeamAccess(['owner', 'admin', 'manager']),
  rateLimiter.standard,
  [
    param('teamId').isUUID(),
    body('email').isEmail(),
    body('role').isIn(['admin', 'manager', 'editor', 'viewer', 'contributor']),
    body('permissions').optional().isArray()
  ],
  validate,
  teamController.addMember
);

// Update member role
router.put('/:teamId/members/:userId',
  authenticate,
  checkTeamAccess(['owner', 'admin']),
  rateLimiter.standard,
  [
    param('teamId').isUUID(),
    param('userId').isUUID(),
    body('role').isIn(['admin', 'manager', 'editor', 'viewer', 'contributor']),
    body('permissions').optional().isArray()
  ],
  validate,
  teamController.updateMember
);

// Remove team member
router.delete('/:teamId/members/:userId',
  authenticate,
  checkTeamAccess(['owner', 'admin']),
  rateLimiter.standard,
  [
    param('teamId').isUUID(),
    param('userId').isUUID()
  ],
  validate,
  teamController.removeMember
);

// Get team activity
router.get('/:teamId/activity',
  authenticate,
  checkTeamAccess(),
  rateLimiter.standard,
  [
    param('teamId').isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('userId').optional().isUUID(),
    query('type').optional().isString()
  ],
  validate,
  teamController.getActivity
);

// Create team workspace
router.post('/:teamId/workspaces',
  authenticate,
  checkTeamAccess(['owner', 'admin', 'manager']),
  rateLimiter.standard,
  [
    param('teamId').isUUID(),
    body('name').notEmpty().isString(),
    body('type').isIn(['project', 'campaign', 'content', 'general']),
    body('description').optional().isString(),
    body('members').optional().isArray()
  ],
  validate,
  teamController.createWorkspace
);

// Get team workspaces
router.get('/:teamId/workspaces',
  authenticate,
  checkTeamAccess(),
  rateLimiter.standard,
  [
    param('teamId').isUUID(),
    query('type').optional().isString(),
    query('active').optional().isBoolean()
  ],
  validate,
  teamController.getWorkspaces
);

// Team notifications
router.get('/:teamId/notifications',
  authenticate,
  checkTeamAccess(),
  rateLimiter.standard,
  [
    param('teamId').isUUID(),
    query('unread').optional().isBoolean(),
    query('type').optional().isString()
  ],
  validate,
  teamController.getNotifications
);

// Send team notification
router.post('/:teamId/notifications',
  authenticate,
  checkTeamAccess(['owner', 'admin', 'manager']),
  rateLimiter.standard,
  [
    param('teamId').isUUID(),
    body('title').notEmpty().isString(),
    body('message').notEmpty().isString(),
    body('type').isIn(['info', 'warning', 'success', 'error']),
    body('recipients').optional().isArray()
  ],
  validate,
  teamController.sendNotification
);

// Team permissions
router.get('/:teamId/permissions',
  authenticate,
  checkTeamAccess(['owner', 'admin']),
  rateLimiter.standard,
  [
    param('teamId').isUUID()
  ],
  validate,
  teamController.getPermissions
);

// Update team permissions
router.put('/:teamId/permissions',
  authenticate,
  checkTeamAccess(['owner']),
  rateLimiter.standard,
  [
    param('teamId').isUUID(),
    body('permissions').isObject()
  ],
  validate,
  teamController.updatePermissions
);

// Team billing
router.get('/:teamId/billing',
  authenticate,
  checkTeamAccess(['owner', 'admin']),
  rateLimiter.standard,
  [
    param('teamId').isUUID()
  ],
  validate,
  teamController.getBilling
);

// Team audit log
router.get('/:teamId/audit',
  authenticate,
  checkTeamAccess(['owner', 'admin']),
  rateLimiter.standard,
  [
    param('teamId').isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('action').optional().isString(),
    query('userId').optional().isUUID()
  ],
  validate,
  teamController.getAuditLog
);

module.exports = router;