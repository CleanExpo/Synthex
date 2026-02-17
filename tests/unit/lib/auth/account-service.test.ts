/**
 * Unit Tests for Account Service
 *
 * Tests the multi-provider account management system:
 * - Account creation (OAuth and email)
 * - Account linking and unlinking
 * - Token management (encrypted storage/retrieval)
 * - Account retrieval and lookup
 * - Error handling and edge cases
 */

// Mock dependencies before imports
jest.mock('@/lib/prisma', () => {
  const mockAccountModel = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  };

  const mockUserModel = {
    findUnique: jest.fn(),
    update: jest.fn(),
  };

  const prisma = {
    account: mockAccountModel,
    user: mockUserModel,
  };

  return {
    __esModule: true,
    default: prisma,
    prisma,
  };
});

jest.mock('@/lib/security/field-encryption', () => ({
  encryptField: jest.fn((value: string | null | undefined) => {
    if (value === null || value === undefined || value === '') return null;
    return `encrypted:${value}`;
  }),
  decryptField: jest.fn((value: string | null | undefined) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string' && value.startsWith('encrypted:')) {
      return value.replace('encrypted:', '');
    }
    return value;
  }),
}));

import { AccountService, accountService } from '@/lib/auth/account-service';
import prisma from '@/lib/prisma';
import { encryptField, decryptField } from '@/lib/security/field-encryption';
import type { AuthProvider, OAuthProfile, OAuthTokens } from '@/types/auth';

// Type helpers for mocked prisma
const mockAccount = (prisma as any).account;
const mockUser = (prisma as any).user;

describe('AccountService', () => {
  // Test fixtures
  const TEST_USER_ID = 'user-123';
  const TEST_PROVIDER: AuthProvider = 'google';
  const TEST_PROFILE: OAuthProfile = {
    id: 'google-id-456',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
  };
  const TEST_TOKENS: OAuthTokens = {
    accessToken: 'access-token-abc',
    refreshToken: 'refresh-token-def',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    tokenType: 'Bearer',
    scope: 'openid email profile',
    idToken: 'id-token-ghi',
  };
  const TEST_ACCOUNT = {
    id: 'account-789',
    userId: TEST_USER_ID,
    type: 'oauth',
    provider: 'google',
    providerAccountId: 'google-id-456',
    accessToken: 'encrypted:access-token-abc',
    refreshToken: 'encrypted:refresh-token-def',
    expiresAt: TEST_TOKENS.expiresAt,
    tokenType: 'Bearer',
    scope: 'openid email profile',
    idToken: 'encrypted:id-token-ghi',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Restore encryption mock implementations (resetMocks clears them)
    (encryptField as jest.Mock).mockImplementation(
      (value: string | null | undefined) => {
        if (value === null || value === undefined || value === '') return null;
        return `encrypted:${value}`;
      }
    );
    (decryptField as jest.Mock).mockImplementation(
      (value: string | null | undefined) => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'string' && value.startsWith('encrypted:')) {
          return value.replace('encrypted:', '');
        }
        return value;
      }
    );
  });

  // ==========================================
  // Singleton
  // ==========================================

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = AccountService.getInstance();
      const instance2 = AccountService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export a singleton as accountService', () => {
      expect(accountService).toBeInstanceOf(AccountService);
    });
  });

  // ==========================================
  // Account Creation
  // ==========================================

  describe('createAccount', () => {
    it('should create an OAuth account with encrypted tokens', async () => {
      mockAccount.create.mockResolvedValue(TEST_ACCOUNT);

      const result = await accountService.createAccount(
        TEST_USER_ID,
        TEST_PROVIDER,
        TEST_PROFILE,
        TEST_TOKENS
      );

      expect(mockAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          type: 'oauth',
          provider: 'google',
          providerAccountId: 'google-id-456',
        }),
      });
      expect(encryptField).toHaveBeenCalledWith(TEST_TOKENS.accessToken);
      expect(encryptField).toHaveBeenCalledWith(TEST_TOKENS.refreshToken);
      expect(encryptField).toHaveBeenCalledWith(TEST_TOKENS.idToken);
      expect(result).toEqual({
        id: 'account-789',
        provider: 'google',
        providerAccountId: 'google-id-456',
        createdAt: TEST_ACCOUNT.createdAt,
      });
    });

    it('should create an account without tokens', async () => {
      mockAccount.create.mockResolvedValue({
        ...TEST_ACCOUNT,
        accessToken: null,
        refreshToken: null,
        idToken: null,
      });

      await accountService.createAccount(TEST_USER_ID, TEST_PROVIDER, TEST_PROFILE);

      expect(mockAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: null,
          tokenType: null,
          scope: null,
        }),
      });
    });
  });

  describe('createEmailAccount', () => {
    it('should create a credentials-type account for email', async () => {
      const emailAccount = {
        id: 'email-account-1',
        userId: TEST_USER_ID,
        type: 'credentials',
        provider: 'email',
        providerAccountId: 'user@example.com',
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date('2025-01-15'),
      };
      mockAccount.create.mockResolvedValue(emailAccount);

      const result = await accountService.createEmailAccount(
        TEST_USER_ID,
        'user@example.com'
      );

      expect(mockAccount.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          type: 'credentials',
          provider: 'email',
          providerAccountId: 'user@example.com',
        },
      });
      expect(result.provider).toBe('email');
      expect(result.providerAccountId).toBe('user@example.com');
    });
  });

  // ==========================================
  // Account Linking
  // ==========================================

  describe('linkAccount', () => {
    it('should create a new account link when provider not yet linked', async () => {
      mockAccount.findUnique.mockResolvedValue(null);
      mockAccount.create.mockResolvedValue(TEST_ACCOUNT);
      mockUser.update.mockResolvedValue({});

      const result = await accountService.linkAccount(
        TEST_USER_ID,
        TEST_PROVIDER,
        TEST_PROFILE,
        TEST_TOKENS
      );

      expect(result.success).toBe(true);
      expect(result.account).toBeDefined();
      expect(result.account!.provider).toBe('google');
    });

    it('should update tokens when provider already linked to same user', async () => {
      mockAccount.findUnique.mockResolvedValue({
        ...TEST_ACCOUNT,
        userId: TEST_USER_ID,
        user: { id: TEST_USER_ID, email: 'test@example.com' },
      });
      mockAccount.update.mockResolvedValue(TEST_ACCOUNT);

      const result = await accountService.linkAccount(
        TEST_USER_ID,
        TEST_PROVIDER,
        TEST_PROFILE,
        TEST_TOKENS
      );

      expect(result.success).toBe(true);
      expect(mockAccount.update).toHaveBeenCalledWith({
        where: { id: TEST_ACCOUNT.id },
        data: expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        }),
      });
    });

    it('should return conflict error when provider linked to different user', async () => {
      mockAccount.findUnique.mockResolvedValue({
        ...TEST_ACCOUNT,
        userId: 'other-user-456',
        user: { id: 'other-user-456', email: 'other@example.com' },
      });

      const result = await accountService.linkAccount(
        TEST_USER_ID,
        TEST_PROVIDER,
        TEST_PROFILE,
        TEST_TOKENS
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already linked to another user');
      expect(result.conflictEmail).toBe('other@example.com');
    });

    it('should update legacy Google fields when linking Google account', async () => {
      mockAccount.findUnique.mockResolvedValue(null);
      mockAccount.create.mockResolvedValue(TEST_ACCOUNT);
      mockUser.update.mockResolvedValue({});

      await accountService.linkAccount(
        TEST_USER_ID,
        'google',
        TEST_PROFILE,
        TEST_TOKENS
      );

      expect(mockUser.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: expect.objectContaining({
          googleId: TEST_PROFILE.id,
          authProvider: 'google',
        }),
      });
    });

    it('should catch and return errors gracefully', async () => {
      mockAccount.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const result = await accountService.linkAccount(
        TEST_USER_ID,
        TEST_PROVIDER,
        TEST_PROFILE,
        TEST_TOKENS
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  // ==========================================
  // Account Retrieval
  // ==========================================

  describe('getAccountsByUserId', () => {
    it('should return linked accounts from Account table', async () => {
      mockAccount.findMany.mockResolvedValue([TEST_ACCOUNT]);
      mockUser.findUnique.mockResolvedValue({
        password: null,
        email: 'test@example.com',
        googleId: null,
      });

      const accounts = await accountService.getAccountsByUserId(TEST_USER_ID);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].provider).toBe('google');
    });

    it('should include implicit email account when user has password', async () => {
      mockAccount.findMany.mockResolvedValue([]);
      mockUser.findUnique.mockResolvedValue({
        password: 'hashed-password',
        email: 'user@example.com',
        googleId: null,
      });

      const accounts = await accountService.getAccountsByUserId(TEST_USER_ID);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe('implicit-email');
      expect(accounts[0].provider).toBe('email');
      expect(accounts[0].isPrimary).toBe(true);
    });

    it('should include legacy Google account when googleId set but not in Account table', async () => {
      mockAccount.findMany.mockResolvedValue([]);
      mockUser.findUnique.mockResolvedValue({
        password: null,
        email: 'user@example.com',
        googleId: 'legacy-google-id',
      });

      const accounts = await accountService.getAccountsByUserId(TEST_USER_ID);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe('legacy-google');
      expect(accounts[0].provider).toBe('google');
    });
  });

  describe('getAccountByProvider', () => {
    it('should return account for matching provider', async () => {
      mockAccount.findFirst.mockResolvedValue(TEST_ACCOUNT);

      const account = await accountService.getAccountByProvider(
        TEST_USER_ID,
        'google'
      );

      expect(account).not.toBeNull();
      expect(account!.provider).toBe('google');
    });

    it('should fall back to legacy Google field', async () => {
      mockAccount.findFirst.mockResolvedValue(null);
      mockUser.findUnique.mockResolvedValue({ googleId: 'legacy-id' });

      const account = await accountService.getAccountByProvider(
        TEST_USER_ID,
        'google'
      );

      expect(account).not.toBeNull();
      expect(account!.id).toBe('legacy-google');
    });

    it('should return null when provider not found', async () => {
      mockAccount.findFirst.mockResolvedValue(null);

      const account = await accountService.getAccountByProvider(
        TEST_USER_ID,
        'github'
      );

      expect(account).toBeNull();
    });
  });

  describe('findUserByProviderAccount', () => {
    it('should find user by provider and providerAccountId', async () => {
      mockAccount.findUnique.mockResolvedValue({
        ...TEST_ACCOUNT,
        user: { id: TEST_USER_ID, email: 'test@example.com' },
      });

      const result = await accountService.findUserByProviderAccount(
        'google',
        'google-id-456'
      );

      expect(result).toEqual({
        userId: TEST_USER_ID,
        email: 'test@example.com',
      });
    });

    it('should fall back to legacy googleId field for Google provider', async () => {
      mockAccount.findUnique.mockResolvedValue(null);
      mockUser.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
      });

      const result = await accountService.findUserByProviderAccount(
        'google',
        'legacy-google-id'
      );

      expect(result).toEqual({
        userId: TEST_USER_ID,
        email: 'test@example.com',
      });
    });

    it('should return null when no matching account found', async () => {
      mockAccount.findUnique.mockResolvedValue(null);

      const result = await accountService.findUserByProviderAccount(
        'github',
        'nonexistent-id'
      );

      expect(result).toBeNull();
    });
  });

  describe('findUserByEmail', () => {
    it('should return user with account providers', async () => {
      mockUser.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
        password: 'hashed-pw',
        googleId: null,
      });
      mockAccount.findMany.mockResolvedValue([
        { provider: 'google' },
      ]);

      const result = await accountService.findUserByEmail('test@example.com');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(TEST_USER_ID);
      expect(result!.hasPassword).toBe(true);
      expect(result!.providers).toContain('email');
      expect(result!.providers).toContain('google');
    });

    it('should return null for non-existent user', async () => {
      mockUser.findUnique.mockResolvedValue(null);

      const result = await accountService.findUserByEmail('nobody@example.com');

      expect(result).toBeNull();
    });
  });

  // ==========================================
  // Account Unlinking
  // ==========================================

  describe('canUnlinkAccount', () => {
    it('should allow unlinking when other auth methods remain', async () => {
      // Mock getAccountsByUserId behavior
      mockAccount.findMany.mockResolvedValue([
        { ...TEST_ACCOUNT, provider: 'google', providerAccountId: 'g-id' },
      ]);
      mockUser.findUnique.mockResolvedValue({
        password: 'hashed-pw',
        email: 'test@example.com',
        googleId: null,
      });

      const result = await accountService.canUnlinkAccount(TEST_USER_ID, 'google');

      expect(result.canUnlink).toBe(true);
      expect(result.remainingMethods).toBeDefined();
    });

    it('should deny unlinking when it is the only auth method', async () => {
      mockAccount.findMany.mockResolvedValue([
        { ...TEST_ACCOUNT, provider: 'google', providerAccountId: 'g-id', id: 'acc-1', createdAt: new Date() },
      ]);
      // First call for getAccountsByUserId -> user lookup, second for canUnlinkAccount -> password check
      mockUser.findUnique
        .mockResolvedValueOnce({
          password: null,
          email: 'test@example.com',
          googleId: null,
        })
        .mockResolvedValueOnce({
          password: null,
        });

      const result = await accountService.canUnlinkAccount(TEST_USER_ID, 'google');

      expect(result.canUnlink).toBe(false);
      expect(result.reason).toContain('Cannot unlink');
    });
  });

  describe('unlinkAccount', () => {
    it('should delete the account link and return success', async () => {
      // Setup: user has password + google => can unlink google
      mockAccount.findMany.mockResolvedValue([
        { ...TEST_ACCOUNT, provider: 'google', providerAccountId: 'g-id', id: 'acc-1', createdAt: new Date() },
      ]);
      mockUser.findUnique
        .mockResolvedValueOnce({
          password: 'hashed-pw',
          email: 'test@example.com',
          googleId: null,
        })
        .mockResolvedValueOnce({
          password: 'hashed-pw',
        });
      mockAccount.deleteMany.mockResolvedValue({ count: 1 });
      mockUser.update.mockResolvedValue({});

      const result = await accountService.unlinkAccount(TEST_USER_ID, 'google');

      expect(result.success).toBe(true);
      expect(mockAccount.deleteMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID, provider: 'google' },
      });
    });

    it('should clear legacy fields when unlinking Google', async () => {
      mockAccount.findMany.mockResolvedValue([
        { ...TEST_ACCOUNT, provider: 'google', providerAccountId: 'g-id', id: 'acc-1', createdAt: new Date() },
      ]);
      mockUser.findUnique
        .mockResolvedValueOnce({
          password: 'hashed-pw',
          email: 'test@example.com',
          googleId: null,
        })
        .mockResolvedValueOnce({
          password: 'hashed-pw',
        });
      mockAccount.deleteMany.mockResolvedValue({ count: 1 });
      mockUser.update.mockResolvedValue({});

      await accountService.unlinkAccount(TEST_USER_ID, 'google');

      expect(mockUser.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { googleId: null, authProvider: 'local' },
      });
    });

    it('should return error when cannot unlink (only auth method)', async () => {
      mockAccount.findMany.mockResolvedValue([
        { ...TEST_ACCOUNT, provider: 'google', providerAccountId: 'g-id', id: 'acc-1', createdAt: new Date() },
      ]);
      mockUser.findUnique
        .mockResolvedValueOnce({
          password: null,
          email: 'test@example.com',
          googleId: null,
        })
        .mockResolvedValueOnce({
          password: null,
        });

      const result = await accountService.unlinkAccount(TEST_USER_ID, 'google');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot unlink');
    });
  });

  // ==========================================
  // Token Management
  // ==========================================

  describe('updateTokens', () => {
    it('should update encrypted tokens for a provider', async () => {
      mockAccount.updateMany.mockResolvedValue({ count: 1 });

      await accountService.updateTokens(TEST_USER_ID, 'google', TEST_TOKENS);

      expect(mockAccount.updateMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID, provider: 'google' },
        data: expect.objectContaining({
          accessToken: 'encrypted:access-token-abc',
          refreshToken: 'encrypted:refresh-token-def',
          idToken: 'encrypted:id-token-ghi',
        }),
      });
      expect(encryptField).toHaveBeenCalledWith(TEST_TOKENS.accessToken);
    });
  });

  describe('getTokens', () => {
    it('should return decrypted tokens', async () => {
      mockAccount.findFirst.mockResolvedValue({
        accessToken: 'encrypted:access-token-abc',
        refreshToken: 'encrypted:refresh-token-def',
        expiresAt: TEST_TOKENS.expiresAt,
        tokenType: 'Bearer',
        scope: 'openid email profile',
        idToken: 'encrypted:id-token-ghi',
      });

      const tokens = await accountService.getTokens(TEST_USER_ID, 'google');

      expect(tokens).not.toBeNull();
      expect(tokens!.accessToken).toBe('access-token-abc');
      expect(tokens!.refreshToken).toBe('refresh-token-def');
      expect(tokens!.idToken).toBe('id-token-ghi');
      expect(decryptField).toHaveBeenCalledWith('encrypted:access-token-abc');
    });

    it('should return null when no account found', async () => {
      mockAccount.findFirst.mockResolvedValue(null);

      const tokens = await accountService.getTokens(TEST_USER_ID, 'google');

      expect(tokens).toBeNull();
    });

    it('should return null when account has no access token', async () => {
      mockAccount.findFirst.mockResolvedValue({
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        tokenType: null,
        scope: null,
        idToken: null,
      });

      const tokens = await accountService.getTokens(TEST_USER_ID, 'google');

      expect(tokens).toBeNull();
    });
  });
});
