import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function GET() {
  try {
    const results = {
      tables: {
        profiles: false,
        user_settings: false,
        social_integrations: false,
      },
      storage: {
        avatars_bucket: false,
      },
      test_operations: {
        can_read_profiles: false,
        can_read_settings: false,
        can_read_integrations: false,
      },
      errors: [] as string[],
    };

    // Check if tables exist
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      if (!profilesError) {
        results.tables.profiles = true;
      } else {
        results.errors.push(`Profiles table: ${profilesError.message}`);
      }
    } catch (e: any) {
      results.errors.push(`Profiles check: ${e.message}`);
    }

    try {
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('id')
        .limit(1);
      
      if (!settingsError) {
        results.tables.user_settings = true;
      } else {
        results.errors.push(`Settings table: ${settingsError.message}`);
      }
    } catch (e: any) {
      results.errors.push(`Settings check: ${e.message}`);
    }

    try {
      const { data: integrations, error: integrationsError } = await supabase
        .from('social_integrations')
        .select('id')
        .limit(1);
      
      if (!integrationsError) {
        results.tables.social_integrations = true;
      } else {
        results.errors.push(`Integrations table: ${integrationsError.message}`);
      }
    } catch (e: any) {
      results.errors.push(`Integrations check: ${e.message}`);
    }

    // Check storage bucket
    try {
      const { data: buckets, error: bucketsError } = await supabase
        .storage
        .listBuckets();
      
      if (!bucketsError && buckets) {
        results.storage.avatars_bucket = buckets.some(b => b.name === 'avatars');
        if (!results.storage.avatars_bucket) {
          // Try to create the bucket
          const { error: createError } = await supabase
            .storage
            .createBucket('avatars', { public: true });
          
          if (!createError) {
            results.storage.avatars_bucket = true;
          } else {
            results.errors.push(`Create avatars bucket: ${createError.message}`);
          }
        }
      }
    } catch (e: any) {
      results.errors.push(`Storage check: ${e.message}`);
    }

    // Test operations with a user session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      // Test profile read
      try {
        const { error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (!error || error.code === 'PGRST116') { // PGRST116 = no rows
          results.test_operations.can_read_profiles = true;
        }
      } catch (e: any) {
        results.errors.push(`Profile read test: ${e.message}`);
      }

      // Test settings read
      try {
        const { error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        
        if (!error || error.code === 'PGRST116') {
          results.test_operations.can_read_settings = true;
        }
      } catch (e: any) {
        results.errors.push(`Settings read test: ${e.message}`);
      }

      // Test integrations read
      try {
        const { error } = await supabase
          .from('social_integrations')
          .select('*')
          .eq('user_id', session.user.id);
        
        if (!error) {
          results.test_operations.can_read_integrations = true;
        }
      } catch (e: any) {
        results.errors.push(`Integrations read test: ${e.message}`);
      }
    }

    // Calculate overall status
    const allTablesExist = Object.values(results.tables).every(v => v);
    const storageReady = results.storage.avatars_bucket;
    const canPerformOperations = Object.values(results.test_operations).every(v => v);

    const overallStatus = allTablesExist && storageReady ? 'ready' : 'needs_setup';

    return NextResponse.json({
      status: overallStatus,
      message: overallStatus === 'ready' 
        ? '✅ Database is properly configured!' 
        : '⚠️ Database needs configuration. Please run the migration in Supabase SQL Editor.',
      results,
      migration_url: 'https://app.supabase.com/project/znyjoyjsvjotlzjppzal/sql/new',
      migration_file: 'supabase/migrations/20250113_create_user_tables.sql',
      session_user: session?.user?.email || 'Not logged in',
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to check database configuration',
      error: error.message,
    }, { status: 500 });
  }
}