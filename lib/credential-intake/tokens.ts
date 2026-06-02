import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';

export const CREDENTIAL_INTAKE_PROVIDERS = [
  'facebook',
  'instagram',
  'linkedin',
  'reddit',
] as const;

export type CredentialIntakeProvider =
  (typeof CREDENTIAL_INTAKE_PROVIDERS)[number];

export const CredentialIntakeProviderSchema = z.enum(
  CREDENTIAL_INTAKE_PROVIDERS
);

export interface CredentialIntakeTokenPayload {
  type: 'credential_intake';
  organizationId: string;
  providers: CredentialIntakeProvider[];
  createdByUserId: string;
  purpose: string;
  iat?: number;
  exp?: number;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required for credential intake links');
  }
  return secret;
}

function normalizeProviders(
  providers: string[] | undefined
): CredentialIntakeProvider[] {
  const fallback = [...CREDENTIAL_INTAKE_PROVIDERS];
  if (!providers || providers.length === 0) return fallback;

  const unique = new Set<CredentialIntakeProvider>();
  for (const provider of providers) {
    const parsed = CredentialIntakeProviderSchema.safeParse(provider);
    if (parsed.success) unique.add(parsed.data);
  }
  return unique.size > 0 ? [...unique] : fallback;
}

export function createCredentialIntakeToken(input: {
  organizationId: string;
  providers?: string[];
  createdByUserId: string;
  purpose?: string;
  expiresInHours?: number;
}): string {
  const expiresInHours = Math.min(Math.max(input.expiresInHours ?? 72, 1), 168);
  const payload: CredentialIntakeTokenPayload = {
    type: 'credential_intake',
    organizationId: input.organizationId,
    providers: normalizeProviders(input.providers),
    createdByUserId: input.createdByUserId,
    purpose: input.purpose?.trim() || 'credential-intake',
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: `${expiresInHours}h`,
  } as SignOptions);
}

export function verifyCredentialIntakeToken(
  token: string
): CredentialIntakeTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload &
    Partial<CredentialIntakeTokenPayload>;

  if (
    decoded.type !== 'credential_intake' ||
    !decoded.organizationId ||
    !decoded.createdByUserId
  ) {
    throw new Error('Invalid credential intake token');
  }

  const providers = normalizeProviders(decoded.providers);

  return {
    type: 'credential_intake',
    organizationId: decoded.organizationId,
    providers,
    createdByUserId: decoded.createdByUserId,
    purpose:
      typeof decoded.purpose === 'string' && decoded.purpose.trim()
        ? decoded.purpose
        : 'credential-intake',
    iat: decoded.iat,
    exp: decoded.exp,
  };
}
