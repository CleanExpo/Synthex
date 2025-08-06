import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { generateContent, saveDraft, getDrafts, publishContent } from '../services/content';
import { AuthenticatedRequest } from '../types';

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
    const userId = (req as AuthenticatedRequest).user.id;

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
    const userId = (req as AuthenticatedRequest).user.id;

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
    const userId = (req as AuthenticatedRequest).user.id;
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
    const userId = (req as AuthenticatedRequest).user.id;

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

export default router;