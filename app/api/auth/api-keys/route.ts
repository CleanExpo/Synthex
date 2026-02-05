/**
 * API Keys Management Route
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - FIELD_ENCRYPTION_KEY: 32-byte hex key for API key encryption (CRITICAL)
 *
 * NOTE: API keys are encrypted at rest using AES-256-GCM
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encryptField, isEncrypted } from '@/lib/security/field-encryption';

type KeysBody = {
  email?: string;
  openrouterApiKey?: string;
  anthropicApiKey?: string;
};

/**
 * GET /api/auth/api-keys?email={email}
 * Returns flags indicating whether keys exist for the user.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email') || '';

  if (!email) {
    return NextResponse.json({
      success: true,
      data: { apiKeys: { hasOpenRouterKey: false, hasAnthropicKey: false } },
      persisted: false,
    });
  }

  const canUseDb = !!process.env.DATABASE_URL;
  if (!canUseDb) {
    return NextResponse.json({
      success: true,
      data: { apiKeys: { hasOpenRouterKey: false, hasAnthropicKey: false } },
      persisted: false,
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { openrouterApiKey: true, anthropicApiKey: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        apiKeys: {
          hasOpenRouterKey: !!user?.openrouterApiKey,
          hasAnthropicKey: !!user?.anthropicApiKey,
        },
      },
      persisted: true,
    });
  } catch (err) {
    console.error('GET /api/auth/api-keys error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API key status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/api-keys
 * Body: { email, openrouterApiKey?, anthropicApiKey? }
 * Stores provided keys for the user. Returns flags.
 */
export async function POST(req: NextRequest) {
  let body: KeysBody = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const email = (body.email || '').toString().trim();
  if (!email) {
    return NextResponse.json(
      { success: false, error: 'Email is required' },
      { status: 400 }
    );
  }

  const canUseDb = !!process.env.DATABASE_URL;
  if (!canUseDb) {
    return NextResponse.json({
      success: true,
      data: {
        apiKeys: {
          hasOpenRouterKey: !!body.openrouterApiKey,
          hasAnthropicKey: !!body.anthropicApiKey,
        },
      },
      persisted: false,
    });
  }

  try {
    // Encrypt API keys before storing
    const encryptedOpenRouterKey = body.openrouterApiKey
      ? encryptField(body.openrouterApiKey)
      : undefined;
    const encryptedAnthropicKey = body.anthropicApiKey
      ? encryptField(body.anthropicApiKey)
      : undefined;

    // Upsert user with encrypted keys
    const updated = await prisma.user.upsert({
      where: { email },
      update: {
        openrouterApiKey: encryptedOpenRouterKey ?? undefined,
        anthropicApiKey: encryptedAnthropicKey ?? undefined,
      },
      create: {
        email,
        password: '!', // placeholder for locally managed accounts
        name: email,
        openrouterApiKey: encryptedOpenRouterKey ?? null,
        anthropicApiKey: encryptedAnthropicKey ?? null,
      },
      select: { openrouterApiKey: true, anthropicApiKey: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        apiKeys: {
          hasOpenRouterKey: !!updated.openrouterApiKey,
          hasAnthropicKey: !!updated.anthropicApiKey,
        },
      },
      persisted: true,
    });
  } catch (err) {
    console.error('POST /api/auth/api-keys error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to save API keys' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
