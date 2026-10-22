/**
 * IndexNow submission client.
 *
 * Protocol (https://www.indexnow.org/documentation, read 22/10/2026):
 * POST JSON `{host, key, keyLocation, urlList}` to an IndexNow endpoint,
 * at most 10,000 URLs per post. Responses: 200 submitted, 202 received with
 * key validation pending, 400 bad format, 403 key not valid, 422 URLs not
 * on the host or key not matching the schema, 429 too many requests.
 *
 * Only 200 counts as success. Everything else is reported as what it is;
 * a 429 is "retry later", a 403 is "key not verified", never success.
 */
import { isValidIndexNowKey } from './key';

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const INDEXNOW_MAX_URLS_PER_REQUEST = 10_000;

export type IndexNowOutcome =
  | 'submitted'
  | 'accepted-key-pending'
  | 'bad-request'
  | 'key-not-verified'
  | 'unprocessable'
  | 'retry-later'
  | 'unexpected-status'
  | 'network-error';

export interface IndexNowClassification {
  outcome: IndexNowOutcome;
  /** True only for 200. */
  ok: boolean;
  /** True when the same request may succeed later without changes. */
  retryable: boolean;
  detail: string;
}

export interface IndexNowBody {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export interface IndexNowRequestInput {
  /** Bare host, e.g. `carsi.com.au`. */
  host: string;
  key: string;
  /** `https://<host>/<key>.txt`. */
  keyLocation: string;
  urls: readonly string[];
}

export interface IndexNowBatchResult extends IndexNowClassification {
  urlCount: number;
  status?: number;
}

export interface IndexNowSubmission {
  /** True only when every URL was on-host and every batch returned 200. */
  ok: boolean;
  host: string;
  requested: number;
  rejectedOffHost: string[];
  batches: IndexNowBatchResult[];
  /** Present when nothing was sent. */
  reason?: string;
}

export function classifyIndexNowStatus(status: number): IndexNowClassification {
  switch (status) {
    case 200:
      return {
        outcome: 'submitted',
        ok: true,
        retryable: false,
        detail: 'URLs submitted',
      };
    case 202:
      return {
        outcome: 'accepted-key-pending',
        ok: false,
        retryable: false,
        detail: 'received; IndexNow key validation pending',
      };
    case 400:
      return {
        outcome: 'bad-request',
        ok: false,
        retryable: false,
        detail: 'invalid request format',
      };
    case 403:
      return {
        outcome: 'key-not-verified',
        ok: false,
        retryable: false,
        detail: 'key not valid: key file missing or does not contain the key',
      };
    case 422:
      return {
        outcome: 'unprocessable',
        ok: false,
        retryable: false,
        detail: 'URLs not on the host, or key does not match the protocol',
      };
    case 429:
      return {
        outcome: 'retry-later',
        ok: false,
        retryable: true,
        detail: 'too many requests; retry later',
      };
    default:
      return {
        outcome: 'unexpected-status',
        ok: false,
        retryable: status >= 500,
        detail: `unexpected HTTP ${status}`,
      };
  }
}

function onHost(url: string, host: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.protocol === 'https:' || u.protocol === 'http:') &&
      u.host.toLowerCase() === host.toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * Validate, de-duplicate and chunk URLs into protocol-sized request bodies.
 * URLs that are malformed or on another host are returned in
 * `rejectedOffHost` instead of being sent (the API would answer 422).
 */
export function buildIndexNowRequests(input: IndexNowRequestInput): {
  bodies: IndexNowBody[];
  rejectedOffHost: string[];
} {
  const accepted: string[] = [];
  const rejectedOffHost: string[] = [];
  const seen = new Set<string>();
  for (const url of input.urls) {
    if (!onHost(url, input.host)) {
      rejectedOffHost.push(url);
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    accepted.push(url);
  }
  const bodies: IndexNowBody[] = [];
  for (let i = 0; i < accepted.length; i += INDEXNOW_MAX_URLS_PER_REQUEST) {
    bodies.push({
      host: input.host,
      key: input.key,
      keyLocation: input.keyLocation,
      urlList: accepted.slice(i, i + INDEXNOW_MAX_URLS_PER_REQUEST),
    });
  }
  return { bodies, rejectedOffHost };
}

/** Submit URLs to IndexNow, one POST per 10,000. Never throws. */
export async function submitToIndexNow(
  input: IndexNowRequestInput,
  opts: { fetchImpl?: typeof fetch; endpoint?: string } = {}
): Promise<IndexNowSubmission> {
  const base = {
    host: input.host,
    requested: input.urls.length,
  };
  if (!isValidIndexNowKey(input.key)) {
    return {
      ...base,
      ok: false,
      rejectedOffHost: [],
      batches: [],
      reason: 'invalid key: protocol requires 8-128 of a-z, A-Z, 0-9, dash',
    };
  }
  const { bodies, rejectedOffHost } = buildIndexNowRequests(input);
  if (bodies.length === 0) {
    return {
      ...base,
      ok: false,
      rejectedOffHost,
      batches: [],
      reason: 'no on-host URLs to submit',
    };
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const endpoint = opts.endpoint ?? INDEXNOW_ENDPOINT;
  const batches: IndexNowBatchResult[] = [];
  for (const body of bodies) {
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
      });
      batches.push({
        ...classifyIndexNowStatus(res.status),
        status: res.status,
        urlCount: body.urlList.length,
      });
    } catch (err) {
      batches.push({
        outcome: 'network-error',
        ok: false,
        retryable: true,
        detail: err instanceof Error ? err.message : String(err),
        urlCount: body.urlList.length,
      });
    }
  }
  return {
    ...base,
    ok: rejectedOffHost.length === 0 && batches.every(b => b.ok),
    rejectedOffHost,
    batches,
  };
}
