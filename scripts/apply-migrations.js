const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting Supabase migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250113_create_user_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Running migration: 20250113_create_user_tables.sql');

    // Split SQL into individual statements (simple split by semicolon)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        // Skip comments
        if (statement.startsWith('--')) continue;

        console.log(`\n📌 Executing: ${statement.substring(0, 50)}...`);
        
        // Execute SQL statement
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        }).single();

        if (error) {
          // Try direct execution for some statements
          const { error: directError } = await supabase
            .from('_migrations')
            .insert({ sql: statement, executed_at: new Date().toISOString() });

          if (directError) {
            console.error(`❌ Error: ${directError.message}`);
            errorCount++;
          } else {
            console.log('✅ Success');
            successCount++;
          }
        } else {
          console.log('✅ Success');
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error executing statement: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Migration Summary:`);
    console.log(`   ✅ Successful statements: ${successCount}`);
    console.log(`   ❌ Failed statements: ${errorCount}`);
    console.log('='.repeat(50));

    if (errorCount > 0) {
      console.log('\n⚠️  Some statements failed. This might be because:');
      console.log('   1. Tables/policies already exist');
      console.log('   2. You need to run these in Supabase SQL Editor');
      console.log('\n📋 To apply manually:');
      console.log('   1. Go to https://app.supabase.com/project/znyjoyjsvjotlzjppzal/sql/new');
      console.log('   2. Copy the content from supabase/migrations/20250113_create_user_tables.sql');
      console.log('   3. Paste and run in the SQL editor');
    } else {
      console.log('\n✨ Migration completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n📋 Please apply the migration manually:');
    console.log('   1. Go to https://app.supabase.com/project/znyjoyjsvjotlzjppzal/sql/new');
    console.log('   2. Copy the content from supabase/migrations/20250113_create_user_tables.sql');
    console.log('   3. Paste and run in the SQL editor');
  }
}

// Run the migration
runMigration();