// Test environment variables — must be set before any module imports
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-at-least-32-chars-long!!';
process.env.OWNER_EMAILS = process.env.OWNER_EMAILS || 'test@synthex.social';

const { TextDecoder, TextEncoder } = require('util');

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// Polyfill Web APIs for Next.js server components
//
// Define own data properties rather than assigning them. A subclass may declare
// the same name as a getter on its prototype — NextRequest does exactly that for
// `url` — and a plain `this.url = …` in this constructor then walks the
// prototype chain, finds a getter with no setter, and throws
// "Cannot set property url of #<NextRequest> which has only a getter" before the
// subclass constructor can run at all.
//
// defineProperty writes an own property that shadows the accessor instead. For
// every case where the assignment already worked the result is byte-identical
// (assignment creates the same writable/enumerable/configurable data property),
// so this is strictly more permissive than what it replaces.
function definePolyfillProps(target, props) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}

if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init = {}) {
      definePolyfillProps(this, {
        url: typeof input === 'string' ? input : input.url,
        method: init.method || 'GET',
        headers: new Map(Object.entries(init.headers || {})),
        body: init.body,
      });
    }

    // Route handlers read the body with req.json(). Without these the call is
    // undefined and every handler reports its own "malformed JSON" error, which
    // reads like a route bug rather than a missing polyfill method. Mirrors the
    // Response polyfill below.
    json() {
      return Promise.resolve(
        typeof this.body === 'string' ? JSON.parse(this.body) : this.body
      );
    }

    text() {
      return Promise.resolve(this.body == null ? '' : String(this.body));
    }
  };
}

/**
 * NextResponse.cookies.set() calls headers.delete + headers.append
 * (edge-runtime ResponseCookies). A Map only has delete — missing append
 * turned SYN-1216's alreadyComplete JWT re-issue into a 500 in contract tests.
 */
function createTestHeaders(init) {
  const store = new Map();

  const api = {
    get(name) {
      return store.get(String(name).toLowerCase()) ?? null;
    },
    set(name, value) {
      store.set(String(name).toLowerCase(), String(value));
    },
    has(name) {
      return store.has(String(name).toLowerCase());
    },
    delete(name) {
      store.delete(String(name).toLowerCase());
    },
    append(name, value) {
      const key = String(name).toLowerCase();
      const existing = store.get(key);
      if (existing == null || existing === '') {
        store.set(key, String(value));
      } else {
        store.set(key, `${existing}, ${value}`);
      }
    },
    forEach(callback) {
      store.forEach((value, key) => callback(value, key));
    },
    entries() {
      return store.entries();
    },
    [Symbol.iterator]() {
      return store.entries();
    },
  };

  if (init) {
    if (typeof init.forEach === 'function') {
      init.forEach((value, key) => api.append(key, value));
    } else {
      Object.entries(init).forEach(([key, value]) => {
        if (value != null) api.append(key, String(value));
      });
    }
  }

  return api;
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || '';
      this.headers = createTestHeaders(init.headers);
    }
    json() {
      return Promise.resolve(
        typeof this.body === 'string' ? JSON.parse(this.body) : this.body
      );
    }
    text() {
      return Promise.resolve(String(this.body));
    }
    // Static method required by NextResponse.json()
    static json(data, init = {}) {
      const body = JSON.stringify(data);
      return new Response(body, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(init.headers || {}),
        },
      });
    }
  };
}

if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    constructor(init = {}) {
      this._headers = new Map();
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this._headers.set(key.toLowerCase(), value);
        });
      }
    }
    get(name) {
      return this._headers.get(name.toLowerCase()) || null;
    }
    set(name, value) {
      this._headers.set(name.toLowerCase(), value);
    }
    has(name) {
      return this._headers.has(name.toLowerCase());
    }
    delete(name) {
      this._headers.delete(name.toLowerCase());
    }
    append(name, value) {
      const key = name.toLowerCase();
      const existing = this._headers.get(key);
      if (existing == null || existing === '') {
        this._headers.set(key, String(value));
      } else {
        this._headers.set(key, `${existing}, ${value}`);
      }
    }
  };
}

if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}
