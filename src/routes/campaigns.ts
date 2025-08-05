import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import CampaignService, { CreateCampaignSchema, UpdateCampaignSchema } from '../services/campaign';
import { apiResponse } from '../utils/apiResponse';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * @route   GET /api/campaigns
 * @desc    Get all campaigns for the authenticated user
 * @access  Private
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, platform, page = '1', limit = '10' } = req.query;
    
    const result = await CampaignService.getUserCampaigns(req.user!.id, {
      status: status as string,
      platform: platform as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    });
    
    return apiResponse.success(res, result, 'Campaigns retrieved successfully');
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return apiResponse.error(res, 'Failed to fetch campaigns');
  }
});

/**
 * @route   POST /api/campaigns
 * @desc    Create a new campaign
 * @access  Private
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const campaign = await CampaignService.create(req.user!.id, req.body);
    return apiResponse.created(res, campaign, 'Campaign created successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid campaign data', error.errors);
    }
    console.error('Error creating campaign:', error);
    return apiResponse.error(res, 'Failed to create campaign');
  }
});

/**
 * @route   GET /api/campaigns/statistics
 * @desc    Get campaign statistics for the user
 * @access  Private
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const stats = await CampaignService.getStatistics(req.user!.id);
    return apiResponse.success(res, stats, 'Statistics retrieved successfully');
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return apiResponse.error(res, 'Failed to fetch statistics');
  }
});

/**
 * @route   GET /api/campaigns/:id
 * @desc    Get a single campaign by ID
 * @access  Private
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await CampaignService.getById(req.params.id, req.user!.id);
    
    if (!campaign) {
      return apiResponse.notFound(res, 'Campaign not found');
    }
    
    return apiResponse.success(res, campaign, 'Campaign retrieved successfully');
  } catch (error) {
    console.error('Error fetching campaign:', error);
    return apiResponse.error(res, 'Failed to fetch campaign');
  }
});

/**
 * @route   PUT /api/campaigns/:id
 * @desc    Update a campaign
 * @access  Private
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await CampaignService.update(
      req.params.id,
      req.user!.id,
      req.body
    );
    
    return apiResponse.success(res, campaign, 'Campaign updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid campaign data', error.errors);
    }
    if ((error as Error).message === 'Campaign not found') {
      return apiResponse.notFound(res, 'Campaign not found');
    }
    console.error('Error updating campaign:', error);
    return apiResponse.error(res, 'Failed to update campaign');
  }
});

/**
 * @route   DELETE /api/campaigns/:id
 * @desc    Delete a campaign
 * @access  Private
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await CampaignService.delete(req.params.id, req.user!.id);
    return apiResponse.success(res, null, 'Campaign deleted successfully');
  } catch (error) {
    if ((error as Error).message === 'Campaign not found') {
      return apiResponse.notFound(res, 'Campaign not found');
    }
    console.error('Error deleting campaign:', error);
    return apiResponse.error(res, 'Failed to delete campaign');
  }
});

/**
 * @route   POST /api/campaigns/:id/clone
 * @desc    Clone a campaign
 * @access  Private
 */
router.post('/:id/clone', async (req: Request, res: Response) => {
  try {
    const campaign = await CampaignService.clone(req.params.id, req.user!.id);
    return apiResponse.created(res, campaign, 'Campaign cloned successfully');
  } catch (error) {
    if ((error as Error).message === 'Campaign not found') {
      return apiResponse.notFound(res, 'Campaign not found');
    }
    console.error('Error cloning campaign:', error);
    return apiResponse.error(res, 'Failed to clone campaign');
  }
});

/**
 * @route   PUT /api/campaigns/:id/analytics
 * @desc    Update campaign analytics
 * @access  Private
 */
router.put('/:id/analytics', async (req: Request, res: Response) => {
  try {
    // Verify ownership first
    const campaign = await CampaignService.getById(req.params.id, req.user!.id);
    if (!campaign) {
      return apiResponse.notFound(res, 'Campaign not found');
    }
    
    const updated = await CampaignService.updateAnalytics(req.params.id, req.body);
    return apiResponse.success(res, updated, 'Analytics updated successfully');
  } catch (error) {
    console.error('Error updating analytics:', error);
    return apiResponse.error(res, 'Failed to update analytics');
  }
});

export default router;