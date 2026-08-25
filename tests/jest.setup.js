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

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || '';
      this.headers = new Map(Object.entries(init.headers || {}));
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
  };
}

if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}
