import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { maskApiKey } from '../lib/encryption/api-key-encryption';
import { encryptField } from '../lib/security/field-encryption';
import {
  ACCOUNT_REFERENCE_MAPPINGS,
  CREDENTIAL_SEARCH_BLOCKERS,
  type CredentialMapping,
} from '../lib/credential-intake/account-reference-mappings';

loadDotenv({ path: path.join(process.cwd(), '.env.local'), override: true });
loadDotenv({ path: path.join(process.cwd(), '.env') });

const { default: prisma } = await import('../lib/prisma');

type OnePasswordField = {
  id?: string;
  label?: string;
  type?: string;
  purpose?: string;
  reference?: string;
  value?: string;
};

type OnePasswordUrl = {
  label?: string;
  primary?: boolean;
  href?: string;
};

type OnePasswordItem = {
  id: string;
  title: string;
  category?: string;
  vault?: { id?: string; name?: string };
  urls?: OnePasswordUrl[];
  fields?: OnePasswordField[];
  updated_at?: string;
};

const ACTOR_ID = 'system:1password-synthex-account-reference-import';
const IMPORT_SOURCE = '1password_reference_import';
const RUN_AT = new Date().toISOString();

// Canonical inventory now lives in lib/credential-intake/account-reference-mappings.ts
// so the importer and the read-only coverage report share one source of truth
// (SYN-1023).

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getOnePasswordItem(vault: string, itemId: string): OnePasswordItem {
  try {
    const output = execFileSync(
      'op',
      ['item', 'get', itemId, '--vault', vault, '--format', 'json'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15_000,
      }
    );
    return JSON.parse(output) as OnePasswordItem;
  } catch (error) {
    const cause =
      error instanceof Error && error.message ? ` ${error.message}` : '';
    throw new Error(
      `Unable to read 1Password item ${itemId} from vault ${vault}.${cause} ` +
        'Unlock/approve 1Password CLI access, then rerun this importer.'
    );
  }
}

function fieldKey(field: OnePasswordField): string {
  return (field.label || field.id || field.purpose || 'field')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '');
}

function collectFieldReferences(item: OnePasswordItem): Record<string, string> {
  const references: Record<string, string> = {};
  for (const field of item.fields ?? []) {
    if (!field.reference) continue;
    const key = fieldKey(field);
    if (!key || references[key]) continue;
    references[key] = field.reference;
  }
  return references;
}

function findPotentialOAuthLabels(item: OnePasswordItem): string[] {
  return (item.fields ?? [])
    .filter(field => {
      const label = `${field.label ?? ''} ${field.id ?? ''}`.toLowerCase();
      return /(client|app).*(id|secret)|oauth|api\s*key/.test(label);
    })
    .map(field => field.label || field.id || 'unnamed field');
}

function primaryUrl(item: OnePasswordItem): string | null {
  const primary = (item.urls ?? []).find(url => url.primary && url.href);
  if (primary?.href) return primary.href;
  return (item.urls ?? []).find(url => url.href)?.href ?? null;
}

function safeReference(vault: string, itemId: string): string {
  return `op://${vault}/${itemId}`;
}

function metadataPayload(mapping: CredentialMapping, item: OnePasswordItem) {
  return {
    version: 1,
    importedAt: RUN_AT,
    usage: 'credential_reference_only',
    oauthReconnectRequired: true,
    onePassword: {
      vault: mapping.vault,
      itemId: mapping.itemId,
      itemTitle: item.title,
      category: item.category ?? null,
      primaryUrl: primaryUrl(item),
      updatedAt: item.updated_at ?? null,
      reference: safeReference(mapping.vault, mapping.itemId),
      fieldReferences: collectFieldReferences(item),
      potentialOAuthFieldsPresent: findPotentialOAuthLabels(item),
    },
    synthex: {
      orgSlug: mapping.orgSlug,
      provider: mapping.provider,
      platforms: mapping.platforms ?? [],
      notes: mapping.notes ?? null,
    },
  };
}

function credentialSourceFor(mapping: CredentialMapping) {
  return {
    type: '1password_reference',
    vaultSecretSlug: mapping.slug,
    provider: mapping.provider,
    importedAt: RUN_AT,
  };
}

function existingCredentialSources(
  metadata: Record<string, unknown>
): Array<Record<string, unknown>> {
  const credentialSources = metadata.credentialSources;
  if (Array.isArray(credentialSources)) {
    return credentialSources.filter(
      source => source && typeof source === 'object' && !Array.isArray(source)
    ) as Array<Record<string, unknown>>;
  }

  const credentialSource = metadata.credentialSource;
  if (
    credentialSource &&
    typeof credentialSource === 'object' &&
    !Array.isArray(credentialSource)
  ) {
    return [credentialSource as Record<string, unknown>];
  }

  return [];
}

function mergeCredentialSources(
  metadata: Record<string, unknown>,
  mapping: CredentialMapping,
  oauthReconnectRequired: boolean
) {
  const nextSource = {
    ...credentialSourceFor(mapping),
    oauthReconnectRequired,
  };
  const sources = [
    ...existingCredentialSources(metadata).filter(
      source => source.vaultSecretSlug !== mapping.slug
    ),
    nextSource,
  ];

  return { primary: nextSource, all: sources };
}

async function upsertVaultSecret(
  organizationId: string,
  mapping: CredentialMapping,
  item: OnePasswordItem
) {
  const plaintext = JSON.stringify(metadataPayload(mapping, item));
  const encryptedValue = encryptField(plaintext);
  if (!encryptedValue) throw new Error(`Failed to encrypt ${mapping.slug}`);

  const secret = await prisma.vaultSecret.upsert({
    where: {
      organizationId_slug: {
        organizationId,
        slug: mapping.slug,
      },
    },
    create: {
      organizationId,
      name: mapping.name,
      slug: mapping.slug,
      description: mapping.notes ?? 'Encrypted 1Password item reference for account recovery and OAuth reconnect handling.',
      secretType: 'custom',
      provider: mapping.provider,
      encryptedValue,
      maskedValue: maskApiKey(safeReference(mapping.vault, mapping.itemId)),
      isRotatable: false,
      source: IMPORT_SOURCE,
      createdBy: null,
    },
    update: {
      name: mapping.name,
      description: mapping.notes ?? 'Encrypted 1Password item reference for account recovery and OAuth reconnect handling.',
      secretType: 'custom',
      provider: mapping.provider,
      encryptedValue,
      maskedValue: maskApiKey(safeReference(mapping.vault, mapping.itemId)),
      isActive: true,
      isRotatable: false,
      source: IMPORT_SOURCE,
      lastRotatedAt: new Date(),
    },
    select: {
      id: true,
      slug: true,
      provider: true,
      updatedAt: true,
    },
  });

  await prisma.vaultAccessLog.create({
    data: {
      vaultSecretId: secret.id,
      organizationId,
      action: 'rotate',
      actor: ACTOR_ID,
      actorType: 'system',
      details: {
        source: IMPORT_SOURCE,
        provider: mapping.provider,
        vaultSecretSlug: mapping.slug,
        onePasswordItemTitle: item.title,
        importedAt: RUN_AT,
      },
    },
  });

  return secret;
}

async function updatePlatformConnectionMetadata(
  organizationId: string,
  mapping: CredentialMapping
) {
  if (!mapping.platforms?.length) return [];

  const connections = await prisma.platformConnection.findMany({
    where: {
      organizationId,
      platform: { in: mapping.platforms },
      deletedAt: null,
    },
    select: {
      id: true,
      platform: true,
      isActive: true,
      metadata: true,
    },
  });

  const updates = [];
  for (const connection of connections) {
    const existing = asRecord(connection.metadata);
    const wasEligible = existing.publishReadiness === 'eligible';
    const nextPublishReadiness = !connection.isActive
      ? 'blocked_until_oauth_reconnect'
      : wasEligible
        ? 'eligible'
        : 'blocked_until_owned_page_or_scope_verified';
    const credentialSources = mergeCredentialSources(
      existing,
      mapping,
      !connection.isActive
    );
    const metadata = {
      ...existing,
      credentialSource: credentialSources.primary,
      credentialSources: credentialSources.all,
      authStatus: connection.isActive
        ? existing.authStatus ?? 'connected'
        : 'requires_oauth_reconnect',
      publishReadiness: nextPublishReadiness,
    };

    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: {
        metadata,
        isActive: connection.isActive,
      },
    });

    updates.push({
      platform: connection.platform,
      isActive: connection.isActive,
      publishReadiness: metadata.publishReadiness,
    });
  }
  return updates;
}

async function updateOrganizationCredentialState(
  organizationId: string,
  orgSlug: string,
  slug: string
) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  if (!org) throw new Error(`Organization not found: ${orgSlug}`);

  const settings = asRecord(org.settings);
  const socialPublishing = asRecord(settings.socialPublishing);
  const onePasswordReferences = {
    ...asRecord(socialPublishing.onePasswordReferences),
    [slug]: {
      vaultSecretSlug: slug,
      importedAt: RUN_AT,
      status: 'reference_imported',
    },
  };

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...settings,
        socialPublishing: {
          ...socialPublishing,
          managedThroughSynthexOnly: true,
          organicOnly: true,
          adSpendEnabled: false,
          onePasswordReferences,
          lastCredentialReferenceImportAt: RUN_AT,
        },
      },
    },
  });
}

async function markCredentialSearchBlockers() {
  const results = [];
  for (const blocker of CREDENTIAL_SEARCH_BLOCKERS) {
    const org = await prisma.organization.findUnique({
      where: { slug: blocker.orgSlug },
      select: { id: true, settings: true },
    });
    if (!org) continue;

    const settings = asRecord(org.settings);
    const socialPublishing = asRecord(settings.socialPublishing);
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        settings: {
          ...settings,
          socialPublishing: {
            ...socialPublishing,
            managedThroughSynthexOnly: true,
            organicOnly: true,
            adSpendEnabled: false,
            credentialIntakeRequired: true,
            credentialSearch: {
              ...asRecord(socialPublishing.credentialSearch),
              onePassword: blocker,
            },
          },
        },
      },
    });
    results.push(blocker);
  }
  return results;
}

async function main() {
  const imported = [];
  for (const mapping of ACCOUNT_REFERENCE_MAPPINGS) {
    const org = await prisma.organization.findUnique({
      where: { slug: mapping.orgSlug },
      select: { id: true, slug: true },
    });
    if (!org) throw new Error(`Organization not found: ${mapping.orgSlug}`);

    const item = getOnePasswordItem(mapping.vault, mapping.itemId);
    const secret = await upsertVaultSecret(org.id, mapping, item);
    const connectionUpdates = await updatePlatformConnectionMetadata(
      org.id,
      mapping
    );
    await updateOrganizationCredentialState(org.id, org.slug, mapping.slug);

    imported.push({
      orgSlug: org.slug,
      provider: mapping.provider,
      vaultSecretSlug: secret.slug,
      itemTitle: item.title,
      platformConnectionsUpdated: connectionUpdates.length,
      connectionReadiness: connectionUpdates,
    });
  }

  const blockers = await markCredentialSearchBlockers();

  console.log(
    JSON.stringify(
      {
        importedAt: RUN_AT,
        importedCount: imported.length,
        imported,
        blockers,
      },
      null,
      2
    )
  );
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
