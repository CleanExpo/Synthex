// jest.setup.js — SYNTHEX test environment bootstrap
// CI/CD fix: inject required env vars before any module is loaded
// so Supabase client initialisation (and other env-dependent code) doesn't throw.

// ──────────────────────────────────────────────────────────
// Supabase
// ──────────────────────────────────────────────────────────
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';

// ──────────────────────────────────────────────────────────
// NextAuth
// ──────────────────────────────────────────────────────────
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? 'test-nextauth-secret-32-chars-min';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

// ──────────────────────────────────────────────────────────
// Redis / Upstash
// ──────────────────────────────────────────────────────────
process.env.UPSTASH_REDIS_REST_URL =
  process.env.UPSTASH_REDIS_REST_URL ?? 'http://localhost:8079';
process.env.UPSTASH_REDIS_REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? 'test-redis-token';

// ──────────────────────────────────────────────────────────
// OpenRouter / AI providers
// ──────────────────────────────────────────────────────────
process.env.OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY ?? 'test-openrouter-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'test-openai-key';
process.env.ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY ?? 'test-anthropic-key';
process.env.GOOGLE_AI_API_KEY =
  process.env.GOOGLE_AI_API_KEY ?? 'test-google-ai-key';

// ──────────────────────────────────────────────────────────
// Stripe
// ──────────────────────────────────────────────────────────
process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_placeholder';
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? 'pk_test_placeholder';

// ──────────────────────────────────────────────────────────
// App
// ──────────────────────────────────────────────────────────
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
process.env.CRON_SECRET = process.env.CRON_SECRET ?? 'test-cron-secret';

// ──────────────────────────────────────────────────────────
// Global mocks
// ──────────────────────────────────────────────────────────

// Mock next/navigation to avoid "invariant: headers was called outside a request scope" errors
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useParams: jest.fn(() => ({})),
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

// Mock next/headers (only available in server context)
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(),
    getAll: jest.fn(() => []),
  })),
  headers: jest.fn(() => new Headers()),
}));

// Suppress noisy console output during tests
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args[0]?.toString() ?? '';
  // Suppress known React test warnings that don't affect correctness
  if (
    message.includes('Warning: ReactDOM.render is no longer supported') ||
    message.includes('Warning: An update to') ||
    message.includes('act()')
  ) {
    return;
  }
  originalConsoleError(...args);
};
