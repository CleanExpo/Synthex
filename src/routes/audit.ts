import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import AuditService, { AuditLogFiltersSchema } from '../services/audit';
import { apiResponse } from '../utils/apiResponse';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Middleware to check admin role (in production, implement proper role checking)
const requireAdmin = (req: Request, res: Response, next: Function) => {
  // For now, allow all authenticated users to view audit logs
  // In production, implement proper role-based access control
  const userRole = (req.user as any)?.role || 'user';
  
  if (userRole !== 'admin' && userRole !== 'superadmin') {
    return apiResponse.error(res, 'Insufficient permissions to access audit logs', 403);
  }
  
  next();
};

/**
 * @route   GET /api/v1/audit/logs
 * @desc    Get audit logs with filtering (admin only)
 * @access  Private (Admin)
 */
router.get('/logs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    
    // Parse query parameters
    if (req.query.userId) filters.userId = req.query.userId as string;
    if (req.query.action) filters.action = req.query.action as string;
    if (req.query.resource) filters.resource = req.query.resource as string;
    
    if (req.query.severity && ['low', 'medium', 'high', 'critical'].includes(req.query.severity as string)) {
      filters.severity = req.query.severity;
    }
    
    if (req.query.category && ['auth', 'data', 'system', 'security', 'compliance', 'api'].includes(req.query.category as string)) {
      filters.category = req.query.category;
    }
    
    if (req.query.outcome && ['success', 'failure', 'warning'].includes(req.query.outcome as string)) {
      filters.outcome = req.query.outcome;
    }
    
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
    if (req.query.page) filters.page = parseInt(req.query.page as string);
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
    
    if (req.query.sortBy && ['createdAt', 'action', 'severity', 'outcome'].includes(req.query.sortBy as string)) {
      filters.sortBy = req.query.sortBy;
    }
    
    if (req.query.sortOrder && ['asc', 'desc'].includes(req.query.sortOrder as string)) {
      filters.sortOrder = req.query.sortOrder;
    }
    
    const result = await AuditService.getLogs(filters);
    
    return apiResponse.success(res, result, 'Audit logs retrieved successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    console.error('Error fetching audit logs:', error);
    return apiResponse.error(res, 'Failed to fetch audit logs');
  }
});

/**
 * @route   GET /api/v1/audit/logs/:id
 * @desc    Get a single audit log by ID (admin only)
 * @access  Private (Admin)
 */
router.get('/logs/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const auditLog = await AuditService.getById(req.params.id as string);
    
    if (!auditLog) {
      return apiResponse.notFound(res, 'Audit log not found');
    }
    
    return apiResponse.success(res, auditLog, 'Audit log retrieved successfully');
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return apiResponse.error(res, 'Failed to fetch audit log');
  }
});

/**
 * @route   GET /api/v1/audit/stats
 * @desc    Get audit log statistics (admin only)
 * @access  Private (Admin)
 */
router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (req.query.startDate) startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) endDate = new Date(req.query.endDate as string);
    
    const stats = await AuditService.getStats(startDate, endDate);
    
    return apiResponse.success(res, stats, 'Audit statistics retrieved successfully');
  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    return apiResponse.error(res, 'Failed to fetch audit statistics');
  }
});

/**
 * @route   POST /api/v1/audit/cleanup
 * @desc    Clean up old audit logs (admin only)
 * @access  Private (Admin)
 */
router.post('/cleanup', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { retentionDays = 365 } = req.body;
    
    if (typeof retentionDays !== 'number' || retentionDays < 30) {
      return apiResponse.error(res, 'Retention days must be a number greater than 30', 400);
    }
    
    const deletedCount = await AuditService.cleanup(retentionDays);
    
    // Log the cleanup action
    await AuditService.log({
      userId: req.user!.id,
      action: 'audit_cleanup_initiated',
      resource: 'audit_logs',
      details: { retentionDays, deletedCount },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'medium',
      category: 'system',
      outcome: 'success'
    });
    
    return apiResponse.success(res, { deletedCount }, `${deletedCount} old audit logs cleaned up`);
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    return apiResponse.error(res, 'Failed to cleanup audit logs');
  }
});

/**
 * @route   GET /api/v1/audit/user/:userId
 * @desc    Get audit logs for a specific user (admin only, or own logs)
 * @access  Private
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const requestedUserId = req.params.userId as string;
    const currentUserId = req.user!.id;
    const userRole = (req.user as any)?.role || 'user';
    
    // Users can only access their own audit logs unless they're admin
    if (requestedUserId !== currentUserId && userRole !== 'admin' && userRole !== 'superadmin') {
      return apiResponse.error(res, 'Insufficient permissions', 403);
    }
    
    const filters: any = {
      userId: requestedUserId
    };
    
    // Parse additional filters
    if (req.query.page) filters.page = parseInt(req.query.page as string);
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
    
    const result = await AuditService.getLogs(filters);
    
    return apiResponse.success(res, result, 'User audit logs retrieved successfully');
  } catch (error) {
    console.error('Error fetching user audit logs:', error);
    return apiResponse.error(res, 'Failed to fetch user audit logs');
  }
});

/**
 * @route   POST /api/v1/audit/log
 * @desc    Create a manual audit log entry (admin only)
 * @access  Private (Admin)
 */
router.post('/log', requireAdmin, async (req: Request, res: Response) => {
  try {
    const auditLog = await AuditService.log({
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return apiResponse.created(res, auditLog, 'Audit log created successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    console.error('Error creating audit log:', error);
    return apiResponse.error(res, 'Failed to create audit log');
  }
});

export default router;
