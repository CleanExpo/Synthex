import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Import centralized Prisma client with Accelerate
import { prisma } from '@/lib/prisma';
import { appConfig } from '../config/app-config';

// Connect to database (required - no fallback)
prisma.$connect()
  .then(() => {
    console.log('✅ Connected to database with Prisma Accelerate');
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error.message);
    throw new Error('Database connection required for authentication');
  });

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  preferences?: any;
}

export interface CreateUserData {
  email: string;
  password: string;
  name?: string;
}

export interface CreateGoogleUserData {
  email: string;
  name: string;
  googleId: string;
  avatar?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN = '7d';
  private readonly SALT_ROUNDS = 12;

  constructor() {
    this.JWT_SECRET = appConfig.security.jwtSecret;
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  JWT_SECRET not set in environment variables. Using generated secret.');
    }
  }

  private generateFallbackSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateToken(userId: string): string {
    return jwt.sign({ userId }, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
  }

  verifyToken(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as { userId: string };
      return decoded;
    } catch (error) {
      return null;
    }
  }

  async createUser(userData: CreateUserData): Promise<User> {
    const { email, password, name } = userData;

    // Check if user already exists
    const existingUser = await (prisma as any).user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user = await (prisma as any).user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        preferences: true,
      }
    });

    return user;
  }

  async createGoogleUser(userData: CreateGoogleUserData): Promise<User> {
    const { email, name, googleId, avatar } = userData;

    // Create user with Google data
    const user = await (prisma as any).user.create({
      data: {
        email,
        name,
        googleId,
        avatar,
        password: '', // Empty password for Google users
        authProvider: 'google',
        emailVerified: true, // Google emails are pre-verified
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        preferences: true,
        avatar: true,
        authProvider: true,
      }
    });

    return user;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const user = await (prisma as any).user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        preferences: true,
        avatar: true,
        authProvider: true,
        googleId: true,
      }
    });

    return user;
  }

  async updateUserGoogleInfo(userId: string, data: {
    googleId: string;
    avatar?: string;
    lastLogin: Date;
  }): Promise<User> {
    const user = await (prisma as any).user.update({
      where: { id: userId },
      data: {
        googleId: data.googleId,
        avatar: data.avatar,
        lastLogin: data.lastLogin,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        preferences: true,
        avatar: true,
        authProvider: true,
      }
    });

    return user;
  }

  async authenticateUser(credentials: LoginCredentials): Promise<{ user: User; token: string } | null> {
    const { email, password } = credentials;

    // Find user
    const user = await (prisma as any).user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        createdAt: true,
        preferences: true,
      }
    });

    if (!user) {
      return null;
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Generate token
    const token = this.generateToken(user.id);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token
    };
  }

  async getUserById(userId: string): Promise<User | null> {
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        preferences: true,
      }
    });

    return user;
  }

  async updateUserApiKeys(userId: string, apiKeys: { openrouterApiKey?: string; anthropicApiKey?: string }): Promise<void> {
    const encryptedKeys: any = {};
    
    if (apiKeys.openrouterApiKey) {
      encryptedKeys.openrouterApiKey = this.encryptApiKey(apiKeys.openrouterApiKey);
    }
    
    if (apiKeys.anthropicApiKey) {
      encryptedKeys.anthropicApiKey = this.encryptApiKey(apiKeys.anthropicApiKey);
    }

    await (prisma as any).user.update({
      where: { id: userId },
      data: encryptedKeys
    });
  }

  async getUserApiKeys(userId: string): Promise<{ openrouterApiKey?: string; anthropicApiKey?: string }> {
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: {
        openrouterApiKey: true,
        anthropicApiKey: true,
      }
    });

    if (!user) {
      return {};
    }

    const decryptedKeys: any = {};
    
    if (user.openrouterApiKey) {
      decryptedKeys.openrouterApiKey = this.decryptApiKey(user.openrouterApiKey);
    }
    
    if (user.anthropicApiKey) {
      decryptedKeys.anthropicApiKey = this.decryptApiKey(user.anthropicApiKey);
    }

    return decryptedKeys;
  }

  private encryptApiKey(apiKey: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.JWT_SECRET, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptApiKey(encryptedApiKey: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.JWT_SECRET, 'salt', 32);
      const parts = encryptedApiKey.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      return '';
    }
  }

  async logApiUsage(userId: string, endpoint: string, data: {
    model?: string;
    tokens?: number;
    cost?: number;
    status: string;
    requestData?: any;
    responseData?: any;
    errorMessage?: string;
  }): Promise<void> {
    await (prisma as any).apiUsage.create({
      data: {
        userId,
        endpoint,
        ...data
      }
    });
  }

  async getUserApiUsage(userId: string, limit: number = 100): Promise<any[]> {
    return (prisma as any).apiUsage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        endpoint: true,
        model: true,
        tokens: true,
        cost: true,
        status: true,
        createdAt: true,
        errorMessage: true,
      }
    });
  }

  async generateResetCode(email: string): Promise<{ code: string; expiresAt: Date }> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await (prisma as any).user.update({
      where: { email },
      data: {
        resetCode: code,
        resetCodeExpires: expiresAt
      }
    });
    
    return { code, expiresAt };
  }

  async verifyResetCode(email: string, code: string): Promise<string | null> {
    const user = await (prisma as any).user.findUnique({
      where: { email },
      select: {
        id: true,
        resetCode: true,
        resetCodeExpires: true
      }
    });
    
    if (!user || user.resetCode !== code) {
      return null;
    }
    
    if (user.resetCodeExpires && user.resetCodeExpires < new Date()) {
      return null;
    }
    
    // Generate a temporary token for password reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    await (prisma as any).user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpires: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      }
    });
    
    return resetToken;
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
    const user = await (prisma as any).user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: {
          gt: new Date()
        }
      }
    });
    
    if (!user) {
      return false;
    }
    
    const hashedPassword = await this.hashPassword(newPassword);
    
    await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetCode: null,
        resetCodeExpires: null,
        resetToken: null,
        resetTokenExpires: null
      }
    });
    
    return true;
  }

  async sendPasswordResetEmail(email: string, code: string): Promise<void> {
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    // For now, log to console
    console.log(`Password reset code for ${email}: ${code}`);
    console.log('In production, this would be sent via email');
  }

  async updateUserProfile(userId: string, data: { name?: string; preferences?: any }): Promise<User> {
    const user = await (prisma as any).user.update({
      where: { id: userId },
      data: {
        name: data.name,
        preferences: data.preferences
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        preferences: true
      }
    });

    return user;
  }
}

// Always use real auth service with Prisma
const authService = new AuthService();

export { authService };
