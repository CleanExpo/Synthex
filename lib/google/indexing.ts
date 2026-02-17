/**
 * Google Indexing API Integration
 *
 * Enables instant URL submission to Google for crawling.
 * Uses a Service Account for authentication (no user interaction required).
 *
 * Setup:
 * 1. Enable "Web Search Indexing API" in Google Cloud Console
 * 2. Create a Service Account with Indexing API access
 * 3. Add the service account email as an Owner in Google Search Console
 * 4. Set GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON env var with the JSON key contents
 *
 * ENVIRONMENT VARIABLES:
 * - GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: JSON string of service account credentials
 * - GOOGLE_CLOUD_PROJECT_ID: Google Cloud project ID (gen-lang-client-0717569718)
 */

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

interface IndexingResponse {
  success: boolean;
  url: string;
  type: 'URL_UPDATED' | 'URL_DELETED';
  notifyTime?: string;
  error?: string;
}

const INDEXING_API_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';

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
    scope: INDEXING_SCOPE,
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
function loadCredentials(): ServiceAccountCredentials {
  const json = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new Error('GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON environment variable not set');
  }

  try {
    return JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON in GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON');
  }
}

/**
 * Submit a URL to Google for indexing (URL_UPDATED) or removal (URL_DELETED)
 */
export async function submitUrl(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<IndexingResponse> {
  try {
    const credentials = loadCredentials();
    const accessToken = await getAccessToken(credentials);

    const response = await fetch(INDEXING_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ url, type }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, url, type, error: `API error ${response.status}: ${error}` };
    }

    const data = await response.json();
    return {
      success: true,
      url,
      type,
      notifyTime: data.urlNotificationMetadata?.latestUpdate?.notifyTime,
    };
  } catch (error) {
    return {
      success: false,
      url,
      type,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Submit multiple URLs for indexing in batch
 */
export async function submitBatch(
  urls: string[],
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<IndexingResponse[]> {
  // Google Indexing API has a quota of 200 requests/day
  const results: IndexingResponse[] = [];
  for (const url of urls.slice(0, 200)) {
    const result = await submitUrl(url, type);
    results.push(result);
    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return results;
}

/**
 * Get all public URLs for the Synthex site (for batch submission)
 */
export function getSynthexPublicUrls(): string[] {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';
  return [
    '/',
    '/features',
    '/pricing',
    '/about',
    '/blog',
    '/demo',
    '/docs',
    '/api-reference',
    '/case-studies',
    '/support',
    '/careers',
    '/roadmap',
    '/changelog',
    '/contact',
    '/security',
    '/signup',
  ].map((path) => `${baseUrl}${path}`);
}
