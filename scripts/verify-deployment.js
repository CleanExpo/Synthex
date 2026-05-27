#!/usr/bin/env node

/**
 * Public production smoke verification for Synthex.
 *
 * This script intentionally checks only public, non-mutating routes. It proves
 * that the deployed site is reachable, health probes respond, security headers
 * are present, and protected APIs reject unauthenticated requests.
 *
 * It does not verify production secrets, Supabase RLS, Stripe webhooks, or
 * authenticated browser journeys. Those remain separate release gates.
 */

const DEFAULT_BASE_URL = 'https://synthex.social';
const baseUrl = (process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

const checks = [
  {
    name: 'homepage reachable',
    path: '/',
    method: 'GET',
    expectedStatuses: [200],
    validate: ({ headers }) => {
      const requiredHeaders = [
        'content-security-policy',
        'strict-transport-security',
        'x-frame-options',
        'x-content-type-options',
      ];
      const missing = requiredHeaders.filter((header) => !headers.has(header));
      return missing.length === 0
        ? { ok: true }
        : { ok: false, reason: `missing headers: ${missing.join(', ')}` };
    },
  },
  {
    name: 'liveness probe',
    path: '/api/health/live',
    method: 'HEAD',
    expectedStatuses: [200],
    validate: ({ headers }) =>
      headers.get('x-health-check') === 'liveness'
        ? { ok: true }
        : { ok: false, reason: 'missing x-health-check: liveness' },
  },
  {
    name: 'readiness probe',
    path: '/api/health/ready',
    method: 'HEAD',
    expectedStatuses: [200],
    validate: ({ headers }) =>
      headers.get('x-health-status') === 'ready'
        ? { ok: true }
        : { ok: false, reason: 'missing x-health-status: ready' },
  },
  {
    name: 'campaigns API requires auth',
    path: '/api/campaigns',
    method: 'GET',
    expectedStatuses: [401],
  },
  {
    name: 'notifications API requires auth',
    path: '/api/notifications',
    method: 'GET',
    expectedStatuses: [401],
  },
  {
    name: 'scheduler API requires auth',
    path: '/api/scheduler/posts',
    method: 'GET',
    expectedStatuses: [401],
  },
  {
    name: 'analytics API requires auth',
    path: '/api/analytics/dashboard',
    method: 'GET',
    expectedStatuses: [401],
  },
];

async function runCheck(check) {
  const url = `${baseUrl}${check.path}`;
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: check.method,
      redirect: 'manual',
      headers: {
        'user-agent': 'synthex-production-smoke/1.0',
      },
    });

    const durationMs = Date.now() - startedAt;
    const statusOk = check.expectedStatuses.includes(response.status);
    const validation = check.validate
      ? check.validate({ response, headers: response.headers })
      : { ok: true };

    return {
      ...check,
      url,
      status: response.status,
      durationMs,
      ok: statusOk && validation.ok,
      reason: !statusOk
        ? `expected ${check.expectedStatuses.join(' or ')}, got ${response.status}`
        : validation.reason,
      headers: {
        server: response.headers.get('server') || '',
        vercelId: response.headers.get('x-vercel-id') || '',
        matchedPath: response.headers.get('x-matched-path') || '',
        healthCheck: response.headers.get('x-health-check') || '',
        healthStatus: response.headers.get('x-health-status') || '',
      },
    };
  } catch (error) {
    return {
      ...check,
      url,
      status: 'ERROR',
      durationMs: Date.now() - startedAt,
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
      headers: {},
    };
  }
}

export async function verifyDeployment() {
  console.log(`Synthex public production smoke: ${baseUrl}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  const results = [];
  for (const check of checks) {
    const result = await runCheck(check);
    results.push(result);

    const marker = result.ok ? 'PASS' : 'FAIL';
    const details = result.reason ? ` - ${result.reason}` : '';
    console.log(
      `${marker} ${result.method} ${result.path} -> ${result.status} (${result.durationMs}ms)${details}`
    );

    const observedHeaders = Object.entries(result.headers)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
    if (observedHeaders) {
      console.log(`     headers: ${observedHeaders}`);
    }
  }

  const failed = results.filter((result) => !result.ok);
  console.log('');
  console.log(
    `Summary: ${results.length - failed.length}/${results.length} public smoke checks passed`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }

  return { baseUrl, results, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await verifyDeployment();
}
