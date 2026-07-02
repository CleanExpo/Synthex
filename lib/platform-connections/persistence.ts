import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type PersistPlatformConnectionInput = {
  userId: string;
  organizationId: string | null;
  platform: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scope?: string | null;
  profileId: string;
  profileName?: string | null;
  accountType?: string;
  metadata?: Prisma.InputJsonObject;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

function connectionScope(input: PersistPlatformConnectionInput) {
  return input.organizationId
    ? { organizationId: input.organizationId, platform: input.platform }
    : {
        userId: input.userId,
        organizationId: null,
        platform: input.platform,
      };
}

async function updateExistingConnection(
  connectionId: string,
  input: PersistPlatformConnectionInput
) {
  return prisma.platformConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: input.accessToken,
      ...(input.refreshToken ? { refreshToken: input.refreshToken } : {}),
      expiresAt: input.expiresAt ?? null,
      ...(input.scope ? { scope: input.scope } : {}),
      profileId: input.profileId,
      profileName: input.profileName ?? undefined,
      accountType: input.accountType ?? undefined,
      isActive: true,
      deletedAt: null,
      lastSync: new Date(),
      updatedAt: new Date(),
      metadata: input.metadata,
    },
    select: { id: true },
  });
}

async function deactivateDuplicateConnections(
  input: PersistPlatformConnectionInput,
  canonicalConnectionId: string
) {
  return prisma.platformConnection.updateMany({
    where: {
      ...connectionScope(input),
      id: { not: canonicalConnectionId },
      isActive: true,
    },
    data: {
      isActive: false,
      accessToken: '',
      refreshToken: null,
      deletedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function persistPlatformConnection(
  input: PersistPlatformConnectionInput
) {
  const scope = connectionScope(input);

  const existing = await prisma.platformConnection.findFirst({
    where: scope,
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });

  let connection: { id: string };

  if (existing) {
    connection = await updateExistingConnection(existing.id, input);
  } else {
    try {
      connection = await prisma.platformConnection.create({
        data: {
          userId: input.userId,
          organizationId: input.organizationId,
          platform: input.platform,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken ?? null,
          expiresAt: input.expiresAt ?? null,
          scope: input.scope ?? '',
          profileId: input.profileId,
          profileName: input.profileName ?? undefined,
          accountType: input.accountType ?? 'personal',
          isActive: true,
          lastSync: new Date(),
          metadata: input.metadata,
        },
        select: { id: true },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      logger.warn('Platform connection create raced with an existing row', {
        platform: input.platform,
        organizationId: input.organizationId,
      });

      const racedExisting = await prisma.platformConnection.findFirst({
        where: scope,
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      if (!racedExisting) throw error;
      connection = await updateExistingConnection(racedExisting.id, input);
    }
  }

  await deactivateDuplicateConnections(input, connection.id);

  return connection;
}
