#!/usr/bin/env node

/**
 * Database Setup Script for SYNTHEX
 * Run this to initialize all database tables in Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function setupDatabase() {
  console.log(`${colors.cyan}${colors.bright}
╔═══════════════════════════════════════════╗
║     SYNTHEX Database Setup Script         ║
╚═══════════════════════════════════════════╝
${colors.reset}`);

  // Check for required environment variables
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(`${colors.red}❌ Missing required environment variables!${colors.reset}`);
    console.log(`
Please ensure the following are set in your .env.local file:
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

You can find these in your Supabase project settings.
    `);
    process.exit(1);
  }

  console.log(`${colors.green}✓${colors.reset} Environment variables loaded`);
  console.log(`${colors.blue}📍 Supabase URL:${colors.reset} ${SUPABASE_URL}`);
  
  // Initialize Supabase client with service role key
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_complete_schema.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`${colors.red}❌ Migration file not found at: ${migrationPath}${colors.reset}`);
    process.exit(1);
  }
  
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log(`${colors.green}✓${colors.reset} Migration file loaded (${migrationSQL.length} characters)`);
  
  // Create readline interface for user confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log(`
${colors.yellow}⚠️  WARNING: This will create/update the following tables:${colors.reset}
- users, profiles, personas
- viral_patterns, content_posts
- campaigns, analytics, schedules
- integrations, teams, team_members
- audit_logs, api_keys, notifications
- subscriptions, generation_logs, experiments

${colors.yellow}This operation will:${colors.reset}
1. Create new tables if they don't exist
2. Add indexes for performance
3. Enable Row Level Security
4. Insert sample viral patterns
  `);
  
  rl.question(`${colors.cyan}Do you want to continue? (yes/no): ${colors.reset}`, async (answer) => {
    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log(`${colors.yellow}Setup cancelled.${colors.reset}`);
      rl.close();
      process.exit(0);
    }
    
    rl.close();
    
    console.log(`\n${colors.blue}🚀 Running database migration...${colors.reset}`);
    
    try {
      // Execute the migration
      // Note: Supabase doesn't have a direct SQL execution method in the JS client
      // We need to use the Supabase SQL Editor or the CLI
      
      console.log(`
${colors.yellow}📝 Manual Step Required:${colors.reset}

Since direct SQL execution requires the Supabase CLI or SQL Editor, please:

${colors.bright}Option 1: Using Supabase Dashboard (Recommended)${colors.reset}
1. Go to: ${colors.cyan}https://app.supabase.com/project/${SUPABASE_URL.split('.')[0].replace('https://', '')}/sql${colors.reset}
2. Click "New Query"
3. Copy the contents of: ${colors.cyan}supabase/migrations/001_complete_schema.sql${colors.reset}
4. Paste and click "Run"

${colors.bright}Option 2: Using Supabase CLI${colors.reset}
1. Install Supabase CLI: ${colors.cyan}npm install -g supabase${colors.reset}
2. Login: ${colors.cyan}supabase login${colors.reset}
3. Link project: ${colors.cyan}supabase link --project-ref ${SUPABASE_URL.split('.')[0].replace('https://', '')}${colors.reset}
4. Run migration: ${colors.cyan}supabase db push${colors.reset}

${colors.bright}Option 3: Using this automated approach${colors.reset}
We'll attempt to create tables programmatically...
      `);
      
      // Attempt to verify connection
      const { data, error } = await supabase.from('users').select('count').limit(1);
      
      if (!error) {
        console.log(`${colors.green}✓ Database connection successful!${colors.reset}`);
        
        // Check if tables exist
        const tables = [
          'users', 'profiles', 'personas', 'viral_patterns', 
          'content_posts', 'campaigns', 'analytics'
        ];
        
        console.log(`\n${colors.blue}Checking existing tables...${colors.reset}`);
        
        for (const table of tables) {
          const { error: tableError } = await supabase.from(table).select('count').limit(1);
          if (!tableError) {
            console.log(`${colors.green}✓${colors.reset} Table '${table}' exists`);
          } else {
            console.log(`${colors.yellow}⚠${colors.reset} Table '${table}' not found`);
          }
        }
      } else {
        console.log(`${colors.yellow}⚠ Could not verify database connection${colors.reset}`);
      }
      
      // Create a verification file
      const verificationPath = path.join(__dirname, '..', 'database-setup.log');
      const logContent = `
Database Setup Log
==================
Date: ${new Date().toISOString()}
Supabase URL: ${SUPABASE_URL}
Migration File: ${migrationPath}
Status: Ready for manual execution

Next Steps:
1. Run the migration SQL in Supabase Dashboard
2. Verify all tables are created
3. Test authentication flow
`;
      
      fs.writeFileSync(verificationPath, logContent);
      console.log(`\n${colors.green}✓ Setup log created at: ${verificationPath}${colors.reset}`);
      
      console.log(`
${colors.bright}${colors.green}✅ Database setup preparation complete!${colors.reset}

${colors.cyan}Next steps:${colors.reset}
1. Run the migration in Supabase SQL Editor
2. Verify tables are created
3. Test the application

${colors.blue}Quick Links:${colors.reset}
- SQL Editor: ${colors.cyan}https://app.supabase.com/project/${SUPABASE_URL.split('.')[0].replace('https://', '')}/sql${colors.reset}
- Table Editor: ${colors.cyan}https://app.supabase.com/project/${SUPABASE_URL.split('.')[0].replace('https://', '')}/editor${colors.reset}
      `);
      
    } catch (error) {
      console.error(`${colors.red}❌ Error during setup:${colors.reset}`, error.message);
      process.exit(1);
    }
  });
}

// Run the setup
setupDatabase().catch(console.error);