/**
 * Bing Webmaster Tools API client (JSON protocol, API-key auth).
 *
 * Endpoint shape from the Microsoft Learn JSON samples (read 22/10/2026):
 *   https://ssl.bing.com/webmaster/api.svc/json/<Method>?apikey=<key>
 * POST methods take a JSON body; GET methods take query parameters.
 * Success bodies are wrapped as {"d": ...}. Failures are HTTP 400 with
 * {"ErrorCode": n, "Message": "..."}.
 *   - Access: https://learn.microsoft.com/en-us/bingwebmaster/getting-access
 *   - Methods: https://learn.microsoft.com/en-us/dotnet/api/microsoft.bing.webmaster.api.interfaces.iwebmasterapi
 *
 * The API key comes from BING_WEBMASTER_API_KEY (or the `apiKey` option).
 * It travels in the query string, so request URLs are never logged or
 * returned, and any error text has the key redacted.
 */

export const BING_WEBMASTER_JSON_BASE =
  'https://ssl.bing.com/webmaster/api.svc/json';
/** SubmitUrlBatch accepts at most 500 URLs per call (Microsoft Learn remarks). */
export const BING_SUBMIT_URL_BATCH_MAX = 500;

export type BingFailureKind =
  | 'not-configured'
  | 'invalid-input'
  | 'api-error'
  | 'http-error'
  | 'network-error'
  | 'bad-response';

export type BingResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: BingFailureKind;
      message: string;
      status?: number;
      errorCode?: number;
    };

export interface BingSite {
  url: string;
  isVerified: boolean;
  authenticationCode?: string;
  dnsVerificationCode?: string;
}

export interface BingUrlSubmissionQuota {
  daily: number;
  monthly: number;
}

export interface BingWebmasterClient {
  addSite(siteUrl: string): Promise<BingResult<null>>;
  getUserSites(): Promise<BingResult<BingSite[]>>;
  verifySite(siteUrl: string): Promise<BingResult<{ verified: boolean }>>;
  submitFeed(siteUrl: string, feedUrl: string): Promise<BingResult<null>>;
  submitUrlBatch(
    siteUrl: string,
    urlList: readonly string[]
  ): Promise<BingResult<null>>;
  getUrlSubmissionQuota(
    siteUrl: string
  ): Promise<BingResult<BingUrlSubmissionQuota>>;
}

export interface BingWebmasterClientOptions {
  /** Defaults to process.env.BING_WEBMASTER_API_KEY. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

function redact(text: string, apiKey: string): string {
  let out = text.replace(/apikey=[^&\s"']*/gi, 'apikey=[redacted]');
  if (apiKey) out = out.split(apiKey).join('[redacted]');
  return out;
}

export function createBingWebmasterClient(
  opts: BingWebmasterClientOptions = {}
): BingWebmasterClient {
  const apiKey = (
    opts.apiKey ??
    process.env.BING_WEBMASTER_API_KEY ??
    ''
  ).trim();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = opts.baseUrl ?? BING_WEBMASTER_JSON_BASE;

  async function call(
    method: string,
    verb: 'GET' | 'POST',
    params: Record<string, unknown>
  ): Promise<BingResult<unknown>> {
    if (!apiKey) {
      return {
        ok: false,
        kind: 'not-configured',
        message: 'BING_WEBMASTER_API_KEY is not set',
      };
    }
    const query = new URLSearchParams();
    if (verb === 'GET')
      for (const [k, v] of Object.entries(params)) query.set(k, String(v));
    query.set('apikey', apiKey);
    const url = `${baseUrl}/${method}?${query.toString()}`;

    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: verb,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        ...(verb === 'POST' ? { body: JSON.stringify(params) } : {}),
      });
    } catch (err) {
      return {
        ok: false,
        kind: 'network-error',
        message: redact(
          err instanceof Error ? err.message : String(err),
          apiKey
        ),
      };
    }

    let body: unknown = undefined;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    const obj =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

    if (res.status < 200 || res.status >= 300) {
      if (typeof obj.ErrorCode === 'number') {
        return {
          ok: false,
          kind: 'api-error',
          status: res.status,
          errorCode: obj.ErrorCode,
          message: redact(String(obj.Message ?? 'unknown error'), apiKey),
        };
      }
      return {
        ok: false,
        kind: 'http-error',
        status: res.status,
        message: `HTTP ${res.status} from ${method}`,
      };
    }
    if (!('d' in obj)) {
      return {
        ok: false,
        kind: 'bad-response',
        status: res.status,
        message: `${method} response has no "d" wrapper`,
      };
    }
    return { ok: true, data: obj.d };
  }

  function badShape<T>(method: string): BingResult<T> {
    return {
      ok: false,
      kind: 'bad-response',
      message: `${method} returned an unexpected shape`,
    };
  }

  return {
    async addSite(siteUrl) {
      const r = await call('AddSite', 'POST', { siteUrl });
      return r.ok ? { ok: true, data: null } : r;
    },

    async getUserSites() {
      const r = await call('GetUserSites', 'GET', {});
      if (!r.ok) return r;
      if (!Array.isArray(r.data)) return badShape('GetUserSites');
      const sites: BingSite[] = [];
      for (const raw of r.data as Array<Record<string, unknown>>) {
        if (typeof raw?.Url !== 'string' || typeof raw.IsVerified !== 'boolean')
          return badShape('GetUserSites');
        sites.push({
          url: raw.Url,
          isVerified: raw.IsVerified,
          ...(typeof raw.AuthenticationCode === 'string'
            ? { authenticationCode: raw.AuthenticationCode }
            : {}),
          ...(typeof raw.DnsVerificationCode === 'string'
            ? { dnsVerificationCode: raw.DnsVerificationCode }
            : {}),
        });
      }
      return { ok: true, data: sites };
    },

    async verifySite(siteUrl) {
      const r = await call('VerifySite', 'POST', { siteUrl });
      if (!r.ok) return r;
      if (typeof r.data !== 'boolean') return badShape('VerifySite');
      return { ok: true, data: { verified: r.data } };
    },

    async submitFeed(siteUrl, feedUrl) {
      const r = await call('SubmitFeed', 'POST', { siteUrl, feedUrl });
      return r.ok ? { ok: true, data: null } : r;
    },

    async submitUrlBatch(siteUrl, urlList) {
      if (urlList.length === 0 || urlList.length > BING_SUBMIT_URL_BATCH_MAX) {
        return {
          ok: false,
          kind: 'invalid-input',
          message: `urlList must hold 1-${BING_SUBMIT_URL_BATCH_MAX} URLs (got ${urlList.length})`,
        };
      }
      const r = await call('SubmitUrlBatch', 'POST', {
        siteUrl,
        urlList: [...urlList],
      });
      return r.ok ? { ok: true, data: null } : r;
    },

    async getUrlSubmissionQuota(siteUrl) {
      const r = await call('GetUrlSubmissionQuota', 'GET', { siteUrl });
      if (!r.ok) return r;
      const d = r.data as Record<string, unknown> | null;
      if (
        !d ||
        typeof d.DailyQuota !== 'number' ||
        typeof d.MonthlyQuota !== 'number'
      )
        return badShape('GetUrlSubmissionQuota');
      return {
        ok: true,
        data: { daily: d.DailyQuota, monthly: d.MonthlyQuota },
      };
    },
  };
}
