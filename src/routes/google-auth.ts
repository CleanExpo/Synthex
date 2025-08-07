import express, { Request, Response } from 'express';
import { authService } from '../services/auth';

const router = express.Router();

// Import passport only if Google OAuth is configured
let passport: any = null;
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport = require('../config/passport').default;
}

// Google OAuth status route
router.get('/google/status', (req: Request, res: Response) => {
  const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  res.json({
    configured: isConfigured,
    message: isConfigured ? 'Google OAuth is configured' : 'Google OAuth is not configured'
  });
});

// Google OAuth login route
router.get('/google', (req: Request, res: Response, next: any) => {
  if (!passport) {
    return res.status(400).json({
      error: 'Google OAuth not configured',
      message: 'Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment variables'
    });
  }
  
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })(req, res, next);
});

// Google OAuth callback route - matches Google Console configuration
router.get('/google/callback', (req: Request, res: Response, next: any) => {
  if (!passport) {
    return res.redirect('/dashboard?error=google_not_configured');
  }
  
  passport.authenticate('google', { 
    failureRedirect: '/dashboard?error=auth_failed',
    session: false  // We'll use JWT instead of sessions
  })(req, res, async () => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.redirect('/dashboard?error=auth_failed');
      }

      // Generate JWT token
      const token = authService.generateToken(user.id);
      
      // Log the authentication event
      await authService.logApiUsage(user.id, '/auth/google/callback', {
        status: 'success',
        requestData: { authProvider: 'google' },
        responseData: { userId: user.id, email: user.email }
      });

      // Redirect to dashboard with token
      // In production, you might want to use a more secure method to pass the token
      res.redirect(`/dashboard?token=${token}&success=google_login`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect('/dashboard?error=auth_callback_failed');
    }
  });
});

// Check Google authentication status
router.get('/google/status', async (req: Request, res: Response) => {
  try {
    const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    
    res.json({
      configured: isConfigured,
      authUrl: isConfigured ? '/api/google' : null,
      message: isConfigured 
        ? 'Google OAuth is configured and ready'
        : 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check Google auth status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Link Google account to existing user (for users who signed up with email/password)
router.post('/google/link', 
  // This would require the user to be authenticated first
  async (req: Request, res: Response) => {
    try {
      // This is a placeholder for account linking functionality
      // You would implement this if you want users to link their Google account
      // to an existing email/password account
      
      res.json({
        message: 'Account linking not yet implemented',
        suggestion: 'Users should login with Google directly or use email/password'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to link Google account',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Unlink Google account
router.post('/google/unlink', async (req: Request, res: Response) => {
  try {
    // Placeholder for unlinking Google account
    res.json({
      message: 'Account unlinking not yet implemented'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to unlink Google account',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;