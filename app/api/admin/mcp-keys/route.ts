/**
 * /api/admin/mcp-keys — SYN-MCP-004-1 (SYN-1080): admin management of the
 * scoped MCP key registry (McpApiKey / mcp_api_keys).
 *
 * ADMIN/OWNER only via the shared `verifyAdmin` gate (x-admin-api-key header,
 * or admin/superadmin JWT/cookie). ZERO client-facing exposure.
 *
 *   POST   — mint a key. The raw key is returned EXACTLY ONCE in this
 *            response and never stored (only its sha-256 hash persists).
 *   GET    — list keys (metadata only — never keyHash, never raw keys).
 *            Optional ?organizationId= filter.
 *   DELETE — revoke a key by ?id= (soft delete: sets revokedAt; idempotent).
 *
 * Error shape: { error, details? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { logger } from '@/lib/logger';
import { hashMcpKey } from '@/app/api/mcp/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Raw key format: smk_<64 hex chars> (256 bits of entropy). */
const KEY_PREFIX = 'smk_';

const CreateKeySchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  label: z.string().min(1).max(100),
  // '*' = all tools (wildcard); named scopes are consumed by SYN-MCP-007's
  // scope-filtered registration. Default [] = no tool scopes until granted.
  scopes: z.array(z.string().min(1).max(100)).max(50).default([]),
  expiresAt: z.string().datetime().optional(),
});

const KEY_METADATA_SELECT = {
  id: true,
  organizationId: true,
  userId: true,
  label: true,
  scopes: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
  createdAt: true,
  // keyHash deliberately excluded — never leaves the server.
} as const;

function adminDenied(auth: { error?: string }) {
  return NextResponse.json(
    { error: auth.error ?? 'Admin access required' },
    { status: auth.error === 'Authentication required' ? 401 : 403 }
  );
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth.isAdmin) return adminDenied(auth);

  try {
    const body = await request.json().catch(() => null);
    const parsed = CreateKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { organizationId, userId, label, scopes, expiresAt } = parsed.data;

    const rawKey = `${KEY_PREFIX}${randomBytes(32).toString('hex')}`;
    const record = await prisma.mcpApiKey.create({
      data: {
        keyHash: hashMcpKey(rawKey),
        organizationId,
        userId,
        label,
        scopes,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: KEY_METADATA_SELECT,
    });

    logger.info('admin:mcp-keys:created', {
      keyId: record.id,
      organizationId,
      label,
      createdBy: auth.userId ?? 'admin-api-key',
    });

    return NextResponse.json(
      {
        // Shown once — the hash is all that persists. Store it now.
        key: rawKey,
        note: 'Store this key now — it is shown once and cannot be recovered.',
        record,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('admin:mcp-keys:create-failed', error);
    return NextResponse.json(
      {
        error: 'Failed to create MCP key',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth.isAdmin) return adminDenied(auth);

  try {
    const { searchParams } = new URL(request.url);
    const organizationId =
      searchParams.get('organizationId')?.trim() || undefined;

    const keys = await prisma.mcpApiKey.findMany({
      where: organizationId ? { organizationId } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: KEY_METADATA_SELECT,
    });

    return NextResponse.json({ keys });
  } catch (error) {
    logger.error('admin:mcp-keys:list-failed', error);
    return NextResponse.json(
      {
        error: 'Failed to list MCP keys',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth.isAdmin) return adminDenied(auth);

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    if (!id) {
      return NextResponse.json(
        { error: 'Missing required query param: id' },
        { status: 400 }
      );
    }

    const existing = await prisma.mcpApiKey.findUnique({
      where: { id },
      select: { id: true, revokedAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    if (existing.revokedAt) {
      // Idempotent — already revoked.
      return NextResponse.json({ id, revokedAt: existing.revokedAt });
    }

    const updated = await prisma.mcpApiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: { id: true, revokedAt: true },
    });

    logger.info('admin:mcp-keys:revoked', {
      keyId: id,
      revokedBy: auth.userId ?? 'admin-api-key',
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('admin:mcp-keys:revoke-failed', error);
    return NextResponse.json(
      {
        error: 'Failed to revoke MCP key',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
