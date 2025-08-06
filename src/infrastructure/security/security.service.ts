/**
 * Security Service Implementation
 * Provides comprehensive security operations including encryption, JWT, and authentication
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  ISecurityService,
  TokenOptions,
  InfrastructureError,
  ILogger
} from '../../architecture/layer-interfaces';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  tenantId?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface EncryptedData {
  encryptedText: string;
  iv: string;
  tag: string;
  algorithm: string;
}

export class SecurityService implements ISecurityService {
  private logger: ILogger;
  private readonly jwtSecret: string;
  private readonly jwtIssuer: string;
  private readonly encryptionAlgorithm = 'aes-256-gcm';
  private readonly encryptionKey: Buffer;
  private readonly saltRounds = 12;

  constructor(logger: ILogger, jwtSecret?: string, encryptionKey?: string) {
    this.logger = logger;
    
    // JWT Configuration
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || this.generateSecureSecret();
    this.jwtIssuer = process.env.JWT_ISSUER || 'synthex-app';

    if (!jwtSecret && !process.env.JWT_SECRET) {
      this.logger.warn('JWT_SECRET not provided, using generated secret. This is not recommended for production.');
    }

    // Encryption Configuration
    const keyString = encryptionKey || process.env.ENCRYPTION_KEY || this.generateEncryptionKey();
    this.encryptionKey = Buffer.from(keyString, 'hex');

    if (!encryptionKey && !process.env.ENCRYPTION_KEY) {
      this.logger.warn('ENCRYPTION_KEY not provided, using generated key. This is not recommended for production.');
    }

    this.logger.info('Security service initialized', {
      jwtIssuer: this.jwtIssuer,
      encryptionAlgorithm: this.encryptionAlgorithm,
      saltRounds: this.saltRounds
    });
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      if (!password || typeof password !== 'string') {
        throw new InfrastructureError(
          'Password must be a non-empty string',
          'INVALID_PASSWORD_INPUT',
          400
        );
      }

      if (password.length < 8) {
        throw new InfrastructureError(
          'Password must be at least 8 characters long',
          'PASSWORD_TOO_SHORT',
          400
        );
      }

      const hash = await bcrypt.hash(password, this.saltRounds);

      this.logger.debug('Password hashed successfully');
      return hash;

    } catch (error) {
      if (error instanceof InfrastructureError) {
        throw error;
      }

      throw new InfrastructureError(
        'Failed to hash password',
        'PASSWORD_HASH_ERROR',
        500,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      if (!password || !hash) {
        return false;
      }

      const isValid = await bcrypt.compare(password, hash);

      this.logger.debug('Password verification completed', {
        isValid,
        hashPrefix: hash.substring(0, 10) + '...'
      });

      return isValid;

    } catch (error) {
      this.logger.error('Password verification failed', error as Error);
      return false;
    }
  }

  /**
   * Generate JWT token
   */
  async generateToken(payload: JWTPayload, options: TokenOptions = {}): Promise<string> {
    try {
      const tokenOptions: jwt.SignOptions = {
        issuer: options.issuer || this.jwtIssuer,
        expiresIn: options.expiresIn || '7d',
        algorithm: 'HS256'
      };

      if (options.audience) {
        tokenOptions.audience = options.audience;
      }

      // Add issued at timestamp
      const tokenPayload = {
        ...payload,
        iat: Math.floor(Date.now() / 1000)
      };

      const token = jwt.sign(tokenPayload, this.jwtSecret, tokenOptions);

      this.logger.debug('JWT token generated', {
        userId: payload.userId,
        expiresIn: tokenOptions.expiresIn,
        issuer: tokenOptions.issuer
      });

      return token;

    } catch (error) {
      throw new InfrastructureError(
        'Failed to generate JWT token',
        'TOKEN_GENERATION_ERROR',
        500,
        { userId: payload.userId },
        error as Error
      );
    }
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      if (!token || typeof token !== 'string') {
        throw new InfrastructureError(
          'Token must be a non-empty string',
          'INVALID_TOKEN_INPUT',
          401
        );
      }

      // Remove 'Bearer ' prefix if present
      const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;

      const decoded = jwt.verify(cleanToken, this.jwtSecret, {
        issuer: this.jwtIssuer,
        algorithms: ['HS256']
      }) as JWTPayload;

      // Validate required fields
      if (!decoded.userId || !decoded.email) {
        throw new InfrastructureError(
          'Token missing required fields',
          'INVALID_TOKEN_PAYLOAD',
          401
        );
      }

      this.logger.debug('JWT token verified successfully', {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      });

      return decoded;

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new InfrastructureError(
          'Invalid token',
          'INVALID_TOKEN',
          401,
          undefined,
          error
        );
      }

      if (error instanceof jwt.TokenExpiredError) {
        throw new InfrastructureError(
          'Token expired',
          'TOKEN_EXPIRED',
          401,
          undefined,
          error
        );
      }

      if (error instanceof InfrastructureError) {
        throw error;
      }

      throw new InfrastructureError(
        'Token verification failed',
        'TOKEN_VERIFICATION_ERROR',
        401,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(data: string): Promise<string> {
    try {
      if (!data || typeof data !== 'string') {
        throw new InfrastructureError(
          'Data must be a non-empty string',
          'INVALID_ENCRYPTION_INPUT',
          400
        );
      }

      const iv = crypto.randomBytes(12); // 96-bit IV for GCM
      const cipher = crypto.createCipher(this.encryptionAlgorithm, this.encryptionKey);
      cipher.setAAD(Buffer.from('synthex-app')); // Additional authenticated data

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      const encryptedData: EncryptedData = {
        encryptedText: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.encryptionAlgorithm
      };

      const result = Buffer.from(JSON.stringify(encryptedData)).toString('base64');

      this.logger.debug('Data encrypted successfully', {
        algorithm: this.encryptionAlgorithm,
        dataLength: data.length
      });

      return result;

    } catch (error) {
      throw new InfrastructureError(
        'Failed to encrypt data',
        'ENCRYPTION_ERROR',
        500,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encryptedData: string): Promise<string> {
    try {
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new InfrastructureError(
          'Encrypted data must be a non-empty string',
          'INVALID_DECRYPTION_INPUT',
          400
        );
      }

      const dataBuffer = Buffer.from(encryptedData, 'base64');
      const encryptionInfo: EncryptedData = JSON.parse(dataBuffer.toString('utf8'));

      const decipher = crypto.createDecipher(encryptionInfo.algorithm, this.encryptionKey);
      decipher.setAuthTag(Buffer.from(encryptionInfo.tag, 'hex'));
      decipher.setAAD(Buffer.from('synthex-app'));

      let decrypted = decipher.update(encryptionInfo.encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      this.logger.debug('Data decrypted successfully', {
        algorithm: encryptionInfo.algorithm
      });

      return decrypted;

    } catch (error) {
      throw new InfrastructureError(
        'Failed to decrypt data',
        'DECRYPTION_ERROR',
        500,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    try {
      return crypto.randomBytes(length).toString('hex');
    } catch (error) {
      throw new InfrastructureError(
        'Failed to generate secure token',
        'TOKEN_GENERATION_ERROR',
        500,
        { length },
        error as Error
      );
    }
  }

  /**
   * Generate API key
   */
  generateApiKey(prefix: string = 'sk'): string {
    try {
      const randomPart = crypto.randomBytes(24).toString('base64').replace(/[+/]/g, '').substring(0, 32);
      return `${prefix}_${randomPart}`;
    } catch (error) {
      throw new InfrastructureError(
        'Failed to generate API key',
        'API_KEY_GENERATION_ERROR',
        500,
        { prefix },
        error as Error
      );
    }
  }

  /**
   * Hash API key for storage
   */
  async hashApiKey(apiKey: string): Promise<string> {
    try {
      return await this.hashPassword(apiKey);
    } catch (error) {
      throw new InfrastructureError(
        'Failed to hash API key',
        'API_KEY_HASH_ERROR',
        500,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Verify API key
   */
  async verifyApiKey(apiKey: string, hashedApiKey: string): Promise<boolean> {
    try {
      return await this.verifyPassword(apiKey, hashedApiKey);
    } catch (error) {
      this.logger.error('API key verification failed', error as Error);
      return false;
    }
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    try {
      return crypto.randomBytes(32).toString('hex');
    } catch (error) {
      throw new InfrastructureError(
        'Failed to generate CSRF token',
        'CSRF_TOKEN_GENERATION_ERROR',
        500,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (!password) {
      return {
        isValid: false,
        score: 0,
        feedback: ['Password is required']
      };
    }

    // Length check
    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters long');
    } else if (password.length >= 12) {
      score += 2;
    } else {
      score += 1;
    }

    // Character variety checks
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password should contain lowercase letters');
    }

    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password should contain uppercase letters');
    }

    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password should contain numbers');
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password should contain special characters');
    }

    // Common patterns check
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /admin/i,
      /letmein/i
    ];

    const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password));
    if (hasCommonPattern) {
      score -= 2;
      feedback.push('Password contains common patterns');
    }

    // Sequential characters check
    if (/(.)\1{2,}/.test(password)) {
      score -= 1;
      feedback.push('Password should not contain repeated characters');
    }

    const isValid = score >= 4 && password.length >= 8;

    return {
      isValid,
      score: Math.max(0, Math.min(5, score)),
      feedback
    };
  }

  /**
   * Create secure session data
   */
  createSecureSession(userId: string, sessionData: any): {
    sessionId: string;
    encryptedData: string;
    expires: Date;
  } {
    try {
      const sessionId = this.generateSecureToken(32);
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const sessionPayload = {
        userId,
        data: sessionData,
        createdAt: new Date().toISOString(),
        expires: expires.toISOString()
      };

      const encryptedData = this.encrypt(JSON.stringify(sessionPayload));

      return {
        sessionId,
        encryptedData,
        expires
      };

    } catch (error) {
      throw new InfrastructureError(
        'Failed to create secure session',
        'SESSION_CREATION_ERROR',
        500,
        { userId },
        error as Error
      );
    }
  }

  /**
   * Validate secure session
   */
  async validateSecureSession(sessionId: string, encryptedData: string): Promise<{
    isValid: boolean;
    userId?: string;
    data?: any;
    expires?: Date;
  }> {
    try {
      const decryptedData = await this.decrypt(encryptedData);
      const sessionPayload = JSON.parse(decryptedData);

      const expires = new Date(sessionPayload.expires);
      const isValid = expires > new Date();

      if (!isValid) {
        this.logger.debug('Session expired', { sessionId, expires });
        return { isValid: false };
      }

      return {
        isValid: true,
        userId: sessionPayload.userId,
        data: sessionPayload.data,
        expires
      };

    } catch (error) {
      this.logger.warn('Session validation failed', error as Error, { sessionId });
      return { isValid: false };
    }
  }

  /**
   * Generate secure secret
   */
  private generateSecureSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate encryption key
   */
  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Sanitize sensitive data for logging
   */
  sanitizeForLogging(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };
    const sensitiveFields = [
      'password',
      'passwordHash',
      'token',
      'secret',
      'key',
      'apiKey',
      'privateKey',
      'encryptionKey',
      'jwtSecret'
    ];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Get security configuration info (for health checks)
   */
  getSecurityInfo(): {
    jwtIssuer: string;
    encryptionAlgorithm: string;
    saltRounds: number;
    hasJwtSecret: boolean;
    hasEncryptionKey: boolean;
  } {
    return {
      jwtIssuer: this.jwtIssuer,
      encryptionAlgorithm: this.encryptionAlgorithm,
      saltRounds: this.saltRounds,
      hasJwtSecret: !!this.jwtSecret,
      hasEncryptionKey: !!this.encryptionKey
    };
  }
}