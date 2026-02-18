/**
 * Google Search Console API Integration
 *
 * Provides search analytics, URL indexing inspection, and sitemap status
 * from Google Search Console via Service Account authentication.
 *
 * Setup:
 * 1. Enable "Google Search Console API" in Google Cloud Console
 * 2. Create a Service Account (or reuse the one from Indexing API)
 * 3. Add the service account email as a property owner in Google Search Console
 * 4. Set GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON env var with the JSON key contents
 *
 * ENVIRONMENT VARIABLES:
 * - GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: JSON string of service account credentials
 */

// ============================================================================
// TYPES
// ============================================================================

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchAnalyticsResult {
  rows: SearchAnalyticsRow[];
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
}

export interface SearchAnalyticsOptions {
  startDate?: string;
  endDate?: string;
  dimensions?: ('query' | 'page' | 'country' | 'device')[];
  rowLimit?: number;
}

export interface IndexingInspection {
  indexingState: string;
  crawlState: string;
  lastCrawlTime: string | null;
  robotsTxtState: string;
  pageFetchState: string;
  verdict: string;
  coverageState: string;
}

export interface SitemapInfo {
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
// AUTH HELPERS (Duplicated from indexing.ts for self-containment)
// ============================================================================

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SEARCH_CONSOLE_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/webmasters',
].join(' ');

/**
 * Create a JWT for service account authentication
 */
function createJWT(credentials: ServiceAccountCredentials): string {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: SEARCH_CONSOLE_SCOPES,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  };

  // Base64url encode
  const base64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const headerEncoded = base64url(header);
  const payloadEncoded = base64url(payload);
  const signInput = `${headerEncoded}.${payloadEncoded}`;

  // Sign with private key
  const crypto = require('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign
    .sign(credentials.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signInput}.${signature}`;
}

/**
 * Get an OAuth2 access token using service account credentials
 */
async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const jwt = createJWT(credentials);

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Load service account credentials from environment
 */
function loadCredentials(): ServiceAccountCredentials | null {
  const json = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON;
  if (!json) {
    return null;
  }

  try {
    return JSON.parse(json);
  } catch {
    console.warn('Invalid JSON in GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON');
    return null;
  }
}

// ============================================================================
// SEARCH ANALYTICS
// ============================================================================

/**
 * Get search analytics data from Google Search Console.
 * Falls back to demo data if credentials are not configured.
 */
export async function getSearchAnalytics(
  siteUrl: string,
  options: SearchAnalyticsOptions = {}
): Promise<SearchAnalyticsResult> {
  const {
    startDate = getDateDaysAgo(28),
    endDate = getDateDaysAgo(0),
    dimensions = ['query'],
    rowLimit = 25,
  } = options;

  const credentials = loadCredentials();
  if (!credentials) {
    console.warn('Search Console credentials not configured. Returning demo data.');
    return getDemoAnalyticsData(dimensions);
  }

  try {
    const accessToken = await getAccessToken(credentials);
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions,
        rowLimit,
        type: 'web',
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Search Console API error ${response.status}: ${error}`);
    }

    const data = await response.json();
    const rows: SearchAnalyticsRow[] = (data.rows || []).map((row: Record<string, unknown>) => ({
      keys: row.keys as string[],
      clicks: row.clicks as number,
      impressions: row.impressions as number,
      ctr: row.ctr as number,
      position: row.position as number,
    }));

    // Calculate totals
    const totals = rows.reduce(
      (acc, row) => ({
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
        ctr: 0, // Will be calculated below
        position: 0, // Will be calculated below
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0 }
    );

    totals.ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
    totals.position =
      rows.length > 0 ? rows.reduce((sum, r) => sum + r.position, 0) / rows.length : 0;

    return { rows, totals };
  } catch (error) {
    console.error('Search Console Analytics error:', error);
    throw error;
  }
}

// ============================================================================
// URL INSPECTION (INDEXING STATUS)
// ============================================================================

/**
 * Inspect a URL's indexing status via the URL Inspection API.
 * Returns indexing coverage, crawl state, and related metadata.
 */
export async function getIndexingStatus(
  siteUrl: string,
  inspectionUrl: string
): Promise<IndexingInspection> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error(
      'Search Console credentials not configured. Set GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON to use the URL Inspection API.'
    );
  }

  try {
    const accessToken = await getAccessToken(credentials);
    const apiUrl = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        inspectionUrl,
        siteUrl,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`URL Inspection API error ${response.status}: ${error}`);
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
  } catch (error) {
    console.error('URL Inspection API error:', error);
    throw error;
  }
}

// ============================================================================
// SITEMAP STATUS
// ============================================================================

/**
 * Get sitemap status from Google Search Console.
 * Returns a list of sitemaps with their metadata and status.
 * Falls back to empty array with warning if credentials not configured.
 */
export async function getSitemapStatus(siteUrl: string): Promise<SitemapInfo[]> {
  const credentials = loadCredentials();
  if (!credentials) {
    console.warn('Search Console credentials not configured. Returning empty sitemap list.');
    return [];
  }

  try {
    const accessToken = await getAccessToken(credentials);
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/sitemaps`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sitemaps API error ${response.status}: ${error}`);
    }

    const data = await response.json();
    const sitemaps: SitemapInfo[] = (data.sitemap || []).map((sitemap: Record<string, unknown>) => ({
      path: sitemap.path as string,
      lastSubmitted: (sitemap.lastSubmitted as string) || null,
      isPending: (sitemap.isPending as boolean) || false,
      isSitemapsIndex: (sitemap.isSitemapsIndex as boolean) || false,
      lastDownloaded: (sitemap.lastDownloaded as string) || null,
      warnings: parseInt(String(sitemap.warnings || '0'), 10),
      errors: parseInt(String(sitemap.errors || '0'), 10),
      contents: ((sitemap.contents as Array<Record<string, unknown>>) || []).map((c) => ({
        type: c.type as string,
        submitted: parseInt(String(c.submitted || '0'), 10),
        indexed: parseInt(String(c.indexed || '0'), 10),
      })),
    }));

    return sitemaps;
  } catch (error) {
    console.error('Sitemaps API error:', error);
    throw error;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get a date string (YYYY-MM-DD) for N days ago
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Generate demo analytics data when credentials are not available
 */
function getDemoAnalyticsData(dimensions: string[]): SearchAnalyticsResult {
  const demoQueries = [
    { keys: ['marketing automation'], clicks: 245, impressions: 12400, ctr: 0.0198, position: 8.3 },
    { keys: ['social media scheduler'], clicks: 189, impressions: 9800, ctr: 0.0193, position: 12.1 },
    { keys: ['ai content generator'], clicks: 156, impressions: 8200, ctr: 0.019, position: 15.4 },
    { keys: ['instagram scheduling tool'], clicks: 134, impressions: 7100, ctr: 0.0189, position: 11.7 },
    { keys: ['content calendar app'], clicks: 112, impressions: 6500, ctr: 0.0172, position: 14.2 },
    { keys: ['social media analytics'], clicks: 98, impressions: 5800, ctr: 0.0169, position: 18.6 },
    { keys: ['brand voice ai'], clicks: 87, impressions: 4200, ctr: 0.0207, position: 9.8 },
    { keys: ['multi platform posting'], clicks: 76, impressions: 3900, ctr: 0.0195, position: 13.5 },
    { keys: ['tiktok scheduler'], clicks: 65, impressions: 3400, ctr: 0.0191, position: 16.3 },
    { keys: ['competitor tracking tool'], clicks: 54, impressions: 2800, ctr: 0.0193, position: 19.1 },
  ];

  const demoPages = [
    { keys: ['https://synthex.social/'], clicks: 320, impressions: 18000, ctr: 0.0178, position: 6.2 },
    { keys: ['https://synthex.social/features'], clicks: 210, impressions: 12500, ctr: 0.0168, position: 9.4 },
    { keys: ['https://synthex.social/pricing'], clicks: 185, impressions: 9800, ctr: 0.0189, position: 8.1 },
    { keys: ['https://synthex.social/blog'], clicks: 145, impressions: 7600, ctr: 0.0191, position: 14.7 },
    { keys: ['https://synthex.social/demo'], clicks: 98, impressions: 5200, ctr: 0.0188, position: 11.3 },
  ];

  const demoCountries = [
    { keys: ['USA'], clicks: 580, impressions: 32000, ctr: 0.0181, position: 10.2 },
    { keys: ['GBR'], clicks: 210, impressions: 11500, ctr: 0.0183, position: 12.4 },
    { keys: ['CAN'], clicks: 145, impressions: 7800, ctr: 0.0186, position: 11.8 },
    { keys: ['AUS'], clicks: 98, impressions: 5200, ctr: 0.0188, position: 13.1 },
    { keys: ['DEU'], clicks: 76, impressions: 4100, ctr: 0.0185, position: 14.6 },
  ];

  const demoDevices = [
    { keys: ['MOBILE'], clicks: 620, impressions: 35000, ctr: 0.0177, position: 12.3 },
    { keys: ['DESKTOP'], clicks: 380, impressions: 19500, ctr: 0.0195, position: 9.8 },
    { keys: ['TABLET'], clicks: 110, impressions: 6100, ctr: 0.018, position: 11.5 },
  ];

  // Select demo data based on dimension
  const primaryDimension = dimensions[0] || 'query';
  let rows: SearchAnalyticsRow[];

  switch (primaryDimension) {
    case 'page':
      rows = demoPages;
      break;
    case 'country':
      rows = demoCountries;
      break;
    case 'device':
      rows = demoDevices;
      break;
    default:
      rows = demoQueries;
  }

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
    rows.length > 0 ? rows.reduce((sum, r) => sum + r.position, 0) / rows.length : 0;

  return { rows, totals };
}
