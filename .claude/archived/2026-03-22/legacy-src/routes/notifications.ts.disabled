import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import NotificationService, { 
  CreateNotificationSchema,
  UpdateNotificationSchema, 
  NotificationFiltersSchema
} from '../services/notification';
import { apiResponse } from '../utils/apiResponse';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * @route   GET /api/v1/notifications
 * @desc    Get all notifications for the authenticated user
 * @access  Private
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    
    if (req.query.type && ['info', 'success', 'warning', 'error', 'platform', 'system'].includes(req.query.type as string)) {
      filters.type = req.query.type;
    }
    
    if (req.query.read === 'true') filters.read = true;
    if (req.query.read === 'false') filters.read = false;
    
    if (req.query.priority && ['low', 'medium', 'high', 'critical'].includes(req.query.priority as string)) {
      filters.priority = req.query.priority;
    }
    
    if (req.query.page) filters.page = parseInt(req.query.page as string);
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
    
    if (req.query.sortBy && ['createdAt', 'priority', 'type'].includes(req.query.sortBy as string)) {
      filters.sortBy = req.query.sortBy;
    }
    
    if (req.query.sortOrder && ['asc', 'desc'].includes(req.query.sortOrder as string)) {
      filters.sortOrder = req.query.sortOrder;
    }
    
    const result = await NotificationService.getUserNotifications(req.user!.id, filters);
    
    return apiResponse.success(res, result, 'Notifications retrieved successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    console.error('Error fetching notifications:', error);
    return apiResponse.error(res, 'Failed to fetch notifications');
  }
});

/**
 * @route   POST /api/v1/notifications
 * @desc    Create a new notification (admin only)
 * @access  Private
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // For now, allow users to create notifications for themselves
    // In production, this might be restricted to admin users
    const notification = await NotificationService.create(req.user!.id, req.body);
    
    return apiResponse.created(res, notification, 'Notification created successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    console.error('Error creating notification:', error);
    return apiResponse.error(res, 'Failed to create notification');
  }
});

/**
 * @route   GET /api/v1/notifications/stats
 * @desc    Get notification statistics for the user
 * @access  Private
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await NotificationService.getStats(req.user!.id);
    return apiResponse.success(res, stats, 'Notification statistics retrieved successfully');
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    return apiResponse.error(res, 'Failed to fetch notification statistics');
  }
});

/**
 * @route   GET /api/v1/notifications/:id
 * @desc    Get a single notification by ID
 * @access  Private
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const notification = await NotificationService.getById(req.params.id, req.user!.id);
    
    if (!notification) {
      return apiResponse.notFound(res, 'Notification not found');
    }
    
    return apiResponse.success(res, notification, 'Notification retrieved successfully');
  } catch (error) {
    console.error('Error fetching notification:', error);
    return apiResponse.error(res, 'Failed to fetch notification');
  }
});

/**
 * @route   PUT /api/v1/notifications/:id
 * @desc    Update a notification (mark as read, archive, etc.)
 * @access  Private
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const notification = await NotificationService.update(
      req.params.id,
      req.user!.id,
      req.body
    );
    
    return apiResponse.success(res, notification, 'Notification updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'Notification not found') {
      return apiResponse.notFound(res, 'Notification not found');
    }
    console.error('Error updating notification:', error);
    return apiResponse.error(res, 'Failed to update notification');
  }
});

/**
 * @route   PUT /api/v1/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const notification = await NotificationService.markAsRead(req.params.id, req.user!.id);
    return apiResponse.success(res, notification, 'Notification marked as read');
  } catch (error) {
    if ((error as Error).message === 'Notification not found') {
      return apiResponse.notFound(res, 'Notification not found');
    }
    console.error('Error marking notification as read:', error);
    return apiResponse.error(res, 'Failed to mark notification as read');
  }
});

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const count = await NotificationService.markAllAsRead(req.user!.id);
    return apiResponse.success(res, { count }, `${count} notifications marked as read`);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return apiResponse.error(res, 'Failed to mark notifications as read');
  }
});

/**
 * @route   PUT /api/v1/notifications/:id/archive
 * @desc    Archive a notification
 * @access  Private
 */
router.put('/:id/archive', async (req: Request, res: Response) => {
  try {
    const notification = await NotificationService.archive(req.params.id, req.user!.id);
    return apiResponse.success(res, notification, 'Notification archived');
  } catch (error) {
    if ((error as Error).message === 'Notification not found') {
      return apiResponse.notFound(res, 'Notification not found');
    }
    console.error('Error archiving notification:', error);
    return apiResponse.error(res, 'Failed to archive notification');
  }
});

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await NotificationService.delete(req.params.id, req.user!.id);
    return apiResponse.success(res, null, 'Notification deleted successfully');
  } catch (error) {
    if ((error as Error).message === 'Notification not found') {
      return apiResponse.notFound(res, 'Notification not found');
    }
    console.error('Error deleting notification:', error);
    return apiResponse.error(res, 'Failed to delete notification');
  }
});

/**
 * @route   DELETE /api/v1/notifications/archived
 * @desc    Delete all archived notifications
 * @access  Private
 */
router.delete('/archived', async (req: Request, res: Response) => {
  try {
    const count = await NotificationService.deleteArchived(req.user!.id);
    return apiResponse.success(res, { count }, `${count} archived notifications deleted`);
  } catch (error) {
    console.error('Error deleting archived notifications:', error);
    return apiResponse.error(res, 'Failed to delete archived notifications');
  }
});

/**
 * @route   POST /api/v1/notifications/system
 * @desc    Create a system notification
 * @access  Private
 */
router.post('/system', async (req: Request, res: Response) => {
  try {
    const { title, message, priority = 'medium' } = req.body;
    
    if (!title || !message) {
      return apiResponse.error(res, 'Title and message are required', 400);
    }
    
    const notification = await NotificationService.createSystemNotification(
      req.user!.id,
      title,
      message,
      priority
    );
    
    return apiResponse.created(res, notification, 'System notification created successfully');
  } catch (error) {
    console.error('Error creating system notification:', error);
    return apiResponse.error(res, 'Failed to create system notification');
  }
});

/**
 * @route   POST /api/v1/notifications/schedule
 * @desc    Schedule a notification
 * @access  Private
 */
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const { scheduledFor, ...notificationData } = req.body;
    
    if (!scheduledFor) {
      return apiResponse.error(res, 'scheduledFor is required', 400);
    }
    
    const notification = await NotificationService.scheduleNotification(
      req.user!.id,
      notificationData,
      new Date(scheduledFor)
    );
    
    return apiResponse.created(res, notification, 'Notification scheduled successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    console.error('Error scheduling notification:', error);
    return apiResponse.error(res, 'Failed to schedule notification');
  }
});

export default router;
