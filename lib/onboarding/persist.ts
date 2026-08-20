/**
 * Shared onboarding persistence helpers — single place for org attachment,
 * orphan record migration, and API key setup flags.
 */
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth/jwt-utils';
import { resolveApiKeyConfigured } from '@/lib/ai/resolve-api-key-status';
import type { NextResponse } from 'next/server';

/** Map UI/provider aliases to canonical APICredential provider names. */
export function normalizeAiProvider(provider: string): string {
  const normalised = provider.toLowerCase().trim();
  if (normalised === 'gemini') return 'google';
  return normalised;
}

/**
 * Resolve the user's onboarding organisation id (membership or active pointer).
 */
export async function resolveOnboardingOrganizationId(
  userId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, activeOrganizationId: true },
  });
  if (user?.activeOrganizationId) return user.activeOrganizationId;
  if (user?.organizationId) return user.organizationId;

  const membership = await prisma.organization.findFirst({
    where: { users: { some: { id: userId } } },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  return membership?.id ?? null;
}

/**
 * Attach the user to their onboarding org as soon as it exists so OAuth and
 * scoped queries work before Finish Setup.
 */
export async function attachUserToOrganization(
  userId: string,
  organizationId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, onboardingComplete: true },
  });
  if (!user) return;

  if (
    user.onboardingComplete &&
    user.organizationId &&
    user.organizationId !== organizationId
  ) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      organizationId,
      activeOrganizationId: organizationId,
    },
  });
}

/**
 * Move platform connections and API credentials created before org assignment
 * onto the completing organisation.
 */
export async function migrateOrphanRecordsToOrg(
  userId: string,
  organizationId: string
): Promise<{ connections: number; credentials: number }> {
  const [connections, credentials] = await Promise.all([
    prisma.platformConnection.updateMany({
      where: { userId, organizationId: null, isActive: true },
      data: { organizationId },
    }),
    prisma.aPICredential.updateMany({
      where: { userId, organizationId: null, revokedAt: null },
      data: { organizationId },
    }),
  ]);

  return {
    connections: connections.count,
    credentials: credentials.count,
  };
}

/**
 * Mark API key setup complete on User + OnboardingProgress.
 */
export async function markApiKeySetupComplete(
  userId: string,
  organizationId?: string | null
): Promise<void> {
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: {
      apiKeyConfigured: true,
      apiKeyLastValidated: now,
    },
  });

  const orgId =
    organizationId ?? (await resolveOnboardingOrganizationId(userId));
  if (!orgId) return;

  const progress = await prisma.onboardingProgress.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
    select: { completedStages: true },
  });

  const completedStages = progress?.completedStages ?? [];
  const stages = completedStages.includes('api-setup')
    ? completedStages
    : [...completedStages, 'api-setup'];

  await prisma.onboardingProgress.updateMany({
    where: { userId, organizationId: orgId },
    data: {
      apiCredentialsAdded: true,
      apiSetupCompletedAt: now,
      completedStages: stages,
    },
  });
}

/**
 * Re-issue auth-token cookie after credential save so apiKeyConfigured is fresh.
 */
export async function refreshAuthTokenCookie(
  userId: string,
  response: NextResponse
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      onboardingComplete: true,
    },
  });
  if (!user?.email) return;

  const apiKeyConfigured = await resolveApiKeyConfigured(userId);
  const token = generateToken({
    userId: user.id,
    email: user.email,
    name: user.name ?? undefined,
    onboardingComplete: user.onboardingComplete,
    apiKeyConfigured,
  });

  const isProduction = process.env.NODE_ENV === 'production';
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}
