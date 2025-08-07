/**
 * Test Critical Application Flows
 * Run with: node test-critical-flows.js
 */

const axios = require('axios');
const colors = require('colors/safe');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1`;

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

// Helper function to run a test
async function runTest(name, testFn) {
    totalTests++;
    process.stdout.write(`Testing ${name}... `);
    
    try {
        await testFn();
        passedTests++;
        console.log(colors.green('✓ PASSED'));
        testResults.push({ name, status: 'PASSED', error: null });
        return true;
    } catch (error) {
        failedTests++;
        console.log(colors.red('✗ FAILED'));
        console.log(colors.red(`  Error: ${error.message}`));
        testResults.push({ name, status: 'FAILED', error: error.message });
        return false;
    }
}

// Test functions
async function testHealthEndpoint() {
    const response = await axios.get(`${BASE_URL}/health`);
    if (!response.data.success) throw new Error('Health check failed');
    if (!response.data.data.status) throw new Error('Missing status in health response');
}

async function testDatabaseHealth() {
    const response = await axios.get(`${BASE_URL}/health/db`);
    if (!response.data.success && response.status !== 503) {
        throw new Error('Database health endpoint not working');
    }
}

async function testAuthRegistration() {
    const testUser = {
        email: `test${Date.now()}@example.com`,
        password: 'TestPass123!',
        name: 'Test User'
    };
    
    const response = await axios.post(`${API_BASE}/auth/register`, testUser);
    if (!response.data.success) throw new Error('Registration failed');
    if (!response.data.data.token) throw new Error('No token returned');
    
    // Store for other tests
    global.testToken = response.data.data.token;
    global.testUser = response.data.data.user;
}

async function testAuthLogin() {
    if (!global.testUser) {
        // Create a user first
        await testAuthRegistration();
    }
    
    const response = await axios.post(`${API_BASE}/auth/login`, {
        email: global.testUser.email,
        password: 'TestPass123!'
    });
    
    if (!response.data.success) throw new Error('Login failed');
    if (!response.data.data.token) throw new Error('No token returned');
}

async function testNotificationCreation() {
    if (!global.testToken) {
        throw new Error('No auth token available');
    }
    
    const response = await axios.post(
        `${API_BASE}/notifications`,
        {
            title: 'Test Notification',
            message: 'This is a test notification',
            type: 'info'
        },
        {
            headers: { Authorization: `Bearer ${global.testToken}` }
        }
    );
    
    if (!response.data.success) throw new Error('Notification creation failed');
}

async function testAuditLogging() {
    // This should happen automatically, so we just check if we can retrieve logs
    const response = await axios.get(`${API_BASE}/audit/logs`);
    // May fail with auth, but endpoint should exist
    if (response.status === 404) throw new Error('Audit endpoint not found');
}

async function testCampaignCreation() {
    if (!global.testToken) {
        throw new Error('No auth token available');
    }
    
    const response = await axios.post(
        `${API_BASE}/campaigns`,
        {
            name: 'Test Campaign',
            platform: 'twitter',
            description: 'Test campaign description'
        },
        {
            headers: { Authorization: `Bearer ${global.testToken}` }
        }
    );
    
    if (!response.data.success) throw new Error('Campaign creation failed');
}

async function testDashboardAPI() {
    const response = await axios.get(`${API_BASE}/dashboard/data`);
    // Should return some data even without auth
    if (!response.data) throw new Error('Dashboard API not responding');
}

async function testGoogleAuthStatus() {
    const response = await axios.get(`${API_BASE}/auth/google/status`);
    if (!response.data.hasOwnProperty('configured')) {
        throw new Error('Google auth status endpoint not working');
    }
}

async function testOpenRouterStatus() {
    const response = await axios.get(`${BASE_URL}/api/openrouter/status`);
    if (!response.data.hasOwnProperty('configured')) {
        throw new Error('OpenRouter status endpoint not working');
    }
}

// Main test runner
async function runAllTests() {
    console.log(colors.cyan('\n========================================'));
    console.log(colors.cyan('  CRITICAL FLOWS TEST SUITE'));
    console.log(colors.cyan('========================================\n'));
    console.log(`Testing against: ${BASE_URL}\n`);
    
    // Infrastructure tests
    console.log(colors.yellow('\n📡 Infrastructure Tests:\n'));
    await runTest('Health Endpoint', testHealthEndpoint);
    await runTest('Database Health', testDatabaseHealth);
    
    // Authentication tests
    console.log(colors.yellow('\n🔐 Authentication Tests:\n'));
    await runTest('User Registration', testAuthRegistration);
    await runTest('User Login', testAuthLogin);
    await runTest('Google Auth Status', testGoogleAuthStatus);
    
    // Core Features tests
    console.log(colors.yellow('\n✨ Core Features Tests:\n'));
    await runTest('Notification Creation', testNotificationCreation);
    await runTest('Audit Logging', testAuditLogging);
    await runTest('Campaign Creation', testCampaignCreation);
    
    // API tests
    console.log(colors.yellow('\n🔌 API Integration Tests:\n'));
    await runTest('Dashboard API', testDashboardAPI);
    await runTest('OpenRouter Status', testOpenRouterStatus);
    
    // Print summary
    console.log(colors.cyan('\n========================================'));
    console.log(colors.cyan('  TEST RESULTS SUMMARY'));
    console.log(colors.cyan('========================================\n'));
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(colors.green(`Passed: ${passedTests}`));
    console.log(colors.red(`Failed: ${failedTests}`));
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);
    
    if (failedTests > 0) {
        console.log(colors.red('\nFailed Tests:'));
        testResults
            .filter(r => r.status === 'FAILED')
            .forEach(r => {
                console.log(colors.red(`  ✗ ${r.name}`));
                console.log(colors.gray(`    ${r.error}`));
            });
    }
    
    // Exit with appropriate code
    process.exit(failedTests > 0 ? 1 : 0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error(colors.red('\n\n❌ Unhandled error during testing:'));
    console.error(error);
    process.exit(1);
});

// Check if server is running
axios.get(BASE_URL)
    .then(() => {
        console.log(colors.green(`✓ Server is running at ${BASE_URL}`));
        runAllTests();
    })
    .catch(() => {
        console.error(colors.red(`✗ Cannot connect to server at ${BASE_URL}`));
        console.error(colors.yellow('Please ensure the server is running with: npm start'));
        process.exit(1);
    });