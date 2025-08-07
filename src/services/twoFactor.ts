import { z } from 'zod';
import { prisma } from '../lib/prisma';
import * as crypto from 'crypto';
import AuditService from './audit';

// External dependencies that would need to be installed:
// npm install speakeasy qrcode

// For now, we'll create a simplified version without external dependencies
// In production, use proper TOTP libraries like speakeasy

// Validation schemas
export const SetupTwoFactorSchema = z.object({
  password: z.string().min(1, 'Password is required for 2FA setup')
});

export const VerifyTwoFactorSchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/, 'Token must be numeric'),
  backupCode: z.string().optional()
});

export const DisableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/, 'Token must be numeric').optional(),
  backupCode: z.string().optional()
});

export interface TwoFactorSecret {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorStatus {
  enabled: boolean;
  backupCodesRemaining: number;
  lastUsed?: Date;
  setupAt?: Date;
}

export class TwoFactorService {
  private static readonly BACKUP_CODES_COUNT = 10;
  private static readonly BACKUP_CODE_LENGTH = 8;
  private static readonly SECRET_LENGTH = 32;

  /**
   * Generate a secure random secret for TOTP
   */
  private static generateSecret(): string {
    // In production, use a proper crypto library
    // For now, generate a base32-compatible secret
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < this.SECRET_LENGTH; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }

  /**
   * Generate backup codes
   */
  private static generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < this.BACKUP_CODES_COUNT; i++) {
      // Generate 8-digit backup code
      const code = Math.floor(10000000 + Math.random() * 90000000).toString();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Simple TOTP implementation (use proper library in production)
   */
  private static generateTOTP(secret: string, window: number = 0): string {
    // Simplified TOTP - in production use speakeasy or similar
    const time = Math.floor(Date.now() / 30000) + window;
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(time.toString());
    const hash = hmac.digest();
    
    const offset = hash[hash.length - 1] & 0xf;
    const code = (
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)
    ) % 1000000;
    
    return code.toString().padStart(6, '0');
  }

  /**
   * Verify TOTP token with time window tolerance
   */
  private static verifyTOTP(secret: string, token: string): boolean {
    // Check current window and ±1 window for clock drift
    for (let window = -1; window <= 1; window++) {
      if (this.generateTOTP(secret, window) === token) {
        return true;
      }
    }
    return false;
  }

  /**
   * Hash backup codes for storage
   */
  private static hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Generate QR code URL for authenticator apps
   */
  private static generateQRCodeUrl(email: string, secret: string, issuer: string = 'Synthex'): string {
    const label = encodeURIComponent(`${issuer}:${email}`);
    const params = new URLSearchParams({
      secret,
      issuer,
      algorithm: 'SHA1',
      digits: '6',
      period: '30'
    });
    
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  /**
   * Setup two-factor authentication for a user
   */
  static async setupTwoFactor(
    userId: string,
    data: z.infer<typeof SetupTwoFactorSchema>,
    ipAddress?: string
  ): Promise<TwoFactorSecret> {
    const validated = SetupTwoFactorSchema.parse(data);
    
    try {
      // Verify user's password first (implement password verification)
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: { email: true, twoFactorEnabled: true }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.twoFactorEnabled) {
        throw new Error('Two-factor authentication is already enabled');
      }
      
      // Generate secret and backup codes
      const secret = this.generateSecret();
      const backupCodes = this.generateBackupCodes();
      const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));
      
      // Store the secret temporarily (user needs to verify before enabling)
      await (prisma as any).user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: secret,
          twoFactorBackupCodes: hashedBackupCodes,
          twoFactorEnabled: false // Not enabled until verified
        }
      });
      
      // Generate QR code URL
      const qrCodeUrl = this.generateQRCodeUrl(user.email, secret);
      
      // Log the setup attempt
      await AuditService.log({
        userId,
        action: '2fa_setup_initiated',
        resource: 'authentication',
        ipAddress,
        severity: 'medium',
        category: 'security',
        outcome: 'success'
      });
      
      return {
        secret,
        qrCodeUrl,
        backupCodes
      };
    } catch (error) {
      // Log the failed attempt
      await AuditService.log({
        userId,
        action: '2fa_setup_failed',
        resource: 'authentication',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        ipAddress,
        severity: 'medium',
        category: 'security',
        outcome: 'failure'
      });
      
      throw error;
    }
  }

  /**
   * Verify and enable two-factor authentication
   */
  static async verifyAndEnableTwoFactor(
    userId: string,
    data: z.infer<typeof VerifyTwoFactorSchema>,
    ipAddress?: string
  ): Promise<boolean> {
    const validated = VerifyTwoFactorSchema.parse(data);
    
    try {
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: {
          twoFactorSecret: true,
          twoFactorEnabled: true,
          twoFactorBackupCodes: true
        }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.twoFactorEnabled) {
        throw new Error('Two-factor authentication is already enabled');
      }
      
      if (!user.twoFactorSecret) {
        throw new Error('Two-factor setup not initiated');
      }
      
      // Verify the token
      const isValidToken = this.verifyTOTP(user.twoFactorSecret, validated.token);
      
      if (!isValidToken) {
        throw new Error('Invalid verification code');
      }
      
      // Enable 2FA
      await (prisma as any).user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSetupAt: new Date()
        }
      });
      
      // Log successful enablement
      await AuditService.log({
        userId,
        action: '2fa_enabled',
        resource: 'authentication',
        ipAddress,
        severity: 'high',
        category: 'security',
        outcome: 'success'
      });
      
      return true;
    } catch (error) {
      // Log the failed attempt
      await AuditService.log({
        userId,
        action: '2fa_enable_failed',
        resource: 'authentication',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        ipAddress,
        severity: 'medium',
        category: 'security',
        outcome: 'failure'
      });
      
      throw error;
    }
  }

  /**
   * Verify 2FA token during login
   */
  static async verifyTwoFactor(
    userId: string,
    data: z.infer<typeof VerifyTwoFactorSchema>,
    ipAddress?: string
  ): Promise<boolean> {
    const validated = VerifyTwoFactorSchema.parse(data);
    
    try {
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: {
          twoFactorSecret: true,
          twoFactorEnabled: true,
          twoFactorBackupCodes: true
        }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!user.twoFactorEnabled) {
        throw new Error('Two-factor authentication is not enabled');
      }
      
      let verified = false;
      let usedBackupCode = false;
      
      // Try TOTP token first
      if (validated.token && user.twoFactorSecret) {
        verified = this.verifyTOTP(user.twoFactorSecret, validated.token);
      }
      
      // If TOTP failed, try backup code
      if (!verified && validated.backupCode && user.twoFactorBackupCodes) {
        const hashedCode = this.hashBackupCode(validated.backupCode);
        const backupCodes = user.twoFactorBackupCodes as string[];
        
        if (backupCodes.includes(hashedCode)) {
          verified = true;
          usedBackupCode = true;
          
          // Remove used backup code
          const updatedCodes = backupCodes.filter(code => code !== hashedCode);
          await (prisma as any).user.update({
            where: { id: userId },
            data: {
              twoFactorBackupCodes: updatedCodes,
              twoFactorLastUsed: new Date()
            }
          });
        }
      }
      
      if (verified) {
        // Update last used timestamp
        if (!usedBackupCode) {
          await (prisma as any).user.update({
            where: { id: userId },
            data: { twoFactorLastUsed: new Date() }
          });
        }
        
        // Log successful verification
        await AuditService.log({
          userId,
          action: '2fa_verified',
          resource: 'authentication',
          details: { method: usedBackupCode ? 'backup_code' : 'totp' },
          ipAddress,
          severity: 'low',
          category: 'auth',
          outcome: 'success'
        });
      } else {
        // Log failed verification
        await AuditService.log({
          userId,
          action: '2fa_verification_failed',
          resource: 'authentication',
          ipAddress,
          severity: 'medium',
          category: 'security',
          outcome: 'failure'
        });
      }
      
      return verified;
    } catch (error) {
      // Log the error
      await AuditService.log({
        userId,
        action: '2fa_verification_error',
        resource: 'authentication',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        ipAddress,
        severity: 'high',
        category: 'security',
        outcome: 'failure'
      });
      
      throw error;
    }
  }

  /**
   * Disable two-factor authentication
   */
  static async disableTwoFactor(
    userId: string,
    data: z.infer<typeof DisableTwoFactorSchema>,
    ipAddress?: string
  ): Promise<boolean> {
    const validated = DisableTwoFactorSchema.parse(data);
    
    try {
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: {
          twoFactorSecret: true,
          twoFactorEnabled: true,
          twoFactorBackupCodes: true
        }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!user.twoFactorEnabled) {
        throw new Error('Two-factor authentication is not enabled');
      }
      
      // Verify password and 2FA token/backup code for security
      let verified = false;
      
      if (validated.token && user.twoFactorSecret) {
        verified = this.verifyTOTP(user.twoFactorSecret, validated.token);
      }
      
      if (!verified && validated.backupCode && user.twoFactorBackupCodes) {
        const hashedCode = this.hashBackupCode(validated.backupCode);
        const backupCodes = user.twoFactorBackupCodes as string[];
        verified = backupCodes.includes(hashedCode);
      }
      
      if (!verified) {
        throw new Error('Invalid verification code or backup code');
      }
      
      // Disable 2FA
      await (prisma as any).user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: null,
          twoFactorSetupAt: null,
          twoFactorLastUsed: null
        }
      });
      
      // Log the disable action
      await AuditService.log({
        userId,
        action: '2fa_disabled',
        resource: 'authentication',
        ipAddress,
        severity: 'high',
        category: 'security',
        outcome: 'success'
      });
      
      return true;
    } catch (error) {
      // Log the failed attempt
      await AuditService.log({
        userId,
        action: '2fa_disable_failed',
        resource: 'authentication',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        ipAddress,
        severity: 'medium',
        category: 'security',
        outcome: 'failure'
      });
      
      throw error;
    }
  }

  /**
   * Get two-factor authentication status
   */
  static async getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: true,
        twoFactorLastUsed: true,
        twoFactorSetupAt: true
      }
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const backupCodes = user.twoFactorBackupCodes as string[] || [];
    
    return {
      enabled: user.twoFactorEnabled || false,
      backupCodesRemaining: backupCodes.length,
      lastUsed: user.twoFactorLastUsed,
      setupAt: user.twoFactorSetupAt
    };
  }

  /**
   * Generate new backup codes (requires verification)
   */
  static async generateNewBackupCodes(
    userId: string,
    data: z.infer<typeof VerifyTwoFactorSchema>,
    ipAddress?: string
  ): Promise<string[]> {
    const validated = VerifyTwoFactorSchema.parse(data);
    
    try {
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: {
          twoFactorSecret: true,
          twoFactorEnabled: true
        }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!user.twoFactorEnabled) {
        throw new Error('Two-factor authentication is not enabled');
      }
      
      // Verify current 2FA token
      const isValidToken = this.verifyTOTP(user.twoFactorSecret!, validated.token);
      
      if (!isValidToken) {
        throw new Error('Invalid verification code');
      }
      
      // Generate new backup codes
      const newBackupCodes = this.generateBackupCodes();
      const hashedBackupCodes = newBackupCodes.map(code => this.hashBackupCode(code));
      
      // Update user with new backup codes
      await (prisma as any).user.update({
        where: { id: userId },
        data: {
          twoFactorBackupCodes: hashedBackupCodes
        }
      });
      
      // Log the regeneration
      await AuditService.log({
        userId,
        action: '2fa_backup_codes_regenerated',
        resource: 'authentication',
        ipAddress,
        severity: 'medium',
        category: 'security',
        outcome: 'success'
      });
      
      return newBackupCodes;
    } catch (error) {
      await AuditService.log({
        userId,
        action: '2fa_backup_codes_regeneration_failed',
        resource: 'authentication',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        ipAddress,
        severity: 'medium',
        category: 'security',
        outcome: 'failure'
      });
      
      throw error;
    }
  }

  /**
   * Check if user requires 2FA verification
   */
  static async requiresTwoFactor(userId: string): Promise<boolean> {
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true }
    });
    
    return user?.twoFactorEnabled || false;
  }
}

export default TwoFactorService;
