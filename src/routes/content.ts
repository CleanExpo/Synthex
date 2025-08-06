import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { generateContent, saveDraft, getDrafts, publishContent } from '../services/content';

const router = Router();

// Content generation validation
const contentGenerationValidation = [
  body('prompt').notEmpty().trim().withMessage('Prompt is required'),
  body('platform').optional().isIn(['twitter', 'linkedin', 'facebook', 'instagram', 'tiktok', 'youtube', 'all']),
  body('tone').optional().isIn(['professional', 'casual', 'friendly', 'bold']),
];

// Generate content with AI
router.post('/generate', authenticateToken, contentGenerationValidation, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { prompt, platform, tone, context } = req.body;
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    const result = await generateContent({
      prompt,
      platform: platform || 'all',
      tone: tone || 'professional',
      context,
      userId
    });

    res.json({
      message: 'Content generated successfully',
      data: result
    });
  } catch (error) {
    console.error('Content generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate content',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Save draft
router.post('/drafts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { content, platform, metadata } = req.body;
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const draft = await saveDraft({
      content,
      platform,
      metadata,
      userId
    });

    res.json({
      message: 'Draft saved successfully',
      data: draft
    });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Get drafts
router.get('/drafts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;
    const drafts = await getDrafts(userId);

    res.json({
      data: drafts
    });
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ error: 'Failed to get drafts' });
  }
});

// Publish content
router.post('/publish', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { content, platform, scheduleTime, campaignId } = req.body;
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    if (!content || !platform) {
      return res.status(400).json({ error: 'Content and platform are required' });
    }

    const result = await publishContent({
      content,
      platform,
      scheduleTime,
      campaignId,
      userId
    });

    res.json({
      message: 'Content published successfully',
      data: result
    });
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'Failed to publish content' });
  }
});

// Schedule content
router.post('/schedule', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { content, platform, scheduledAt, repeat, campaignId } = req.body;
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    if (!content || !platform || !scheduledAt) {
      return res.status(400).json({ error: 'Content, platform, and scheduled time are required' });
    }

    // For now, we'll store scheduled posts as drafts with a scheduled status
    const scheduledPost = await saveDraft({
      content,
      platform,
      metadata: {
        scheduledAt,
        repeat,
        status: 'scheduled'
      },
      userId,
      campaignId
    });

    res.json({
      message: 'Content scheduled successfully',
      data: scheduledPost
    });
  } catch (error) {
    console.error('Schedule error:', error);
    res.status(500).json({ error: 'Failed to schedule content' });
  }
});

// Get scheduled posts
router.get('/scheduled', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;
    const { startDate, endDate } = req.query;

    // For now, return sample scheduled posts
    const scheduledPosts = [
      {
        id: '1',
        content: 'Excited to share our latest product updates! Check out what\'s new.',
        platform: 'twitter',
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        status: 'scheduled'
      },
      {
        id: '2',
        content: 'Join us for a live Q&A session this Friday at 3 PM EST.',
        platform: 'instagram',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'scheduled'
      },
      {
        id: '3',
        content: 'Behind the scenes: How we design our eco-friendly packaging.',
        platform: 'linkedin',
        scheduledAt: new Date(Date.now() + 172800000).toISOString(),
        status: 'scheduled'
      }
    ];

    res.json({
      data: scheduledPosts
    });
  } catch (error) {
    console.error('Get scheduled posts error:', error);
    res.status(500).json({ error: 'Failed to get scheduled posts' });
  }
});

// Update scheduled post
router.put('/scheduled/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, scheduledAt, platform } = req.body;
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    // TODO: Implement update logic
    res.json({
      message: 'Scheduled post updated successfully',
      data: { id, content, scheduledAt, platform }
    });
  } catch (error) {
    console.error('Update scheduled post error:', error);
    res.status(500).json({ error: 'Failed to update scheduled post' });
  }
});

// Delete scheduled post
router.delete('/scheduled/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    // TODO: Implement delete logic
    res.json({
      message: 'Scheduled post deleted successfully'
    });
  } catch (error) {
    console.error('Delete scheduled post error:', error);
    res.status(500).json({ error: 'Failed to delete scheduled post' });
  }
});

export default router;