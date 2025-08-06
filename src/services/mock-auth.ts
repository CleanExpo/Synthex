import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  preferences?: any;
  password?: string;
  googleId?: string | null;
  avatar?: string | null;
  authProvider?: string;
  emailVerified?: boolean;
  openrouterApiKey?: string | null;
  anthropicApiKey?: string | null;
  resetCode?: string | null;
  resetCodeExpires?: Date | null;
  resetToken?: string | null;
  resetTokenExpires?: Date | null;
  lastLogin?: Date | null;
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

export interface ApiUsage {
  id: string;
  userId: string;
  endpoint: string;
  model?: string;
  tokens?: number;
  cost?: number;
  status: string;
  createdAt: Date;
  errorMessage?: string;
  requestData?: any;
  responseData?: any;
}

// In-memory storage
const users = new Map<string, User>();
const apiUsage = new Map<string, ApiUsage[]>();

// Initialize with a demo user
const demoUserId = crypto.randomUUID();
users.set(demoUserId, {
  id: demoUserId,
  email: 'demo@synthex.com',
  name: 'Demo User',
  password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpfQr6U1B1xP.O', // password: demo123!
  createdAt: new Date(),
  preferences: {
    onboardingCompleted: false,
    userType: null,
    platforms: []
  },
  authProvider: 'local',
  emailVerified: true
});

export class MockAuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN = '7d';
  private readonly SALT_ROUNDS = 12;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || this.generateFallbackSecret();
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
    const existingUser = Array.from(users.values()).find(u => u.email === email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user: User = {
      id: crypto.randomUUID(),
      email,
      password: hashedPassword,
      name: name || null,
      createdAt: new Date(),
      preferences: {
        onboardingCompleted: false,
        userType: null,
        platforms: []
      },
      authProvider: 'local',
      emailVerified: false
    };

    users.set(user.id, user);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async createGoogleUser(userData: CreateGoogleUserData): Promise<User> {
    const { email, name, googleId, avatar } = userData;

    // Check if user already exists
    const existingUser = Array.from(users.values()).find(u => u.email === email);
    if (existingUser) {
      // Update existing user with Google info
      existingUser.googleId = googleId;
      existingUser.avatar = avatar;
      existingUser.authProvider = 'google';
      existingUser.emailVerified = true;
      existingUser.lastLogin = new Date();
      users.set(existingUser.id, existingUser);
      
      const { password: _, ...userWithoutPassword } = existingUser;
      return userWithoutPassword;
    }

    // Create new user with Google data
    const user: User = {
      id: crypto.randomUUID(),
      email,
      name,
      googleId,
      avatar,
      password: '', // Empty password for Google users
      authProvider: 'google',
      emailVerified: true, // Google emails are pre-verified
      createdAt: new Date(),
      preferences: {
        onboardingCompleted: false,
        userType: null,
        platforms: []
      }
    };

    users.set(user.id, user);

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const user = Array.from(users.values()).find(u => u.email === email);
    return user || null;
  }

  async updateUserGoogleInfo(userId: string, data: {
    googleId: string;
    avatar?: string;
    lastLogin: Date;
  }): Promise<User> {
    const user = users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.googleId = data.googleId;
    if (data.avatar) user.avatar = data.avatar;
    user.lastLogin = data.lastLogin;

    users.set(userId, user);

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async authenticateUser(credentials: LoginCredentials): Promise<{ user: User; token: string } | null> {
    const { email, password } = credentials;

    // Find user
    const user = Array.from(users.values()).find(u => u.email === email);
    if (!user || !user.password) {
      return null;
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Update last login
    user.lastLogin = new Date();
    users.set(user.id, user);

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
    const user = users.get(userId);
    if (!user) return null;

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateUserApiKeys(userId: string, apiKeys: { openrouterApiKey?: string; anthropicApiKey?: string }): Promise<void> {
    const user = users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (apiKeys.openrouterApiKey) {
      user.openrouterApiKey = this.encryptApiKey(apiKeys.openrouterApiKey);
    }
    
    if (apiKeys.anthropicApiKey) {
      user.anthropicApiKey = this.encryptApiKey(apiKeys.anthropicApiKey);
    }

    users.set(userId, user);
  }

  async getUserApiKeys(userId: string): Promise<{ openrouterApiKey?: string; anthropicApiKey?: string }> {
    const user = users.get(userId);
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
    const usage: ApiUsage = {
      id: crypto.randomUUID(),
      userId,
      endpoint,
      ...data,
      createdAt: new Date()
    };

    if (!apiUsage.has(userId)) {
      apiUsage.set(userId, []);
    }
    
    const userUsage = apiUsage.get(userId)!;
    userUsage.push(usage);
    
    // Keep only last 1000 entries per user
    if (userUsage.length > 1000) {
      userUsage.splice(0, userUsage.length - 1000);
    }
  }

  async getUserApiUsage(userId: string, limit: number = 100): Promise<any[]> {
    const userUsage = apiUsage.get(userId) || [];
    return userUsage
      .slice(-limit)
      .reverse()
      .map(({ requestData, responseData, ...usage }) => usage);
  }

  async generateResetCode(email: string): Promise<{ code: string; expiresAt: Date }> {
    const user = Array.from(users.values()).find(u => u.email === email);
    if (!user) {
      throw new Error('User not found');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    user.resetCode = code;
    user.resetCodeExpires = expiresAt;
    users.set(user.id, user);
    
    return { code, expiresAt };
  }

  async verifyResetCode(email: string, code: string): Promise<string | null> {
    const user = Array.from(users.values()).find(u => u.email === email);
    
    if (!user || user.resetCode !== code) {
      return null;
    }
    
    if (user.resetCodeExpires && user.resetCodeExpires < new Date()) {
      return null;
    }
    
    // Generate a temporary token for password reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    user.resetToken = resetToken;
    user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    users.set(user.id, user);
    
    return resetToken;
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
    const user = Array.from(users.values()).find(u => 
      u.resetToken === token && 
      u.resetTokenExpires && 
      u.resetTokenExpires > new Date()
    );
    
    if (!user) {
      return false;
    }
    
    const hashedPassword = await this.hashPassword(newPassword);
    
    user.password = hashedPassword;
    user.resetCode = null;
    user.resetCodeExpires = null;
    user.resetToken = null;
    user.resetTokenExpires = null;
    
    users.set(user.id, user);
    
    return true;
  }

  async sendPasswordResetEmail(email: string, code: string): Promise<void> {
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    // For now, log to console
    console.log(`Password reset code for ${email}: ${code}`);
    console.log('In production, this would be sent via email');
  }

  async updateUserProfile(userId: string, data: { name?: string; preferences?: any }): Promise<User> {
    const user = users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (data.name !== undefined) user.name = data.name;
    if (data.preferences !== undefined) {
      user.preferences = { ...user.preferences, ...data.preferences };
    }

    users.set(userId, user);

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

export const authService = new MockAuthService();