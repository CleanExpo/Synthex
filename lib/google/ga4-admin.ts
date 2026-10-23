/**
 * GA4 Admin API client for onboarding (kit K2 "measurement").
 *
 * Creates a GA4 property, a web data stream (which yields the G- measurement
 * ID) and key events under the client's `analytics.edit` grant. Every step is
 * idempotent: it lists what already exists and reuses a match (property by
 * display name, stream by site URI, key event by event name) before creating.
 * Any non-2xx response throws a Ga4AdminError; nothing is ever reported as
 * created unless Google returned the created resource.
 *
 * Google docs (v1beta, read 22/10/2026):
 * - properties.create / list:
 *   https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties/create
 * - properties.dataStreams (webStreamData.measurementId):
 *   https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.dataStreams
 * - properties.keyEvents (countingMethod is required):
 *   https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.keyEvents
 * Accounts cannot be created here: Google requires accounts.provisionAccountTicket
 * plus the user accepting the Terms of Service, so an existing account id is input.
 */

const ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta';

export type Ga4AdminErrorCode =
  | 'NEEDS_EDIT_CONSENT'
  | 'PERMISSION_DENIED'
  | 'UNAUTHENTICATED'
  | 'UPSTREAM_ERROR'
  | 'INVALID_RESPONSE'
  | 'STREAM_EXISTS'
  | 'PROPERTY_NAME_TAKEN';

export class Ga4AdminError extends Error {
  constructor(
    public readonly code: Ga4AdminErrorCode,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'Ga4AdminError';
  }
}

export interface Ga4AdminDeps {
  accessToken: string;
  fetch?: typeof fetch;
}

interface GoogleErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{ reason?: string }>;
  };
}

async function toError(res: Response): Promise<Ga4AdminError> {
  let body: GoogleErrorBody = {};
  try {
    body = (await res.json()) as GoogleErrorBody;
  } catch {
    // Non-JSON error body: classify on status alone.
  }
  const message = body.error?.message ?? `HTTP ${res.status}`;
  const scopeMissing =
    (body.error?.details ?? []).some(
      d => d.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'
    ) || /insufficient authentication scopes/i.test(message);

  if (res.status === 403 && scopeMissing) {
    return new Ga4AdminError(
      'NEEDS_EDIT_CONSENT',
      'Google Analytics needs Analytics edit consent: reconnect Google Analytics and accept "Synthex may create Analytics for me".',
      403
    );
  }
  if (res.status === 403) {
    return new Ga4AdminError(
      'PERMISSION_DENIED',
      `The connected Google account cannot edit this Analytics account or property (Google: ${message}).`,
      403
    );
  }
  if (res.status === 401) {
    return new Ga4AdminError(
      'UNAUTHENTICATED',
      'The Google Analytics token was rejected; reconnect Google Analytics.',
      401
    );
  }
  return new Ga4AdminError(
    'UPSTREAM_ERROR',
    `GA4 Admin API error ${res.status}: ${message}`,
    res.status
  );
}

async function call<T>(
  deps: Ga4AdminDeps,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<T> {
  const doFetch = deps.fetch ?? globalThis.fetch;
  const res = await doFetch(`${ADMIN_BASE}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${deps.accessToken}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

/** GET every page of a list endpoint. */
async function listAll<T>(
  deps: Ga4AdminDeps,
  path: string,
  key: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ ...params, pageSize: '200' });
    if (pageToken) qs.set('pageToken', pageToken);
    const data = await call<Record<string, unknown>>(
      deps,
      'GET',
      `${path}?${qs.toString()}`
    );
    items.push(...((data[key] as T[] | undefined) ?? []));
    pageToken = data.nextPageToken as string | undefined;
    if (!pageToken) break;
  }
  return items;
}

function lastSegment(name: string | undefined): string {
  return (name ?? '').split('/').pop() ?? '';
}

function normaliseAccountId(accountId: string): string {
  return accountId.replace(/^accounts\//, '');
}

function normaliseUri(uri: string): string {
  const withScheme = /^https?:\/\//i.test(uri) ? uri : `https://${uri}`;
  try {
    const u = new URL(withScheme);
    return `${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return uri.trim().toLowerCase().replace(/\/+$/, '');
  }
}

interface AdminProperty {
  name?: string;
  displayName?: string;
}

export interface CreatePropertyInput {
  accountId: string;
  displayName: string;
  timeZone?: string;
  currencyCode?: string;
}

export interface CreatePropertyResult {
  propertyId: string;
  displayName: string;
  created: boolean;
}

/**
 * Creates a NEW property, never adopts one. A display name proves nothing
 * about who a property belongs to or how it is configured (time zone,
 * currency), so an existing property with the same name in the account is
 * refused (PROPERTY_NAME_TAKEN), not reused. Lists then creates, so callers
 * must serialise per GA4 account (the provision route holds a
 * transaction-scoped advisory lock).
 */
export async function createProperty(
  deps: Ga4AdminDeps,
  input: CreatePropertyInput
): Promise<CreatePropertyResult> {
  const accountId = normaliseAccountId(input.accountId);
  const displayName = input.displayName.trim();

  const existing = await listAll<AdminProperty>(
    deps,
    'properties',
    'properties',
    {
      filter: `parent:accounts/${accountId}`,
    }
  );
  const match = existing.find(p => p.displayName?.trim() === displayName);
  if (match) {
    throw new Ga4AdminError(
      'PROPERTY_NAME_TAKEN',
      `A GA4 property called "${displayName}" already exists in this account. Synthex only sets up properties it creates, so choose a different name.`,
      409
    );
  }

  const created = await call<AdminProperty>(deps, 'POST', 'properties', {
    parent: `accounts/${accountId}`,
    displayName,
    timeZone: input.timeZone ?? 'Australia/Brisbane',
    currencyCode: input.currencyCode ?? 'AUD',
  });
  const propertyId = lastSegment(created.name);
  if (!propertyId) {
    throw new Ga4AdminError(
      'INVALID_RESPONSE',
      'GA4 Admin API returned a property without a name.',
      502
    );
  }
  return {
    propertyId,
    displayName: created.displayName ?? displayName,
    created: true,
  };
}

interface AdminDataStream {
  name?: string;
  type?: string;
  webStreamData?: { defaultUri?: string; measurementId?: string };
}

export interface CreateWebDataStreamInput {
  propertyId: string;
  defaultUri: string;
  displayName?: string;
}

export interface CreateWebDataStreamResult {
  streamId: string;
  measurementId: string;
  defaultUri: string;
  created: boolean;
}

function toStreamResult(
  stream: AdminDataStream,
  created: boolean
): CreateWebDataStreamResult {
  const measurementId = stream.webStreamData?.measurementId;
  if (!measurementId) {
    throw new Ga4AdminError(
      'INVALID_RESPONSE',
      'GA4 Admin API returned a web data stream without a measurement ID.',
      502
    );
  }
  return {
    streamId: lastSegment(stream.name),
    measurementId,
    defaultUri: stream.webStreamData?.defaultUri ?? '',
    created,
  };
}

export async function createWebDataStream(
  deps: Ga4AdminDeps,
  input: CreateWebDataStreamInput
): Promise<CreateWebDataStreamResult> {
  const path = `properties/${input.propertyId}/dataStreams`;
  const wanted = normaliseUri(input.defaultUri);

  const existing = await listAll<AdminDataStream>(deps, path, 'dataStreams');
  const match = existing.find(
    s =>
      s.type === 'WEB_DATA_STREAM' &&
      s.webStreamData?.defaultUri &&
      normaliseUri(s.webStreamData.defaultUri) === wanted
  );
  if (match) return toStreamResult(match, false);
  // The client consented to ONE web data stream for their website. A property
  // that already has a web stream for a different site does not get a second.
  if (existing.some(s => s.type === 'WEB_DATA_STREAM')) {
    throw new Ga4AdminError(
      'STREAM_EXISTS',
      'This GA4 property already has a web data stream for a different website, and the consent covers one stream. Use that website, or remove the other stream first.',
      409
    );
  }

  const created = await call<AdminDataStream>(deps, 'POST', path, {
    type: 'WEB_DATA_STREAM',
    displayName: input.displayName ?? wanted,
    webStreamData: { defaultUri: input.defaultUri },
  });
  return toStreamResult(created, true);
}

interface AdminKeyEvent {
  name?: string;
  eventName?: string;
}

export interface CreateKeyEventsInput {
  propertyId: string;
  eventNames: string[];
}

export interface CreateKeyEventsResult {
  created: string[];
  existing: string[];
}

export async function createKeyEvents(
  deps: Ga4AdminDeps,
  input: CreateKeyEventsInput
): Promise<CreateKeyEventsResult> {
  const path = `properties/${input.propertyId}/keyEvents`;
  const present = new Set(
    (await listAll<AdminKeyEvent>(deps, path, 'keyEvents')).map(
      k => k.eventName
    )
  );

  const result: CreateKeyEventsResult = { created: [], existing: [] };
  for (const eventName of [...new Set(input.eventNames)]) {
    if (present.has(eventName)) {
      result.existing.push(eventName);
      continue;
    }
    const created = await call<AdminKeyEvent>(deps, 'POST', path, {
      eventName,
      countingMethod: 'ONCE_PER_EVENT',
    });
    if (created.eventName !== eventName) {
      throw new Ga4AdminError(
        'INVALID_RESPONSE',
        `GA4 Admin API did not confirm key event "${eventName}".`,
        502
      );
    }
    result.created.push(eventName);
  }
  return result;
}
