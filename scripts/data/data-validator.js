/**
 * Data Validator
 * Validates database records for integrity and correctness
 *
 * @task UNI-433 - Implement Data Validation & Cleanup
 *
 * Usage:
 *   node scripts/data/data-validator.js [--fix] [--verbose]
 *
 * Options:
 *   --fix      Attempt to fix issues automatically
 *   --verbose  Show detailed output
 *   --table    Validate specific table only
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const VERBOSE = args.includes('--verbose');
const tableArg = args.find((a) => a.startsWith('--table='));
const SPECIFIC_TABLE = tableArg ? tableArg.split('=')[1] : null;

// Validation results
const results = {
  errors: [],
  warnings: [],
  fixed: [],
  stats: {},
};

/**
 * Log verbose message
 */
function log(message) {
  if (VERBOSE) {
    console.log(message);
  }
}

/**
 * Add error to results
 */
function addError(table, id, message, data = null) {
  results.errors.push({ table, id, message, data });
}

/**
 * Add warning to results
 */
function addWarning(table, id, message, data = null) {
  results.warnings.push({ table, id, message, data });
}

/**
 * Add fixed item to results
 */
function addFixed(table, id, message) {
  results.fixed.push({ table, id, message });
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * Validate Users table
 */
async function validateUsers() {
  log('\\n📋 Validating Users...');
  const users = await prisma.user.findMany();
  results.stats.users = { total: users.length, valid: 0, invalid: 0 };

  for (const user of users) {
    let isValid = true;

    // Check required fields
    if (!user.email || user.email.trim() === '') {
      addError('User', user.id, 'Missing or empty email');
      isValid = false;
    }

    // Validate email format
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (user.email && !emailRegex.test(user.email)) {
      addError('User', user.id, `Invalid email format: ${user.email}`);
      isValid = false;
    }

    // Check password (hashed)
    if (!user.password || user.password.length < 20) {
      addWarning('User', user.id, 'Password may not be properly hashed');
    }

    // Validate auth provider
    const validProviders = ['local', 'google', 'github'];
    if (user.authProvider && !validProviders.includes(user.authProvider)) {
      addWarning('User', user.id, `Unknown auth provider: ${user.authProvider}`);
    }

    // Check for orphaned organization references
    if (user.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: user.organizationId },
      });
      if (!org) {
        addError('User', user.id, `Orphaned organization reference: ${user.organizationId}`);
        isValid = false;
        if (FIX_MODE) {
          await prisma.user.update({
            where: { id: user.id },
            data: { organizationId: null },
          });
          addFixed('User', user.id, 'Removed orphaned organization reference');
        }
      }
    }

    if (isValid) {
      results.stats.users.valid++;
    } else {
      results.stats.users.invalid++;
    }
  }

  log(`  Found ${users.length} users, ${results.stats.users.invalid} with issues`);
}

/**
 * Validate Campaigns table
 */
async function validateCampaigns() {
  log('\\n📋 Validating Campaigns...');
  const campaigns = await prisma.campaign.findMany();
  results.stats.campaigns = { total: campaigns.length, valid: 0, invalid: 0 };

  for (const campaign of campaigns) {
    let isValid = true;

    // Check required fields
    if (!campaign.name || campaign.name.trim() === '') {
      addError('Campaign', campaign.id, 'Missing campaign name');
      isValid = false;
    }

    // Check user reference
    const user = await prisma.user.findUnique({
      where: { id: campaign.userId },
    });
    if (!user) {
      addError('Campaign', campaign.id, `Orphaned user reference: ${campaign.userId}`);
      isValid = false;
      if (FIX_MODE) {
        await prisma.campaign.delete({ where: { id: campaign.id } });
        addFixed('Campaign', campaign.id, 'Deleted campaign with orphaned user reference');
        continue;
      }
    }

    // Validate status
    const validStatuses = ['draft', 'active', 'paused', 'completed'];
    if (!validStatuses.includes(campaign.status)) {
      addWarning('Campaign', campaign.id, `Unknown status: ${campaign.status}`);
    }

    // Validate platform
    const validPlatforms = ['instagram', 'twitter', 'linkedin', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit'];
    if (campaign.platform && !validPlatforms.some((p) => campaign.platform.includes(p))) {
      addWarning('Campaign', campaign.id, `Unknown platform: ${campaign.platform}`);
    }

    if (isValid) {
      results.stats.campaigns.valid++;
    } else {
      results.stats.campaigns.invalid++;
    }
  }

  log(`  Found ${campaigns.length} campaigns, ${results.stats.campaigns.invalid} with issues`);
}

/**
 * Validate Posts table
 */
async function validatePosts() {
  log('\\n📋 Validating Posts...');
  const posts = await prisma.post.findMany();
  results.stats.posts = { total: posts.length, valid: 0, invalid: 0 };

  for (const post of posts) {
    let isValid = true;

    // Check content
    if (!post.content || post.content.trim() === '') {
      addError('Post', post.id, 'Missing post content');
      isValid = false;
    }

    // Check campaign reference
    const campaign = await prisma.campaign.findUnique({
      where: { id: post.campaignId },
    });
    if (!campaign) {
      addError('Post', post.id, `Orphaned campaign reference: ${post.campaignId}`);
      isValid = false;
      if (FIX_MODE) {
        await prisma.post.delete({ where: { id: post.id } });
        addFixed('Post', post.id, 'Deleted post with orphaned campaign reference');
        continue;
      }
    }

    // Validate status
    const validStatuses = ['draft', 'scheduled', 'published', 'failed'];
    if (!validStatuses.includes(post.status)) {
      addWarning('Post', post.id, `Unknown status: ${post.status}`);
    }

    // Check scheduled posts have scheduledAt
    if (post.status === 'scheduled' && !post.scheduledAt) {
      addError('Post', post.id, 'Scheduled post missing scheduledAt date');
      isValid = false;
    }

    // Check published posts have publishedAt
    if (post.status === 'published' && !post.publishedAt) {
      addWarning('Post', post.id, 'Published post missing publishedAt date');
    }

    if (isValid) {
      results.stats.posts.valid++;
    } else {
      results.stats.posts.invalid++;
    }
  }

  log(`  Found ${posts.length} posts, ${results.stats.posts.invalid} with issues`);
}

/**
 * Validate Sessions table
 */
async function validateSessions() {
  log('\\n📋 Validating Sessions...');
  const sessions = await prisma.session.findMany();
  results.stats.sessions = { total: sessions.length, valid: 0, invalid: 0, expired: 0 };

  const now = new Date();

  for (const session of sessions) {
    let isValid = true;

    // Check for expired sessions
    if (session.expiresAt < now) {
      results.stats.sessions.expired++;
      if (FIX_MODE) {
        await prisma.session.delete({ where: { id: session.id } });
        addFixed('Session', session.id, 'Deleted expired session');
        continue;
      } else {
        addWarning('Session', session.id, 'Session expired');
      }
    }

    // Check token
    if (!session.token || session.token.length < 10) {
      addError('Session', session.id, 'Invalid or missing token');
      isValid = false;
    }

    if (isValid) {
      results.stats.sessions.valid++;
    } else {
      results.stats.sessions.invalid++;
    }
  }

  log(`  Found ${sessions.length} sessions, ${results.stats.sessions.expired} expired`);
}

/**
 * Validate Platform Connections
 */
async function validatePlatformConnections() {
  log('\\n📋 Validating Platform Connections...');
  const connections = await prisma.platformConnection.findMany();
  results.stats.platformConnections = { total: connections.length, valid: 0, invalid: 0 };

  for (const conn of connections) {
    let isValid = true;

    // Check user reference
    const user = await prisma.user.findUnique({
      where: { id: conn.userId },
    });
    if (!user) {
      addError('PlatformConnection', conn.id, `Orphaned user reference: ${conn.userId}`);
      isValid = false;
      if (FIX_MODE) {
        await prisma.platformConnection.delete({ where: { id: conn.id } });
        addFixed('PlatformConnection', conn.id, 'Deleted connection with orphaned user');
        continue;
      }
    }

    // Check access token
    if (!conn.accessToken) {
      addError('PlatformConnection', conn.id, 'Missing access token');
      isValid = false;
    }

    // Check expired tokens
    if (conn.expiresAt && conn.expiresAt < new Date()) {
      addWarning('PlatformConnection', conn.id, 'Access token expired');
    }

    if (isValid) {
      results.stats.platformConnections.valid++;
    } else {
      results.stats.platformConnections.invalid++;
    }
  }

  log(`  Found ${connections.length} connections, ${results.stats.platformConnections.invalid} with issues`);
}

/**
 * Validate Quotes table
 */
async function validateQuotes() {
  log('\\n📋 Validating Quotes...');

  try {
    const quotes = await prisma.quote.findMany();
    results.stats.quotes = { total: quotes.length, valid: 0, invalid: 0, expired: 0 };

    const now = new Date();

    for (const quote of quotes) {
      let isValid = true;

      // Check text
      if (!quote.text || quote.text.trim() === '') {
        addError('Quote', quote.id, 'Missing quote text');
        isValid = false;
      }

      // Check category
      const validCategories = ['inspirational', 'motivational', 'business', 'humor', 'wisdom', 'leadership', 'success', 'creativity', 'marketing', 'general'];
      if (!validCategories.includes(quote.category)) {
        addWarning('Quote', quote.id, `Unknown category: ${quote.category}`);
      }

      // Check expired quotes
      if (quote.expiresAt && quote.expiresAt < now) {
        results.stats.quotes.expired++;
        if (FIX_MODE) {
          await prisma.quote.delete({ where: { id: quote.id } });
          addFixed('Quote', quote.id, 'Deleted expired quote');
          continue;
        }
      }

      if (isValid) {
        results.stats.quotes.valid++;
      } else {
        results.stats.quotes.invalid++;
      }
    }

    log(`  Found ${quotes.length} quotes, ${results.stats.quotes.invalid} with issues`);
  } catch (error) {
    log('  Quotes table not found or empty (may not be migrated yet)');
    results.stats.quotes = { total: 0, valid: 0, invalid: 0, skipped: true };
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🔍 SYNTHEX Data Validator');
  console.log('========================');
  console.log(`Mode: ${FIX_MODE ? 'FIX (will modify data)' : 'CHECK ONLY'}`);
  console.log(`Verbose: ${VERBOSE}`);
  if (SPECIFIC_TABLE) {
    console.log(`Table: ${SPECIFIC_TABLE}`);
  }
  console.log('');

  const tables = {
    users: validateUsers,
    campaigns: validateCampaigns,
    posts: validatePosts,
    sessions: validateSessions,
    platformConnections: validatePlatformConnections,
    quotes: validateQuotes,
  };

  // Run validations
  if (SPECIFIC_TABLE && tables[SPECIFIC_TABLE]) {
    await tables[SPECIFIC_TABLE]();
  } else {
    for (const [name, validator] of Object.entries(tables)) {
      await validator();
    }
  }

  // Print results
  console.log('\\n' + '='.repeat(50));
  console.log('📊 VALIDATION RESULTS');
  console.log('='.repeat(50));

  // Stats
  console.log('\\n📈 Statistics:');
  for (const [table, stats] of Object.entries(results.stats)) {
    if (stats.skipped) {
      console.log(`  ${table}: skipped`);
    } else {
      console.log(`  ${table}: ${stats.total} total, ${stats.valid} valid, ${stats.invalid} invalid`);
    }
  }

  // Errors
  if (results.errors.length > 0) {
    console.log(`\\n❌ Errors (${results.errors.length}):`);
    for (const error of results.errors.slice(0, 20)) {
      console.log(`  [${error.table}:${error.id}] ${error.message}`);
    }
    if (results.errors.length > 20) {
      console.log(`  ... and ${results.errors.length - 20} more errors`);
    }
  }

  // Warnings
  if (results.warnings.length > 0) {
    console.log(`\\n⚠️  Warnings (${results.warnings.length}):`);
    for (const warning of results.warnings.slice(0, 10)) {
      console.log(`  [${warning.table}:${warning.id}] ${warning.message}`);
    }
    if (results.warnings.length > 10) {
      console.log(`  ... and ${results.warnings.length - 10} more warnings`);
    }
  }

  // Fixed
  if (results.fixed.length > 0) {
    console.log(`\\n✅ Fixed (${results.fixed.length}):`);
    for (const fix of results.fixed) {
      console.log(`  [${fix.table}:${fix.id}] ${fix.message}`);
    }
  }

  // Summary
  console.log('\\n' + '='.repeat(50));
  const hasErrors = results.errors.length > 0;
  const hasWarnings = results.warnings.length > 0;

  if (!hasErrors && !hasWarnings) {
    console.log('✅ All data is valid!');
  } else if (!hasErrors) {
    console.log(`⚠️  Data valid with ${results.warnings.length} warnings`);
  } else {
    console.log(`❌ Found ${results.errors.length} errors and ${results.warnings.length} warnings`);
    if (!FIX_MODE) {
      console.log('   Run with --fix to attempt automatic fixes');
    }
  }

  // Exit code
  process.exit(hasErrors ? 1 : 0);
}

main()
  .catch((error) => {
    console.error('\\n❌ Validation failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
