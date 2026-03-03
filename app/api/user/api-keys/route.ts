/**
 * User Synthex API Keys Route
 *
 * Manages user-facing Synthex platform API keys (not AI provider keys).
 * Keys are stored in User.settings JSON and returned with the raw key only on creation.
 *
 * @route POST /api/user/api-keys  — create a new key
 * @route GET  /api/user/api-keys  — list existing keys (masked)
 * @route DELETE /api/user/api-keys?id=<keyId> — revoke a key
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import prisma from '@/lib/prisma';
import { type Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

const CreateKeySchema = z.object({
  name: z.string().min(1).max(64).default('New API Key'),
});

interface StoredApiKey {
  id: string;
  name: string;
  keyHash: string;      // sha256 hash for lookup
  keyPreview: string;   // last 4 chars for display
  created: string;      // ISO date
  lastUsed?: string;
}

function generateKey(): string {
  const bytes = randomBytes(32).toString('hex');
  return `sk-${bytes}`;
}

function keyPreview(key: string): string {
  return `sk-****-****-${key.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const settings = (user.settings as Record<string, unknown> | null) ?? {};
    const keys = (settings.apiKeys as StoredApiKey[] | undefined) ?? [];

    return NextResponse.json({
      keys: keys.map(k => ({
        id: k.id,
        name: k.name,
        key: k.keyPreview,
        created: k.created,
        lastUsed: k.lastUsed || 'Never',
      })),
    });
  } catch (error) {
    console.error('[User API Keys] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = CreateKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const settings = (user.settings as Record<string, unknown> | null) ?? {};
    const existingKeys = (settings.apiKeys as StoredApiKey[] | undefined) ?? [];

    // Cap at 10 keys
    if (existingKeys.length >= 10) {
      return NextResponse.json({ error: 'Maximum of 10 API keys allowed. Delete an existing key first.' }, { status: 400 });
    }

    const rawKey = generateKey();
    const { createHash } = await import('crypto');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const newKey: StoredApiKey = {
      id: `key_${Date.now()}_${randomBytes(4).toString('hex')}`,
      name: parsed.data.name,
      keyHash,
      keyPreview: keyPreview(rawKey),
      created: new Date().toISOString().split('T')[0],
    };

    const updatedKeys = [...existingKeys, newKey];
    await prisma.user.update({
      where: { id: userId },
      data: { settings: { ...settings, apiKeys: updatedKeys } as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      id: newKey.id,
      name: newKey.name,
      key: rawKey, // Raw key returned only on creation
      created: newKey.created,
      lastUsed: 'Never',
    });
  } catch (error) {
    console.error('[User API Keys] POST error:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');
    if (!keyId) {
      return NextResponse.json({ error: 'Key ID required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const settings = (user.settings as Record<string, unknown> | null) ?? {};
    const existingKeys = (settings.apiKeys as StoredApiKey[] | undefined) ?? [];
    const filtered = existingKeys.filter(k => k.id !== keyId);

    if (filtered.length === existingKeys.length) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { settings: { ...settings, apiKeys: filtered } as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    console.error('[User API Keys] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
