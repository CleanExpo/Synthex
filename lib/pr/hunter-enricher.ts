/**
 * PR Journalist CRM — Hunter.io Email Enricher (Phase 92)
 *
 * Optional email discovery via Hunter.io API.
 * Gracefully returns empty result if HUNTER_API_KEY is not configured.
 * Free tier: 50 email-finder credits/month.
 *
 * @module lib/pr/hunter-enricher
 */

// ---------------------------------------------------------------------------
// Hunter.io API response shapes
// ---------------------------------------------------------------------------

interface HunterEmailFinderData {
  email: string | null;
  score: number;        // 0-100 confidence
  position: string | null;
}

interface HunterEmailFinderResponse {
  data: HunterEmailFinderData;
  meta?: {
    params?: {
      first_name?: string;
      last_name?: string;
      domain?: string;
    };
  };
}

interface HunterAccountData {
  requests?: {
    searches?: {
      used: number;
      available: number;
    };
  };
}

interface HunterAccountResponse {
  data: HunterAccountData;
}

// ---------------------------------------------------------------------------
// Main enrichment function
// ---------------------------------------------------------------------------

/**
 * Look up a journalist's email via Hunter.io Email Finder API.
 *
 * @param name - Full name of the journalist (e.g. "Jane Smith")
 * @param domain - Outlet domain (e.g. "theaustralian.com.au")
 * @param apiKey - Hunter.io API key (falls back to HUNTER_API_KEY env var)
 * @returns Email and confidence score, or empty result if not found
 */
export async function enrichJournalist(
  name: string,
  domain: string,
  apiKey?: string
): Promise<{ email?: string; confidence?: number }> {
  const key = apiKey ?? process.env.HUNTER_API_KEY;
  if (!key) {
    return {};
  }

  // Split name into first and last
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ') || parts[0]; // fallback to first if no last name

  if (!firstName || !domain) {
    return {};
  }

  const url = new URL('https://api.hunter.io/v2/email-finder');
  url.searchParams.set('first_name', firstName);
  url.searchParams.set('last_name', lastName);
  url.searchParams.set('domain', domain);
  url.searchParams.set('api_key', key);

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      return {};
    }

    const data: HunterEmailFinderResponse = await res.json();
    const email = data.data?.email ?? undefined;
    const confidence = data.data?.score ?? undefined;

    return { email: email ?? undefined, confidence };
  } catch {
    // Network error or timeout — fail gracefully
    return {};
  }
}

// ---------------------------------------------------------------------------
// Credit check helper
// ---------------------------------------------------------------------------

/**
 * Check remaining Hunter.io API credits.
 * Returns null if API key not configured or request fails.
 */
export async function getHunterCreditsRemaining(): Promise<number | null> {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;

  try {
    const url = `https://api.hunter.io/v2/account?api_key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;

    const data: HunterAccountResponse = await res.json();
    return data.data?.requests?.searches?.available ?? null;
  } catch {
    return null;
  }
}
