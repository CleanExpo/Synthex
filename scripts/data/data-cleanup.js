/**
 * Data Cleanup Script
 * Removes demo/seed data for production deployment
 *
 * @task UNI-433 - Implement Data Validation & Cleanup
 *
 * Usage:
 *   node scripts/data/data-cleanup.js [options]
 *
 * Options:
 *   --dry-run      Show what would be deleted without actually deleting
 *   --demo         Remove demo accounts and their data
 *   --expired      Remove expired sessions and tokens
 *   --orphaned     Remove orphaned records
 *   --all          Remove all cleanup targets
 *   --confirm      Skip confirmation prompt
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const REMOVE_DEMO = args.includes('--demo') || args.includes('--all');
const REMOVE_EXPIRED = args.includes('--expired') || args.includes('--all');
const REMOVE_ORPHANED = args.includes('--orphaned') || args.includes('--all');
const SKIP_CONFIRM = args.includes('--confirm');

// Demo account patterns
const DEMO_EMAIL_PATTERNS = [
  'demo@synthex.com',
  'admin@synthex.com',
  'test@synthex.com',
  '%@example.com',
  '%@test.com',
  'demo+%',
  'test+%',
];

// Results tracking
const results = {
  toDelete: {
    users: [],
    campaigns: [],
    posts: [],
    sessions: [],
    projects: [],
    platformConnections: [],
    quotes: [],
    auditLogs: [],
    notifications: [],
  },
  deleted: {
    users: 0,
    campaigns: 0,
    posts: 0,
    sessions: 0,
    projects: 0,
    platformConnections: 0,
    quotes: 0,
    auditLogs: 0,
    notifications: 0,
  },
};

/**
 * Ask for confirmation
 */
async function confirm(message) {
  if (SKIP_CONFIRM || DRY_RUN) {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Find demo users
 */
async function findDemoUsers() {
  console.log('\\n🔍 Finding demo users...');

  const demoUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: 'demo@synthex.com' },
        { email: 'admin@synthex.com' },
        { email: 'test@synthex.com' },
        { email: { endsWith: '@example.com' } },
        { email: { endsWith: '@test.com' } },
        { email: { startsWith: 'demo+' } },
        { email: { startsWith: 'test+' } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          campaigns: true,
          projects: true,
          platformConnections: true,
        },
      },
    },
  });

  results.toDelete.users = demoUsers;
  console.log(`  Found ${demoUsers.length} demo users`);

  for (const user of demoUsers) {
    console.log(`    - ${user.email} (${user._count.campaigns} campaigns, ${user._count.projects} projects)`);
  }

  return demoUsers;
}

/**
 * Find expired sessions
 */
async function findExpiredSessions() {
  console.log('\\n🔍 Finding expired sessions...');

  const expiredSessions = await prisma.session.findMany({
    where: {
      expiresAt: { lt: new Date() },
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
    },
  });

  results.toDelete.sessions = expiredSessions;
  console.log(`  Found ${expiredSessions.length} expired sessions`);

  return expiredSessions;
}

/**
 * Find orphaned records
 */
async function findOrphanedRecords() {
  console.log('\\n🔍 Finding orphaned records...');

  // Find campaigns without users
  const orphanedCampaigns = await prisma.$queryRaw`
    SELECT c.id, c.name, c."userId"
    FROM campaigns c
    LEFT JOIN users u ON c."userId" = u.id
    WHERE u.id IS NULL
  `;
  results.toDelete.campaigns.push(...orphanedCampaigns);
  console.log(`  Found ${orphanedCampaigns.length} orphaned campaigns`);

  // Find posts without campaigns
  const orphanedPosts = await prisma.$queryRaw`
    SELECT p.id, p."campaignId"
    FROM posts p
    LEFT JOIN campaigns c ON p."campaignId" = c.id
    WHERE c.id IS NULL
  `;
  results.toDelete.posts.push(...orphanedPosts);
  console.log(`  Found ${orphanedPosts.length} orphaned posts`);

  // Find platform connections without users
  const orphanedConnections = await prisma.$queryRaw`
    SELECT pc.id, pc.platform, pc."userId"
    FROM platform_connections pc
    LEFT JOIN users u ON pc."userId" = u.id
    WHERE u.id IS NULL
  `;
  results.toDelete.platformConnections.push(...orphanedConnections);
  console.log(`  Found ${orphanedConnections.length} orphaned platform connections`);

  // Find projects without users
  const orphanedProjects = await prisma.$queryRaw`
    SELECT p.id, p.name, p."userId"
    FROM projects p
    LEFT JOIN users u ON p."userId" = u.id
    WHERE u.id IS NULL
  `;
  results.toDelete.projects.push(...orphanedProjects);
  console.log(`  Found ${orphanedProjects.length} orphaned projects`);

  return {
    campaigns: orphanedCampaigns,
    posts: orphanedPosts,
    connections: orphanedConnections,
    projects: orphanedProjects,
  };
}

/**
 * Find expired quotes
 */
async function findExpiredQuotes() {
  console.log('\\n🔍 Finding expired quotes...');

  try {
    const expiredQuotes = await prisma.quote.findMany({
      where: {
        expiresAt: { lt: new Date() },
      },
      select: {
        id: true,
        text: true,
        expiresAt: true,
      },
    });

    results.toDelete.quotes = expiredQuotes;
    console.log(`  Found ${expiredQuotes.length} expired quotes`);

    return expiredQuotes;
  } catch (error) {
    console.log('  Quotes table not found (may not be migrated yet)');
    return [];
  }
}

/**
 * Delete demo user and related data
 */
async function deleteDemoUser(user) {
  const userId = user.id;

  // Delete related data in order (due to foreign keys)
  // 1. Delete posts (through campaigns)
  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    select: { id: true },
  });

  for (const campaign of campaigns) {
    const deletedPosts = await prisma.post.deleteMany({
      where: { campaignId: campaign.id },
    });
    results.deleted.posts += deletedPosts.count;
  }

  // 2. Delete campaigns
  const deletedCampaigns = await prisma.campaign.deleteMany({
    where: { userId },
  });
  results.deleted.campaigns += deletedCampaigns.count;

  // 3. Delete projects
  const deletedProjects = await prisma.project.deleteMany({
    where: { userId },
  });
  results.deleted.projects += deletedProjects.count;

  // 4. Delete platform connections
  const deletedConnections = await prisma.platformConnection.deleteMany({
    where: { userId },
  });
  results.deleted.platformConnections += deletedConnections.count;

  // 5. Delete notifications
  const deletedNotifications = await prisma.notification.deleteMany({
    where: { userId },
  });
  results.deleted.notifications += deletedNotifications.count;

  // 6. Delete audit logs
  const deletedLogs = await prisma.auditLog.deleteMany({
    where: { userId },
  });
  results.deleted.auditLogs += deletedLogs.count;

  // 7. Delete user
  await prisma.user.delete({ where: { id: userId } });
  results.deleted.users++;
}

/**
 * Delete expired sessions
 */
async function deleteExpiredSessions() {
  const deleted = await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  results.deleted.sessions = deleted.count;
  return deleted.count;
}

/**
 * Delete orphaned records
 */
async function deleteOrphanedRecords() {
  // Delete orphaned posts
  if (results.toDelete.posts.length > 0) {
    const postIds = results.toDelete.posts.map((p) => p.id);
    const deleted = await prisma.post.deleteMany({
      where: { id: { in: postIds } },
    });
    results.deleted.posts += deleted.count;
  }

  // Delete orphaned campaigns
  if (results.toDelete.campaigns.length > 0) {
    const campaignIds = results.toDelete.campaigns.map((c) => c.id);
    const deleted = await prisma.campaign.deleteMany({
      where: { id: { in: campaignIds } },
    });
    results.deleted.campaigns += deleted.count;
  }

  // Delete orphaned platform connections
  if (results.toDelete.platformConnections.length > 0) {
    const connIds = results.toDelete.platformConnections.map((c) => c.id);
    const deleted = await prisma.platformConnection.deleteMany({
      where: { id: { in: connIds } },
    });
    results.deleted.platformConnections += deleted.count;
  }

  // Delete orphaned projects
  if (results.toDelete.projects.length > 0) {
    const projectIds = results.toDelete.projects.map((p) => p.id);
    const deleted = await prisma.project.deleteMany({
      where: { id: { in: projectIds } },
    });
    results.deleted.projects += deleted.count;
  }
}

/**
 * Delete expired quotes
 */
async function deleteExpiredQuotes() {
  try {
    const deleted = await prisma.quote.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    results.deleted.quotes = deleted.count;
    return deleted.count;
  } catch (error) {
    return 0;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🧹 SYNTHEX Data Cleanup');
  console.log('========================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('');

  if (!REMOVE_DEMO && !REMOVE_EXPIRED && !REMOVE_ORPHANED) {
    console.log('No cleanup options specified. Use one of:');
    console.log('  --demo      Remove demo accounts');
    console.log('  --expired   Remove expired sessions/tokens');
    console.log('  --orphaned  Remove orphaned records');
    console.log('  --all       Remove all cleanup targets');
    console.log('  --dry-run   Preview changes without deleting');
    process.exit(0);
  }

  // Discovery phase
  console.log('\\n📊 DISCOVERY PHASE');
  console.log('==================');

  if (REMOVE_DEMO) {
    await findDemoUsers();
  }

  if (REMOVE_EXPIRED) {
    await findExpiredSessions();
    await findExpiredQuotes();
  }

  if (REMOVE_ORPHANED) {
    await findOrphanedRecords();
  }

  // Summary
  const totalToDelete =
    results.toDelete.users.length +
    results.toDelete.campaigns.length +
    results.toDelete.posts.length +
    results.toDelete.sessions.length +
    results.toDelete.projects.length +
    results.toDelete.platformConnections.length +
    results.toDelete.quotes.length;

  console.log('\\n📋 CLEANUP SUMMARY');
  console.log('==================');
  console.log(`  Demo users: ${results.toDelete.users.length}`);
  console.log(`  Expired sessions: ${results.toDelete.sessions.length}`);
  console.log(`  Expired quotes: ${results.toDelete.quotes.length}`);
  console.log(`  Orphaned campaigns: ${results.toDelete.campaigns.length}`);
  console.log(`  Orphaned posts: ${results.toDelete.posts.length}`);
  console.log(`  Orphaned projects: ${results.toDelete.projects.length}`);
  console.log(`  Orphaned connections: ${results.toDelete.platformConnections.length}`);
  console.log(`  ─────────────────────`);
  console.log(`  Total records to clean: ${totalToDelete}`);

  if (totalToDelete === 0) {
    console.log('\\n✅ No data to clean up!');
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log('\\n📝 DRY RUN - No changes made');
    process.exit(0);
  }

  // Confirmation
  const confirmed = await confirm('\\n⚠️  Proceed with deletion?');
  if (!confirmed) {
    console.log('\\n❌ Cleanup cancelled');
    process.exit(0);
  }

  // Deletion phase
  console.log('\\n🗑️  DELETION PHASE');
  console.log('==================');

  if (REMOVE_DEMO && results.toDelete.users.length > 0) {
    console.log('\\nDeleting demo users and related data...');
    for (const user of results.toDelete.users) {
      console.log(`  Deleting ${user.email}...`);
      await deleteDemoUser(user);
    }
  }

  if (REMOVE_EXPIRED) {
    console.log('\\nDeleting expired sessions...');
    await deleteExpiredSessions();

    console.log('Deleting expired quotes...');
    await deleteExpiredQuotes();
  }

  if (REMOVE_ORPHANED) {
    console.log('\\nDeleting orphaned records...');
    await deleteOrphanedRecords();
  }

  // Final report
  console.log('\\n✅ CLEANUP COMPLETE');
  console.log('===================');
  console.log(`  Users deleted: ${results.deleted.users}`);
  console.log(`  Campaigns deleted: ${results.deleted.campaigns}`);
  console.log(`  Posts deleted: ${results.deleted.posts}`);
  console.log(`  Projects deleted: ${results.deleted.projects}`);
  console.log(`  Sessions deleted: ${results.deleted.sessions}`);
  console.log(`  Connections deleted: ${results.deleted.platformConnections}`);
  console.log(`  Quotes deleted: ${results.deleted.quotes}`);
  console.log(`  Notifications deleted: ${results.deleted.notifications}`);
  console.log(`  Audit logs deleted: ${results.deleted.auditLogs}`);
}

main()
  .catch((error) => {
    console.error('\\n❌ Cleanup failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
