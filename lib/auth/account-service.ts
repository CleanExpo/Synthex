/**
 * Account Service for Multi-Provider Authentication
 *
 * Manages linked authentication accounts (OAuth providers + email/password).
 * Enables users to link multiple auth methods to a single account.
 *
 * @module lib/auth/account-service
 * @version 2.1.0 - Added FIELD_ENCRYPTION_KEY support for production
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - FIELD_ENCRYPTION_KEY: 32-byte hex key for token encryption (CRITICAL)
 *
 * FAILURE MODE: Operations will throw if database unavailable
 * NOTE: During migration, some methods fall back to legacy fields if Account table doesn't exist
 * NOTE: OAuth tokens are encrypted at rest using AES-256-GCM
 */

import prisma from '@/lib/prisma';
import { encryptField, decryptField } from '@/lib/security/field-encryption';
import type {
  AuthProvider,
  OAuthProfile,
  OAuthTokens,
  LinkedAccount,
  AccountLinkResult,
  AccountUnlinkResult,
  CanUnlinkResult,
} from '@/types/auth';

// Type for Prisma account operations
type PrismaAccount = {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  tokenType: string | null;
  scope: string | null;
  idToken: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Helper to safely access account model (may not exist during migration)
function getAccountModel(): any {
  return (prisma as any).account;
}

// ==========================================
// Account Service Class
// ==========================================

export class AccountService {
  private static instance: AccountService;

  private constructor() {}

  static getInstance(): AccountService {
    if (!AccountService.instance) {
      AccountService.instance = new AccountService();
    }
    return AccountService.instance;
  }

  // ==========================================
  // Account Creation & Linking
  // ==========================================

  /**
   * Create an OAuth account for a user
   */
  async createAccount(
    userId: string,
    provider: AuthProvider,
    profile: OAuthProfile,
    tokens?: OAuthTokens
  ): Promise<LinkedAccount> {
    const accountModel = getAccountModel();
    if (!accountModel) {
      // Fallback: return minimal account object
      return {
        id: `legacy-${provider}-${profile.id}`,
        provider,
        providerAccountId: profile.id,
        createdAt: new Date(),
      };
    }

    // Encrypt sensitive tokens before storing
    const account = await accountModel.create({
      data: {
        userId,
        type: 'oauth',
        provider,
        providerAccountId: profile.id,
        accessToken: encryptField(tokens?.accessToken),
        refreshToken: encryptField(tokens?.refreshToken),
        expiresAt: tokens?.expiresAt || null,
        tokenType: tokens?.tokenType || null,
        scope: tokens?.scope || null,
        idToken: encryptField(tokens?.idToken),
      },
    });

    return this.toLinkedAccount(account);
  }

  /**
   * Create an email/password account record
   */
  async createEmailAccount(userId: string, email: string): Promise<LinkedAccount> {
    const accountModel = getAccountModel();
    if (!accountModel) {
      return {
        id: `legacy-email-${email}`,
        provider: 'email',
        providerAccountId: email,
        createdAt: new Date(),
      };
    }

    const account = await accountModel.create({
      data: {
        userId,
        type: 'credentials',
        provider: 'email',
        providerAccountId: email,
      },
    });

    return this.toLinkedAccount(account);
  }

  /**
   * Link an OAuth provider to an existing user account
   */
  async linkAccount(
    userId: string,
    provider: AuthProvider,
    profile: OAuthProfile,
    tokens?: OAuthTokens
  ): Promise<AccountLinkResult> {
    try {
      const accountModel = getAccountModel();

      // Check if this OAuth account is already linked to another user
      if (accountModel) {
        const existingAccount = await accountModel.findUnique({
          where: {
            provider_providerAccountId: {
              provider,
              providerAccountId: profile.id,
            },
          },
          include: {
            user: true,
          },
        });

        if (existingAccount) {
          if (existingAccount.userId === userId) {
            // Already linked to this user - update tokens (encrypted)
            const updated = await accountModel.update({
              where: { id: existingAccount.id },
              data: {
                accessToken: encryptField(tokens?.accessToken),
                refreshToken: encryptField(tokens?.refreshToken),
                expiresAt: tokens?.expiresAt || null,
                tokenType: tokens?.tokenType || null,
                scope: tokens?.scope || null,
                idToken: encryptField(tokens?.idToken),
              },
            });
            return {
              success: true,
              account: this.toLinkedAccount(updated),
            };
          }

          // Linked to a different user - conflict
          return {
            success: false,
            error: `This ${provider} account is already linked to another user`,
            conflictEmail: existingAccount.user.email,
          };
        }
      }

      // Create new link
      const account = await this.createAccount(userId, provider, profile, tokens);

      // Update user's legacy fields for backwards compatibility
      if (provider === 'google') {
        await prisma.user.update({
          where: { id: userId },
          data: {
            googleId: profile.id,
            avatar: profile.avatar || undefined,
            authProvider: 'google',
          },
        });
      }

      return {
        success: true,
        account,
      };
    } catch (error) {
      console.error('[AccountService] Link error:', error);
      return {
        success: false,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Failed to link account',
      };
    }
  }

  // ==========================================
  // Account Retrieval
  // ==========================================

  /**
   * Get all linked accounts for a user
   */
  async getAccountsByUserId(userId: string): Promise<LinkedAccount[]> {
    const accountModel = getAccountModel();
    let accounts: PrismaAccount[] = [];

    if (accountModel) {
      try {
        accounts = await accountModel.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });
      } catch {
        // Table may not exist
      }
    }

    // Also check if user has a password (implicit email account)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, email: true, googleId: true },
    });

    const linkedAccounts = accounts.map((a) => this.toLinkedAccount(a));

    // If user has password but no email account record, include implicit email account
    const hasEmailAccount = accounts.some((a) => a.provider === 'email');
    if (user?.password && !hasEmailAccount) {
      linkedAccounts.unshift({
        id: 'implicit-email',
        provider: 'email',
        providerAccountId: user.email,
        createdAt: new Date(),
        isPrimary: true,
      });
    }

    // Include legacy Google account if not in Account table
    const hasGoogleAccount = accounts.some((a) => a.provider === 'google');
    if (user?.googleId && !hasGoogleAccount) {
      linkedAccounts.push({
        id: 'legacy-google',
        provider: 'google',
        providerAccountId: user.googleId,
        createdAt: new Date(),
      });
    }

    return linkedAccounts;
  }

  /**
   * Get a specific account by provider
   */
  async getAccountByProvider(
    userId: string,
    provider: AuthProvider
  ): Promise<LinkedAccount | null> {
    const accountModel = getAccountModel();

    if (accountModel) {
      try {
        const account = await accountModel.findFirst({
          where: { userId, provider },
        });
        if (account) {
          return this.toLinkedAccount(account);
        }
      } catch {
        // Table may not exist
      }
    }

    // Fall back to legacy fields
    if (provider === 'google') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { googleId: true },
      });
      if (user?.googleId) {
        return {
          id: 'legacy-google',
          provider: 'google',
          providerAccountId: user.googleId,
          createdAt: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Find user by OAuth provider ID
   */
  async findUserByProviderAccount(
    provider: AuthProvider,
    providerAccountId: string
  ): Promise<{ userId: string; email: string } | null> {
    const accountModel = getAccountModel();

    if (accountModel) {
      try {
        const account = await accountModel.findUnique({
          where: {
            provider_providerAccountId: {
              provider,
              providerAccountId,
            },
          },
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        });

        if (account) {
          return { userId: account.user.id, email: account.user.email };
        }
      } catch {
        // Table may not exist
      }
    }

    // Also check legacy googleId field for backwards compatibility
    if (provider === 'google') {
      const user = await prisma.user.findUnique({
        where: { googleId: providerAccountId },
        select: { id: true, email: true },
      });
      if (user) {
        return { userId: user.id, email: user.email };
      }
    }

    return null;
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<{
    id: string;
    email: string;
    hasPassword: boolean;
    providers: AuthProvider[];
  } | null> {
    // First get the user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    // Then get accounts separately (table may not exist yet during migration)
    let accountProviders: string[] = [];
    const accountModel = getAccountModel();

    if (accountModel) {
      try {
        const accounts = await accountModel.findMany({
          where: { userId: user.id },
          select: { provider: true },
        });
        accountProviders = accounts?.map((a: { provider: string }) => a.provider) || [];
      } catch {
        // Account table may not exist yet - fall back to legacy fields
        if (user.googleId) {
          accountProviders.push('google');
        }
      }
    } else {
      // Fall back to legacy fields
      if (user.googleId) {
        accountProviders.push('google');
      }
    }

    const providers: AuthProvider[] = accountProviders.map((p: string) => p as AuthProvider);

    // Include email if user has a password
    if (user.password) {
      providers.unshift('email');
    }

    return {
      id: user.id,
      email: user.email,
      hasPassword: !!user.password,
      providers,
    };
  }

  // ==========================================
  // Account Unlinking
  // ==========================================

  /**
   * Check if a provider can be unlinked
   */
  async canUnlinkAccount(
    userId: string,
    provider: AuthProvider
  ): Promise<CanUnlinkResult> {
    const accounts = await this.getAccountsByUserId(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    // Calculate remaining auth methods after unlinking
    const remainingAccounts = accounts.filter((a) => a.provider !== provider);
    const hasPassword = !!user?.password;
    const hasRemainingOAuth = remainingAccounts.some(
      (a) => a.provider !== 'email' && a.provider !== 'demo'
    );

    // User must have at least one auth method remaining
    if (!hasPassword && !hasRemainingOAuth && remainingAccounts.length === 0) {
      return {
        canUnlink: false,
        reason: 'Cannot unlink the only authentication method. Please add a password or link another provider first.',
        remainingMethods: [],
      };
    }

    const remainingMethods: AuthProvider[] = remainingAccounts.map(
      (a) => a.provider as AuthProvider
    );
    if (hasPassword && !remainingMethods.includes('email')) {
      remainingMethods.unshift('email');
    }

    return {
      canUnlink: true,
      remainingMethods,
    };
  }

  /**
   * Unlink an OAuth provider from a user account
   */
  async unlinkAccount(
    userId: string,
    provider: AuthProvider
  ): Promise<AccountUnlinkResult> {
    // First check if unlinking is allowed
    const canUnlink = await this.canUnlinkAccount(userId, provider);

    if (!canUnlink.canUnlink) {
      return {
        success: false,
        error: canUnlink.reason,
        remainingMethods: canUnlink.remainingMethods,
      };
    }

    try {
      const accountModel = getAccountModel();

      // Delete the account link
      if (accountModel) {
        try {
          await accountModel.deleteMany({
            where: { userId, provider },
          });
        } catch {
          // Table may not exist
        }
      }

      // Clear legacy fields if unlinking Google
      if (provider === 'google') {
        await prisma.user.update({
          where: { id: userId },
          data: {
            googleId: null,
            authProvider: 'local',
          },
        });
      }

      return {
        success: true,
        remainingMethods: canUnlink.remainingMethods,
      };
    } catch (error) {
      console.error('[AccountService] Unlink error:', error);
      return {
        success: false,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Failed to unlink account',
      };
    }
  }

  // ==========================================
  // Token Management
  // ==========================================

  /**
   * Update OAuth tokens for an account
   */
  async updateTokens(
    userId: string,
    provider: AuthProvider,
    tokens: OAuthTokens
  ): Promise<void> {
    const accountModel = getAccountModel();
    if (!accountModel) return;

    try {
      // Encrypt sensitive tokens before storing
      await accountModel.updateMany({
        where: { userId, provider },
        data: {
          accessToken: encryptField(tokens.accessToken),
          refreshToken: encryptField(tokens.refreshToken),
          expiresAt: tokens.expiresAt || null,
          tokenType: tokens.tokenType || null,
          scope: tokens.scope || null,
          idToken: encryptField(tokens.idToken),
        },
      });
    } catch {
      // Table may not exist
    }
  }

  /**
   * Get OAuth tokens for an account
   */
  async getTokens(
    userId: string,
    provider: AuthProvider
  ): Promise<OAuthTokens | null> {
    const accountModel = getAccountModel();
    if (!accountModel) return null;

    try {
      const account = await accountModel.findFirst({
        where: { userId, provider },
        select: {
          accessToken: true,
          refreshToken: true,
          expiresAt: true,
          tokenType: true,
          scope: true,
          idToken: true,
        },
      });

      if (!account || !account.accessToken) return null;

      // Decrypt sensitive tokens before returning
      const decryptedAccessToken = decryptField(account.accessToken);
      if (!decryptedAccessToken) return null;

      return {
        accessToken: decryptedAccessToken,
        refreshToken: decryptField(account.refreshToken) ?? undefined,
        expiresAt: account.expiresAt ?? undefined,
        tokenType: account.tokenType ?? undefined,
        scope: account.scope ?? undefined,
        idToken: decryptField(account.idToken) ?? undefined,
      };
    } catch {
      return null;
    }
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private toLinkedAccount(
    account: {
      id: string;
      provider: string;
      providerAccountId: string;
      createdAt: Date;
    }
  ): LinkedAccount {
    return {
      id: account.id,
      provider: account.provider as AuthProvider,
      providerAccountId: account.providerAccountId,
      createdAt: account.createdAt,
    };
  }
}

// Export singleton instance
export const accountService = AccountService.getInstance();
