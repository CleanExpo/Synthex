# Supabase SQL Migrations

These SQL scripts must be run manually in the Supabase SQL Editor. They cannot be applied automatically by Prisma migrations.

## How to Apply

1. Go to your Supabase Project Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of the migration file
5. Paste into the SQL editor
6. Click **Run** to execute

## Migrations

### `add_onboarding_columns.sql`

Adds onboarding completion tracking to the `profiles` table:
- `onboarding_completed` (BOOLEAN) - Flag indicating if user completed onboarding
- `onboarding_completed_at` (TIMESTAMP) - Timestamp when onboarding was completed
- Index for efficient queries

**Required for:** Onboarding flow redirect in middleware to work properly

**Run this first** if users are being stuck on signin instead of progressing to onboarding.

## User Setup (Optional)

If you have an existing user you want to manually mark as having completed onboarding:

```sql
UPDATE public.profiles 
SET 
  onboarding_completed = true,
  onboarding_completed_at = NOW()
WHERE id = 'user-uuid-here';
```

## Troubleshooting

If users are stuck on signin or seeing redirect loops:

1. Run `add_onboarding_columns.sql` to add required columns
2. Restart your development server (or redeploy to Vercel)
3. Clear browser cookies for the domain
4. Try logging in again

The middleware will now check for onboarding completion and redirect properly.
