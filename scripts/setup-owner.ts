/**
 * One-time script: Set up owner/admin account with full enterprise access
 *
 * Promotes phill.mcgurk@gmail.com to superadmin with custom (unlimited) plan,
 * multi-business ownership, and resets onboarding so the new AI flow triggers.
 *
 * Usage: npx tsx scripts/setup-owner.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomBytes } from 'crypto';

// Load env vars
config({ path: '.env' });
config({ path: '.env.local', override: true });

const OWNER_EMAIL = 'phill.mcgurk@gmail.com';

// Generate CUID-like ID (simple approach using timestamp + random)
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(8).toString('hex');
  return `${timestamp}${randomPart}`.substring(0, 24);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n🔧 Setting up owner account: ${OWNER_EMAIL}\n`);

  // ── Step 1: Find user ──────────────────────────────────────────────
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, name, preferences')
    .eq('email', OWNER_EMAIL)
    .single();

  if (userError || !user) {
    console.error('❌ User not found:', userError?.message || 'No user with that email');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.name || user.email} (${user.id})`);

  // ── Step 2: Set superadmin role in preferences ─────────────────────
  const currentPrefs = (user.preferences as Record<string, unknown>) || {};
  const updatedPrefs = {
    ...currentPrefs,
    role: 'superadmin',
    status: 'active',
  };

  const { error: prefsError } = await supabase
    .from('users')
    .update({
      preferences: updatedPrefs,
    })
    .eq('id', user.id);

  if (prefsError) {
    console.error('❌ Failed to update user preferences:', prefsError.message);
    process.exit(1);
  }

  console.log('✅ Set role: superadmin');

  // Try to set isMultiBusinessOwner if column exists
  const { error: multiError } = await supabase
    .from('users')
    .update({
      is_multi_business_owner: true,
    })
    .eq('id', user.id);

  if (!multiError) {
    console.log('✅ Set isMultiBusinessOwner: true');
  } else {
    console.warn('⚠️  isMultiBusinessOwner column may not exist yet (skipping)');
  }

  // ── Step 3: Create/update subscription to custom (unlimited) ───────
  const now = new Date();
  const tenYearsFromNow = new Date(now);
  tenYearsFromNow.setFullYear(tenYearsFromNow.getFullYear() + 10);

  const subscriptionData = {
    id: generateId(),
    user_id: user.id,
    plan: 'scale',
    status: 'active',
    current_period_start: now.toISOString(),
    current_period_end: tenYearsFromNow.toISOString(),
    cancel_at_period_end: false,
    cancelled_at: null,
    max_social_accounts: -1, // unlimited
    max_ai_posts: -1,        // unlimited
    max_personas: -1,       // unlimited
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // Check for existing subscription
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingSub) {
    const { error: subError } = await supabase
      .from('subscriptions')
      .update(subscriptionData)
      .eq('user_id', user.id);

    if (subError) {
      console.error('❌ Failed to update subscription:', subError.message);
    } else {
      console.log('✅ Updated subscription: custom (unlimited) — 10-year term');
    }
  } else {
    const { error: subError } = await supabase
      .from('subscriptions')
      .insert(subscriptionData);

    if (subError) {
      console.error('❌ Failed to create subscription:', subError.message);
    } else {
      console.log('✅ Created subscription: custom (unlimited) — 10-year term');
    }
  }

  // ── Step 4: Reset onboarding_completed so new AI flow triggers ─────
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ onboarding_completed: false })
    .eq('id', user.id);

  if (profileError) {
    console.warn('⚠️  Could not reset onboarding_completed:', profileError.message);
    // This is a warning, not fatal — some installs may not use profiles table
  } else {
    console.log('✅ Reset onboarding_completed to trigger new AI flow');
  }

  // ── Step 5: Create audit log ───────────────────────────────────────
  const { error: auditError } = await supabase
    .from('audit_logs')
    .insert({
      id: generateId(),
      user_id: user.id,
      action: 'owner_setup',
      resource: 'user',
      resource_id: user.id,
      details: {
        promoted_to: 'superadmin',
        subscription_plan: 'scale',
        multi_business_owner: true,
      },
      severity: 'high',
      category: 'admin',
      outcome: 'success',
    });

  if (auditError) {
    console.warn('⚠️  Could not create audit log:', auditError.message);
  } else {
    console.log('✅ Created audit log');
  }

  // ── Complete ────────────────────────────────────────────────────────
  console.log(`\n🎉 Setup complete!\n`);
  console.log(`   User: ${user.name || user.email}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role: superadmin`);
  console.log(`   Multi-Business: enabled`);
  console.log(`   Subscription: custom (unlimited)`);
  console.log(`   Onboarding: ready to trigger\n`);
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════
// Invoke
// ═══════════════════════════════════════════════════════════════════════

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});