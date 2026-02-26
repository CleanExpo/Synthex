/**
 * API Settings: AI Provider Credentials
 *
 * GET  /api/settings/api-credentials — List all AI provider credentials for the user
 * POST /api/settings/api-credentials — Add or update an AI provider credential
 * DELETE /api/settings/api-credentials — Revoke an AI provider credential
 *
 * Reuses the same encryption and validation services as the onboarding flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { encryptApiKey, maskApiKey } from '@/lib/encryption/api-key-encryption';
import { validateAPIKey, APIProvider } from '@/lib/encryption/api-key-validator';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

// --- GET: list credentials ---

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const credentials = await prisma.aPICredential.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
        provider: true,
        maskedKey: true,
        isValid: true,
        isActive: true,
        lastValidatedAt: true,
        lastUsedAt: true,
        validationError: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ credentials });
  } catch (error) {
    console.error('[Settings API Credentials] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    );
  }
}

// --- POST: add or update credential ---

const AddCredentialSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'openrouter']),
  apiKey: z.string().min(10, 'API key is too short'),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = AddCredentialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { provider, apiKey } = parsed.data;

    // Validate key with the actual provider
    const validation = await validateAPIKey(provider as APIProvider, apiKey);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: validation.error || 'Invalid API key',
          provider,
        },
        { status: 400 }
      );
    }

    // Encrypt and mask
    const encryptedKey = encryptApiKey(apiKey);
    const maskedKey = maskApiKey(apiKey);

    // Upsert: find existing for this user+provider (without org), or create new
    const existing = await prisma.aPICredential.findFirst({
      where: {
        userId,
        provider,
        organizationId: null,
        revokedAt: null,
      },
    });

    let credential;

    if (existing) {
      credential = await prisma.aPICredential.update({
        where: { id: existing.id },
        data: {
          encryptedKey,
          maskedKey,
          isValid: true,
          isActive: true,
          lastValidatedAt: new Date(),
          validationError: null,
          updatedAt: new Date(),
        },
      });
    } else {
      credential = await prisma.aPICredential.create({
        data: {
          userId,
          organizationId: null,
          provider,
          encryptedKey,
          maskedKey,
          isValid: true,
          isActive: true,
          lastValidatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      credential: {
        id: credential.id,
        provider: credential.provider,
        maskedKey: credential.maskedKey,
        isValid: credential.isValid,
        isActive: credential.isActive,
        lastValidatedAt: credential.lastValidatedAt,
        createdAt: credential.createdAt,
      },
    });
  } catch (error) {
    console.error('[Settings API Credentials] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save credential' },
      { status: 500 }
    );
  }
}

// --- DELETE: revoke a credential ---

const DeleteCredentialSchema = z.object({
  id: z.string().min(1),
});

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = DeleteCredentialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    // Verify ownership before deleting
    const credential = await prisma.aPICredential.findFirst({
      where: {
        id: parsed.data.id,
        userId,
      },
    });

    if (!credential) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 404 }
      );
    }

    // Soft-delete: mark as revoked + inactive
    await prisma.aPICredential.update({
      where: { id: credential.id },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Settings API Credentials] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete credential' },
      { status: 500 }
    );
  }
}

// Required for crypto usage in api-key-encryption (Node.js built-in)
export const runtime = 'nodejs';
