#!/usr/bin/env node
/**
 * Capture Cloudflare Workers latency baseline
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://synthex.social';

const metrics = {
  metadata: {
    capturedAt: new Date().toISOString(),
    targetUrl: TARGET_URL,
  },
  results: {
    homepage: null,
    analytics: null,
    health: null,
  },
  analysis: {},
};

function makeRequest(path) {
  return new Promise(resolve => {
    const startTime = Date.now();
    https
      .get(TARGET_URL + path, { timeout: 5000 }, res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          const duration = Date.now() - startTime;
          resolve({
            status: res.statusCode,
            duration,
            timestamp: new Date().toISOString(),
          });
        });
      })
      .on('error', () => {
        resolve({ error: true, duration: -1 });
      })
      .on('timeout', () => {
        resolve({ error: true, duration: -1, message: 'timeout' });
      })
      .setTimeout(5000);
  });
}

async function capture() {
  console.log('📸 Capturing Cloudflare Workers latency baseline...\n');

  const results = {
    '/': await makeRequest('/'),
    '/api/analytics': await makeRequest('/api/analytics'),
    '/api/health': await makeRequest('/api/health'),
  };

  metrics.results.homepage = results['/'];
  metrics.results.analytics = results['/api/analytics'];
  metrics.results.health = results['/api/health'];

  const durations = Object.values(metrics.results)
    .filter(r => !r.error && r.duration > 0)
    .map(r => r.duration);

  metrics.analysis = {
    overallAvg: Math.round(
      durations.reduce((a, b) => a + b, 0) / durations.length
    ),
    targetCompliant: durations.every(d => d < 200),
    outliers: durations.filter(d => d > 300),
  };

  console.log('========================================');
  console.log('CLOUDFLARE WORKERS LATENCY BASELINE');
  console.log('========================================\n');
  console.log('Target:', TARGET_URL);
  console.log('Captured:', metrics.metadata.capturedAt);
  console.log('');
  console.log('Endpoints:');
  console.log(
    '  ↳ Homepage (/):',
    metrics.results.homepage.status,
    '-',
    metrics.results.homepage.duration,
    'ms'
  );
  console.log(
    '  ↳ Analytics (/api/analytics):',
    metrics.results.analytics.status,
    '-',
    metrics.results.analytics.duration,
    'ms'
  );
  console.log(
    '  ↳ Health (/api/health):',
    metrics.results.health.status,
    '-',
    metrics.results.health.duration,
    'ms'
  );
  console.log('');
  console.log('Analysis:');
  console.log('  ↳ Average:', metrics.analysis.overallAvg, 'ms');
  console.log(
    '  ↳ Compliant (<200ms):',
    metrics.analysis.targetCompliant ? '✓ YES' : '✗ NO'
  );
  console.log('  ↳ Outliers (>300ms):', metrics.analysis.outliers.length);
  console.log('');

  const output = path.join(
    process.env.HERMES_KANBAN_WORKSPACE || '.worktrees/t_84d40025',
    'cloudflare-workers-latency-baseline.json'
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(metrics, null, 2));
  console.log('✅ Saved to:', output);
}

capture().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
