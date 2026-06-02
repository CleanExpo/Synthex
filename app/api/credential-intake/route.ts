import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { VaultService } from '@/lib/vault';
import { prisma } from '@/lib/prisma';
import {
  CREDENTIAL_INTAKE_PROVIDERS,
  CredentialIntakeProviderSchema,
  verifyCredentialIntakeToken,
} from '@/lib/credential-intake/tokens';
import { slugify, type VaultActor } from '@/lib/vault/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tokenSchema = z.string().min(20);
const intakeEntrySchema = z.object({
  provider: CredentialIntakeProviderSchema,
  label: z.string().min(2).max(80),
  secretType: z
    .enum(['api_key', 'oauth_token', 'oauth_refresh_token', 'custom'])
    .default('custom'),
  value: z.string().min(1).max(20_000),
  notes: z.string().max(500).optional(),
});

const submitSchema = z.object({
  token: tokenSchema,
  entries: z.array(intakeEntrySchema).min(1).max(12),
});

function noStoreJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, private'
  );
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

function providerLabel(provider: string): string {
  return provider
    .split('-')
    .map(part => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function verifyTokenOrResponse(token: string) {
  try {
    return { payload: verifyCredentialIntakeToken(token), response: null };
  } catch {
    return {
      payload: null,
      response: noStoreJson(
        { error: 'Invalid or expired credential intake link' },
        401
      ),
    };
  }
}

export async function GET(request: NextRequest) {
  const token = tokenSchema.safeParse(
    request.nextUrl.searchParams.get('token')
  );
  if (!token.success) {
    return noStoreJson({ error: 'Missing credential intake token' }, 400);
  }

  const verified = verifyTokenOrResponse(token.data);
  if (!verified.payload) return verified.response;

  const org = await prisma.organization.findUnique({
    where: { id: verified.payload.organizationId },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!org || org.status !== 'active') {
    return noStoreJson({ error: 'Organisation is not available' }, 404);
  }

  return noStoreJson({
    success: true,
    organization: org,
    providers: verified.payload.providers,
    expiresAt: verified.payload.exp
      ? new Date(verified.payload.exp * 1000).toISOString()
      : null,
  });
}

export async function POST(request: NextRequest) {
  const parsed = submitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return noStoreJson(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400
    );
  }

  const verified = verifyTokenOrResponse(parsed.data.token);
  if (!verified.payload) return verified.response;

  const allowedProviders = new Set(verified.payload.providers);
  const disallowed = parsed.data.entries.find(
    entry => !allowedProviders.has(entry.provider)
  );
  if (disallowed) {
    return noStoreJson(
      {
        error: `${providerLabel(disallowed.provider)} is not allowed on this link`,
      },
      403
    );
  }

  const [org, creator] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: verified.payload.organizationId },
      select: { id: true, status: true },
    }),
    prisma.user.findUnique({
      where: { id: verified.payload.createdByUserId },
      select: { id: true },
    }),
  ]);
  if (!org || org.status !== 'active' || !creator) {
    return noStoreJson(
      { error: 'Credential intake is no longer available' },
      404
    );
  }

  const actor: VaultActor = {
    id: `credential-intake:${verified.payload.createdByUserId}`,
    type: 'system',
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  };

  const saved = [];
  for (const entry of parsed.data.entries) {
    const prepared = VaultService.prepareSecret(entry.value);
    if (!prepared) {
      return noStoreJson(
        {
          error: `Unable to encrypt ${providerLabel(entry.provider)} credential`,
        },
        500
      );
    }

    const slug = slugify(
      `secure-intake-${entry.provider}-${entry.secretType}-${entry.label}`
    );
    const existing = await VaultService.getSecretMetadata(org.id, slug);
    const description = [
      'Submitted through secure credential intake.',
      `Purpose: ${verified.payload.purpose}.`,
      entry.notes?.trim() ? `Notes: ${entry.notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    const result = existing
      ? await VaultService.rotateSecret(org.id, slug, entry.value, actor)
      : await VaultService.createSecret(
          {
            organizationId: org.id,
            name: `${providerLabel(entry.provider)} - ${entry.label.trim()}`,
            slug,
            description,
            secretType: entry.secretType,
            provider: entry.provider,
            encryptedValue: prepared.encrypted,
            maskedValue: prepared.masked,
            isRotatable: true,
            source: 'manual',
            createdBy: creator.id,
          },
          actor
        );

    if (!result) {
      return noStoreJson(
        {
          error: `Unable to store ${providerLabel(entry.provider)} credential`,
        },
        500
      );
    }

    saved.push({
      provider: entry.provider,
      label: entry.label,
      slug: result.slug,
      maskedValue: result.maskedValue,
      action: existing ? 'rotated' : 'created',
    });
  }

  return noStoreJson({
    success: true,
    saved,
    supportedProviders: CREDENTIAL_INTAKE_PROVIDERS,
  });
}
