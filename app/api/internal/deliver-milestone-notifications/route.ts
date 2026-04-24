/**
 * POST /api/internal/deliver-milestone-notifications
 *
 * Daily batch job (SYN-675) that:
 * 1. Finds undelivered milestone_events (email_sent_at IS NULL)
 * 2. For anniversary_1yr: inserts the milestone record if today is the org's
 *    1-year anniversary (via get_anniversary_orgs RPC) — then processes
 * 3. Resolves the primary contact email for each org
 * 4. Sends the milestone notification email via Resend
 * 5. Sets email_sent_at on the milestone_events row
 *
 * Feature flag: MILESTONE_NOTIFICATIONS_ENABLED=true required (defaults disabled).
 * Called by: supabase/functions/deliver-milestone-notifications (Deno cron proxy)
 * Auth:      CRON_SECRET bearer token
 * SYN-675
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import {
  sendMilestoneNotificationEmail,
  type MilestoneType,
} from '@/lib/email/milestone-notification-email';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

// ── Supabase admin singleton ──────────────────────────────────────────────────

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _admin;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve primary contact email for an organisation. */
async function resolveEmail(organizationId: string): Promise<string | null> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        businessOwners: {
          where: { isActive: true },
          include: { owner: { select: { email: true } } },
          take: 1,
        },
      },
    });
    return org?.businessOwners?.[0]?.owner?.email ?? null;
  } catch {
    return null;
  }
}

/** Fetch org name and created_at for milestone context. */
async function resolveOrg(
  organizationId: string
): Promise<{ name: string; createdAt: Date } | null> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, createdAt: true },
    });
    if (!org) return null;
    return { name: org.name, createdAt: new Date(org.createdAt) };
  } catch {
    return null;
  }
}

/** Count published posts for an org. */
async function countPublishedPosts(organizationId: string): Promise<number> {
  try {
    return await prisma.post.count({
      where: {
        deletedAt: null,
        status: 'published',
        campaign: { organizationId },
      },
    } as Parameters<typeof prisma.post.count>[0]);
  } catch {
    return 100; // default to threshold so email still sends
  }
}

/** Sum total reach for an org across all platform metrics. */
async function fetchTotalReach(organizationId: string): Promise<number> {
  try {
    const admin = getAdmin() as ReturnType<typeof createClient<any>>;
    const { data, error } = await admin
      .from('platform_metrics')
      .select(
        'reach, platform_posts!inner(connection_id, platform_connections!inner(organization_id))'
      )
      .eq(
        'platform_posts.platform_connections.organization_id',
        organizationId
      );

    if (error || !data) return 1000;
    return (data as { reach: number }[]).reduce(
      (sum, row) => sum + (row.reach ?? 0),
      0
    );
  } catch {
    return 1000;
  }
}

/**
 * Seed anniversary_1yr milestone events for orgs whose 1-year anniversary is today.
 * Uses the get_anniversary_orgs() RPC defined in the migration.
 */
async function seedAnniversaryMilestones(): Promise<void> {
  try {
    const admin = getAdmin() as ReturnType<typeof createClient<any>>;
    const { data, error } = await admin.rpc('get_anniversary_orgs');
    if (error || !data) return;

    for (const row of data as { organization_id: string }[]) {
      await admin
        .from('milestone_events')
        .insert({
          organization_id: row.organization_id,
          milestone_type: 'anniversary_1yr',
          triggered_at: new Date().toISOString(),
          metadata: { source: 'cron_anniversary_check' },
        })
        .select('id')
        // Silently ignore if already exists (unique constraint)
        .throwOnError();
    }
  } catch {
    // Non-fatal — anniversary seeding fails gracefully
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Feature flag guard (defaults off pending copy approval)
  if (process.env.MILESTONE_NOTIFICATIONS_ENABLED !== 'true') {
    return NextResponse.json({
      ok: true,
      message: 'MILESTONE_NOTIFICATIONS_ENABLED is not set — no emails sent',
    });
  }

  // Auth guard
  const auth = verifyCronRequest(req, 'DELIVER_MILESTONE_NOTIFICATIONS');
  if (!auth.ok) return auth.response;

  const admin = getAdmin() as ReturnType<typeof createClient<any>>;

  // Step 1: Seed anniversary milestones for today's anniversaries
  await seedAnniversaryMilestones();

  // Step 2: Fetch all pending milestone events (email_sent_at IS NULL)
  const { data: pending, error: fetchError } = await admin
    .from('milestone_events')
    .select('id, organization_id, milestone_type, triggered_at, metadata')
    .is('email_sent_at', null)
    .order('triggered_at', { ascending: true });

  if (fetchError) {
    console.error(
      '[deliver-milestone-notifications] Failed to fetch pending:',
      fetchError
    );
    return NextResponse.json(
      { error: 'Failed to fetch pending milestones' },
      { status: 500 }
    );
  }

  const events = (pending ?? []) as {
    id: string;
    organization_id: string;
    milestone_type: MilestoneType;
    triggered_at: string;
    metadata: Record<string, unknown> | null;
  }[];

  let delivered = 0;
  let skippedNoEmail = 0;
  let skippedNoOrg = 0;
  let errors = 0;

  for (const event of events) {
    try {
      // Resolve org
      const org = await resolveOrg(event.organization_id);
      if (!org) {
        skippedNoOrg++;
        continue;
      }

      // Resolve contact email
      const email = await resolveEmail(event.organization_id);
      if (!email) {
        skippedNoEmail++;
        continue;
      }

      // Build milestone-specific context
      let postCount: number | undefined;
      let joinDateLabel: string | undefined;
      let totalReach: number | undefined;

      switch (event.milestone_type) {
        case 'posts_100':
          postCount = await countPublishedPosts(event.organization_id);
          break;
        case 'anniversary_1yr':
          joinDateLabel = org.createdAt.toLocaleDateString('en-AU', {
            month: 'long',
            year: 'numeric',
          });
          break;
        case 'local_views_1000':
          totalReach = await fetchTotalReach(event.organization_id);
          break;
      }

      // Send email
      const { success, error: emailError } =
        await sendMilestoneNotificationEmail({
          to: email,
          businessName: org.name,
          milestoneType: event.milestone_type,
          postCount,
          joinDateLabel,
          totalReach,
          dashboardUrl: `${APP_URL}/dashboard`,
        });

      if (!success) {
        console.error(
          `[deliver-milestone-notifications] Email failed for ${event.organization_id} (${event.milestone_type}):`,
          emailError
        );
        errors++;
        continue;
      }

      // Mark as sent
      await admin
        .from('milestone_events')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', event.id);

      delivered++;
    } catch (err) {
      console.error(
        `[deliver-milestone-notifications] Unexpected error for event ${event.id}:`,
        err
      );
      errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    milestones_pending: events.length,
    delivered,
    skipped_no_email: skippedNoEmail,
    skipped_no_org: skippedNoOrg,
    errors,
  });
}
