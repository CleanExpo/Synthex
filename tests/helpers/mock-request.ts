/**
 * Mock NextRequest helper for unit tests.
 *
 * Avoids `new NextRequest()` which fails in jest+jsdom due to the
 * polyfill Request class in jest.setup.js conflicting with the native
 * Request's read-only `url` getter that NextRequest inherits.
 *
 * Creates a plain object that satisfies the NextRequest interface
 * subset used by API route handlers:
 *   .url, .method, .headers.get(), .json(), .text(), .nextUrl.searchParams
 */

interface MockNextRequestOptions {
  method?: string;
  body?: object | string;
  headers?: Record<string, string>;
  url?: string;
}

/**
 * Creates a mock request object compatible with NextRequest for testing
 * API route handlers without triggering the polyfill conflict.
 */
export function createMockNextRequest({
  method = 'GET',
  body,
  headers = {},
  url = 'http://localhost:3000/api/test',
}: MockNextRequestOptions = {}) {
  const parsedUrl = new URL(url);

  // Build a Headers-like object
  const headersMap = new Map<string, string>();
  for (const [key, value] of Object.entries(headers)) {
    headersMap.set(key.toLowerCase(), value);
  }

  if (body && !headersMap.has('content-type')) {
    headersMap.set('content-type', 'application/json');
  }

  const bodyString = typeof body === 'string' ? body : body ? JSON.stringify(body) : undefined;

  const mockHeaders = {
    get: (name: string) => headersMap.get(name.toLowerCase()) ?? null,
    has: (name: string) => headersMap.has(name.toLowerCase()),
    set: (name: string, value: string) => headersMap.set(name.toLowerCase(), value),
    forEach: (cb: (value: string, key: string) => void) => headersMap.forEach(cb),
    entries: () => headersMap.entries(),
    keys: () => headersMap.keys(),
    values: () => headersMap.values(),
  };

  return {
    url,
    method,
    headers: mockHeaders,
    nextUrl: parsedUrl,
    json: async () => {
      if (!bodyString) return {};
      return JSON.parse(bodyString);
    },
    text: async () => bodyString ?? '',
    body: bodyString ?? null,
    // NextRequest compatibility fields
    ip: '127.0.0.1',
    geo: {},
    cookies: {
      get: () => undefined,
      getAll: () => [],
      has: () => false,
    },
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
