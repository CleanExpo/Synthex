import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialize Supabase admin client (avoids build-time errors)
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Supabase configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }

    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
}

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(request: NextRequest) {
  // Verify this is a legitimate cron job request
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const timestamp = new Date().toISOString();
    const backupData: any = {
      timestamp,
      tables: {},
      statistics: {}
    };

    const supabase = getSupabaseAdmin();

    // Backup user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
    
    if (!profilesError) {
      backupData.tables.profiles = profiles;
      backupData.statistics.profileCount = profiles?.length || 0;
    }

    // Backup content posts
    const { data: posts, error: postsError } = await supabase
      .from('content_posts')
      .select('*');
    
    if (!postsError) {
      backupData.tables.content_posts = posts;
      backupData.statistics.postCount = posts?.length || 0;
    }

    // Backup campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*');
    
    if (!campaignsError) {
      backupData.tables.campaigns = campaigns;
      backupData.statistics.campaignCount = campaigns?.length || 0;
    }

    // Backup analytics events (last 30 days only to manage size)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: analytics, error: analyticsError } = await supabase
      .from('analytics_events')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString());
    
    if (!analyticsError) {
      backupData.tables.analytics_events = analytics;
      backupData.statistics.analyticsCount = analytics?.length || 0;
    }

    // Store backup metadata
    const backupMetadata = {
      id: crypto.randomUUID(),
      created_at: timestamp,
      type: 'scheduled',
      statistics: backupData.statistics,
      status: 'completed',
      size_bytes: JSON.stringify(backupData).length
    };

    // In production, you would:
    // 1. Upload to cloud storage (S3, Google Cloud Storage, etc.)
    // 2. Store metadata in a backups table
    // 3. Send notification on completion

    // For now, we'll create a backup record
    const { error: backupError } = await supabase
      .from('system_backups')
      .insert(backupMetadata);

    return NextResponse.json({
      success: true,
      backup: {
        id: backupMetadata.id,
        timestamp,
        statistics: backupData.statistics,
        size: `${(backupMetadata.size_bytes / 1024 / 1024).toFixed(2)} MB`
      }
    });

  } catch (error) {
    console.error('Backup failed:', error);
    return NextResponse.json(
      { error: 'Backup failed', details: error },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // Get backup history
    const { data: backups, error } = await supabase
      .from('system_backups')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // If table doesn't exist, return empty array
      return NextResponse.json({
        backups: [],
        message: 'No backups found'
      });
    }

    return NextResponse.json({
      backups: backups || [],
      count: backups?.length || 0,
      lastBackup: backups?.[0]?.created_at || null
    });

  } catch (error) {
    console.error('Failed to fetch backup history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch backup history' },
      { status: 500 }
    );
  }
}
// Node.js runtime required for Prisma
export const runtime = 'nodejs';
