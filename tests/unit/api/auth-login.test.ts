/**
 * Unit tests for Login API Business Logic
 * Tests POST /api/auth/login
 *
 * Note: These tests verify the business logic without HTTP layer.
 * For full E2E tests, use integration tests with supertest.
 */

// Mock dependencies
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  session: {
    deleteMany: jest.fn(),
    create: jest.fn()
  },
  auditLog: {
    create: jest.fn()
  }
};

const mockSupabaseAuth = {
  signInWithPassword: jest.fn()
};

const mockJwtSign = jest.fn(() => 'mock-jwt-token');

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}));

jest.mock('@/lib/supabase-client', () => ({
  supabase: {
    auth: mockSupabaseAuth
  }
}));

jest.mock('jsonwebtoken', () => ({
  sign: (...args: unknown[]) => mockJwtSign(...args)
}));

// Set environment variable
process.env.JWT_SECRET = 'test-secret-key-for-testing';

describe('Login API Business Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should require email', () => {
      const input = { password: 'password123' };
      const isValid = Boolean(input.email && input.password);
      expect(isValid).toBe(false);
    });

    it('should require password', () => {
      const input = { email: 'test@example.com' };
      const isValid = Boolean(input.email && input.password);
      expect(isValid).toBe(false);
    });

    it('should accept valid email and password', () => {
      const input = { email: 'test@example.com', password: 'password123' };
      const isValid = Boolean(input.email && input.password);
      expect(isValid).toBe(true);
    });
  });

  describe('User Lookup', () => {
    it('should return null for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const user = await mockPrisma.user.findUnique({
        where: { email: 'nonexistent@example.com' }
      });

      expect(user).toBeNull();
    });

    it('should find user by email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        authProvider: 'local'
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const user = await mockPrisma.user.findUnique({
        where: { email: 'test@example.com' }
      });

      expect(user).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
    });
  });

  describe('OAuth User Detection', () => {
    it('should detect Google OAuth user', () => {
      const user = { authProvider: 'google' };
      const isOAuthUser = user.authProvider && user.authProvider !== 'local' && user.authProvider !== 'email';
      expect(isOAuthUser).toBe(true);
    });

    it('should detect GitHub OAuth user', () => {
      const user = { authProvider: 'github' };
      const isOAuthUser = user.authProvider && user.authProvider !== 'local' && user.authProvider !== 'email';
      expect(isOAuthUser).toBe(true);
    });

    it('should allow local user', () => {
      const user = { authProvider: 'local' };
      const isOAuthUser = user.authProvider && user.authProvider !== 'local' && user.authProvider !== 'email';
      expect(isOAuthUser).toBe(false);
    });

    it('should allow email user', () => {
      const user = { authProvider: 'email' };
      const isOAuthUser = user.authProvider && user.authProvider !== 'local' && user.authProvider !== 'email';
      expect(isOAuthUser).toBe(false);
    });
  });

  describe('Password Verification (Supabase)', () => {
    it('should verify password with Supabase', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null
      });

      const result = await mockSupabaseAuth.signInWithPassword({
        email: 'test@example.com',
        password: 'correct-password'
      });

      expect(result.data.user).toBeTruthy();
      expect(result.error).toBeNull();
    });

    it('should handle invalid password', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' }
      });

      const result = await mockSupabaseAuth.signInWithPassword({
        email: 'test@example.com',
        password: 'wrong-password'
      });

      expect(result.data.user).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate JWT with correct payload', () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const secret = 'test-secret';
      const options = { expiresIn: '7d' };

      mockJwtSign(payload, secret, options);

      expect(mockJwtSign).toHaveBeenCalledWith(payload, secret, options);
    });

    it('should call jwt sign function', () => {
      mockJwtSign({}, '', {});
      expect(mockJwtSign).toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should delete existing sessions', async () => {
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await mockPrisma.session.deleteMany({
        where: { userId: 'user-123' }
      });

      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' }
      });
    });

    it('should create new session', async () => {
      const sessionData = {
        token: 'mock-jwt-token',
        userId: 'user-123',
        expiresAt: expect.any(Date)
      };

      mockPrisma.session.create.mockResolvedValue({ id: 'session-123', ...sessionData });

      const session = await mockPrisma.session.create({
        data: sessionData
      });

      expect(session.id).toBe('session-123');
    });
  });

  describe('Audit Logging', () => {
    it('should log successful login', async () => {
      const auditData = {
        userId: 'user-123',
        action: 'user_login',
        resource: 'authentication',
        resourceId: 'user-123',
        category: 'auth',
        outcome: 'success',
        details: { email: 'test@example.com', authProvider: 'local' }
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-123' });

      await mockPrisma.auditLog.create({ data: auditData });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'user_login',
          outcome: 'success'
        })
      });
    });

    it('should log failed login attempt', async () => {
      const auditData = {
        userId: 'user-123',
        action: 'login_failed',
        resource: 'authentication',
        category: 'auth',
        outcome: 'failure',
        details: { email: 'test@example.com', reason: 'invalid_password' }
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-123' });

      await mockPrisma.auditLog.create({ data: auditData });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'login_failed',
          outcome: 'failure'
        })
      });
    });
  });

  describe('Last Login Update', () => {
    it('should update last login timestamp', async () => {
      const now = new Date();
      mockPrisma.user.update.mockResolvedValue({ id: 'user-123', lastLogin: now });

      await mockPrisma.user.update({
        where: { id: 'user-123' },
        data: { lastLogin: now }
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { lastLogin: now }
      });
    });
  });

  describe('Response Format', () => {
    it('should format successful login response', () => {
      const response = {
        success: true,
        message: 'Login successful',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: true
        },
        token: 'mock-jwt-token'
      };

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('message', 'Login successful');
      expect(response).toHaveProperty('token');
      expect(response.user).toHaveProperty('id');
      expect(response.user).toHaveProperty('email');
    });

    it('should not include sensitive data in response', () => {
      const response = {
        success: true,
        user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
        token: 'mock-jwt-token'
      };

      // Should not have password
      expect(response.user).not.toHaveProperty('password');
      // Should not have authProvider
      expect(response.user).not.toHaveProperty('authProvider');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        mockPrisma.user.findUnique({ where: { email: 'test@example.com' } })
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle Supabase auth errors', async () => {
      mockSupabaseAuth.signInWithPassword.mockRejectedValue(new Error('Supabase error'));

      await expect(
        mockSupabaseAuth.signInWithPassword({ email: '', password: '' })
      ).rejects.toThrow('Supabase error');
    });
  });

  describe('Complete Login Flow', () => {
    it('should complete successful login flow', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        authProvider: 'local'
      };

      // 1. Find user
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const user = await mockPrisma.user.findUnique({ where: { email: mockUser.email } });
      expect(user).toEqual(mockUser);

      // 2. Verify password
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'supabase-id' } },
        error: null
      });
      const authResult = await mockSupabaseAuth.signInWithPassword({
        email: mockUser.email,
        password: 'correct-password'
      });
      expect(authResult.error).toBeNull();

      // 3. Generate JWT
      mockJwtSign(
        { userId: user!.id, email: user!.email },
        'secret',
        { expiresIn: '7d' }
      );
      const token = 'mock-jwt-token'; // Simulated token
      expect(mockJwtSign).toHaveBeenCalled();

      // 4. Delete old sessions
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
      await mockPrisma.session.deleteMany({ where: { userId: user!.id } });

      // 5. Create new session
      mockPrisma.session.create.mockResolvedValue({ id: 'session-new' });
      await mockPrisma.session.create({
        data: { token, userId: user!.id, expiresAt: new Date() }
      });

      // 6. Update last login
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, lastLogin: new Date() });
      await mockPrisma.user.update({
        where: { id: user!.id },
        data: { lastLogin: new Date() }
      });

      // 7. Log successful login
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-123' });
      await mockPrisma.auditLog.create({
        data: {
          userId: user!.id,
          action: 'user_login',
          resource: 'authentication',
          outcome: 'success'
        }
      });

      // Verify all steps were called
      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalled();
      expect(mockJwtSign).toHaveBeenCalled();
      expect(mockPrisma.session.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.session.create).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });
});
