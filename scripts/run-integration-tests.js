#!/usr/bin/env node

/**
 * Integration Test Runner
 *
 * @task UNI-422 - Implement Integration Test Automation
 *
 * Runs integration tests with proper setup and teardown.
 *
 * Usage:
 *   node scripts/run-integration-tests.js [options]
 *
 * Options:
 *   --api-url=<url>     API URL to test against (default: http://localhost:3000)
 *   --file=<pattern>    Run specific test files matching pattern
 *   --verbose           Show detailed output
 *   --ci                CI mode (no interactive prompts, stricter timeouts)
 *   --parallel          Run tests in parallel
 *   --coverage          Generate coverage report
 *   --bail              Stop on first failure
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Parse arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

// Configuration
const config = {
  apiUrl: getArg('api-url') || process.env.API_URL || 'http://localhost:3000',
  filePattern: getArg('file') || 'tests/integration/**/*.test.{ts,js}',
  verbose: hasFlag('verbose'),
  ci: hasFlag('ci'),
  parallel: hasFlag('parallel'),
  coverage: hasFlag('coverage'),
  bail: hasFlag('bail'),
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`${colors.blue}[${step}]${colors.reset} ${message}`);
}

/**
 * Check if API is available
 */
async function checkApiHealth() {
  logStep('Health', `Checking API at ${config.apiUrl}...`);

  try {
    const response = await fetch(`${config.apiUrl}/api/health/live`, {
      method: 'GET',
      timeout: 5000,
    });

    if (response.ok) {
      log('  ✓ API is healthy', 'green');
      return true;
    } else {
      log(`  ✗ API returned status ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`  ✗ API not reachable: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Wait for API to become available
 */
async function waitForApi(maxWait = 60000) {
  logStep('Wait', 'Waiting for API to become available...');

  const startTime = Date.now();
  const checkInterval = 2000;

  while (Date.now() - startTime < maxWait) {
    const healthy = await checkApiHealth();
    if (healthy) return true;

    log(`  Retrying in ${checkInterval / 1000}s...`, 'gray');
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  log('  ✗ API did not become available within timeout', 'red');
  return false;
}

/**
 * Run Jest with integration tests
 */
function runTests() {
  logStep('Test', 'Running integration tests...');

  const jestArgs = [
    '--testMatch', `**/${config.filePattern}`,
    '--runInBand', // Run tests serially for integration tests
    '--detectOpenHandles',
    '--forceExit',
    '--testTimeout=30000',
  ];

  if (config.verbose) {
    jestArgs.push('--verbose');
  }

  if (config.coverage) {
    jestArgs.push('--coverage');
    jestArgs.push('--coverageDirectory=coverage/integration');
  }

  if (config.bail) {
    jestArgs.push('--bail');
  }

  if (config.ci) {
    jestArgs.push('--ci');
    jestArgs.push('--reporters=default');
    jestArgs.push('--reporters=jest-junit');
  }

  // Set environment variables
  const env = {
    ...process.env,
    RUN_INTEGRATION_TESTS: 'true',
    API_URL: config.apiUrl,
    NODE_ENV: 'test',
  };

  return new Promise((resolve, reject) => {
    const jest = spawn('npx', ['jest', ...jestArgs], {
      env,
      stdio: 'inherit',
      shell: true,
    });

    jest.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Jest exited with code ${code}`));
      }
    });

    jest.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Generate test report
 */
function generateReport() {
  logStep('Report', 'Generating test report...');

  const reportDir = 'test-reports/integration';

  try {
    execSync(`mkdir -p ${reportDir}`, { stdio: 'pipe' });

    // Copy jest results if available
    try {
      execSync(`cp junit.xml ${reportDir}/junit.xml 2>/dev/null || true`, { stdio: 'pipe' });
    } catch {
      // Ignore if junit.xml doesn't exist
    }

    // Generate HTML report if coverage exists
    if (config.coverage) {
      log('  Coverage report: coverage/integration/lcov-report/index.html', 'green');
    }

    log('  Test reports saved to: ' + reportDir, 'green');
  } catch (error) {
    log(`  Warning: Could not generate report: ${error.message}`, 'yellow');
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  log('SYNTHEX Integration Test Runner', 'blue');
  console.log('='.repeat(60));
  console.log(`API URL: ${config.apiUrl}`);
  console.log(`CI Mode: ${config.ci}`);
  console.log(`Coverage: ${config.coverage}`);
  console.log('');

  try {
    // Check API health or wait for it
    const apiReady = await waitForApi(config.ci ? 120000 : 60000);

    if (!apiReady) {
      log('\n✗ API is not available. Cannot run integration tests.', 'red');
      log('  Make sure the development server is running:', 'gray');
      log('  npm run dev', 'gray');
      process.exit(1);
    }

    // Run tests
    console.log('');
    await runTests();

    // Generate report
    if (config.ci || config.coverage) {
      console.log('');
      generateReport();
    }

    console.log('\n' + '='.repeat(60));
    log('✓ Integration tests completed successfully!', 'green');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    log(`✗ Integration tests failed: ${error.message}`, 'red');
    console.log('='.repeat(60) + '\n');
    process.exit(1);
  }
}

// Run
main();
