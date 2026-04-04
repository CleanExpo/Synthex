/**
 * Data Integrity Check
 * Comprehensive database integrity and statistics report
 *
 * @task UNI-433 - Implement Data Validation & Cleanup
 *
 * Usage:
 *   node scripts/data/data-integrity-check.js [--json] [--verbose]
 *
 * Options:
 *   --json     Output as JSON
 *   --verbose  Show detailed breakdowns
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const JSON_OUTPUT = args.includes('--json');
const VERBOSE = args.includes('--verbose');

// Report data
const report = {
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
  database: {
    connected: false,
    latency: 0,
  },
  tables: {},
  integrity: {
    errors: [],
    warnings: [],
    orphanedRecords: 0,
    expiredRecords: 0,
  },
  statistics: {
    totalRecords: 0,
    activeUsers: 0,
    recentActivity: {},
  },
  recommendations: [],
};

/**
 * Check database connection
 */
async function checkConnection() {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    report.database.connected = true;
    report.database.latency = Date.now() - start;
    return true;
  } catch (error) {
    report.database.connected = false;
    report.database.error = error.message;
    return false;
  }
}

/**
 * Get table statistics
 */
async function getTableStats() {
  // Users
  const userStats = await prisma.user.aggregate({
    _count: { id: true },
  });
  const verifiedUsers = await prisma.user.count({
    where: { emailVerified: true },
  });
  const recentUsers = await prisma.user.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  report.tables.users = {
    total: userStats._count.id,
    verified: verifiedUsers,
    unverified: userStats._count.id - verifiedUsers,
    last30Days: recentUsers,
  };

  // Campaigns
  const campaignStats = await prisma.campaign.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  const totalCampaigns = campaignStats.reduce((sum, s) => sum + s._count.id, 0);

  report.tables.campaigns = {
    total: totalCampaigns,
    byStatus: Object.fromEntries(campaignStats.map((s) => [s.status, s._count.id])),
  };

  // Posts
  const postStats = await prisma.post.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  const totalPosts = postStats.reduce((sum, s) => sum + s._count.id, 0);

  const platformStats = await prisma.post.groupBy({
    by: ['platform'],
    _count: { id: true },
  });

  report.tables.posts = {
    total: totalPosts,
    byStatus: Object.fromEntries(postStats.map((s) => [s.status, s._count.id])),
    byPlatform: Object.fromEntries(platformStats.map((s) => [s.platform, s._count.id])),
  };

  // Sessions
  const activeSessions = await prisma.session.count({
    where: { expiresAt: { gt: new Date() } },
  });
  const expiredSessions = await prisma.session.count({
    where: { expiresAt: { lt: new Date() } },
  });

  report.tables.sessions = {
    total: activeSessions + expiredSessions,
    active: activeSessions,
    expired: expiredSessions,
  };
  report.integrity.expiredRecords += expiredSessions;

  // Projects
  const projectStats = await prisma.project.aggregate({
    _count: { id: true },
  });

  report.tables.projects = {
    total: projectStats._count.id,
  };

  // Platform Connections
  const connectionStats = await prisma.platformConnection.groupBy({
    by: ['platform'],
    _count: { id: true },
  });
  const activeConnections = await prisma.platformConnection.count({
    where: { isActive: true },
  });

  report.tables.platformConnections = {
    total: connectionStats.reduce((sum, s) => sum + s._count.id, 0),
    active: activeConnections,
    byPlatform: Object.fromEntries(connectionStats.map((s) => [s.platform, s._count.id])),
  };

  // Quotes (if exists)
  try {
    const quoteStats = await prisma.quote.aggregate({
      _count: { id: true },
    });
    const expiredQuotes = await prisma.quote.count({
      where: { expiresAt: { lt: new Date() } },
    });
    const aiQuotes = await prisma.quote.count({
      where: { aiGenerated: true },
    });

    report.tables.quotes = {
      total: quoteStats._count.id,
      expired: expiredQuotes,
      aiGenerated: aiQuotes,
      custom: quoteStats._count.id - aiQuotes,
    };
    report.integrity.expiredRecords += expiredQuotes;
  } catch (error) {
    report.tables.quotes = { total: 0, note: 'Table not migrated' };
  }

  // Notifications
  const notificationStats = await prisma.notification.aggregate({
    _count: { id: true },
  });
  const unreadNotifications = await prisma.notification.count({
    where: { read: false },
  });

  report.tables.notifications = {
    total: notificationStats._count.id,
    unread: unreadNotifications,
    read: notificationStats._count.id - unreadNotifications,
  };

  // Audit Logs
  const auditStats = await prisma.auditLog.aggregate({
    _count: { id: true },
  });
  const recentAudits = await prisma.auditLog.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  report.tables.auditLogs = {
    total: auditStats._count.id,
    last24Hours: recentAudits,
  };

  // Calculate totals
  report.statistics.totalRecords = Object.values(report.tables).reduce(
    (sum, t) => sum + (t.total || 0),
    0
  );
  report.statistics.activeUsers = report.tables.users.total;
}

/**
 * Check for orphaned records
 */
async function checkOrphanedRecords() {
  // Campaigns without users
  const orphanedCampaigns = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM campaigns c
    LEFT JOIN users u ON c."userId" = u.id
    WHERE u.id IS NULL
  `;
  const orphanedCampaignCount = Number(orphanedCampaigns[0].count);

  if (orphanedCampaignCount > 0) {
    report.integrity.orphanedRecords += orphanedCampaignCount;
    report.integrity.errors.push({
      type: 'orphaned_records',
      table: 'campaigns',
      count: orphanedCampaignCount,
      message: `${orphanedCampaignCount} campaigns without user reference`,
    });
  }

  // Posts without campaigns
  const orphanedPosts = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM posts p
    LEFT JOIN campaigns c ON p."campaignId" = c.id
    WHERE c.id IS NULL
  `;
  const orphanedPostCount = Number(orphanedPosts[0].count);

  if (orphanedPostCount > 0) {
    report.integrity.orphanedRecords += orphanedPostCount;
    report.integrity.errors.push({
      type: 'orphaned_records',
      table: 'posts',
      count: orphanedPostCount,
      message: `${orphanedPostCount} posts without campaign reference`,
    });
  }

  // Platform connections without users
  const orphanedConnections = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM platform_connections pc
    LEFT JOIN users u ON pc."userId" = u.id
    WHERE u.id IS NULL
  `;
  const orphanedConnectionCount = Number(orphanedConnections[0].count);

  if (orphanedConnectionCount > 0) {
    report.integrity.orphanedRecords += orphanedConnectionCount;
    report.integrity.errors.push({
      type: 'orphaned_records',
      table: 'platform_connections',
      count: orphanedConnectionCount,
      message: `${orphanedConnectionCount} connections without user reference`,
    });
  }

  // Projects without users
  const orphanedProjects = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM projects p
    LEFT JOIN users u ON p."userId" = u.id
    WHERE u.id IS NULL
  `;
  const orphanedProjectCount = Number(orphanedProjects[0].count);

  if (orphanedProjectCount > 0) {
    report.integrity.orphanedRecords += orphanedProjectCount;
    report.integrity.errors.push({
      type: 'orphaned_records',
      table: 'projects',
      count: orphanedProjectCount,
      message: `${orphanedProjectCount} projects without user reference`,
    });
  }
}

/**
 * Check for data quality issues
 */
async function checkDataQuality() {
  // Users without email verification
  const unverifiedOld = await prisma.user.count({
    where: {
      emailVerified: false,
      createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  if (unverifiedOld > 0) {
    report.integrity.warnings.push({
      type: 'unverified_users',
      count: unverifiedOld,
      message: `${unverifiedOld} users unverified for over 7 days`,
    });
  }

  // Stale sessions
  if (report.tables.sessions.expired > 100) {
    report.integrity.warnings.push({
      type: 'stale_sessions',
      count: report.tables.sessions.expired,
      message: `${report.tables.sessions.expired} expired sessions should be cleaned up`,
    });
    report.recommendations.push('Run: node scripts/data/data-cleanup.js --expired');
  }

  // Demo accounts
  const demoUsers = await prisma.user.count({
    where: {
      OR: [
        { email: 'demo@synthex.com' },
        { email: 'admin@synthex.com' },
        { email: { endsWith: '@example.com' } },
        { email: { endsWith: '@test.com' } },
      ],
    },
  });

  if (demoUsers > 0 && process.env.NODE_ENV === 'production') {
    report.integrity.warnings.push({
      type: 'demo_accounts',
      count: demoUsers,
      message: `${demoUsers} demo/test accounts found in production`,
    });
    report.recommendations.push('Run: node scripts/data/data-cleanup.js --demo');
  }

  // Large tables warning
  if (report.tables.auditLogs.total > 100000) {
    report.integrity.warnings.push({
      type: 'large_table',
      table: 'audit_logs',
      count: report.tables.auditLogs.total,
      message: 'Audit logs table is large, consider archiving old records',
    });
  }
}

/**
 * Generate recommendations
 */
function generateRecommendations() {
  if (report.integrity.orphanedRecords > 0) {
    report.recommendations.push('Run: node scripts/data/data-cleanup.js --orphaned');
  }

  if (report.integrity.errors.length > 0) {
    report.recommendations.push('Run: node scripts/data/data-validator.js --fix');
  }

  if (report.tables.users.unverified > report.tables.users.verified) {
    report.recommendations.push('Consider implementing email verification reminder emails');
  }
}

/**
 * Print report
 */
function printReport() {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\\n📊 SYNTHEX DATA INTEGRITY REPORT');
  console.log('='.repeat(50));
  console.log(`Generated: ${report.timestamp}`);
  console.log(`Environment: ${report.environment}`);

  // Database status
  console.log('\\n📡 Database Connection');
  console.log(`  Status: ${report.database.connected ? '✅ Connected' : '❌ Disconnected'}`);
  if (report.database.connected) {
    console.log(`  Latency: ${report.database.latency}ms`);
  }

  // Table statistics
  console.log('\\n📋 Table Statistics');
  console.log(`  Users: ${report.tables.users.total} (${report.tables.users.verified} verified)`);
  console.log(`  Campaigns: ${report.tables.campaigns.total}`);
  if (VERBOSE && report.tables.campaigns.byStatus) {
    for (const [status, count] of Object.entries(report.tables.campaigns.byStatus)) {
      console.log(`    - ${status}: ${count}`);
    }
  }
  console.log(`  Posts: ${report.tables.posts.total}`);
  if (VERBOSE && report.tables.posts.byPlatform) {
    for (const [platform, count] of Object.entries(report.tables.posts.byPlatform)) {
      console.log(`    - ${platform}: ${count}`);
    }
  }
  console.log(`  Projects: ${report.tables.projects.total}`);
  console.log(`  Sessions: ${report.tables.sessions.total} (${report.tables.sessions.active} active)`);
  console.log(`  Platform Connections: ${report.tables.platformConnections.total}`);
  console.log(`  Quotes: ${report.tables.quotes.total}`);
  console.log(`  Notifications: ${report.tables.notifications.total}`);
  console.log(`  Audit Logs: ${report.tables.auditLogs.total}`);
  console.log(`  ─────────────────────`);
  console.log(`  Total Records: ${report.statistics.totalRecords}`);

  // Integrity issues
  if (report.integrity.errors.length > 0 || report.integrity.warnings.length > 0) {
    console.log('\\n⚠️  Integrity Issues');

    if (report.integrity.errors.length > 0) {
      console.log('  Errors:');
      for (const error of report.integrity.errors) {
        console.log(`    ❌ ${error.message}`);
      }
    }

    if (report.integrity.warnings.length > 0) {
      console.log('  Warnings:');
      for (const warning of report.integrity.warnings) {
        console.log(`    ⚠️  ${warning.message}`);
      }
    }
  } else {
    console.log('\\n✅ No integrity issues found');
  }

  // Summary
  console.log('\\n📈 Summary');
  console.log(`  Orphaned records: ${report.integrity.orphanedRecords}`);
  console.log(`  Expired records: ${report.integrity.expiredRecords}`);
  console.log(`  Errors: ${report.integrity.errors.length}`);
  console.log(`  Warnings: ${report.integrity.warnings.length}`);

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log('\\n💡 Recommendations');
    for (const rec of report.recommendations) {
      console.log(`  → ${rec}`);
    }
  }

  // Overall status
  console.log('\\n' + '='.repeat(50));
  if (report.integrity.errors.length === 0 && report.integrity.orphanedRecords === 0) {
    console.log('✅ Database integrity: HEALTHY');
  } else if (report.integrity.errors.length > 0) {
    console.log('❌ Database integrity: ISSUES FOUND');
  } else {
    console.log('⚠️  Database integrity: NEEDS ATTENTION');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  if (!JSON_OUTPUT) {
    console.log('🔍 Running data integrity check...');
  }

  // Check connection
  const connected = await checkConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database');
    process.exit(1);
  }

  // Gather statistics
  await getTableStats();

  // Check integrity
  await checkOrphanedRecords();
  await checkDataQuality();

  // Generate recommendations
  generateRecommendations();

  // Output report
  printReport();

  // Exit code based on errors
  process.exit(report.integrity.errors.length > 0 ? 1 : 0);
}

main()
  .catch((error) => {
    console.error('\\n❌ Check failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
