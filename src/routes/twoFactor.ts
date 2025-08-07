import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import TwoFactorService, {
  SetupTwoFactorSchema,
  VerifyTwoFactorSchema,
  DisableTwoFactorSchema
} from '../services/twoFactor';
import { apiResponse } from '../utils/apiResponse';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * @route   GET /api/v1/2fa/status
 * @desc    Get two-factor authentication status
 * @access  Private
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await TwoFactorService.getTwoFactorStatus(req.user!.id);
    
    return apiResponse.success(res, status, 'Two-factor status retrieved successfully');
  } catch (error) {
    console.error('Error fetching 2FA status:', error);
    return apiResponse.error(res, 'Failed to fetch two-factor authentication status');
  }
});

/**
 * @route   POST /api/v1/2fa/setup
 * @desc    Setup two-factor authentication
 * @access  Private
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const result = await TwoFactorService.setupTwoFactor(
      req.user!.id,
      req.body,
      ipAddress
    );
    
    return apiResponse.success(res, result, 'Two-factor authentication setup initiated');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'User not found') {
      return apiResponse.notFound(res, 'User not found');
    }
    if ((error as Error).message === 'Two-factor authentication is already enabled') {
      return apiResponse.error(res, 'Two-factor authentication is already enabled', 400);
    }
    console.error('Error setting up 2FA:', error);
    return apiResponse.error(res, 'Failed to setup two-factor authentication');
  }
});

/**
 * @route   POST /api/v1/2fa/verify-setup
 * @desc    Verify and enable two-factor authentication
 * @access  Private
 */
router.post('/verify-setup', async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const success = await TwoFactorService.verifyAndEnableTwoFactor(
      req.user!.id,
      req.body,
      ipAddress
    );
    
    if (success) {
      return apiResponse.success(res, { enabled: true }, 'Two-factor authentication enabled successfully');
    } else {
      return apiResponse.error(res, 'Failed to enable two-factor authentication');
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'User not found') {
      return apiResponse.notFound(res, 'User not found');
    }
    if ((error as Error).message === 'Two-factor authentication is already enabled') {
      return apiResponse.error(res, 'Two-factor authentication is already enabled', 400);
    }
    if ((error as Error).message === 'Two-factor setup not initiated') {
      return apiResponse.error(res, 'Two-factor setup not initiated. Please setup 2FA first.', 400);
    }
    if ((error as Error).message === 'Invalid verification code') {
      return apiResponse.error(res, 'Invalid verification code', 400);
    }
    console.error('Error verifying 2FA setup:', error);
    return apiResponse.error(res, 'Failed to verify two-factor authentication setup');
  }
});

/**
 * @route   POST /api/v1/2fa/verify
 * @desc    Verify two-factor authentication token (for login)
 * @access  Private
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const verified = await TwoFactorService.verifyTwoFactor(
      req.user!.id,
      req.body,
      ipAddress
    );
    
    if (verified) {
      return apiResponse.success(res, { verified: true }, 'Two-factor authentication verified successfully');
    } else {
      return apiResponse.error(res, 'Invalid verification code or backup code', 400);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'User not found') {
      return apiResponse.notFound(res, 'User not found');
    }
    if ((error as Error).message === 'Two-factor authentication is not enabled') {
      return apiResponse.error(res, 'Two-factor authentication is not enabled', 400);
    }
    console.error('Error verifying 2FA:', error);
    return apiResponse.error(res, 'Failed to verify two-factor authentication');
  }
});

/**
 * @route   POST /api/v1/2fa/disable
 * @desc    Disable two-factor authentication
 * @access  Private
 */
router.post('/disable', async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const success = await TwoFactorService.disableTwoFactor(
      req.user!.id,
      req.body,
      ipAddress
    );
    
    if (success) {
      return apiResponse.success(res, { disabled: true }, 'Two-factor authentication disabled successfully');
    } else {
      return apiResponse.error(res, 'Failed to disable two-factor authentication');
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'User not found') {
      return apiResponse.notFound(res, 'User not found');
    }
    if ((error as Error).message === 'Two-factor authentication is not enabled') {
      return apiResponse.error(res, 'Two-factor authentication is not enabled', 400);
    }
    if ((error as Error).message === 'Invalid verification code or backup code') {
      return apiResponse.error(res, 'Invalid verification code or backup code', 400);
    }
    console.error('Error disabling 2FA:', error);
    return apiResponse.error(res, 'Failed to disable two-factor authentication');
  }
});

/**
 * @route   POST /api/v1/2fa/backup-codes/regenerate
 * @desc    Generate new backup codes
 * @access  Private
 */
router.post('/backup-codes/regenerate', async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const backupCodes = await TwoFactorService.generateNewBackupCodes(
      req.user!.id,
      req.body,
      ipAddress
    );
    
    return apiResponse.success(res, { backupCodes }, 'New backup codes generated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'User not found') {
      return apiResponse.notFound(res, 'User not found');
    }
    if ((error as Error).message === 'Two-factor authentication is not enabled') {
      return apiResponse.error(res, 'Two-factor authentication is not enabled', 400);
    }
    if ((error as Error).message === 'Invalid verification code') {
      return apiResponse.error(res, 'Invalid verification code', 400);
    }
    console.error('Error regenerating backup codes:', error);
    return apiResponse.error(res, 'Failed to regenerate backup codes');
  }
});

/**
 * @route   GET /api/v1/2fa/requires
 * @desc    Check if user requires two-factor authentication
 * @access  Public (used during login flow)
 */
router.get('/requires/:userId', async (req: Request, res: Response) => {
  try {
    // This endpoint might be called before full authentication
    // so we'll allow it but limit the information returned
    const requires2FA = await TwoFactorService.requiresTwoFactor(req.params.userId);
    
    return apiResponse.success(res, { requires2FA }, 'Two-factor requirement checked');
  } catch (error) {
    console.error('Error checking 2FA requirement:', error);
    // Don't reveal if user exists or not for security
    return apiResponse.success(res, { requires2FA: false }, 'Two-factor requirement checked');
  }
});

export default router;
