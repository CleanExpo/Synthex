/**
 * Database Migration Runner
 * Executes all SQL migrations in sequence
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'synthex',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Migration tracking table
const MIGRATION_TABLE = 'schema_migrations';

/**
 * Create migration tracking table if it doesn't exist
 */
async function createMigrationTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64) NOT NULL
    );
  `;
  
  try {
    await pool.query(query);
    console.log('✅ Migration tracking table ready');
  } catch (error) {
    console.error('❌ Failed to create migration table:', error.message);
    throw error;
  }
}

/**
 * Get list of already executed migrations
 */
async function getExecutedMigrations() {
  try {
    const result = await pool.query(
      `SELECT filename FROM ${MIGRATION_TABLE} ORDER BY filename`
    );
    return result.rows.map(row => row.filename);
  } catch (error) {
    console.error('❌ Failed to get executed migrations:', error.message);
    return [];
  }
}

/**
 * Calculate checksum for migration file
 */
function calculateChecksum(content) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Record successful migration
 */
async function recordMigration(filename, checksum) {
  const query = `
    INSERT INTO ${MIGRATION_TABLE} (filename, checksum)
    VALUES ($1, $2)
    ON CONFLICT (filename) DO NOTHING;
  `;
  
  try {
    await pool.query(query, [filename, checksum]);
    console.log(`  ✓ Recorded migration: ${filename}`);
  } catch (error) {
    console.error(`  ✗ Failed to record migration ${filename}:`, error.message);
    throw error;
  }
}

/**
 * Execute a single migration file
 */
async function executeMigration(filepath, filename) {
  const client = await pool.connect();
  
  try {
    console.log(`\n📄 Executing migration: ${filename}`);
    
    // Read migration file
    const content = await fs.readFile(filepath, 'utf8');
    const checksum = calculateChecksum(content);
    
    // Start transaction
    await client.query('BEGIN');
    
    // Split content by semicolons but preserve those in quotes
    const statements = content
      .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.length > 0) {
        await client.query(statement);
      }
    }
    
    // Record migration
    await client.query(
      `INSERT INTO ${MIGRATION_TABLE} (filename, checksum)
       VALUES ($1, $2)
       ON CONFLICT (filename) DO NOTHING`,
      [filename, checksum]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    console.log(`  ✅ Migration completed: ${filename}`);
    
    return true;
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error(`  ❌ Migration failed: ${filename}`);
    console.error(`     Error: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  console.log('🚀 Starting database migration process...\n');
  
  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection established');
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   Database: ${dbConfig.database}`);
    console.log(`   User: ${dbConfig.user}\n`);
    
    // Create migration tracking table
    await createMigrationTable();
    
    // Get list of executed migrations
    const executedMigrations = await getExecutedMigrations();
    console.log(`\n📊 Found ${executedMigrations.length} previously executed migrations`);
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ensure migrations run in order
    
    console.log(`📁 Found ${sqlFiles.length} total migration files\n`);
    
    // Execute pending migrations
    let executedCount = 0;
    let skippedCount = 0;
    
    for (const file of sqlFiles) {
      if (executedMigrations.includes(file)) {
        console.log(`⏭️  Skipping already executed: ${file}`);
        skippedCount++;
      } else {
        const filepath = path.join(migrationsDir, file);
        await executeMigration(filepath, file);
        executedCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Migration Summary:');
    console.log(`   Total migrations: ${sqlFiles.length}`);
    console.log(`   Newly executed: ${executedCount}`);
    console.log(`   Previously executed: ${skippedCount}`);
    console.log('='.repeat(60));
    
    if (executedCount > 0) {
      console.log('\n✨ All migrations completed successfully!');
    } else {
      console.log('\n✅ Database is already up to date!');
    }
    
  } catch (error) {
    console.error('\n❌ Migration process failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Rollback the last migration
 */
async function rollbackMigration() {
  console.log('🔄 Rolling back last migration...\n');
  
  try {
    const result = await pool.query(
      `SELECT filename FROM ${MIGRATION_TABLE} 
       ORDER BY executed_at DESC 
       LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      console.log('No migrations to rollback');
      return;
    }
    
    const lastMigration = result.rows[0].filename;
    console.log(`Rolling back: ${lastMigration}`);
    
    // Note: Actual rollback would require DOWN migrations
    // For now, just remove from tracking table
    await pool.query(
      `DELETE FROM ${MIGRATION_TABLE} WHERE filename = $1`,
      [lastMigration]
    );
    
    console.log(`✅ Rolled back: ${lastMigration}`);
    console.log('\n⚠️  Note: This only removed the migration record.');
    console.log('    Manual database cleanup may be required.');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Check migration status
 */
async function checkStatus() {
  console.log('📊 Checking migration status...\n');
  
  try {
    // Check connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection OK\n');
    
    // Check if migration table exists
    const tableExists = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      )`,
      [MIGRATION_TABLE]
    );
    
    if (!tableExists.rows[0].exists) {
      console.log('⚠️  Migration table does not exist');
      console.log('   Run migrations to create it');
      return;
    }
    
    // Get executed migrations
    const executed = await pool.query(
      `SELECT filename, executed_at 
       FROM ${MIGRATION_TABLE} 
       ORDER BY filename`
    );
    
    if (executed.rows.length === 0) {
      console.log('No migrations have been executed yet');
    } else {
      console.log('Executed migrations:');
      executed.rows.forEach(row => {
        const date = new Date(row.executed_at).toLocaleString();
        console.log(`  ✓ ${row.filename} (${date})`);
      });
    }
    
    // Check pending migrations
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    const executedFiles = executed.rows.map(r => r.filename);
    const pending = sqlFiles.filter(f => !executedFiles.includes(f));
    
    if (pending.length > 0) {
      console.log('\nPending migrations:');
      pending.forEach(file => {
        console.log(`  ○ ${file}`);
      });
    } else {
      console.log('\n✅ All migrations are up to date!');
    }
    
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'up':
  case 'migrate':
    runMigrations();
    break;
  case 'down':
  case 'rollback':
    rollbackMigration();
    break;
  case 'status':
    checkStatus();
    break;
  default:
    console.log('Database Migration Runner');
    console.log('========================\n');
    console.log('Usage:');
    console.log('  node run-migrations.js <command>\n');
    console.log('Commands:');
    console.log('  up, migrate    Run all pending migrations');
    console.log('  down, rollback Rollback the last migration');
    console.log('  status         Check migration status\n');
    console.log('Environment variables:');
    console.log('  DB_HOST        Database host (default: localhost)');
    console.log('  DB_PORT        Database port (default: 5432)');
    console.log('  DB_NAME        Database name (default: synthex)');
    console.log('  DB_USER        Database user (default: postgres)');
    console.log('  DB_PASSWORD    Database password (default: postgres)');
    process.exit(0);
}
