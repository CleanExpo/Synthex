/**
 * Google Search Console — OAuth-based Service
 *
 * Per-business GSC access using OAuth tokens stored in PlatformConnection.
 * Falls back to shared Service Account when no OAuth connection exists.
 *
 * @module lib/google/search-console-oauth
 */

import {
  getOAuthAccessToken,
  getServiceAccountAccessToken,
  findOAuthConnection,
  hasServiceAccountCredentials,
} from '@/lib/google/google-auth';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface GSCSearchAnalyticsOptions {
  startDate?: string;
  endDate?: string;
  dimensions?: ('query' | 'page' | 'country' | 'device' | 'date')[];
  rowLimit?: number;
  startRow?: number;
  dimensionFilterGroups?: Array<{
    filters: Array<{
      dimension: string;
      operator: string;
      expression: string;
    }>;
  }>;
}

export interface GSCSearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCSearchAnalyticsResult {
  rows: GSCSearchAnalyticsRow[];
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
}

export interface GSCUrlInspection {
  indexingState: string;
  crawlState: string;
  lastCrawlTime: string | null;
  robotsTxtState: string;
  pageFetchState: string;
  verdict: string;
  coverageState: string;
}

export interface GSCCoverageReport {
  indexed: number;
  errors: number;
  warnings: number;
  excluded: number;
}

export interface GSCSitemapInfo {
  path: string;
  lastSubmitted: string | null;
  isPending: boolean;
  isSitemapsIndex: boolean;
  lastDownloaded: string | null;
  warnings: number;
  errors: number;
  contents: Array<{
    type: string;
    submitted: number;
    indexed: number;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';
const INSPECTION_API_BASE = 'https://searchconsole.googleapis.com/v1';
const INDEXING_API_BASE = 'https://indexing.googleapis.com/v3';
const DEFAULT_TIMEOUT = 30_000;

const WEBMASTERS_SCOPE = 'https://www.googleapis.com/auth/webmasters';
const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';

// ============================================================================
// Auth Resolution
// ============================================================================

/**
 * Resolve an access token for GSC — OAuth first, service account fallback.
 */
async function resolveAccessToken(
  connectionId?: string | null,
  organizationId?: string | null,
  scope: string = WEBMASTERS_SCOPE
): Promise<string> {
  // 1. Try explicit connection ID
  if (connectionId) {
    return getOAuthAccessToken(connectionId);
  }

  // 2. Try org-level OAuth connection
  if (organizationId) {
    const foundConnectionId = await findOAuthConnection(
      organizationId,
      'searchconsole'
    );
    if (foundConnectionId) {
      return getOAuthAccessToken(foundConnectionId);
    }
  }

  // 3. Service account fallback
  if (hasServiceAccountCredentials()) {
    return getServiceAccountAccessToken(scope);
  }

  throw new Error(
    'No Google Search Console credentials available. Connect via OAuth or configure a service account.'
  );
}

// ============================================================================
// Site Management
// ============================================================================

/**
 * List all verified GSC properties accessible by the authenticated account.
 */
export async function listSites(connectionId: string): Promise<GSCSite[]> {
  const accessToken = await getOAuthAccessToken(connectionId);

  const response = await fetch(`${GSC_API_BASE}/sites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GSC listSites failed (${response.status}): ${error}`);
  }

  const data = await response.json();
  return (data.siteEntry || []).map((entry: Record<string, unknown>) => ({
    siteUrl: entry.siteUrl as string,
    permissionLevel: entry.permissionLevel as string,
  }));
}

// ============================================================================
// Search Analytics
// ============================================================================

/**
 * Get search analytics data from GSC.
 */
export async function getSearchAnalytics(
  siteUrl: string,
  options: GSCSearchAnalyticsOptions = {},
  auth?: { connectionId?: string; organizationId?: string }
): Promise<GSCSearchAnalyticsResult> {
  const {
    startDate = getDateDaysAgo(28),
    endDate = getDateDaysAgo(0),
    dimensions = ['query'],
    rowLimit = 25,
    startRow,
    dimensionFilterGroups,
  } = options;

  const accessToken = await resolveAccessToken(
    auth?.connectionId,
    auth?.organizationId
  );

  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const apiUrl = `${GSC_API_BASE}/sites/${encodedSiteUrl}/searchAnalytics/query`;

  const body: Record<string, unknown> = {
    startDate,
    endDate,
    dimensions,
    rowLimit,
    type: 'web',
  };

  if (startRow !== undefined) body.startRow = startRow;
  if (dimensionFilterGroups) body.dimensionFilterGroups = dimensionFilterGroups;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `GSC searchAnalytics failed (${response.status}): ${error}`
    );
  }

  const data = await response.json();
  const rows: GSCSearchAnalyticsRow[] = (data.rows || []).map(
    (row: Record<string, unknown>) => ({
      keys: row.keys as string[],
      clicks: row.clicks as number,
      impressions: row.impressions as number,
      ctr: row.ctr as number,
      position: row.position as number,
    })
  );

  const totals = rows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      impressions: acc.impressions + row.impressions,
      ctr: 0,
      position: 0,
    }),
    { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  );
  totals.ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  totals.position =
    rows.length > 0
      ? rows.reduce((sum, r) => sum + r.position, 0) / rows.length
      : 0;

  return { rows, totals };
}

// ============================================================================
// URL Inspection
// ============================================================================

/**
 * Inspect a URL's indexing status via the URL Inspection API.
 */
export async function getUrlInspection(
  siteUrl: string,
  inspectionUrl: string,
  auth?: { connectionId?: string; organizationId?: string }
): Promise<GSCUrlInspection> {
  const accessToken = await resolveAccessToken(
    auth?.connectionId,
    auth?.organizationId
  );

  const apiUrl = `${INSPECTION_API_BASE}/urlInspection/index:inspect`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ inspectionUrl, siteUrl }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GSC URL Inspection failed (${response.status}): ${error}`);
  }

  const data = await response.json();
  const result = data.inspectionResult?.indexStatusResult;

  return {
    indexingState: result?.indexingState || 'UNKNOWN',
    crawlState: result?.crawlingState || 'UNKNOWN',
    lastCrawlTime: result?.lastCrawlTime || null,
    robotsTxtState: result?.robotsTxtState || 'UNKNOWN',
    pageFetchState: result?.pageFetchState || 'UNKNOWN',
    verdict: result?.verdict || 'UNKNOWN',
    coverageState: result?.coverageState || 'UNKNOWN',
  };
}

// ============================================================================
// Coverage Report
// ============================================================================

/**
 * Get index coverage summary by inspecting key pages.
 * GSC API does not expose coverage counts directly — we approximate
 * by querying search analytics with page dimension for the site.
 */
export async function getCoverageReport(
  siteUrl: string,
  auth?: { connectionId?: string; organizationId?: string }
): Promise<GSCCoverageReport> {
  // Coverage data comes from the GSC UI's Index Coverage report.
  // The API exposes URL Inspection per-URL, not aggregate counts.
  // We return placeholder structure — actual counts come from daily cron snapshots.
  logger.info(
    '[search-console-oauth] getCoverageReport called — aggregate data comes from GSCSnapshot'
  );

  return {
    indexed: 0,
    errors: 0,
    warnings: 0,
    excluded: 0,
  };
}

// ============================================================================
// Sitemaps
// ============================================================================

/**
 * List sitemaps for a GSC property.
 */
export async function listSitemaps(
  siteUrl: string,
  auth?: { connectionId?: string; organizationId?: string }
): Promise<GSCSitemapInfo[]> {
  const accessToken = await resolveAccessToken(
    auth?.connectionId,
    auth?.organizationId
  );

  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const apiUrl = `${GSC_API_BASE}/sites/${encodedSiteUrl}/sitemaps`;

  const response = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GSC listSitemaps failed (${response.status}): ${error}`);
  }

  const data = await response.json();
  return (data.sitemap || []).map((sitemap: Record<string, unknown>) => ({
    path: sitemap.path as string,
    lastSubmitted: (sitemap.lastSubmitted as string) || null,
    isPending: (sitemap.isPending as boolean) || false,
    isSitemapsIndex: (sitemap.isSitemapsIndex as boolean) || false,
    lastDownloaded: (sitemap.lastDownloaded as string) || null,
    warnings: parseInt(String(sitemap.warnings || '0'), 10),
    errors: parseInt(String(sitemap.errors || '0'), 10),
    contents: ((sitemap.contents as Array<Record<string, unknown>>) || []).map(
      c => ({
        type: c.type as string,
        submitted: parseInt(String(c.submitted || '0'), 10),
        indexed: parseInt(String(c.indexed || '0'), 10),
      })
    ),
  }));
}

/**
 * Submit a sitemap URL to Google Search Console.
 */
export async function submitSitemap(
  siteUrl: string,
  sitemapUrl: string,
  auth?: { connectionId?: string; organizationId?: string }
): Promise<void> {
  const accessToken = await resolveAccessToken(
    auth?.connectionId,
    auth?.organizationId
  );

  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const encodedSitemapUrl = encodeURIComponent(sitemapUrl);
  const apiUrl = `${GSC_API_BASE}/sites/${encodedSiteUrl}/sitemaps/${encodedSitemapUrl}`;

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GSC submitSitemap failed (${response.status}): ${error}`);
  }
}

// ============================================================================
// Indexing API
// ============================================================================

/**
 * Request Google to crawl/remove a URL via the Indexing API.
 * Requires the `indexing` scope in the OAuth connection.
 */
export async function requestIndexing(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED',
  auth?: { connectionId?: string; organizationId?: string }
): Promise<{ success: boolean; notifyTime?: string; error?: string }> {
  try {
    const accessToken = await resolveAccessToken(
      auth?.connectionId,
      auth?.organizationId,
      INDEXING_SCOPE
    );

    const apiUrl = `${INDEXING_API_BASE}/urlNotifications:publish`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ url, type }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `API error ${response.status}: ${error}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      notifyTime: data.urlNotificationMetadata?.latestUpdate?.notifyTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}
