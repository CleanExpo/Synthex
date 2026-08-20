import { encryptCredentials, decryptCredentials } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';

export type IntegrationPlatform =
  | 'twitter'
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'pinterest'
  | 'threads';

export type IntegrationStatus = 'active' | 'expired' | 'error' | 'disconnected';

export interface UserIntegration {
  id: string;
  user_id: string;
  platform: IntegrationPlatform;
  credentials: string;
  account_name?: string;
  account_id?: string;
  connected_at: string;
  last_used?: string;
  last_sync?: string;
  status: IntegrationStatus;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

function getEncryptionKey() {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('FIELD_ENCRYPTION_KEY environment variable is required');
  }
  return key;
}

export class IntegrationService {
  static validateCredentials(
    _platform: IntegrationPlatform,
    credentials: Record<string, unknown>
  ) {
    const missing = Object.keys(credentials).length > 0 ? [] : ['credentials'];
    const isValid = missing.length === 0;
    return {
      valid: isValid,
      isValid,
      missing,
      error: isValid ? null : 'Credentials are required',
    };
  }

  static async connectIntegration(
    userId: string,
    platform: IntegrationPlatform,
    credentials: Record<string, unknown>,
    accountName?: string
  ): Promise<UserIntegration> {
    const encryptedCredentials = encryptCredentials(
      credentials,
      getEncryptionKey()
    );
    const existing = await prisma.platformConnection.findFirst({
      where: { userId, platform },
    });
    const record = existing
      ? await prisma.platformConnection.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            accessToken: encryptedCredentials,
            ...(accountName && { profileName: accountName }),
          },
        })
      : await prisma.platformConnection.create({
          data: {
            userId,
            organizationId: 'legacy-platform',
            platform,
            profileName: accountName,
            isActive: true,
            accessToken: encryptedCredentials,
          },
        });

    return {
      id: record.id,
      user_id: userId,
      platform,
      credentials: encryptedCredentials,
      account_name: record.profileName || accountName,
      connected_at: record.createdAt.toISOString(),
      status: 'active',
    };
  }

  static async getUserIntegrations(userId: string): Promise<UserIntegration[]> {
    const records = await prisma.platformConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(record => ({
      id: record.id,
      user_id: userId,
      platform: record.platform as IntegrationPlatform,
      credentials: record.accessToken || '',
      account_name: record.profileName || undefined,
      connected_at: record.createdAt.toISOString(),
      last_sync: record.lastSync?.toISOString(),
      status: record.isActive ? 'active' : 'disconnected',
    }));
  }

  static async getIntegrationWithCredentials(
    userId: string,
    platform: IntegrationPlatform
  ) {
    const record = await prisma.platformConnection.findFirst({
      where: { userId, platform, isActive: true },
    });

    if (!record?.accessToken) {
      throw new Error('Integration not found');
    }

    return {
      integration: {
        id: record.id,
        user_id: userId,
        platform,
        credentials: record.accessToken,
        account_name: record.profileName || undefined,
        connected_at: record.createdAt.toISOString(),
        last_sync: record.lastSync?.toISOString(),
        status: 'active' as const,
      },
      credentials: decryptCredentials(record.accessToken, getEncryptionKey()),
    };
  }

  static async disconnectIntegration(
    userId: string,
    platform: IntegrationPlatform
  ) {
    await prisma.platformConnection.updateMany({
      where: { userId, platform },
      data: { isActive: false },
    });
  }
}
