/**
 * K2 — GA4 Admin API client (lib/google/ga4-admin.ts).
 *
 * SEAM: the exported createProperty / createWebDataStream / createKeyEvents
 * functions, with `fetch` injected at the network boundary (a fake GA4 Admin
 * API held in memory). Nothing reaches Google.
 * CATCHES: duplicate creation when a property / stream / key event already
 * exists; a 403 (missing analytics.edit) treated as success; a stream with no
 * measurement ID reported as done; wrong request bodies (time zone, currency,
 * counting method).
 * MISSES: Google's real behaviour and quota; the OAuth grant itself (covered by
 * ga4-admin-consent tests and the provision route test).
 */

import {
  createProperty,
  createWebDataStream,
  createKeyEvents,
  Ga4AdminError,
  type Ga4AdminDeps,
} from '@/lib/google/ga4-admin';

interface Call {
  method: string;
  url: string;
  body: Record<string, unknown> | null;
}

interface FakeState {
  properties: Array<{
    name: string;
    displayName: string;
    parent: string;
    timeZone?: string;
    currencyCode?: string;
  }>;
  streams: Record<
    string,
    Array<{
      name: string;
      type: string;
      displayName: string;
      webStreamData?: { defaultUri?: string; measurementId?: string };
    }>
  >;
  keyEvents: Record<string, Array<{ name: string; eventName: string }>>;
}

function json(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const SCOPE_403 = {
  error: {
    code: 403,
    message: 'Request had insufficient authentication scopes.',
    status: 'PERMISSION_DENIED',
    details: [
      {
        '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
        reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
        domain: 'googleapis.com',
      },
    ],
  },
};

/** In-memory GA4 Admin API. Records every call; POSTs mutate state. */
function fakeAdminApi(state: FakeState, opts: { forbidWrites?: boolean } = {}) {
  const calls: Call[] = [];
  let seq = 1000;
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url, body });
    const u = new URL(url);
    const path = u.pathname.replace(/^\/v1beta\//, '');

    if (method !== 'GET' && opts.forbidWrites) return json(403, SCOPE_403);

    if (path === 'properties' && method === 'GET') {
      const parent = (u.searchParams.get('filter') ?? '').replace(
        /^parent:/,
        ''
      );
      return json(200, {
        properties: state.properties.filter(p => p.parent === parent),
      });
    }
    if (path === 'properties' && method === 'POST') {
      const created = { name: `properties/${++seq}`, ...body };
      state.properties.push(created);
      return json(200, created);
    }
    const streamMatch = path.match(/^properties\/(\d+)\/dataStreams$/);
    if (streamMatch) {
      const list = (state.streams[streamMatch[1]] ??= []);
      if (method === 'GET') return json(200, { dataStreams: list });
      const created = {
        name: `properties/${streamMatch[1]}/dataStreams/${++seq}`,
        ...body,
        webStreamData: {
          ...(body?.webStreamData ?? {}),
          measurementId: `G-NEW${seq}`,
        },
      };
      list.push(created);
      return json(200, created);
    }
    const keMatch = path.match(/^properties\/(\d+)\/keyEvents$/);
    if (keMatch) {
      const list = (state.keyEvents[keMatch[1]] ??= []);
      if (method === 'GET') return json(200, { keyEvents: list });
      const created = {
        name: `properties/${keMatch[1]}/keyEvents/${++seq}`,
        ...body,
      };
      list.push(created);
      return json(200, created);
    }
    return json(404, { error: { code: 404, message: 'not found' } });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

function emptyState(): FakeState {
  return { properties: [], streams: {}, keyEvents: {} };
}

function deps(fetchImpl: typeof fetch): Ga4AdminDeps {
  return { accessToken: 'test-token', fetch: fetchImpl };
}

const posts = (calls: Call[]) => calls.filter(c => c.method === 'POST');

describe('createProperty', () => {
  it('creates a property under the account with Brisbane time and AUD by default', async () => {
    const api = fakeAdminApi(emptyState());
    const result = await createProperty(deps(api.fetchImpl), {
      accountId: '123',
      displayName: 'CARSI',
    });
    expect(result.created).toBe(true);
    expect(result.propertyId).toBe('1001');
    const [post] = posts(api.calls);
    expect(post.url).toBe(
      'https://analyticsadmin.googleapis.com/v1beta/properties'
    );
    expect(post.body).toMatchObject({
      parent: 'accounts/123',
      displayName: 'CARSI',
      timeZone: 'Australia/Brisbane',
      currencyCode: 'AUD',
    });
  });

  it('refuses (PROPERTY_NAME_TAKEN) a same-name property: never adopts it and never creates a duplicate', async () => {
    expect(await createsNoDuplicate(createProperty)).toBe(true);
  });

  it('throws NEEDS_EDIT_CONSENT on a 403 missing-scope response, never a success', async () => {
    const api = fakeAdminApi(emptyState(), { forbidWrites: true });
    const err = await createProperty(deps(api.fetchImpl), {
      accountId: '123',
      displayName: 'CARSI',
    }).catch(e => e);
    expect(err).toBeInstanceOf(Ga4AdminError);
    expect(err.code).toBe('NEEDS_EDIT_CONSENT');
    expect(err.message).toMatch(/needs Analytics edit consent/);
    expect(await reports403Honestly(createProperty)).toBe(true);
  });

  it('(control: planted failure is caught) a create-always mutant fails the no-duplicate check', async () => {
    const createAlways: typeof createProperty = async (d, input) => {
      const res = await d.fetch!(
        'https://analyticsadmin.googleapis.com/v1beta/properties',
        {
          method: 'POST',
          body: JSON.stringify({
            parent: `accounts/${input.accountId}`,
            displayName: input.displayName,
          }),
        }
      );
      const body = (await res.json()) as { name: string };
      return {
        propertyId: body.name.split('/')[1],
        displayName: input.displayName,
        created: true,
      };
    };
    expect(await createsNoDuplicate(createAlways)).toBe(false);
  });

  it('(control: planted failure is caught) a mutant that treats 403 as success fails the honesty check', async () => {
    const swallow403: typeof createProperty = async (d, input) => {
      await d.fetch!(
        'https://analyticsadmin.googleapis.com/v1beta/properties',
        {
          method: 'POST',
          body: JSON.stringify({ displayName: input.displayName }),
        }
      );
      return { propertyId: '', displayName: input.displayName, created: true };
    };
    expect(await reports403Honestly(swallow403)).toBe(false);
  });
});

/**
 * True when createFn, finding a same-name property, neither adopts it nor
 * creates a duplicate: it refuses with PROPERTY_NAME_TAKEN and makes no POST.
 */
async function createsNoDuplicate(createFn: typeof createProperty) {
  const state = emptyState();
  state.properties.push({
    name: 'properties/555',
    displayName: 'CARSI',
    parent: 'accounts/123',
  });
  const api = fakeAdminApi(state);
  const outcome = await createFn(deps(api.fetchImpl), {
    accountId: '123',
    displayName: 'CARSI',
  }).catch(e => e);
  return (
    posts(api.calls).length === 0 &&
    state.properties.filter(p => p.displayName === 'CARSI').length === 1 &&
    outcome instanceof Ga4AdminError &&
    outcome.code === 'PROPERTY_NAME_TAKEN'
  );
}

/** True when createFn rejects a 403 missing-scope with NEEDS_EDIT_CONSENT. */
async function reports403Honestly(createFn: typeof createProperty) {
  const api = fakeAdminApi(emptyState(), { forbidWrites: true });
  try {
    await createFn(deps(api.fetchImpl), {
      accountId: '123',
      displayName: 'CARSI',
    });
    return false;
  } catch (e) {
    return e instanceof Ga4AdminError && e.code === 'NEEDS_EDIT_CONSENT';
  }
}

describe('createWebDataStream', () => {
  it('creates a web stream and returns its measurement ID', async () => {
    const api = fakeAdminApi(emptyState());
    const result = await createWebDataStream(deps(api.fetchImpl), {
      propertyId: '555',
      defaultUri: 'https://carsi.com.au',
      displayName: 'carsi.com.au',
    });
    expect(result.created).toBe(true);
    expect(result.measurementId).toMatch(/^G-NEW\d+$/);
    expect(posts(api.calls)[0].body).toMatchObject({
      type: 'WEB_DATA_STREAM',
      displayName: 'carsi.com.au',
      webStreamData: { defaultUri: 'https://carsi.com.au' },
    });
  });

  it('reuses an existing stream for the same site (trailing slash and case ignored)', async () => {
    const state = emptyState();
    state.streams['555'] = [
      {
        name: 'properties/555/dataStreams/9',
        type: 'WEB_DATA_STREAM',
        displayName: 'carsi',
        webStreamData: {
          defaultUri: 'https://CARSI.com.au/',
          measurementId: 'G-EXIST01',
        },
      },
    ];
    const api = fakeAdminApi(state);
    const result = await createWebDataStream(deps(api.fetchImpl), {
      propertyId: '555',
      defaultUri: 'https://carsi.com.au',
    });
    expect(result).toEqual({
      streamId: '9',
      measurementId: 'G-EXIST01',
      defaultUri: 'https://CARSI.com.au/',
      created: false,
    });
    expect(posts(api.calls)).toHaveLength(0);
  });

  it('refuses a second web stream for a different site (one stream is consented)', async () => {
    const state = emptyState();
    state.streams['555'] = [
      {
        name: 'properties/555/dataStreams/9',
        type: 'WEB_DATA_STREAM',
        displayName: 'carsi',
        webStreamData: {
          defaultUri: 'https://carsi.com.au',
          measurementId: 'G-EXIST01',
        },
      },
    ];
    const api = fakeAdminApi(state);
    const err = await createWebDataStream(deps(api.fetchImpl), {
      propertyId: '555',
      defaultUri: 'https://another-client.example',
    }).catch(e => e);
    expect(err).toBeInstanceOf(Ga4AdminError);
    expect(err.code).toBe('STREAM_EXISTS');
    expect(posts(api.calls)).toHaveLength(0);
  });

  it('throws when Google returns a stream without a measurement ID', async () => {
    const fetchImpl = (async (_u: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'GET'
        ? json(200, { dataStreams: [] })
        : json(200, {
            name: 'properties/555/dataStreams/1',
            type: 'WEB_DATA_STREAM',
          })) as unknown as typeof fetch;
    const err = await createWebDataStream(deps(fetchImpl), {
      propertyId: '555',
      defaultUri: 'https://carsi.com.au',
    }).catch(e => e);
    expect(err).toBeInstanceOf(Ga4AdminError);
    expect(err.code).toBe('INVALID_RESPONSE');
  });
});

describe('createKeyEvents', () => {
  it('creates only the missing key events, counted once per event', async () => {
    const state = emptyState();
    state.keyEvents['555'] = [
      { name: 'properties/555/keyEvents/1', eventName: 'generate_lead' },
    ];
    const api = fakeAdminApi(state);
    const result = await createKeyEvents(deps(api.fetchImpl), {
      propertyId: '555',
      eventNames: ['generate_lead', 'sign_up'],
    });
    expect(result).toEqual({
      created: ['sign_up'],
      existing: ['generate_lead'],
    });
    const p = posts(api.calls);
    expect(p).toHaveLength(1);
    expect(p[0].body).toEqual({
      eventName: 'sign_up',
      countingMethod: 'ONCE_PER_EVENT',
    });
  });

  it('a second run creates nothing', async () => {
    const api = fakeAdminApi(emptyState());
    await createKeyEvents(deps(api.fetchImpl), {
      propertyId: '555',
      eventNames: ['generate_lead', 'sign_up'],
    });
    const before = posts(api.calls).length;
    const second = await createKeyEvents(deps(api.fetchImpl), {
      propertyId: '555',
      eventNames: ['generate_lead', 'sign_up'],
    });
    expect(second.created).toEqual([]);
    expect(posts(api.calls).length).toBe(before);
  });

  it('throws PERMISSION_DENIED (not NEEDS_EDIT_CONSENT) for a 403 without the scope reason', async () => {
    const fetchImpl = (async () =>
      json(403, {
        error: {
          code: 403,
          message:
            'User does not have sufficient permissions for this property.',
          status: 'PERMISSION_DENIED',
        },
      })) as unknown as typeof fetch;
    const err = await createKeyEvents(deps(fetchImpl), {
      propertyId: '555',
      eventNames: ['sign_up'],
    }).catch(e => e);
    expect(err).toBeInstanceOf(Ga4AdminError);
    expect(err.code).toBe('PERMISSION_DENIED');
  });
});
