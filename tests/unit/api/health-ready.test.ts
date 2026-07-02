jest.mock('@/lib/prisma', () => ({
  prisma: {},
  checkDatabaseHealth: jest.fn(async () => ({ healthy: true })),
}));

jest.mock('@/lib/redis-unified', () => ({
  healthCheck: jest.fn(async () => ({
    status: 'healthy',
    connection: 'redis-cloud',
  })),
  getImplementationType: jest.fn(async () => 'redis-cloud-vercel'),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('GET /api/health/ready memory readiness', () => {
  const originalMemoryUsage = process.memoryUsage;
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.memoryUsage = originalMemoryUsage;
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('does not mark readiness degraded solely because local V8 heap ratio is high when no memory limit is reported', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/synthex';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    delete process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;

    process.memoryUsage = jest.fn(() => ({
      rss: 240 * 1024 * 1024,
      heapTotal: 100 * 1024 * 1024,
      heapUsed: 96 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    })) as unknown as typeof process.memoryUsage;

    const { GET } = await import('@/app/api/health/ready/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ready');
    expect(body.checks.memory.status).toBe('healthy');
    expect(body.checks.memory.message).toContain('no limit reported');
  });
});
