/**
 * Complete Environment Variables Validation
 * Checks all variables for correctness and functionality
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('redis');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Helper functions
const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.blue}${colors.bold}═══ ${msg} ═══${colors.reset}\n`),
  subsection: (msg) => console.log(`\n${colors.cyan}▶ ${msg}${colors.reset}`)
};

// Validation results
const results = {
  core: { passed: 0, failed: 0, warnings: 0 },
  supabase: { passed: 0, failed: 0, warnings: 0 },
  database: { passed: 0, failed: 0, warnings: 0 },
  redis: { passed: 0, failed: 0, warnings: 0 },
  ai: { passed: 0, failed: 0, warnings: 0 },
  auth: { passed: 0, failed: 0, warnings: 0 },
  oauth: { passed: 0, failed: 0, warnings: 0 },
  features: { passed: 0, failed: 0, warnings: 0 },
  limits: { passed: 0, failed: 0, warnings: 0 }
};

// Validation functions
function validateRequired(name, value, section) {
  if (value && value.trim() !== '') {
    log.success(`${name}: Set`);
    results[section].passed++;
    return true;
  } else {
    log.error(`${name}: Missing or empty`);
    results[section].failed++;
    return false;
  }
}

function validateOptional(name, value, section) {
  if (value && value.trim() !== '') {
    log.success(`${name}: Set`);
    results[section].passed++;
    return true;
  } else {
    log.warning(`${name}: Not set (optional)`);
    results[section].warnings++;
    return false;
  }
}

function validateUrl(name, value, section) {
  if (!value) {
    log.error(`${name}: Missing`);
    results[section].failed++;
    return false;
  }
  
  try {
    new URL(value);
    log.success(`${name}: Valid URL (${value})`);
    results[section].passed++;
    return true;
  } catch {
    log.error(`${name}: Invalid URL format`);
    results[section].failed++;
    return false;
  }
}

function validateNumber(name, value, section, min = 0, max = null) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    log.error(`${name}: Not a valid number`);
    results[section].failed++;
    return false;
  }
  
  if (num < min || (max && num > max)) {
    log.error(`${name}: Value ${num} out of range (${min}-${max || '∞'})`);
    results[section].failed++;
    return false;
  }
  
  log.success(`${name}: ${num}`);
  results[section].passed++;
  return true;
}

function validateBoolean(name, value, section) {
  if (value === 'true' || value === 'false') {
    log.success(`${name}: ${value}`);
    results[section].passed++;
    return true;
  } else {
    log.warning(`${name}: Invalid boolean value (${value})`);
    results[section].warnings++;
    return false;
  }
}

function validateApiKey(name, value, section, prefix = null) {
  if (!value) {
    log.error(`${name}: Missing`);
    results[section].failed++;
    return false;
  }
  
  if (prefix && !value.startsWith(prefix)) {
    log.warning(`${name}: Doesn't start with expected prefix '${prefix}'`);
    results[section].warnings++;
  }
  
  if (value.length < 20) {
    log.warning(`${name}: Seems too short for an API key`);
    results[section].warnings++;
  }
  
  log.success(`${name}: Set (${value.slice(0, 10)}...)`);
  results[section].passed++;
  return true;
}

async function testRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) {
    log.error('REDIS_URL: Not configured');
    results.redis.failed++;
    return false;
  }
  
  try {
    const client = createClient({ 
      url,
      socket: { connectTimeout: 5000 }
    });
    
    await client.connect();
    await client.ping();
    await client.quit();
    
    log.success('Redis Connection: Working ✅');
    results.redis.passed++;
    return true;
  } catch (error) {
    log.error(`Redis Connection: Failed - ${error.message}`);
    results.redis.failed++;
    return false;
  }
}

async function testSupabaseConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    log.error('Supabase: Missing URL or key');
    results.supabase.failed++;
    return false;
  }
  
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    
    if (response.ok || response.status === 404) {
      log.success('Supabase Connection: Valid credentials ✅');
      results.supabase.passed++;
      return true;
    } else {
      log.error(`Supabase Connection: HTTP ${response.status}`);
      results.supabase.failed++;
      return false;
    }
  } catch (error) {
    log.error(`Supabase Connection: Failed - ${error.message}`);
    results.supabase.failed++;
    return false;
  }
}

// Main validation function
async function validateEnvironment() {
  console.log('');
  console.log('=' .repeat(60));
  console.log(`${colors.bold}🔍 SYNTHEX ENVIRONMENT VALIDATION${colors.reset}`);
  console.log('=' .repeat(60));
  
  // 1. CORE CONFIGURATION
  log.section('CORE CONFIGURATION');
  validateRequired('NODE_ENV', process.env.NODE_ENV, 'core');
  validateNumber('PORT', process.env.PORT, 'core', 1, 65535);
  validateRequired('APP_VERSION', process.env.APP_VERSION, 'core');
  validateUrl('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL, 'core');
  validateUrl('API_URL', process.env.API_URL, 'core');
  
  // 2. SUPABASE
  log.section('SUPABASE');
  validateUrl('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL, 'supabase');
  validateApiKey('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'supabase', 'eyJ');
  validateApiKey('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY, 'supabase', 'eyJ');
  await testSupabaseConnection();
  
  // 3. DATABASE
  log.section('DATABASE');
  validateRequired('DATABASE_PROVIDER', process.env.DATABASE_PROVIDER, 'database');
  validateRequired('DATABASE_URL', process.env.DATABASE_URL, 'database');
  validateRequired('DIRECT_URL', process.env.DIRECT_URL, 'database');
  
  // 4. REDIS
  log.section('REDIS');
  validateRequired('REDIS_HOST', process.env.REDIS_HOST, 'redis');
  validateNumber('REDIS_PORT', process.env.REDIS_PORT, 'redis', 1, 65535);
  validateRequired('REDIS_PASSWORD', process.env.REDIS_PASSWORD, 'redis');
  validateRequired('REDIS_USERNAME', process.env.REDIS_USERNAME, 'redis');
  validateRequired('REDIS_URL', process.env.REDIS_URL, 'redis');
  await testRedisConnection();
  
  // 5. AI APIs
  log.section('AI APIs');
  validateApiKey('OPENROUTER_API_KEY', process.env.OPENROUTER_API_KEY, 'ai', 'sk-or');
  validateUrl('OPENROUTER_BASE_URL', process.env.OPENROUTER_BASE_URL, 'ai');
  validateUrl('OPENROUTER_SITE_URL', process.env.OPENROUTER_SITE_URL, 'ai');
  validateRequired('OPENROUTER_SITE_NAME', process.env.OPENROUTER_SITE_NAME, 'ai');
  validateOptional('OPENROUTER_MODEL', process.env.OPENROUTER_MODEL, 'ai');
  validateOptional('OPENAI_API_KEY', process.env.OPENAI_API_KEY, 'ai');
  validateOptional('ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY, 'ai');
  validateOptional('GOOGLE_API_KEY', process.env.GOOGLE_API_KEY, 'ai');
  
  // 6. AUTHENTICATION & SECURITY
  log.section('AUTHENTICATION & SECURITY');
  validateRequired('JWT_SECRET', process.env.JWT_SECRET, 'auth');
  validateRequired('SESSION_SECRET', process.env.SESSION_SECRET, 'auth');
  validateRequired('API_KEY_SALT', process.env.API_KEY_SALT, 'auth');
  validateRequired('ADMIN_API_KEY', process.env.ADMIN_API_KEY, 'auth');
  validateRequired('CRON_SECRET', process.env.CRON_SECRET, 'auth');
  validateRequired('CORS_ORIGIN', process.env.CORS_ORIGIN, 'auth');
  
  // 7. OAUTH PROVIDERS
  log.section('OAUTH PROVIDERS');
  validateRequired('GOOGLE_CLIENT_ID', process.env.GOOGLE_CLIENT_ID, 'oauth');
  validateRequired('GOOGLE_CLIENT_SECRET', process.env.GOOGLE_CLIENT_SECRET, 'oauth');
  validateUrl('GOOGLE_CALLBACK_URL', process.env.GOOGLE_CALLBACK_URL, 'oauth');
  validateRequired('GOOGLE_PROJECT_NUMBER', process.env.GOOGLE_PROJECT_NUMBER, 'oauth');
  validateRequired('GOOGLE_PROJECT_ID', process.env.GOOGLE_PROJECT_ID, 'oauth');
  validateRequired('GITHUB_CLIENT_ID', process.env.GITHUB_CLIENT_ID, 'oauth');
  validateRequired('GITHUB_CLIENT_SECRET', process.env.GITHUB_CLIENT_SECRET, 'oauth');
  
  // 8. FEATURE FLAGS
  log.section('FEATURE FLAGS');
  const featureFlags = [
    'ENABLE_STRATEGIC_MARKETING',
    'ENABLE_AB_TESTING',
    'ENABLE_PSYCHOLOGY_ANALYTICS',
    'ENABLE_AI_CONTENT',
    'ENABLE_COMPETITOR_ANALYSIS',
    'ENABLE_ADVANCED_ANALYTICS',
    'ENABLE_WHITE_LABEL',
    'ENABLE_HELMET',
    'ENABLE_CORS',
    'ENABLE_RATE_LIMITING',
    'ENABLE_REQUEST_SANITIZATION',
    'SANITIZE_LOGS',
    'PII_DETECTION',
    'CACHE_ENABLED',
    'TRACK_USAGE',
    'TRACK_COSTS',
    'EXPORT_METRICS',
    'ENABLE_REQUEST_LOGGING',
    'ENABLE_PERFORMANCE_MONITORING',
    'ENABLE_ERROR_TRACKING',
    'RATE_LIMIT_ENABLED'
  ];
  
  featureFlags.forEach(flag => {
    validateBoolean(flag, process.env[flag], 'features');
  });
  
  // 9. LIMITS & QUOTAS
  log.section('LIMITS & QUOTAS');
  validateNumber('CACHE_TTL_SECONDS', process.env.CACHE_TTL_SECONDS, 'limits', 0);
  validateNumber('MAX_CONCURRENT_REQUESTS', process.env.MAX_CONCURRENT_REQUESTS, 'limits', 1, 100);
  validateNumber('MAX_CPU_PERCENT', process.env.MAX_CPU_PERCENT, 'limits', 0, 100);
  validateNumber('THROTTLE_DELAY', process.env.THROTTLE_DELAY, 'limits', 0, 10);
  validateNumber('RATE_LIMIT_WINDOW_MS', process.env.RATE_LIMIT_WINDOW_MS, 'limits', 0);
  validateNumber('RATE_LIMIT_MAX_REQUESTS', process.env.RATE_LIMIT_MAX_REQUESTS, 'limits', 1);
  validateNumber('DAILY_BUDGET_LIMIT', process.env.DAILY_BUDGET_LIMIT, 'limits', 0);
  validateNumber('MONTHLY_BUDGET_LIMIT', process.env.MONTHLY_BUDGET_LIMIT, 'limits', 0);
  
  log.subsection('Platform API Limits');
  validateNumber('TWITTER_API_LIMIT', process.env.TWITTER_API_LIMIT, 'limits', 0);
  validateNumber('INSTAGRAM_API_LIMIT', process.env.INSTAGRAM_API_LIMIT, 'limits', 0);
  validateNumber('LINKEDIN_API_LIMIT', process.env.LINKEDIN_API_LIMIT, 'limits', 0);
  validateNumber('TIKTOK_API_LIMIT', process.env.TIKTOK_API_LIMIT, 'limits', 0);
  
  log.subsection('User Tier Limits');
  validateNumber('TIER_FREE_LIMIT', process.env.TIER_FREE_LIMIT, 'limits', 0);
  validateNumber('TIER_BASIC_LIMIT', process.env.TIER_BASIC_LIMIT, 'limits', 0);
  validateNumber('TIER_PRO_LIMIT', process.env.TIER_PRO_LIMIT, 'limits', 0);
  validateNumber('TIER_ENTERPRISE_LIMIT', process.env.TIER_ENTERPRISE_LIMIT, 'limits', 0);
  
  // 10. INTERNATIONALIZATION
  log.section('INTERNATIONALIZATION');
  validateRequired('DEFAULT_LOCALE', process.env.DEFAULT_LOCALE, 'features');
  validateRequired('SUPPORTED_LOCALES', process.env.SUPPORTED_LOCALES, 'features');
  
  // 11. MONITORING & DEBUGGING
  log.section('MONITORING & DEBUGGING');
  validateBoolean('DEBUG', process.env.DEBUG, 'features');
  validateRequired('LOG_LEVEL', process.env.LOG_LEVEL, 'features');
  validateOptional('MONITOR_API_TOKEN', process.env.MONITOR_API_TOKEN, 'features');
  
  // Generate Report
  console.log('');
  console.log('=' .repeat(60));
  console.log(`${colors.bold}📊 VALIDATION REPORT${colors.reset}`);
  console.log('=' .repeat(60));
  
  let totalPassed = 0;
  let totalFailed = 0;
  let totalWarnings = 0;
  
  Object.entries(results).forEach(([section, counts]) => {
    if (counts.passed + counts.failed + counts.warnings > 0) {
      const status = counts.failed > 0 ? '❌' : counts.warnings > 0 ? '⚠️' : '✅';
      console.log(`\n${status} ${section.toUpperCase()}`);
      console.log(`   Passed: ${counts.passed}`);
      if (counts.failed > 0) console.log(`   Failed: ${counts.failed}`);
      if (counts.warnings > 0) console.log(`   Warnings: ${counts.warnings}`);
      
      totalPassed += counts.passed;
      totalFailed += counts.failed;
      totalWarnings += counts.warnings;
    }
  });
  
  console.log('\n' + '─'.repeat(60));
  console.log(`${colors.bold}TOTAL RESULTS:${colors.reset}`);
  console.log(`${colors.green}✅ Passed: ${totalPassed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${totalFailed}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Warnings: ${totalWarnings}${colors.reset}`);
  
  const successRate = Math.round((totalPassed / (totalPassed + totalFailed)) * 100);
  console.log(`\n${colors.bold}Success Rate: ${successRate}%${colors.reset}`);
  
  if (totalFailed === 0) {
    console.log(`\n${colors.green}${colors.bold}🎉 All required environment variables are configured correctly!${colors.reset}`);
  } else {
    console.log(`\n${colors.red}${colors.bold}⚠️  Some required variables are missing or incorrect.${colors.reset}`);
    console.log('Please review the failed items above and update your .env.local file.');
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log(`${colors.cyan}Next steps:${colors.reset}`);
  console.log('1. Fix any failed validations in .env.local');
  console.log('2. Add these same variables to Vercel dashboard');
  console.log('3. Deploy with: vercel --prod');
  console.log('=' .repeat(60));
}

// Run validation
validateEnvironment().catch(console.error);