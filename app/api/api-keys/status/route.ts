/**
 * API Key Status Endpoint
 *
 * GET /api/api-keys/status
 *
 * Returns which providers the user has access to — either via their own
 * stored BYOK key OR via a platform-level environment key.
 *
 * Response shape:
 *   {
 *     providers: {
 *       openai:      { byok: bool, platform: bool, available: bool },
 *       anthropic:   { byok: bool, platform: bool, available: bool },
 *       google:      { byok: bool, platform: bool, available: bool },
 *       openrouter:  { byok: bool, platform: bool, available: bool },
 *       elevenlabs:  { byok: bool, platform: bool, available: bool },
 *     }
 *   }
 *
 * `available` = true if EITHER byok OR platform is configured.
 * The gate component fires only when `available` is false.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Mapping from provider ID to the env var that supplies a platform-level key
const PLATFORM_ENV_MAP: Record<string, string | undefined> = {
  openrouter: process.env.OPENROUTER_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_AI_API_KEY,
  openai: undefined, // Platform uses OpenRouter for OpenAI models
  elevenlabs: process.env.ELEVENLABS_API_KEY,
};

const ALL_PROVIDERS = Object.keys(PLATFORM_ENV_MAP);

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const credentials = await prisma.aPICredential.findMany({
    where: {
      userId,
      isActive: true,
      revokedAt: null,
      provider: { in: ALL_PROVIDERS },
    },
    select: { provider: true },
  });

  const byokProviders = new Set(credentials.map(c => c.provider));

  const providers = Object.fromEntries(
    ALL_PROVIDERS.map(p => {
      const byok = byokProviders.has(p);
      const platform = !!PLATFORM_ENV_MAP[p];
      return [p, { byok, platform, available: byok || platform }];
    })
  );

  return NextResponse.json({ providers });
}
