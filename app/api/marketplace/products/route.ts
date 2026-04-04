/**
 * Marketplace Products API Route
 *
 * CRUD for marketplace products (listings synced across channels).
 * Org-scoped via getEffectiveQueryFilter — never exposes cross-org data.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * UNI-1580 / UNI-1581 / UNI-1582 — Marketplace Phase A1
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';

// Node.js runtime required for Prisma
export const runtime = 'nodejs';

const CreateProductSchema = z.object({
  sku: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priceCents: z.number().int().positive(),
  currency: z.string().length(3).default('AUD'),
  stockQty: z.number().int().min(0).default(0),
  images: z.array(z.string().url()).default([]),
  categories: z.array(z.string()).default([]),
});

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No organisation context found' },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200);
  const offset = Math.max(Number(searchParams.get('offset') ?? '0'), 0);

  const [products, total] = await Promise.all([
    prisma.marketplaceProduct.findMany({
      where: { orgId },
      include: { channelListings: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.marketplaceProduct.count({ where: { orgId } }),
  ]);

  return NextResponse.json({ products, total, limit, offset });
}

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No organisation context found' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const product = await prisma.marketplaceProduct.create({
    data: { ...parsed.data, orgId },
    include: { channelListings: true },
  });

  return NextResponse.json({ product }, { status: 201 });
}
