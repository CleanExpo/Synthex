/**
 * Rate limiters as pass-through (a boundary: the limiter's store is Redis or
 * process memory, and a 429 that "refuses" every sweep case would be a false
 * PASS). Every export of '@/lib/rate-limit' / '@/lib/middleware/api-rate-limit'
 * becomes `(req, handler) => handler()`.
 *
 * Use: jest.mock('@/lib/rate-limit', () => require('./lib/passthrough-limiter').limiterModule());
 */
type Handler = (...a: unknown[]) => unknown;
const pass = (_req: unknown, handler?: Handler) =>
  typeof handler === 'function' ? handler() : undefined;

export function limiterModule(): Record<string, unknown> {
  const limiters = new Proxy({}, { get: () => pass });
  return new Proxy(
    { __esModule: true },
    {
      get(target: Record<string, unknown>, prop: string) {
        if (prop in target) return target[prop];
        if (prop === 'then') return undefined;
        if (prop === 'rateLimiters' || prop === 'default') return limiters;
        return pass;
      },
    }
  );
}
