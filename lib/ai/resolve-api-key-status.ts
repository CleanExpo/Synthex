/**
 * Resolve whether a user has AI access (platform env, user flag, or stored credential).
 */
import { prisma } from '@/lib/prisma';
import { hasPlatformAIKey } from '@/lib/ai/platform-keys';

/**
 * True when the user has at least one active, non-revoked API credential row.
 */
export async function userHasStoredCredential(
  userId: string
): Promise<boolean> {
  try {
    const credential = await prisma.aPICredential.findFirst({
      where: {
        userId,
        isActive: true,
        revokedAt: null,
        provider: { in: ['openrouter', 'anthropic', 'google', 'openai'] },
      },
      select: { id: true },
    });
    return !!credential;
  } catch {
    return false;
  }
}

/**
 * Authoritative check for AI key gate + JWT stamping.
 * Order: platform env → user.apiKeyConfigured → stored credentials.
 */
export async function resolveApiKeyConfigured(
  userId: string
): Promise<boolean> {
  if (hasPlatformAIKey()) {
    return true;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { apiKeyConfigured: true },
    });
    if (user?.apiKeyConfigured) {
      return true;
    }
  } catch {
    // fall through to credential check
  }

  return userHasStoredCredential(userId);
}
