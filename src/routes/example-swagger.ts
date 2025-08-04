import { Router, Request, Response } from 'express';
import { ApiRes } from '../utils/apiResponse';

const router = Router();

/**
 * @swagger
 * /api/v1/example/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Example data
    const users = [
      { id: '1', email: 'user1@example.com', name: 'User One' },
      { id: '2', email: 'user2@example.com', name: 'User Two' }
    ];
    
    return ApiRes.paginated(res, users, page, limit, 100, 'Users retrieved successfully');
  } catch (error) {
    return ApiRes.serverError(res, error);
  }
});

/**
 * @swagger
 * /api/v1/example/webhook:
 *   post:
 *     summary: Register a webhook
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - events
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/webhook
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [content.generated, content.optimized, campaign.created, campaign.completed]
 *                 example: [content.generated, campaign.completed]
 *               secret:
 *                 type: string
 *                 description: Secret key for webhook signature verification
 *                 example: webhook_secret_key_123
 *     responses:
 *       201:
 *         description: Webhook registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: webhook_123
 *                     url:
 *                       type: string
 *                       example: https://example.com/webhook
 *                     events:
 *                       type: array
 *                       items:
 *                         type: string
 *                     active:
 *                       type: boolean
 *                       example: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { url, events, secret } = req.body;
    
    // Validation
    if (!url || !events || !Array.isArray(events)) {
      return ApiRes.validationError(res, {
        errors: [
          { field: 'url', message: 'URL is required' },
          { field: 'events', message: 'Events array is required' }
        ]
      });
    }
    
    // Example webhook creation
    const webhook = {
      id: `webhook_${Date.now()}`,
      url,
      events,
      secret: secret || null,
      active: true,
      createdAt: new Date().toISOString()
    };
    
    return ApiRes.created(res, webhook, 'Webhook registered successfully');
  } catch (error) {
    return ApiRes.serverError(res, error);
  }
});

export default router;