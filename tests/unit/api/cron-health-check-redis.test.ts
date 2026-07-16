const mockCheckDatabaseHealth = jest.fn();
const mockRedisHealthCheck = jest.fn();
const mockAlertError = jest.fn();
const mockAlertCritical = jest.fn();

jest.mock('@/lib/prisma', () => ({
  checkDatabaseHealth: (...args: unknown[]) => mockCheckDatabaseHealth(...args),
}));

jest.mock('@/lib/redis-unified', () => ({
  healthCheck: (...args: unknown[]) => mockRedisHealthCheck(...args),
}));

jest.mock('@/lib/alerts', () => ({
  AlertSeverity: {},
  alertManager: {
    error: (...args: unknown[]) => mockAlertError(...args),
    critical: (...args: unknown[]) => mockAlertCritical(...args),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('POST /api/cron/health-check Redis adapter compatibility', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    mockCheckDatabaseHealth.mockResolvedValue({ healthy: true, latency: 1 });
    mockRedisHealthCheck.mockResolvedValue({
      status: 'healthy',
      connection: 'memory-only',
      implementation: 'memory-only',
    });
    mockAlertError.mockResolvedValue(undefined);
    mockAlertCritical.mockResolvedValue(undefined);
    process.env.CRON_SECRET_HEALTH_CHECK = 'test-cron-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('does not send a Redis Unhealthy alert for legacy status=healthy adapters', async () => {
    const { POST } = await import('@/app/api/cron/health-check/route');
    const request = new Request('http://localhost/api/cron/health-check', {
      method: 'POST',
      headers: { authorization: 'Bearer test-cron-secret' },
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.redis).toBe('ok');
    expect(mockAlertError).not.toHaveBeenCalled();
  });

  it('includes the concrete implementation when Redis is actually unhealthy', async () => {
    mockRedisHealthCheck.mockResolvedValue({
      healthy: false,
      status: 'unhealthy',
      connection: 'redis-cloud',
    });

    const { POST } = await import('@/app/api/cron/health-check/route');
    const request = new Request('http://localhost/api/cron/health-check', {
      method: 'POST',
      headers: { authorization: 'Bearer test-cron-secret' },
    });

    const response = await POST(request as never);

    expect(response.status).toBe(207);
    expect(mockAlertError).toHaveBeenCalledWith(
      'Redis Unhealthy',
      'Redis health check failed. Implementation: redis-cloud',
      'cron/health-check'
    );
  });
});
