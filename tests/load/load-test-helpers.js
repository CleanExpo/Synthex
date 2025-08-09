/**
 * Load Test Helper Functions for Artillery
 */

const crypto = require('crypto');
const faker = require('faker');

/**
 * Generate random string
 */
function randomString(length = 10) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Generate random number
 */
function randomNumber(min = 1, max = 1000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get random item from array
 */
function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Generate test user data
 */
function generateUser(context, events, done) {
  context.vars.testUser = {
    email: `test_${Date.now()}_${randomString(5)}@loadtest.com`,
    password: 'LoadTest123!@#',
    name: faker.name.fullName()
  };
  return done();
}

/**
 * Generate test post data
 */
function generatePost(context, events, done) {
  context.vars.testPost = {
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraphs(2),
    platforms: randomItem([
      ['twitter'],
      ['facebook'],
      ['instagram'],
      ['twitter', 'facebook'],
      ['facebook', 'instagram'],
      ['twitter', 'instagram', 'linkedin']
    ]),
    scheduledAt: new Date(Date.now() + randomNumber(1, 7) * 86400000).toISOString()
  };
  return done();
}

/**
 * Set authentication header
 */
function setAuthHeader(context, events, done) {
  if (context.vars.authToken) {
    context.vars.authHeader = `Bearer ${context.vars.authToken}`;
  }
  return done();
}

/**
 * Check response time
 */
function checkResponseTime(context, next) {
  const startTime = Date.now();
  
  return function(err, response) {
    const responseTime = Date.now() - startTime;
    
    if (responseTime > 1000) {
      console.warn(`Slow response: ${responseTime}ms for ${response.request.uri.path}`);
    }
    
    context.vars.lastResponseTime = responseTime;
    return next(err, response);
  };
}

/**
 * Log errors for debugging
 */
function logErrors(requestParams, response, context, ee, next) {
  if (response.statusCode >= 400) {
    console.error(`Error ${response.statusCode}: ${response.request.uri.path}`);
    if (response.body) {
      console.error('Response:', response.body);
    }
  }
  return next();
}

/**
 * Validate response structure
 */
function validateResponse(requestParams, response, context, ee, next) {
  try {
    const body = JSON.parse(response.body);
    
    // Check for standard API response structure
    if (!body.hasOwnProperty('success')) {
      console.error('Invalid response structure: missing success field');
    }
    
    // Store response data for use in subsequent requests
    if (body.success && body.data) {
      context.vars.lastResponseData = body.data;
    }
  } catch (e) {
    // Not JSON response
  }
  
  return next();
}

/**
 * Clean up test data after scenario
 */
function cleanup(context, events, done) {
  // If we created test data, mark it for cleanup
  if (context.vars.userId) {
    // In a real scenario, you might want to delete test data
    console.log(`Test user created: ${context.vars.userId}`);
  }
  
  return done();
}

/**
 * Custom metrics collector
 */
function collectMetrics(requestParams, response, context, ee, next) {
  // Collect custom metrics
  const endpoint = response.request.uri.path.split('?')[0];
  const method = response.request.method;
  const statusCode = response.statusCode;
  
  // Emit custom metrics
  ee.emit('counter', `endpoint.${method}.${endpoint}.${statusCode}`, 1);
  
  if (context.vars.lastResponseTime) {
    ee.emit('histogram', `response_time.${endpoint}`, context.vars.lastResponseTime);
  }
  
  return next();
}

/**
 * Simulate think time with variation
 */
function thinkTime(min = 1, max = 5) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate batch of test data
 */
function generateBatch(context, events, done) {
  const batchSize = context.vars.$loopCount || 10;
  const batch = [];
  
  for (let i = 0; i < batchSize; i++) {
    batch.push({
      title: faker.lorem.sentence(),
      content: faker.lorem.paragraph(),
      platforms: ['twitter', 'facebook']
    });
  }
  
  context.vars.batch = batch;
  return done();
}

/**
 * Rate limit handler
 */
function handleRateLimit(requestParams, response, context, ee, next) {
  if (response.statusCode === 429) {
    const retryAfter = response.headers['retry-after'] || 60;
    console.log(`Rate limited. Retry after ${retryAfter} seconds`);
    
    // Add delay before next request
    context.vars.delay = retryAfter * 1000;
  }
  
  return next();
}

/**
 * Connection pool monitor
 */
let connectionCount = 0;
const maxConnections = 100;

function connectionMonitor(requestParams, response, context, ee, next) {
  connectionCount++;
  
  if (connectionCount > maxConnections) {
    console.warn(`High connection count: ${connectionCount}`);
  }
  
  // Decrease on response
  setTimeout(() => {
    connectionCount--;
  }, 100);
  
  return next();
}

module.exports = {
  randomString,
  randomNumber,
  randomItem,
  generateUser,
  generatePost,
  setAuthHeader,
  checkResponseTime,
  logErrors,
  validateResponse,
  cleanup,
  collectMetrics,
  thinkTime,
  generateBatch,
  handleRateLimit,
  connectionMonitor
};