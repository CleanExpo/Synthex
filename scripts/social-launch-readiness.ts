#!/usr/bin/env npx tsx
/**
 * Portfolio Social Launch Readiness
 *
 * Read-only audit for the founder portfolio businesses that must publish only
 * through Synthex-owned organic social channels. The report intentionally never
 * prints OAuth tokens, refresh tokens, or decrypted secret values.
 */

import { config as loadDotenv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import {
  asJsonRecord,
  getOwnedSocialClientConfig,
  isBusinessSocialAccountType,
  PORTFOLIO_SOCIAL_CLIENTS,
} from '../lib/social/owned-page-policy';
import {
  buildMetaPublishingReadiness,
  isMetaPublishingPlatform,
} from '../lib/integrations/platform-readiness';
import { resolvePlatformAccessToken } from '../lib/platform-connections/token-readiness';

const DEFAULT_REPORT_PATH =
  'docs/marketing-agency/social-launch-readiness/latest.md';
const SOCIAL_LAUNCH_PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'reddit',
  'threads',
  'tiktok',
  'pinterest',
  'twitter',
] as const;

type SocialLaunchPlatform = (typeof SOCIAL_LAUNCH_PLATFORMS)[number];
type ReadinessStatus =
  | 'ready'
  | 'blocked'
  | 'needs_connection'
  | 'needs_intake'
  | 'not_configured'
  | 'missing';

type Args = {
  json: boolean;
  failOnBlockers: boolean;
  writeReport?: string;
  clients: string[];
};

type OAuthCredentialLookup = (
  platform: string
) => Promise<{ clientId: string; clientSecret: string } | null>;

type OrganizationRow = {
  id: string;
  slug: string;
  name: string;
  website: string | null;
  status: string;
  settings: unknown;
  socialHandles: unknown;
};

type ConnectionRow = {
  id: string;
  organizationId: string | null;
  platform: string;
  isActive: boolean;
  deletedAt: Date | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
  profileId: string | null;
  profileName: string | null;
  accountType: string;
  metadata: unknown;
  updatedAt: Date;
};

type VaultSecretRow = {
  organizationId: string;
  slug: string;
  provider: string | null;
  maskedValue: string;
  isActive: boolean;
  source: string;
  updatedAt: Date;
};

type PlatformReport = {
  platform: SocialLaunchPlatform;
  required: boolean;
  status: ReadinessStatus;
  oauthAppCredentials: boolean;
  activeConnectionCount: number;
  totalConnectionCount: number;
  credentialReferenceSlugs: string[];
  connection?: {
    id: string;
    profileId: string | null;
    profileName: string | null;
    accountType: string;
    scope: string | null;
    expiresAt: string | null;
    tokenStatus: 'ok' | 'expires_soon' | 'expired' | 'no_expiry' | 'invalid';
    metadataPublishReadiness: unknown;
  };
  blockers: string[];
  actions: string[];
  evidence: string[];
};

type BusinessReport = {
  slug: string;
  name: string;
  website: string | null;
  exists: boolean;
  status: ReadinessStatus;
  socialPolicy: {
    ownPageOnly: boolean;
    managedThroughSynthexOnly: boolean;
    organicOnly: boolean;
    adSpendEnabled: boolean;
    directPlatformRoutesDisabled: boolean;
    socialHandles: Record<string, string>;
    allowedProfileIds: Record<string, string[]>;
    blockedCrossBrandProfiles: Record<string, string[]>;
  };
  platforms: PlatformReport[];
  blockers: string[];
};

type SocialLaunchReadinessReport = {
  generatedAt: string;
  clients: BusinessReport[];
  summary: {
    businesses: number;
    ready: number;
    blocked: number;
    needsConnection: number;
    needsIntake: number;
    blockers: number;
  };
};

type BuildReportDeps = {
  prisma: Pick<
    PrismaClient,
    'organization' | 'platformConnection' | 'vaultSecret'
  >;
  getPlatformOAuthCredentials: OAuthCredentialLookup;
  now?: Date;
  clients?: string[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    json: false,
    failOnBlockers: false,
    clients: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg === '--fail-on-blockers') args.failOnBlockers = true;
    else if (arg === '--write-report') {
      args.writeReport = argv[++index] || DEFAULT_REPORT_PATH;
    } else if (arg.startsWith('--write-report=')) {
      args.writeReport = arg.slice('--write-report='.length);
    } else if (arg === '--client') {
      const client = argv[++index];
      if (client) args.clients.push(client);
    } else if (arg.startsWith('--client=')) {
      args.clients.push(arg.slice('--client='.length));
    }
  }

  return args;
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function tokenExpiryStatus(
  expiresAt: Date | null,
  now: Date
): PlatformReport['connection']['tokenStatus'] {
  if (!expiresAt) return 'no_expiry';
  const remainingMs = expiresAt.getTime() - now.getTime();
  if (remainingMs <= 0) return 'expired';
  if (remainingMs <= 24 * 60 * 60 * 1000) return 'expires_soon';
  return 'ok';
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function platformReferenceSlugs(
  secrets: VaultSecretRow[],
  platform: SocialLaunchPlatform
): string[] {
  return secrets
    .filter(secret => {
      if (!secret.isActive) return false;
      const provider = secret.provider?.toLowerCase();
      const slug = secret.slug.toLowerCase();
      if (provider === platform) return true;
      if (platform === 'instagram' && slug.includes('facebook-developer')) {
        return true;
      }
      return slug.includes(platform);
    })
    .map(secret => secret.slug)
    .sort();
}

function platformIsRequired(params: {
  platform: SocialLaunchPlatform;
  socialHandles: Record<string, string>;
  allowedProfileIds: Record<string, string[]>;
  credentialReferenceSlugs: string[];
}): boolean {
  return Boolean(
    params.socialHandles[params.platform] ||
      params.allowedProfileIds[params.platform]?.length ||
      params.credentialReferenceSlugs.length
  );
}

function policyBlockers(settings: unknown): string[] {
  const socialPublishing = asJsonRecord(asJsonRecord(settings).socialPublishing);
  const blockers: string[] = [];
  if (socialPublishing.ownPageOnly !== true) blockers.push('own_page_only_not_enforced');
  if (socialPublishing.managedThroughSynthexOnly !== true) {
    blockers.push('managed_through_synthex_only_not_enforced');
  }
  if (socialPublishing.organicOnly !== true) blockers.push('organic_only_not_enforced');
  if (socialPublishing.adSpendEnabled !== false) blockers.push('ad_spend_not_disabled');
  if (socialPublishing.directPlatformRoutesDisabled !== true) {
    blockers.push('direct_platform_routes_not_disabled');
  }
  return blockers;
}

function containsBlockedCrossBrandProfile(params: {
  platform: SocialLaunchPlatform;
  blockedCrossBrandProfiles: Record<string, string[]>;
  connection: ConnectionRow;
}): boolean {
  const blocked = params.blockedCrossBrandProfiles[params.platform] ?? [];
  if (blocked.length === 0) return false;
  const profileId = params.connection.profileId?.toLowerCase();
  const profileName = params.connection.profileName?.toLowerCase();
  return blocked.some(value => {
    const normalised = value.toLowerCase();
    return normalised === profileId || normalised === profileName;
  });
}

function summarizePlatform(params: {
  platform: SocialLaunchPlatform;
  org: OrganizationRow;
  connections: ConnectionRow[];
  credentialReferenceSlugs: string[];
  hasOAuthCredentials: boolean;
  now: Date;
}): PlatformReport {
  const config = getOwnedSocialClientConfig(params.org.slug);
  const socialHandles = config?.socialHandles ?? {};
  const allowedProfileIds = config?.allowedProfileIds ?? {};
  const blockedCrossBrandProfiles = config?.blockedCrossBrandProfiles ?? {};
  const required = platformIsRequired({
    platform: params.platform,
    socialHandles,
    allowedProfileIds,
    credentialReferenceSlugs: params.credentialReferenceSlugs,
  });
  const platformConnections = params.connections
    .filter(connection => connection.platform === params.platform)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const activeConnections = platformConnections.filter(
    connection => connection.isActive && !connection.deletedAt
  );
  const connection = activeConnections[0] ?? null;
  const blockers = [...policyBlockers(params.org.settings)];
  const actions: string[] = [];
  const evidence: string[] = [];

  if (required && !params.hasOAuthCredentials) {
    blockers.push('oauth_app_credentials_missing');
    actions.push(`Add active OAuth app credentials for ${params.platform}`);
  }

  if (activeConnections.length > 1) {
    blockers.push('duplicate_active_connections');
    actions.push(`Keep one active ${params.platform} connection for ${params.org.slug}`);
  }

  let tokenStatus: PlatformReport['connection']['tokenStatus'] = 'invalid';
  let tokenOk = false;
  if (connection) {
    const tokenReadiness = resolvePlatformAccessToken(connection.accessToken);
    tokenStatus = tokenReadiness.ok
      ? tokenExpiryStatus(connection.expiresAt, params.now)
      : 'invalid';
    tokenOk = tokenReadiness.ok && tokenStatus !== 'expired';
    evidence.push(
      `Active connection ${connection.id} uses ${connection.accountType} profile ${connection.profileId ?? 'unmapped'}`
    );

    if (!tokenReadiness.ok) {
      blockers.push('oauth_token_invalid_or_pending');
      actions.push(`Reconnect ${params.platform} OAuth for ${params.org.slug}`);
    } else if (tokenStatus === 'expired' && !connection.refreshToken) {
      blockers.push('oauth_reauth_required');
      actions.push(`Reconnect expired ${params.platform} OAuth for ${params.org.slug}`);
    } else if (tokenStatus === 'expires_soon') {
      evidence.push(`${params.platform} OAuth token expires within 24 hours`);
    }

    const allowedIds = allowedProfileIds[params.platform] ?? [];
    if (required && allowedIds.length === 0) {
      blockers.push('owned_profile_allowlist_missing');
      actions.push(`Add owned ${params.platform} profile id to ${params.org.slug} policy`);
    }
    if (required && !isBusinessSocialAccountType(connection.accountType)) {
      blockers.push('connection_not_business_page');
      actions.push(`Reconnect ${params.platform} as a business/page account`);
    }
    if (required && (!connection.profileId || !allowedIds.includes(connection.profileId))) {
      blockers.push('active_profile_not_allowlisted');
      actions.push(`Map ${params.platform} to the owned page/profile before publishing`);
    }
    if (
      containsBlockedCrossBrandProfile({
        platform: params.platform,
        blockedCrossBrandProfiles,
        connection,
      })
    ) {
      blockers.push('cross_brand_profile_blocked');
      actions.push(`Remove cross-brand ${params.platform} connection from ${params.org.slug}`);
    }
  } else if (required) {
    blockers.push('oauth_connection_missing');
    actions.push(`Connect ${params.platform} OAuth through Synthex`);
  }

  if (isMetaPublishingPlatform(params.platform) && required && !tokenOk) {
    const metaReadiness = buildMetaPublishingReadiness(params.platform, {
      connected: false,
      hasCredentials: params.hasOAuthCredentials,
    });
    blockers.push(...metaReadiness.issues.map(issue => `meta_${issue}`));
    if (metaReadiness.actionLabel) actions.push(metaReadiness.actionLabel);
    evidence.push(metaReadiness.title);
  }

  const uniqueBlockers = uniqueValues(blockers);
  const status: ReadinessStatus =
    uniqueBlockers.length > 0
      ? 'blocked'
      : required && connection
        ? 'ready'
        : connection
          ? 'ready'
          : required || params.credentialReferenceSlugs.length > 0
          ? 'needs_connection'
          : 'not_configured';

  return {
    platform: params.platform,
    required,
    status,
    oauthAppCredentials: params.hasOAuthCredentials,
    activeConnectionCount: activeConnections.length,
    totalConnectionCount: platformConnections.length,
    credentialReferenceSlugs: params.credentialReferenceSlugs,
    connection: connection
      ? {
          id: connection.id,
          profileId: connection.profileId,
          profileName: connection.profileName,
          accountType: connection.accountType,
          scope: connection.scope,
          expiresAt: iso(connection.expiresAt),
          tokenStatus,
          metadataPublishReadiness: asJsonRecord(connection.metadata).publishReadiness,
        }
      : undefined,
    blockers: uniqueBlockers,
    actions: uniqueValues(actions),
    evidence: uniqueValues(evidence),
  };
}

function summarizeBusiness(params: {
  requestedSlug: string;
  org: OrganizationRow | undefined;
  connections: ConnectionRow[];
  secrets: VaultSecretRow[];
  oauthCredentials: Record<SocialLaunchPlatform, boolean>;
  now: Date;
}): BusinessReport {
  const config = getOwnedSocialClientConfig(params.requestedSlug);
  const socialHandles = config?.socialHandles ?? {};
  const allowedProfileIds = config?.allowedProfileIds ?? {};
  const blockedCrossBrandProfiles = config?.blockedCrossBrandProfiles ?? {};

  if (!params.org) {
    return {
      slug: params.requestedSlug,
      name: params.requestedSlug,
      website: null,
      exists: false,
      status: 'missing',
      socialPolicy: {
        ownPageOnly: true,
        managedThroughSynthexOnly: true,
        organicOnly: true,
        adSpendEnabled: false,
        directPlatformRoutesDisabled: true,
        socialHandles,
        allowedProfileIds,
        blockedCrossBrandProfiles,
      },
      platforms: [],
      blockers: ['organization_missing'],
    };
  }

  const orgConnections = params.connections.filter(
    connection => connection.organizationId === params.org!.id
  );
  const orgSecrets = params.secrets.filter(
    secret => secret.organizationId === params.org!.id
  );
  const platforms = SOCIAL_LAUNCH_PLATFORMS.map(platform =>
    summarizePlatform({
      platform,
      org: params.org!,
      connections: orgConnections,
      credentialReferenceSlugs: platformReferenceSlugs(orgSecrets, platform),
      hasOAuthCredentials: params.oauthCredentials[platform],
      now: params.now,
    })
  );
  const blockers = uniqueValues(platforms.flatMap(platform => platform.blockers));
  const requiredPlatforms = platforms.filter(platform => platform.required);
  const hasKnownSocialInventory =
    Object.keys(socialHandles).length > 0 ||
    Object.keys(allowedProfileIds).length > 0 ||
    orgSecrets.length > 0;
  const status: ReadinessStatus =
    blockers.length > 0
      ? 'blocked'
      : requiredPlatforms.length > 0 &&
          requiredPlatforms.every(platform => platform.status === 'ready')
        ? 'ready'
        : hasKnownSocialInventory
          ? 'needs_connection'
          : 'needs_intake';

  return {
    slug: params.org.slug,
    name: params.org.name,
    website: params.org.website,
    exists: true,
    status,
    socialPolicy: {
      ownPageOnly: true,
      managedThroughSynthexOnly: true,
      organicOnly: true,
      adSpendEnabled: false,
      directPlatformRoutesDisabled: true,
      socialHandles,
      allowedProfileIds,
      blockedCrossBrandProfiles,
    },
    platforms,
    blockers,
  };
}

export async function buildSocialLaunchReadinessReport({
  prisma,
  getPlatformOAuthCredentials,
  now = new Date(),
  clients,
}: BuildReportDeps): Promise<SocialLaunchReadinessReport> {
  const slugs =
    clients && clients.length > 0
      ? clients
      : PORTFOLIO_SOCIAL_CLIENTS.map(client => client.slug);

  const organizations = (await prisma.organization.findMany({
    where: { slug: { in: slugs } },
    select: {
      id: true,
      slug: true,
      name: true,
      website: true,
      status: true,
      settings: true,
      socialHandles: true,
    },
  })) as OrganizationRow[];
  const organizationIds = organizations.map(org => org.id);
  const connections =
    organizationIds.length > 0
      ? ((await prisma.platformConnection.findMany({
          where: {
            organizationId: { in: organizationIds },
            platform: { in: [...SOCIAL_LAUNCH_PLATFORMS] },
            deletedAt: null,
          },
          select: {
            id: true,
            organizationId: true,
            platform: true,
            isActive: true,
            deletedAt: true,
            accessToken: true,
            refreshToken: true,
            expiresAt: true,
            scope: true,
            profileId: true,
            profileName: true,
            accountType: true,
            metadata: true,
            updatedAt: true,
          },
        })) as ConnectionRow[])
      : [];
  const secrets =
    organizationIds.length > 0
      ? ((await prisma.vaultSecret.findMany({
          where: {
            organizationId: { in: organizationIds },
            isActive: true,
            source: '1password_reference_import',
          },
          select: {
            organizationId: true,
            slug: true,
            provider: true,
            maskedValue: true,
            isActive: true,
            source: true,
            updatedAt: true,
          },
        })) as VaultSecretRow[])
      : [];

  const oauthCredentialPairs = await Promise.all(
    SOCIAL_LAUNCH_PLATFORMS.map(async platform => [
      platform,
      Boolean(await getPlatformOAuthCredentials(platform)),
    ])
  );
  const oauthCredentials = Object.fromEntries(
    oauthCredentialPairs
  ) as Record<SocialLaunchPlatform, boolean>;

  const clientsReport = slugs.map(slug =>
    summarizeBusiness({
      requestedSlug: slug,
      org: organizations.find(org => org.slug === slug),
      connections,
      secrets,
      oauthCredentials,
      now,
    })
  );
  const blockerCount = clientsReport.reduce(
    (sum, client) => sum + client.blockers.length,
    0
  );

  return {
    generatedAt: now.toISOString(),
    clients: clientsReport,
    summary: {
      businesses: clientsReport.length,
      ready: clientsReport.filter(client => client.status === 'ready').length,
      blocked: clientsReport.filter(client => client.status === 'blocked').length,
      needsConnection: clientsReport.filter(
        client => client.status === 'needs_connection'
      ).length,
      needsIntake: clientsReport.filter(client => client.status === 'needs_intake')
        .length,
      blockers: blockerCount,
    },
  };
}

function formatMarkdownReport(report: SocialLaunchReadinessReport): string {
  const lines = [
    '# Social Launch Readiness',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Summary: ${report.summary.ready} ready, ${report.summary.blocked} blocked, ${report.summary.needsConnection} needing connection, ${report.summary.needsIntake} needing intake.`,
    '',
  ];

  for (const client of report.clients) {
    lines.push(`## ${client.name} (${client.slug})`, '');
    lines.push(`Status: ${client.status}`);
    if (client.website) lines.push(`Website: ${client.website}`);
    lines.push('');
    lines.push('| Platform | Required | Status | Active | OAuth App | Credential Refs | Blockers |');
    lines.push('| --- | --- | --- | ---: | --- | --- | --- |');
    for (const platform of client.platforms) {
      lines.push(
        `| ${[
          platform.platform,
          platform.required ? 'yes' : 'no',
          platform.status,
          String(platform.activeConnectionCount),
          platform.oauthAppCredentials ? 'yes' : 'no',
          platform.credentialReferenceSlugs.join(', ') || '-',
          platform.blockers.join(', ') || '-',
        ].join(' | ')} |`
      );
    }
    if (client.blockers.length > 0) {
      lines.push('', 'Blockers:');
      for (const blocker of client.blockers) lines.push(`- ${blocker}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadDotenv({ path: path.join(process.cwd(), '.env.local'), override: true });
  loadDotenv({ path: path.join(process.cwd(), '.env') });

  const [{ prisma }, { getPlatformOAuthCredentials }] = await Promise.all([
    import('../lib/prisma'),
    import('../lib/platform-credentials'),
  ]);

  const report = await buildSocialLaunchReadinessReport({
    prisma,
    getPlatformOAuthCredentials,
    clients: args.clients,
  });

  if (args.writeReport) {
    const reportPath = path.resolve(args.writeReport);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, formatMarkdownReport(report));
  }

  if (args.json || !args.writeReport) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      JSON.stringify(
        {
          success: true,
          reportPath: args.writeReport,
          summary: report.summary,
        },
        null,
        2
      )
    );
  }

  if (args.failOnBlockers && report.summary.blockers > 0) {
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

if (process.argv[1]?.endsWith('social-launch-readiness.ts')) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
