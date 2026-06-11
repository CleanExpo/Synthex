import prisma from '../lib/prisma';
import {
  isPlaceholderPlatformToken,
  resolvePlatformAccessToken,
} from '../lib/platform-connections/token-readiness';

const APPLY = process.argv.includes('--apply');
const SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'reddit',
  'threads',
  'tiktok',
  'pinterest',
];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mergeReadinessMetadata(
  metadata: unknown,
  reason: string
): Record<string, unknown> {
  return {
    ...asRecord(metadata),
    authStatus: 'requires_reauth',
    publishReadiness: 'blocked',
    publishReadinessReason: reason,
    publishReadinessCheckedAt: new Date().toISOString(),
  };
}

async function main() {
  const now = new Date();
  const connections = await prisma.platformConnection.findMany({
    where: {
      platform: { in: SOCIAL_PLATFORMS },
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      platform: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      profileName: true,
      metadata: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [{ platform: 'asc' }, { updatedAt: 'desc' }],
  });

  const repairs = connections.flatMap(connection => {
    const accessToken = resolvePlatformAccessToken(connection.accessToken);
    const expired = connection.expiresAt ? connection.expiresAt < now : false;
    const hasRefreshToken =
      Boolean(connection.refreshToken) &&
      !isPlaceholderPlatformToken(connection.refreshToken);

    const reason = !accessToken.ok
      ? accessToken.reason
      : expired && !hasRefreshToken
        ? 'Platform token expired and no refresh token is stored'
        : null;

    if (!reason) return [];

    return [
      {
        id: connection.id,
        organizationId: connection.organization?.id ?? null,
        organizationSlug: connection.organization?.slug ?? null,
        business: connection.organization?.name ?? null,
        platform: connection.platform,
        profileName: connection.profileName,
        reason,
        expired,
      },
    ];
  });

  if (APPLY) {
    for (const repair of repairs) {
      const connection = connections.find(c => c.id === repair.id);
      await prisma.platformConnection.update({
        where: { id: repair.id },
        data: {
          isActive: false,
          metadata: mergeReadinessMetadata(connection?.metadata, repair.reason),
          updatedAt: new Date(),
        },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        inspected: connections.length,
        repaired: APPLY ? repairs.length : 0,
        repairCandidates: repairs,
      },
      null,
      2
    )
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
