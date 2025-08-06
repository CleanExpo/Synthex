import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { authService } from '../services/auth';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  message: 'Too many registration attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const apiKeyValidation = [
  body('openrouterApiKey')
    .optional()
    .matches(/^sk-or-v1-[a-zA-Z0-9-_]+$/)
    .withMessage('Invalid OpenRouter API key format'),
  body('anthropicApiKey')
    .optional()
    .matches(/^sk-ant-api[0-9]{2}-[a-zA-Z0-9-_]+$/)
    .withMessage('Invalid Anthropic API key format')
];

// Register endpoint
router.post('/register', registerLimiter, registerValidation, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, name } = req.body;

    const user = await authService.createUser({ email, password, name });
    const token = authService.generateToken(user.id);

    res.status(201).json({
      message: 'User created successfully',
      user,
      token
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    
    if (error.message === 'User with this email already exists') {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
router.post('/login', authLimiter, loginValidation, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    const result = await authService.authenticateUser({ email, password });
    
    if (!result) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    res.json({
      user: (req as AuthenticatedRequest).user
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { name, preferences } = req.body;
    
    // Validate preferences structure if provided
    if (preferences) {
      const allowedPreferenceKeys = [
        'userType', 
        'platforms', 
        'onboardingCompleted', 
        'onboardingCompletedAt',
        'theme',
        'notifications'
      ];
      
      const invalidKeys = Object.keys(preferences).filter(key => 
        !allowedPreferenceKeys.includes(key)
      );
      
      if (invalidKeys.length > 0) {
        return res.status(400).json({
          error: 'Invalid preference keys',
          invalidKeys
        });
      }
    }

    const updatedUser = await authService.updateUserProfile(userId, {
      name,
      preferences
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Verify token
router.get('/verify', authenticateToken, async (req: Request, res: Response) => {
  try {
    res.json({
      valid: true,
      user: (req as AuthenticatedRequest).user
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Update API keys
router.post('/api-keys', authenticateToken, apiKeyValidation, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { openrouterApiKey, anthropicApiKey } = req.body;
    const userId = (req as AuthenticatedRequest).user!.id;

    await authService.updateUserApiKeys(userId, { openrouterApiKey, anthropicApiKey });

    res.json({
      message: 'API keys updated successfully'
    });
  } catch (error) {
    console.error('API keys update error:', error);
    res.status(500).json({ error: 'Failed to update API keys' });
  }
});

// Get API keys (masked)
router.get('/api-keys', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const apiKeys = await authService.getUserApiKeys(userId);

    // Mask the keys for security
    const maskedKeys = {
      openrouterApiKey: apiKeys.openrouterApiKey ? `${apiKeys.openrouterApiKey.slice(0, 8)}...${apiKeys.openrouterApiKey.slice(-4)}` : null,
      anthropicApiKey: apiKeys.anthropicApiKey ? `${apiKeys.anthropicApiKey.slice(0, 12)}...${apiKeys.anthropicApiKey.slice(-4)}` : null,
      hasOpenRouterKey: !!apiKeys.openrouterApiKey,
      hasAnthropicKey: !!apiKeys.anthropicApiKey
    };

    res.json({ apiKeys: maskedKeys });
  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({ error: 'Failed to get API keys' });
  }
});

// Get API usage statistics
router.get('/usage', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const usage = await authService.getUserApiUsage(userId, limit);
    
    // Calculate summary statistics
    const totalRequests = usage.length;
    const successfulRequests = usage.filter(u => u.status === 'success').length;
    const totalTokens = usage.reduce((sum, u) => sum + (u.tokens || 0), 0);
    const totalCost = usage.reduce((sum, u) => sum + (u.cost || 0), 0);

    res.json({
      usage,
      summary: {
        totalRequests,
        successfulRequests,
        errorRate: totalRequests > 0 ? ((totalRequests - successfulRequests) / totalRequests * 100).toFixed(2) + '%' : '0%',
        totalTokens,
        totalCost: totalCost.toFixed(4)
      }
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
});

// Logout (invalidate token - for future session management)
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    // For JWT tokens, we can't really "logout" without a blacklist
    // In a production app, you'd want to implement session management or token blacklisting
    res.json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Password Reset Routes
router.post('/reset-password/request', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists
    const user = await authService.findUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists for security
      return res.json({ message: 'If the email exists, a reset code will be sent' });
    }
    
    // Generate and save reset code
    const { code } = await authService.generateResetCode(email);
    
    // Send email (in production)
    await authService.sendPasswordResetEmail(email, code);
    
    res.json({ message: 'Reset code sent to email' });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Failed to process reset request' });
  }
});

router.post('/reset-password/verify', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }
    
    const token = await authService.verifyResetCode(email, code);
    
    if (!token) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    
    res.json({ token });
  } catch (error) {
    console.error('Code verification error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

router.post('/reset-password/reset', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const success = await authService.resetPasswordWithToken(token, password);
    
    if (!success) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;