/**
 * POST /api/onboarding/api-credentials
 *
 * Validates and stores API credentials for the user.
 * Credentials are encrypted before storage.
 *
 * Supported providers:
 * - openai
 * - anthropic
 * - google
 * - openrouter
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { encryptApiKey, maskApiKey } from '@/lib/encryption/api-key-encryption';
import { validateAPIKey, APIProvider } from '@/lib/encryption/api-key-validator';
import { getAuthUser } from '@/lib/supabase-server';
import { withRateLimit } from '@/lib/middleware/rate-limiter';

const CredentialsRequestSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'openrouter']),
  apiKey: z.string().min(10),
  organizationId: z.string().optional(),
});

async function postHandler(request: NextRequest) {
  // Auth check
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse and validate request
  const body = await request.json();
  const validation = CredentialsRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { provider, apiKey, organizationId } = validation.data;

  // Validate API key with provider
  const validationResult = await validateAPIKey(provider as APIProvider, apiKey);

  if (!validationResult.isValid) {
    return NextResponse.json(
      { error: validationResult.error || 'Invalid API key' },
      { status: 400 }
    );
  }

  // Encrypt and mask the API key
  const encryptedKey = encryptApiKey(apiKey);
  const maskedKey = maskApiKey(apiKey);

  // Check if credential already exists for this provider
  const existingCredential = await prisma.aPICredential.findFirst({
    where: {
      userId: user.id,
      provider,
      organizationId: organizationId || null,
    },
  });

  let credential;

  if (existingCredential) {
    // Update existing credential
    credential = await prisma.aPICredential.update({
      where: { id: existingCredential.id },
      data: {
        encryptedKey,
        maskedKey,
        isValid: true,
        lastValidatedAt: new Date(),
        validationError: null,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  } else {
    // Create new credential
    credential = await prisma.aPICredential.create({
      data: {
        userId: user.id,
        organizationId: organizationId || null,
        provider,
        encryptedKey,
        maskedKey,
        isValid: true,
        lastValidatedAt: new Date(),
        isActive: true,
      },
    });
  }

  // Return response (never return decrypted key)
  return NextResponse.json(
    {
      success: true,
      credential: {
        id: credential.id,
        provider: credential.provider,
        maskedKey: credential.maskedKey,
        isValid: credential.isValid,
        isActive: credential.isActive,
        lastValidatedAt: credential.lastValidatedAt,
      },
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  // Apply rate limiting: 10 credential submissions per hour
  return withRateLimit(request, async () => {
    try {
      return await postHandler(request);
    } catch (error) {
      console.error('[API Credentials] Error:', error);
      return NextResponse.json(
        { error: 'Failed to save API credentials' },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/onboarding/api-credentials
 *
 * List all API credentials for the user (without decrypted keys)
 */
async function getHandler(request: NextRequest) {
  // Auth check
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get organization ID from query params
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  // Fetch credentials
  const credentials = await prisma.aPICredential.findMany({
    where: {
      userId: user.id,
      organizationId: organizationId || null,
    },
    select: {
      id: true,
      provider: true,
      maskedKey: true,
      isValid: true,
      isActive: true,
      lastValidatedAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ credentials }, { status: 200 });
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  return withRateLimit(request, async () => {
    try {
      return await getHandler(request);
    } catch (error) {
      console.error('[API Credentials] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch API credentials' },
        { status: 500 }
      );
    }
  });
}
