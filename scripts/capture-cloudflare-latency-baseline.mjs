#!/usr/bin/env node
/**
 * Capture Cloudflare Workers latency baseline
 * Goal: Record current latency profile, identify gaps vs <200ms target
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const TARGET_URL = process.env.TARGET_URL || 'https://synthex.social';
const TARGET_PATHS = [
  '/',
  '/api/analytics',
  '/api/health',
  '/api/cron/task-lifecycle',
];

// Metrics structure
const metrics = {
  metadata: {
    capturedAt: new Date().toISOString(),
    targetUrl: TARGET_URL,
    capturedFrom: process.env.NODE_ENV || 'local',
    gitBranch: process.env.BRANCH_NAME || 'unknown',
  },
  results: {
    homepage: null,
    analytics: null,
    health: null,
    taskLifecycle: null,
  },
  analysis: {
    overallP95: null,
    overallAvg: null,
    targetCompliance: null,
    outliers: [],
    recommendations: [],
  },
};

// Helper to make HTTP(S) request
function makeRequest(url, path) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(path, url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'Synthex Cloudflare Latency Baseline Capture',
        Accept: '*/*',
      },
    };

    const startTime = Date.now();
    const req = client.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          status: res.statusCode,
          duration: duration,
          timing: res.headers['server-timing'] || null,
          timestamp: new Date().toISOString(),
        });
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after 5000ms`));
    });

    req.setTimeout(5000);
    req.end();
  });
}

// Parallel request function
async function captureMetrics() {
  console.log(`📸 Capturing latency baseline for: ${TARGET_URL}\n`);

  // Capture metrics for each path
  const promises = TARGET_PATHS.map(async path => {
    try {
      console.log(`  ↳ Testing ${path}...`);
      const result = await makeRequest(TARGET_URL, path);
      console.log(`     → ${result.status} (${result.duration}ms)`);
      return { path, ...result };
    } catch (error) {
      console.log(`     → ERROR: ${error.message}`);
      return { path, error: error.message, duration: -1, status: 0 };
    }
  });

  const results = await Promise.all(promises);

  // Extract duration-only results
  metrics.results.homepage = results.find(r => r.path === '/')?.duration || 0;
  metrics.results.analytics =
    results.find(r => r.path === '/api/analytics')?.duration || 0;
  metrics.results.health =
    results.find(r => r.path === '/api/health')?.duration || 0;
  metrics.results.taskLifecycle =
    results.find(r => r.path === '/api/cron/task-lifecycle')?.duration || 0;

  // Calculate analysis
  const durations = Object.values(metrics.results).filter(d => d > 0);
  metrics.analysis.overallP95 = calculateP95(durations);
  metrics.analysis.overallAvg =
    durations.reduce((a, b) => a + b, 0) / durations.length;
  metrics.analysis.targetCompliance = durations.every(d => d < 200);

  // Identify outliers (>300ms)
  metrics.analysis.outliers = durations.filter(d => d > 300);

  // Generate recommendations
  if (metrics.analysis.overallAvg > 200) {
    metrics.analysis.recommendations.push(
      'Average latency exceeds 200ms target — investigate caching, database query optimization, or frontend bundle size.'
    );
  }
  if (metrics.analysis.outliers.length > 0) {
    metrics.analysis.recommendations.push(
      `Found ${metrics.analysis.outliers.length} outlier requests (>300ms) — identify and optimise the slow endpoints.`
    );
  }
  if (metrics.analysis.overallP95 > 250) {
    metrics.analysis.recommendations.push(
      'P95 latency exceeds 250ms — this indicates 5% of users experience degradation. Review optimization opportunities.'
    );
  }
  if (!metrics.analysis.targetCompliance) {
    metrics.analysis.recommendations.push(
      'Multiple endpoints exceed 200ms target — create optimization backlog with clear priorities.'
    );
  }

  return metrics;
}

// P95 calculation
function calculateP95(durations) {
  if (durations.length === 0) return 0;
  const sorted = [...durations].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[index];
}

// Save results
function saveResults(metrics) {
  const workspace = process.env.HERMES_KANBAN_WORKSPACE || process.cwd();
  const outputPath = path.join(
    workspace,
    'cloudflare-workers-latency-baseline.json'
  );

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2));
  console.log(`\n✅ Baseline captured and saved to: ${outputPath}\n`);
}

// Print summary
function printSummary(metrics) {
  console.log('========================================');
  console.log('LATENCY BASELINE SUMMARY');
  console.log('========================================\n');

  console.log('Target URL:', metrics.metadata.targetUrl);
  console.log('Captured:', metrics.metadata.capturedAt);
  console.log('');

  console.log('Individual Endpoints:');
  console.log('  ↳ Homepage (/):', metrics.results.homepage, 'ms');
  console.log(
    '  ↳ Analytics (/api/analytics):',
    metrics.results.analytics,
    'ms'
  );
  console.log('  ↳ Health (/api/health):', metrics.results.health, 'ms');
  console.log(
    '  ↳ Task Lifecycle (/api/cron/task-lifecycle):',
    metrics.results.taskLifecycle,
    'ms'
  );
  console.log('');

  console.log('Aggregate Metrics:');
  console.log(
    '  ↳ Average Latency:',
    Math.round(metrics.analysis.overallAvg),
    'ms'
  );
  console.log(
    '  ↳ P95 Latency:',
    Math.round(metrics.analysis.overallP95),
    'ms'
  );
  console.log(
    '  ↳ Targets Compliant (<200ms):',
    metrics.analysis.targetCompliance ? '✓ YES' : '✗ NO'
  );
  console.log('  ↳ Outliers (>300ms):', metrics.analysis.outliers.length);
  console.log('');

  if (metrics.analysis.recommendations.length > 0) {
    console.log('Recommendations:');
    metrics.analysis.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
    console.log('');
  }
}

// Main execution
async function main() {
  try {
    const baseline = await captureMetrics();
    printSummary(baseline);
    saveResults(baseline);

    console.log('✨ Baseline capture complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to capture baseline:', error);
    process.exit(1);
  }
}

main();
