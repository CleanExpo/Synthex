/**
 * redis-client incrbyShared — reports whether the SHARED store took the write.
 *
 * The budget enforcer refuses enforced spend when an in-flight counter did
 * not land in the shared store, so this flag is load-bearing: `shared: true`
 * only when the Upstash call succeeded; false in memory mode and on the
 * Upstash-failure fallback. `total` is always a number.
 */

const mockIncrby = jest.fn();
jest.mock('@upstash/redis', () => ({
  // A plain class: the jest config resets mock implementations per test.
  Redis: class {
    incrby(...a: unknown[]) {
      return mockIncrby(...a);
    }
  },
}));

import { getRedisClient, resetRedisClient } from '@/lib/redis-client';

const ENV_KEYS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'DISABLE_REDIS',
] as const;
const saved = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));

afterEach(async () => {
  await resetRedisClient();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function upstashConfigured() {
  delete process.env.DISABLE_REDIS;
  process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.test.invalid';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-placeholder';
}

it('memory mode is not shared, and the total is a number', async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  await resetRedisClient();

  const first = await getRedisClient().incrbyShared('k', 5);
  const second = await getRedisClient().incrbyShared('k', 2);

  expect(first).toEqual({ total: 5, shared: false });
  expect(second).toEqual({ total: 7, shared: false });
});

it('an Upstash write that lands is shared', async () => {
  upstashConfigured();
  await resetRedisClient();
  mockIncrby.mockResolvedValue(42);

  await expect(getRedisClient().incrbyShared('k', 5)).resolves.toEqual({
    total: 42,
    shared: true,
  });
});

it('an Upstash failure falls back to memory and says so', async () => {
  upstashConfigured();
  await resetRedisClient();
  mockIncrby.mockRejectedValue(new Error('upstash unreachable'));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

  await expect(getRedisClient().incrbyShared('k', 5)).resolves.toEqual({
    total: 5,
    shared: false,
  });
  warn.mockRestore();
});
