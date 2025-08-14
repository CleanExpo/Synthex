/**
 * k6 Load Test Script for SYNTHEX
 * Tests critical user flows under load
 * 
 * Usage: k6 run tests/k6/load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const dashboardDuration = new Trend('dashboard_duration');
const contentGenerationDuration = new Trend('content_generation_duration');

// Test configuration
export const options = {
  scenarios: {
    // Smoke test - minimal load
    smoke: {
      executor: 'constant-vus',
      vus: 2,
      duration: '1m',
      tags: { test_type: 'smoke' }
    },
    
    // Load test - normal traffic
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },  // Ramp up
        { duration: '5m', target: 10 },  // Stay at 10 users
        { duration: '2m', target: 20 },  // Increase to 20
        { duration: '5m', target: 20 },  // Stay at 20
        { duration: '2m', target: 0 },   // Ramp down
      ],
      startTime: '2m', // Start after smoke test
      tags: { test_type: 'load' }
    },
    
    // Stress test - beyond normal capacity
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 },
      ],
      startTime: '18m', // Start after load test
      tags: { test_type: 'stress' }
    },
    
    // Spike test - sudden load increase
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 }, // Spike to 100 users
        { duration: '1m', target: 100 },  // Stay at 100
        { duration: '10s', target: 0 },   // Drop to 0
      ],
      startTime: '34m', // Start after stress test
      tags: { test_type: 'spike' }
    }
  },
  
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'], // 95% under 500ms, 99% under 2s
    http_req_failed: ['rate<0.05'], // Error rate under 5%
    errors: ['rate<0.1'], // Custom error rate under 10%
    login_duration: ['p(95)<1000'], // Login under 1s
    dashboard_duration: ['p(95)<2000'], // Dashboard under 2s
    content_generation_duration: ['p(95)<5000'], // AI generation under 5s
  }
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'https://synthex.social';
const TEST_USER = __ENV.TEST_USER || 'loadtest@synthex.social';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'LoadTest123!';

// Helper function to add trace headers
function addTraceHeaders(params = {}) {
  const traceId = randomString(32, '0123456789abcdef');
  const spanId = randomString(16, '0123456789abcdef');
  
  return {
    ...params,
    headers: {
      ...params.headers,
      'traceparent': `00-${traceId}-${spanId}-01`,
      'x-request-id': traceId,
      'user-agent': 'k6-load-test/1.0'
    }
  };
}

// Test scenario: Login Flow
export function loginFlow() {
  const startTime = Date.now();
  
  // 1. Visit homepage
  let res = http.get(`${BASE_URL}/`, addTraceHeaders());
  check(res, {
    'homepage loads': (r) => r.status === 200,
    'homepage fast': (r) => r.timings.duration < 1000,
  });
  errorRate.add(res.status !== 200);
  
  sleep(1);
  
  // 2. Login
  const loginPayload = {
    email: TEST_USER,
    password: TEST_PASSWORD
  };
  
  res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify(loginPayload),
    addTraceHeaders({
      headers: { 'Content-Type': 'application/json' }
    })
  );
  
  check(res, {
    'login successful': (r) => r.status === 200,
    'login returns token': (r) => r.json('token') !== undefined,
  });
  errorRate.add(res.status !== 200);
  loginDuration.add(Date.now() - startTime);
  
  return res.json('token');
}

// Test scenario: Dashboard Access
export function dashboardFlow(token) {
  const startTime = Date.now();
  
  const params = addTraceHeaders({
    headers: {
      'Authorization': `Bearer ${token}`,
    }
  });
  
  // Load dashboard
  let res = http.get(`${BASE_URL}/api/dashboard/stats`, params);
  check(res, {
    'dashboard loads': (r) => r.status === 200,
    'dashboard has data': (r) => r.json('data') !== undefined,
  });
  errorRate.add(res.status !== 200);
  
  // Load campaigns
  res = http.get(`${BASE_URL}/api/campaigns`, params);
  check(res, {
    'campaigns load': (r) => r.status === 200,
  });
  errorRate.add(res.status !== 200);
  
  dashboardDuration.add(Date.now() - startTime);
}

// Test scenario: Content Generation
export function contentGenerationFlow(token) {
  const startTime = Date.now();
  
  const params = addTraceHeaders({
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const payload = {
    prompt: 'Generate a marketing post about summer sale',
    platform: 'instagram',
    tone: 'professional'
  };
  
  const res = http.post(
    `${BASE_URL}/api/ai/generate-content`,
    JSON.stringify(payload),
    params
  );
  
  check(res, {
    'content generated': (r) => r.status === 200,
    'content not empty': (r) => r.json('content') && r.json('content').length > 0,
    'generation under 5s': (r) => r.timings.duration < 5000,
  });
  errorRate.add(res.status !== 200);
  contentGenerationDuration.add(Date.now() - startTime);
}

// Main test function
export default function() {
  // Login and get token
  const token = loginFlow();
  
  if (token) {
    sleep(2);
    
    // Access dashboard
    dashboardFlow(token);
    
    sleep(3);
    
    // Generate content
    contentGenerationFlow(token);
    
    sleep(5);
  }
}

// Setup function - runs once before tests
export function setup() {
  console.log('🚀 Starting load test against:', BASE_URL);
  
  // Verify target is accessible
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error(`Target ${BASE_URL} is not healthy`);
  }
  
  return { startTime: Date.now() };
}

// Teardown function - runs once after tests
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ Load test completed in ${duration}s`);
}