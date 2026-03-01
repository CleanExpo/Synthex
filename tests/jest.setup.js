const { TextDecoder, TextEncoder } = require('util');

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// Polyfill Web APIs for Next.js server components
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init = {}) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init.method || 'GET';
      this.headers = new Map(Object.entries(init.headers || {}));
      this.body = init.body;
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
      return Promise.resolve(typeof this.body === 'string' ? JSON.parse(this.body) : this.body);
    }
    text() {
      return Promise.resolve(String(this.body));
    }
    // Static method required by NextResponse.json()
    static json(data, init = {}) {
      const body = JSON.stringify(data);
      return new Response(body, {
        ...init,
        headers: { 'content-type': 'application/json', ...(init.headers || {}) },
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
