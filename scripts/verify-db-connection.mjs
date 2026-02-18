#!/usr/bin/env node
/**
 * Database Connection Verifier
 *
 * Run before deployments to catch stale DATABASE_URL credentials.
 * Usage: node scripts/verify-db-connection.mjs
 *
 * Checks:
 * 1. DATABASE_URL is set and parseable
 * 2. Can actually connect and authenticate to PostgreSQL
 * 3. DIRECT_URL (if set) also works
 *
 * Exit codes:
 *   0 = all connections verified
 *   1 = connection failed (stale password, wrong host, etc.)
 */

import pg from 'pg';
import { config } from 'dotenv';

// Load env files in order of precedence
config({ path: '.env.local' });
config({ path: '.env' });

const { Pool } = pg;

async function testConnection(label, urlString) {
  if (!urlString) {
    console.log(`  [SKIP] ${label}: not set`);
    return true;
  }

  let url;
  try {
    url = new URL(urlString);
  } catch {
    console.error(`  [FAIL] ${label}: invalid URL format`);
    return false;
  }

  const host = url.hostname;
  const port = parseInt(url.port || '5432', 10);
  const database = url.pathname.replace(/^\//, '');
  const user = url.username;

  console.log(`  Testing ${label}: ${user}@${host}:${port}/${database}`);

  const pool = new Pool({
    host,
    port,
    database,
    user,
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    max: 1,
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT current_database() as db, current_user as usr');
    client.release();
    await pool.end();
    console.log(`  [PASS] ${label}: connected as ${result.rows[0].usr} to ${result.rows[0].db}`);
    return true;
  } catch (error) {
    await pool.end().catch(() => {});
    const msg = error.message || String(error);

    if (msg.includes('SCRAM') || msg.includes('password') || msg.includes('authentication')) {
      console.error(`  [FAIL] ${label}: AUTHENTICATION FAILED — password is wrong or was rotated`);
      console.error(`         Fix: Go to Supabase Dashboard → Settings → Database → copy password`);
      console.error(`         Then update ${label} in Vercel Dashboard → Settings → Environment Variables`);
    } else if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
      console.error(`  [FAIL] ${label}: CONNECTION TIMEOUT — host unreachable`);
      console.error(`         Host: ${host}:${port}`);
    } else {
      console.error(`  [FAIL] ${label}: ${msg}`);
    }
    return false;
  }
}

async function main() {
  console.log('\n=== Database Connection Verification ===\n');

  const dbUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  if (!dbUrl) {
    console.error('  [FAIL] DATABASE_URL is not set in environment');
    console.error('         Checked: .env.local, .env');
    process.exit(1);
  }

  const results = [];
  results.push(await testConnection('DATABASE_URL', dbUrl));
  results.push(await testConnection('DIRECT_URL', directUrl));

  console.log('\n=== Summary ===\n');

  if (results.every(Boolean)) {
    console.log('  All database connections verified. Safe to deploy.\n');
    process.exit(0);
  } else {
    console.error('  One or more connections FAILED. Do NOT deploy until fixed.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Verification script error:', err);
  process.exit(1);
});
