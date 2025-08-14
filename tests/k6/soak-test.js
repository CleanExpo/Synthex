/**
 * k6 Soak Test for SYNTHEX
 * Tests system stability under sustained load
 * Helps identify memory leaks, connection pool issues
 * 
 * Usage: k6 run tests/k6/soak-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '2h', target: 50 },   // Stay at 50 users for 2 hours
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
    errors: ['rate<0.02'],              // Custom error rate under 2%
  }
};

const BASE_URL = __ENV.BASE_URL || 'https://synthex.social';

export default function() {
  // Simulate realistic user behavior
  const workflows = [
    browseHomepage,
    checkDashboard,
    viewCampaigns,
    generateContent,
    updateSettings
  ];
  
  // Randomly select a workflow
  const workflow = workflows[Math.floor(Math.random() * workflows.length)];
  workflow();
  
  // Random think time between actions
  sleep(Math.random() * 10 + 5); // 5-15 seconds
}

function browseHomepage() {
  const res = http.get(`${BASE_URL}/`);
  check(res, {
    'homepage ok': (r) => r.status === 200,
  });
  errorRate.add(res.status !== 200);
}

function checkDashboard() {
  const res = http.get(`${BASE_URL}/api/dashboard/stats`);
  check(res, {
    'dashboard ok': (r) => r.status === 200 || r.status === 401,
  });
  errorRate.add(res.status >= 500);
}

function viewCampaigns() {
  const res = http.get(`${BASE_URL}/api/campaigns`);
  check(res, {
    'campaigns ok': (r) => r.status === 200 || r.status === 401,
  });
  errorRate.add(res.status >= 500);
}

function generateContent() {
  const payload = {
    prompt: `Test content ${Date.now()}`,
    platform: 'twitter'
  };
  
  const res = http.post(
    `${BASE_URL}/api/ai/generate-content`,
    JSON.stringify(payload),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(res, {
    'generation ok': (r) => r.status === 200 || r.status === 401,
  });
  errorRate.add(res.status >= 500);
}

function updateSettings() {
  const res = http.get(`${BASE_URL}/api/user/settings`);
  check(res, {
    'settings ok': (r) => r.status === 200 || r.status === 401,
  });
  errorRate.add(res.status >= 500);
}