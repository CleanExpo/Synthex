#!/usr/bin/env npx tsx
/**
 * Google Connections Orchestrator
 *
 * Audits the Google integration readiness for every business owned by the
 * founder account. It intentionally defaults to read-only mode: no secret
 * values are printed and no external connection records are changed unless
 * --apply is passed.
 */

import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma';
import { listSites } from '../lib/google/search-console-oauth';
import { listLocations } from '../lib/google/business-profile';
import { getOAuthAccessToken } from '../lib/google/google-auth';

config({ path: '.env.local' });
config({ path: '.env' });

const DEFAULT_OWNER_EMAIL = 'phill.mcgurk@gmail.com';
const DEFAULT_APP_URL = 'https://synthex.social';
const PORTFOLIO_SLUGS = [
  'unite-group',
  'restoreassist',
  'disaster-recovery',
  'carsi',
  'synthex',
  'nrpg',
  'ccw',
];

const PLATFORMS = [
  {
    key: 'searchconsole',
    label: 'Google Search Console',
    required: true,
    reason: 'Search visibility, indexing, sitemap, and query data.',
    oauthPath: '/api/auth/oauth/searchconsole',
    scopes: ['webmasters', 'indexing'],
  },
  {
    key: 'googleanalytics',
    label: 'Google Analytics 4',
    required: true,
    reason: 'Traffic, conversion, campaign, and retention attribution.',
    oauthPath: '/api/auth/oauth/googleanalytics',
    scopes: ['analytics.readonly'],
    followUp:
      'Creating GA4 properties autonomously requires analytics.edit scope; current app scope is read-only.',
  },
  {
    key: 'googlebusiness',
    label: 'Google Business Profile',
    required: true,
    reason: 'Local SEO, reviews, GBP posts, profile accuracy, and authority signals.',
    oauthPath: '/api/auth/oauth/googlebusiness',
    scopes: ['business.manage'],
  },
  {
    key: 'youtube',
    label: 'YouTube',
    required: false,
    reason: 'Video upload, channel verification, and video performance loops.',
    oauthPath: '/api/auth/oauth/youtube',
    scopes: ['youtube.readonly', 'youtube.upload'],
  },
  {
    key: 'googledrive',
    label: 'Google Drive',
    required: false,
    reason: 'Workspace asset/source handoff and durable campaign files.',
    oauthPath: '/api/auth/oauth/googledrive',
    scopes: ['drive'],
  },
] as const;

type PlatformKey = (typeof PLATFORMS)[number]['key'];

interface Args {
  owner: string;
  appUrl: string;
  apply: boolean;
  json: boolean;
  writeReport?: string;
}

interface ConnectionSummary {
  id: string;
  platform: string;
  active: boolean;
  hasRefreshToken: boolean;
  expiresAt: string | null;
  profileName: string | null;
  scope: string | null;
  tokenStatus: 'ok' | 'expires_soon' | 'expired' | 'no_expiry';
}

interface PlatformStatus {
  platform: PlatformKey;
  label: string;
  required: boolean;
  status: 'ready' | 'authority_required' | 'reauthorize_required' | 'mapping_required' | 'verify_required';
  connectionCount: number;
  activeConnectionCount: number;
  mappedCount: number;
  recommendedAction: string;
  authorityUrl: string;
  evidence: string[];
  followUp?: string;
}

interface BusinessReport {
  slug: string;
  name: string;
  website: string | null;
  active: boolean;
  status: 'ready' | 'needs_authority' | 'needs_mapping' | 'needs_verification';
  platforms: PlatformStatus[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    owner: DEFAULT_OWNER_EMAIL,
    appUrl:
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      DEFAULT_APP_URL,
    apply: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--owner') args.owner = argv[++index] || args.owner;
    else if (arg.startsWith('--owner=')) args.owner = arg.slice('--owner='.length);
    else if (arg === '--app-url') args.appUrl = argv[++index] || args.appUrl;
    else if (arg.startsWith('--app-url=')) args.appUrl = arg.slice('--app-url='.length);
    else if (arg === '--write-report') args.writeReport = argv[++index];
    else if (arg.startsWith('--write-report=')) {
      args.writeReport = arg.slice('--write-report='.length);
    }
  }

  args.appUrl = args.appUrl.replace(/\/$/, '');
  return args;
}

function tokenStatus(expiresAt: Date | null): ConnectionSummary['tokenStatus'] {
  if (!expiresAt) return 'no_expiry';
  const now = Date.now();
  const expiresMs = expiresAt.getTime();
  if (expiresMs <= now) return 'expired';
  if (expiresMs - now < 24 * 60 * 60 * 1000) return 'expires_soon';
  return 'ok';
}

function normalizeDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const withProtocol = value.startsWith('http') ? value : `https://${value}`;
    const url = new URL(withProtocol);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return value
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
  }
}

function siteMatchesWebsite(siteUrl: string, website: string | null): boolean {
  const domain = normalizeDomain(website);
  if (!domain) return false;
  const normalSite = siteUrl.toLowerCase();
  return (
    normalSite.includes(domain) ||
    normalSite === `sc-domain:${domain}` ||
    normalizeDomain(siteUrl) === domain
  );
}

function authorityUrl(appUrl: string, platform: PlatformKey): string {
  const platformConfig = PLATFORMS.find(item => item.key === platform)!;
  const returnTo = '/dashboard/settings?tab=integrations';
  return `${appUrl}${platformConfig.oauthPath}?returnTo=${encodeURIComponent(returnTo)}`;
}

function summarizeConnection(connection: {
  id: string;
  platform: string;
  isActive: boolean;
  refreshToken: string | null;
  expiresAt: Date | null;
  profileName: string | null;
  scope: string | null;
}): ConnectionSummary {
  return {
    id: connection.id,
    platform: connection.platform,
    active: connection.isActive,
    hasRefreshToken: Boolean(connection.refreshToken),
    expiresAt: connection.expiresAt?.toISOString() ?? null,
    profileName: connection.profileName,
    scope: connection.scope,
    tokenStatus: tokenStatus(connection.expiresAt),
  };
}

async function syncSearchConsole(params: {
  organizationId: string;
  connectionId: string;
  website: string | null;
  apply: boolean;
}) {
  const discovered = await listSites(params.connectionId);
  if (!params.apply) return { discovered, changed: 0 };

  let changed = 0;
  for (const site of discovered) {
    const property = await prisma.gSCProperty.upsert({
      where: {
        organizationId_siteUrl: {
          organizationId: params.organizationId,
          siteUrl: site.siteUrl,
        },
      },
      update: {
        connectionId: params.connectionId,
        permissionLevel: site.permissionLevel,
        isPrimary: siteMatchesWebsite(site.siteUrl, params.website),
        lastSyncedAt: new Date(),
      },
      create: {
        organizationId: params.organizationId,
        connectionId: params.connectionId,
        siteUrl: site.siteUrl,
        permissionLevel: site.permissionLevel,
        isPrimary: siteMatchesWebsite(site.siteUrl, params.website),
        lastSyncedAt: new Date(),
      },
    });
    if (property) changed += 1;
  }

  return { discovered, changed };
}

async function listGa4Candidates(connectionId: string) {
  const accessToken = await getOAuthAccessToken(connectionId);
  const response = await fetch(
    'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error(`GA4 accountSummaries failed (${response.status})`);
  }
  const data = await response.json();
  return (data.accountSummaries ?? []).flatMap(
    (account: { displayName?: string; propertySummaries?: Array<{ property?: string; displayName?: string }> }) =>
      (account.propertySummaries ?? []).map(property => ({
        propertyId: property.property?.replace(/^properties\//, '') ?? '',
        displayName: property.displayName ?? null,
        accountName: account.displayName ?? null,
      }))
  );
}

async function syncGoogleBusiness(params: {
  organizationId: string;
  connectionId: string;
  website: string | null;
  apply: boolean;
}) {
  const discovered = await listLocations(params.connectionId);
  if (!params.apply) return { discovered, changed: 0 };

  const websiteDomain = normalizeDomain(params.website);
  let changed = 0;
  for (const location of discovered) {
    const locationDomain = normalizeDomain(location.websiteUri);
    if (!websiteDomain || locationDomain !== websiteDomain) continue;

    await prisma.gBPLocation.upsert({
      where: {
        organizationId_locationId: {
          organizationId: params.organizationId,
          locationId: location.name,
        },
      },
      update: {
        connectionId: params.connectionId,
        locationName: location.locationName,
        address: location.address ?? undefined,
        phone: location.primaryPhone ?? null,
        website: location.websiteUri ?? null,
        categories: location.primaryCategory
          ? {
              primaryCategory: location.primaryCategory,
              additionalCategories: location.additionalCategories ?? [],
            }
          : undefined,
        hours: location.regularHours ?? undefined,
        newReviewUri: location.metadata?.newReviewUri ?? null,
        verified: true,
        isPrimary: true,
        lastSyncedAt: new Date(),
      },
      create: {
        organizationId: params.organizationId,
        connectionId: params.connectionId,
        locationId: location.name,
        locationName: location.locationName,
        address: location.address ?? undefined,
        phone: location.primaryPhone ?? null,
        website: location.websiteUri ?? null,
        categories: location.primaryCategory
          ? {
              primaryCategory: location.primaryCategory,
              additionalCategories: location.additionalCategories ?? [],
            }
          : undefined,
        hours: location.regularHours ?? undefined,
        newReviewUri: location.metadata?.newReviewUri ?? null,
        verified: true,
        isPrimary: true,
        lastSyncedAt: new Date(),
      },
    });
    changed += 1;
  }

  return { discovered, changed };
}

async function platformStatus(params: {
  platform: (typeof PLATFORMS)[number];
  business: {
    organizationId: string;
    website: string | null;
  };
  connections: ConnectionSummary[];
  mappedCounts: Record<PlatformKey, number>;
  appUrl: string;
  apply: boolean;
}): Promise<PlatformStatus> {
  const { platform, business, connections, mappedCounts, appUrl, apply } = params;
  const platformConnections = connections.filter(
    connection => connection.platform === platform.key
  );
  const activeConnections = platformConnections.filter(
    connection => connection.active
  );
  const activeConnectionMissingDurableAuth = activeConnections.some(
    connection => !connection.hasRefreshToken
  );
  const mappedCount = mappedCounts[platform.key] ?? 0;
  const evidence: string[] = [];
  let discoveredCount = 0;

  if (activeConnections.length > 0) {
    evidence.push(`${activeConnections.length} active OAuth connection(s)`);
  }
  if (mappedCount > 0) evidence.push(`${mappedCount} stored mapping(s)`);

  if (activeConnections.length > 0 && platform.key === 'searchconsole') {
    try {
      const sync = await syncSearchConsole({
        organizationId: business.organizationId,
        connectionId: activeConnections[0].id,
        website: business.website,
        apply,
      });
      discoveredCount = sync.discovered.length;
      evidence.push(`${discoveredCount} discoverable Search Console propert${discoveredCount === 1 ? 'y' : 'ies'}`);
      if (sync.changed > 0) evidence.push(`${sync.changed} GSC mapping(s) upserted`);
    } catch (error) {
      evidence.push(`Search Console discovery failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  if (activeConnections.length > 0 && platform.key === 'googleanalytics') {
    try {
      const candidates = await listGa4Candidates(activeConnections[0].id);
      discoveredCount = candidates.length;
      evidence.push(`${discoveredCount} discoverable GA4 propert${discoveredCount === 1 ? 'y' : 'ies'}`);
    } catch (error) {
      evidence.push(`GA4 discovery failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  if (activeConnections.length > 0 && platform.key === 'googlebusiness') {
    try {
      const sync = await syncGoogleBusiness({
        organizationId: business.organizationId,
        connectionId: activeConnections[0].id,
        website: business.website,
        apply,
      });
      discoveredCount = sync.discovered.length;
      evidence.push(`${discoveredCount} discoverable GBP location(s)`);
      if (sync.changed > 0) evidence.push(`${sync.changed} GBP location mapping(s) upserted`);
    } catch (error) {
      evidence.push(`GBP discovery failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  if (activeConnections.length === 0) {
    return {
      platform: platform.key,
      label: platform.label,
      required: platform.required,
      status: 'authority_required',
      connectionCount: platformConnections.length,
      activeConnectionCount: 0,
      mappedCount,
      recommendedAction: `Provide Google authority for ${platform.label} while the target business is active.`,
      authorityUrl: authorityUrl(appUrl, platform.key),
      evidence,
      followUp: platform.followUp,
    };
  }

  if (activeConnectionMissingDurableAuth) {
    return {
      platform: platform.key,
      label: platform.label,
      required: platform.required,
      status: 'reauthorize_required',
      connectionCount: platformConnections.length,
      activeConnectionCount: activeConnections.length,
      mappedCount,
      recommendedAction: `Re-authorize ${platform.label}; the stored token is missing a durable refresh token or is near expiry.`,
      authorityUrl: authorityUrl(appUrl, platform.key),
      evidence,
      followUp: platform.followUp,
    };
  }

  const mappingRequired =
    ['searchconsole', 'googleanalytics', 'googlebusiness'].includes(platform.key) &&
    mappedCount === 0;
  if (mappingRequired) {
    return {
      platform: platform.key,
      label: platform.label,
      required: platform.required,
      status: 'mapping_required',
      connectionCount: platformConnections.length,
      activeConnectionCount: activeConnections.length,
      mappedCount,
      recommendedAction: `Select or sync the matching ${platform.label} property/location for this business.`,
      authorityUrl: authorityUrl(appUrl, platform.key),
      evidence,
      followUp: platform.followUp,
    };
  }

  return {
    platform: platform.key,
    label: platform.label,
    required: platform.required,
    status: 'ready',
    connectionCount: platformConnections.length,
    activeConnectionCount: activeConnections.length,
    mappedCount,
    recommendedAction: 'No action required.',
    authorityUrl: authorityUrl(appUrl, platform.key),
    evidence,
    followUp: platform.followUp,
  };
}

function businessStatus(platforms: PlatformStatus[]): BusinessReport['status'] {
  const required = platforms.filter(platform => platform.required);
  if (required.some(platform => platform.status === 'authority_required' || platform.status === 'reauthorize_required')) {
    return 'needs_authority';
  }
  if (required.some(platform => platform.status === 'mapping_required')) {
    return 'needs_mapping';
  }
  if (required.some(platform => platform.status === 'verify_required')) {
    return 'needs_verification';
  }
  return 'ready';
}

function renderMarkdown(report: {
  owner: string;
  generatedAt: string;
  apply: boolean;
  businesses: BusinessReport[];
}) {
  const lines = [
    '# Synthex Google Connections Authority Packet',
    '',
    `Generated: ${report.generatedAt}`,
    `Owner account: ${report.owner}`,
    `Mode: ${report.apply ? 'apply exact safe mappings' : 'audit only'}`,
    '',
    '## Specialist Agent Loop',
    '',
    '- Senior PM owns sequencing, evidence, and blocker escalation.',
    '- Google Cloud Console Agent owns OAuth consent screen, enabled APIs, redirect URIs, and scope verification.',
    '- Search Console Agent owns property discovery, ownership verification, sitemap/indexing checks, and GSCProperty mapping.',
    '- GA4 Agent owns property discovery/selection, measurement ID capture, and GA4Property mapping.',
    '- Google Business Profile Agent owns location discovery, profile verification state, NAP consistency, reviews, and GBPLocation mapping.',
    '- YouTube/Drive Agent owns video channel and asset workspace links where required.',
    '- Security/QA Agent verifies no secrets are logged, tokens are encrypted, and each route is org-scoped.',
    '',
    '## Businesses',
    '',
  ];

  for (const business of report.businesses) {
    lines.push(`### ${business.name} (${business.slug})`);
    lines.push('');
    lines.push(`- Website: ${business.website ?? 'missing'}`);
    lines.push(`- Status: ${business.status}`);
    for (const platform of business.platforms) {
      const required = platform.required ? 'required' : 'recommended';
      lines.push(
        `- ${platform.label} (${required}): ${platform.status} - ${platform.recommendedAction}`
      );
      if (platform.evidence.length > 0) {
        lines.push(`  Evidence: ${platform.evidence.join('; ')}`);
      }
      if (platform.status !== 'ready') {
        lines.push(`  Authority URL: ${platform.authorityUrl}`);
      }
      if (platform.followUp) lines.push(`  Follow-up: ${platform.followUp}`);
    }
    lines.push('');
  }

  lines.push('## Founder Authority Step');
  lines.push('');
  lines.push(
    'Log into Synthex as the founder, switch to the named business, then open the listed authority URLs. After Google consent/ownership gates are complete, rerun `npm run connections:google:audit` and then `npm run connections:google:apply` to sync exact safe mappings.'
  );
  lines.push('');
  lines.push('## Non-Negotiable Safety Rules');
  lines.push('');
  lines.push('- Do not paste or commit Google tokens, passwords, client secrets, or service account JSON.');
  lines.push('- Do not map a GA4 property or GBP location unless the business/domain match is explicit.');
  lines.push('- Keep demo/mock organizations separate from founder/client production organizations.');
  lines.push('- Treat OAuth app verification and Search Console ownership as Google authority gates, not engineering bugs.');

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const owner = await prisma.user.findUnique({
    where: { email: args.owner },
    select: { id: true, email: true },
  });
  if (!owner) throw new Error(`Owner account not found: ${args.owner}`);

  const ownerships = await prisma.businessOwnership.findMany({
    where: {
      ownerId: owner.id,
      isActive: true,
      organization: { slug: { in: PORTFOLIO_SLUGS } },
    },
    select: {
      organizationId: true,
      organization: {
        select: {
          name: true,
          slug: true,
          website: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  });

  const businesses: BusinessReport[] = [];

  for (const ownership of ownerships) {
    const organizationId = ownership.organizationId;
    const [rawConnections, gscProperties, ga4Properties, gbpLocations] =
      await Promise.all([
        prisma.platformConnection.findMany({
          where: {
            organizationId,
            deletedAt: null,
            platform: { in: PLATFORMS.map(platform => platform.key) },
          },
          select: {
            id: true,
            platform: true,
            isActive: true,
            refreshToken: true,
            expiresAt: true,
            profileName: true,
            scope: true,
          },
          orderBy: [{ platform: 'asc' }, { updatedAt: 'desc' }],
        }),
        prisma.gSCProperty.findMany({
          where: { organizationId },
          select: { siteUrl: true, permissionLevel: true },
        }),
        prisma.gA4Property.findMany({
          where: { organizationId },
          select: { propertyId: true, syncStatus: true },
        }),
        prisma.gBPLocation.findMany({
          where: { organizationId },
          select: { locationId: true, locationName: true, verified: true },
        }),
      ]);

    const connections = rawConnections.map(summarizeConnection);
    const mappedCounts: Record<PlatformKey, number> = {
      searchconsole: gscProperties.length,
      googleanalytics: ga4Properties.length,
      googlebusiness: gbpLocations.length,
      youtube: 0,
      googledrive: 0,
    };

    const platforms: PlatformStatus[] = [];
    for (const platform of PLATFORMS) {
      platforms.push(
        await platformStatus({
          platform,
          business: {
            organizationId,
            website: ownership.organization.website,
          },
          connections,
          mappedCounts,
          appUrl: args.appUrl,
          apply: args.apply,
        })
      );
    }

    businesses.push({
      slug: ownership.organization.slug,
      name: ownership.organization.name,
      website: ownership.organization.website,
      active: true,
      status: businessStatus(platforms),
      platforms,
    });
  }

  const report = {
    owner: owner.email,
    generatedAt: new Date().toISOString(),
    apply: args.apply,
    businesses,
  };

  if (args.writeReport) {
    const outPath = path.resolve(args.writeReport);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, renderMarkdown(report));
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const ready = businesses.filter(business => business.status === 'ready').length;
    const needsAuthority = businesses.filter(business => business.status === 'needs_authority').length;
    const needsMapping = businesses.filter(business => business.status === 'needs_mapping').length;
    console.log('Synthex Google connection audit');
    console.log(`Owner: ${owner.email}`);
    console.log(`Businesses: ${businesses.length}`);
    console.log(`Ready: ${ready}`);
    console.log(`Needs authority: ${needsAuthority}`);
    console.log(`Needs mapping: ${needsMapping}`);
    console.log('');
    for (const business of businesses) {
      const blockers = business.platforms
        .filter(platform => platform.required && platform.status !== 'ready')
        .map(platform => `${platform.platform}:${platform.status}`);
      console.log(
        `${business.slug}: ${business.status}${blockers.length ? ` (${blockers.join(', ')})` : ''}`
      );
    }
    if (args.writeReport) console.log(`\nReport written to ${args.writeReport}`);
  }
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(process.exitCode ?? 0);
  });
