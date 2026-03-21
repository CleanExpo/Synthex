import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import PostService, { 
  CreatePostSchema, 
  UpdatePostSchema, 
  BatchCreatePostSchema, 
  PublishPostSchema 
} from '../services/posts';
import { apiResponse } from '../utils/apiResponse';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * @route   GET /api/posts
 * @desc    Get all posts for the authenticated user with filtering
 * @access  Private
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      platform, 
      status, 
      campaignId, 
      startDate, 
      endDate,
      page = '1', 
      limit = '10',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const options: any = {
      platform: platform as string,
      status: status as string,
      campaignId: campaignId as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as 'createdAt' | 'scheduledAt' | 'publishedAt',
      sortOrder: sortOrder as 'asc' | 'desc'
    };
    
    // Parse date filters
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);
    
    const result = await PostService.getUserPosts(req.user!.id, options);
    
    return apiResponse.success(res, result, 'Posts retrieved successfully');
  } catch (error) {
    console.error('Error fetching posts:', error);
    return apiResponse.error(res, 'Failed to fetch posts');
  }
});

/**
 * @route   POST /api/posts
 * @desc    Create a new post
 * @access  Private
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const post = await PostService.create(req.user!.id, req.body);
    return apiResponse.created(res, post, 'Post created successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'Campaign not found') {
      return apiResponse.notFound(res, 'Campaign not found');
    }
    console.error('Error creating post:', error);
    return apiResponse.error(res, 'Failed to create post');
  }
});

/**
 * @route   POST /api/posts/batch
 * @desc    Batch create posts
 * @access  Private
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const posts = await PostService.batchCreate(req.user!.id, req.body);
    return apiResponse.created(res, posts, `${posts.length} posts created successfully`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'One or more campaigns not found') {
      return apiResponse.notFound(res, 'One or more campaigns not found');
    }
    console.error('Error batch creating posts:', error);
    return apiResponse.error(res, 'Failed to create posts');
  }
});

/**
 * @route   GET /api/posts/statistics
 * @desc    Get post statistics for the user
 * @access  Private
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const stats = await PostService.getStatistics(req.user!.id);
    return apiResponse.success(res, stats, 'Statistics retrieved successfully');
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return apiResponse.error(res, 'Failed to fetch statistics');
  }
});

/**
 * @route   GET /api/posts/calendar
 * @desc    Get posts for calendar view
 * @access  Private
 */
router.get('/calendar', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, platform } = req.query;
    
    if (!startDate || !endDate) {
      return apiResponse.error(res, 'Start date and end date are required', 400);
    }
    
    const posts = await PostService.getCalendarPosts(
      req.user!.id,
      new Date(startDate as string),
      new Date(endDate as string),
      platform as string
    );
    
    return apiResponse.success(res, posts, 'Calendar posts retrieved successfully');
  } catch (error) {
    console.error('Error fetching calendar posts:', error);
    return apiResponse.error(res, 'Failed to fetch calendar posts');
  }
});

/**
 * @route   GET /api/posts/scheduled
 * @desc    Get scheduled posts that need to be published
 * @access  Private
 */
router.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const posts = await PostService.getScheduledPosts(req.user!.id);
    return apiResponse.success(res, posts, 'Scheduled posts retrieved successfully');
  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
    return apiResponse.error(res, 'Failed to fetch scheduled posts');
  }
});

/**
 * @route   GET /api/posts/:id
 * @desc    Get a single post by ID
 * @access  Private
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const post = await PostService.getById(req.params.id as string, req.user!.id);
    
    if (!post) {
      return apiResponse.notFound(res, 'Post not found');
    }
    
    return apiResponse.success(res, post, 'Post retrieved successfully');
  } catch (error) {
    console.error('Error fetching post:', error);
    return apiResponse.error(res, 'Failed to fetch post');
  }
});

/**
 * @route   PUT /api/posts/:id
 * @desc    Update a post
 * @access  Private
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const post = await PostService.update(
      req.params.id as string,
      req.user!.id,
      req.body
    );
    
    return apiResponse.success(res, post, 'Post updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'Post not found') {
      return apiResponse.notFound(res, 'Post not found');
    }
    if ((error as Error).message === 'Campaign not found') {
      return apiResponse.notFound(res, 'Campaign not found');
    }
    console.error('Error updating post:', error);
    return apiResponse.error(res, 'Failed to update post');
  }
});

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete a post
 * @access  Private
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await PostService.delete(req.params.id as string, req.user!.id);
    return apiResponse.success(res, null, 'Post deleted successfully');
  } catch (error) {
    if ((error as Error).message === 'Post not found') {
      return apiResponse.notFound(res, 'Post not found');
    }
    console.error('Error deleting post:', error);
    return apiResponse.error(res, 'Failed to delete post');
  }
});

/**
 * @route   POST /api/posts/:id/publish
 * @desc    Publish a post to platform
 * @access  Private
 */
router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const post = await PostService.publish(
      req.params.id as string,
      req.user!.id,
      req.body
    );
    
    return apiResponse.success(res, post, 'Post published successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'Post not found') {
      return apiResponse.notFound(res, 'Post not found');
    }
    console.error('Error publishing post:', error);
    return apiResponse.error(res, 'Failed to publish post');
  }
});

/**
 * @route   POST /api/posts/:id/duplicate
 * @desc    Duplicate a post
 * @access  Private
 */
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const post = await PostService.duplicate(req.params.id as string, req.user!.id);
    return apiResponse.created(res, post, 'Post duplicated successfully');
  } catch (error) {
    if ((error as Error).message === 'Post not found') {
      return apiResponse.notFound(res, 'Post not found');
    }
    console.error('Error duplicating post:', error);
    return apiResponse.error(res, 'Failed to duplicate post');
  }
});

/**
 * @route   PUT /api/posts/:id/analytics
 * @desc    Update post analytics
 * @access  Private
 */
router.put('/:id/analytics', async (req: Request, res: Response) => {
  try {
    // Verify ownership first
    const post = await PostService.getById(req.params.id as string, req.user!.id);
    if (!post) {
      return apiResponse.notFound(res, 'Post not found');
    }
    
    const updated = await PostService.updateAnalytics(req.params.id as string, req.body);
    return apiResponse.success(res, updated, 'Analytics updated successfully');
  } catch (error) {
    console.error('Error updating analytics:', error);
    return apiResponse.error(res, 'Failed to update analytics');
  }
});

/**
 * @route   PUT /api/posts/:id/publish-status
 * @desc    Mark a post as published or failed
 * @access  Private
 */
router.put('/:id/publish-status', async (req: Request, res: Response) => {
  try {
    const { status, errorMessage } = req.body;
    
    if (!status || !['published', 'failed'].includes(status)) {
      return apiResponse.error(res, 'Invalid status. Must be "published" or "failed"', 400);
    }
    
    let post;
    if (status === 'published') {
      post = await PostService.markAsPublished(req.params.id as string);
    } else {
      post = await PostService.markAsFailed(req.params.id as string, errorMessage);
    }
    
    return apiResponse.success(res, post, `Post marked as ${status} successfully`);
  } catch (error) {
    if ((error as Error).message === 'Post not found') {
      return apiResponse.notFound(res, 'Post not found');
    }
    console.error('Error updating publish status:', error);
    return apiResponse.error(res, 'Failed to update publish status');
  }
});

/**
 * @route   POST /api/posts/platforms/configure
 * @desc    Configure platform credentials for user
 * @access  Private
 */
router.post('/platforms/configure', async (req: Request, res: Response) => {
  try {
    const { platform, config } = req.body;
    
    if (!platform || !config) {
      return apiResponse.error(res, 'Platform and config are required', 400);
    }
    
    const success = await PostService.configurePlatform(req.user!.id, platform, config);
    
    if (success) {
      return apiResponse.success(res, { configured: true }, 'Platform configured successfully');
    } else {
      return apiResponse.error(res, 'Failed to configure platform');
    }
  } catch (error) {
    console.error('Error configuring platform:', error);
    return apiResponse.error(res, 'Failed to configure platform');
  }
});

/**
 * @route   GET /api/posts/platforms/test/:platform
 * @desc    Test platform connection
 * @access  Private
 */
router.get('/platforms/test/:platform', async (req: Request, res: Response) => {
  try {
    const platform = req.params.platform as string;
    
    const result = await PostService.testPlatformConnection(req.user!.id, platform);
    
    if (result.success) {
      return apiResponse.success(res, { connected: true }, 'Platform connection successful');
    } else {
      return apiResponse.error(res, result.error || 'Connection test failed', 400);
    }
  } catch (error) {
    console.error('Error testing platform connection:', error);
    return apiResponse.error(res, 'Failed to test platform connection');
  }
});

/**
 * @route   POST /api/posts/:id/publish-to-platform
 * @desc    Publish post directly to platform
 * @access  Private
 */
router.post('/:id/publish-to-platform', async (req: Request, res: Response) => {
  try {
    const result = await PostService.publishToPlatform(req.params.id as string, req.user!.id);
    
    if (result.success) {
      return apiResponse.success(res, { 
        published: true, 
        url: result.url 
      }, 'Post published to platform successfully');
    } else {
      return apiResponse.error(res, result.error || 'Failed to publish to platform');
    }
  } catch (error) {
    console.error('Error publishing to platform:', error);
    return apiResponse.error(res, 'Failed to publish to platform');
  }
});

/**
 * @route   POST /api/posts/:id/sync-analytics
 * @desc    Sync analytics from platform
 * @access  Private
 */
router.post('/:id/sync-analytics', async (req: Request, res: Response) => {
  try {
    const result = await PostService.syncPlatformAnalytics(req.params.id as string, req.user!.id);
    
    if (result.success) {
      return apiResponse.success(res, result.analytics, 'Analytics synced successfully');
    } else {
      return apiResponse.error(res, result.error || 'Failed to sync analytics');
    }
  } catch (error) {
    console.error('Error syncing analytics:', error);
    return apiResponse.error(res, 'Failed to sync analytics');
  }
});

/**
 * @route   POST /api/posts/analytics/bulk-sync
 * @desc    Bulk sync analytics for all user's published posts
 * @access  Private
 */
router.post('/analytics/bulk-sync', async (req: Request, res: Response) => {
  try {
    const result = await PostService.bulkSyncAnalytics(req.user!.id);
    
    return apiResponse.success(res, result, `Synced ${result.synced} posts, ${result.failed} failed`);
  } catch (error) {
    console.error('Error bulk syncing analytics:', error);
    return apiResponse.error(res, 'Failed to bulk sync analytics');
  }
});

/**
 * @route   GET /api/posts/platforms/supported
 * @desc    Get list of supported platforms
 * @access  Private
 */
router.get('/platforms/supported', async (req: Request, res: Response) => {
  try {
    const supported = PostService.getSupportedPlatforms();
    const implemented = PostService.getImplementedPlatforms();
    
    return apiResponse.success(res, {
      supported,
      implemented,
      status: supported.map(platform => ({
        platform,
        implemented: implemented.includes(platform),
        ready: implemented.includes(platform)
      }))
    }, 'Platform information retrieved successfully');
  } catch (error) {
    console.error('Error getting platform information:', error);
    return apiResponse.error(res, 'Failed to get platform information');
  }
});

export default router;
