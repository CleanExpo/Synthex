# Onboarding Flow Setup Guide

## Issues Fixed

This guide addresses two issues you reported:

1. **Menu items not working when clicking signin icon** ✅ Fixed
2. **Users returned to signin instead of onboarding flow** ✅ Fixed

---

## What Was Wrong

### Issue 1: Dropdown Menu Not Working
**Problem:** The user profile dropdown menu (clicking the avatar icon) had menu items that weren't clickable.

**Solution:** Updated the dashboard layout to:
- Make Profile, Settings, and Billing menu items navigable with proper links
- Add logout functionality that clears auth tokens and redirects to login

**Files Modified:**
- `app/dashboard/layout.tsx` - Added Link components and logout handler

### Issue 2: Onboarding Redirect Not Working
**Problem:** After OAuth login, users were being sent back to signin instead of the onboarding flow.

**Root Cause:** The middleware onboarding check only looked for Supabase sessions, but OAuth logins use a custom `auth-token` cookie instead.

**Solution:** Updated the middleware to:
- Check for BOTH Supabase sessions AND custom auth tokens
- Parse JWT tokens to extract user ID when session is unavailable
- Properly redirect to `/onboarding` if `onboarding_completed` is false

**Files Modified:**
- `middleware.ts` - Enhanced onboarding redirect logic

### Issue 3: Missing Database Columns
**Problem:** The `profiles` table in Supabase might not have `onboarding_completed` column, causing the redirect check to fail silently.

**Solution:** Created a comprehensive SQL migration that:
- Creates the `profiles` table if it doesn't exist
- Adds `onboarding_completed` and `onboarding_completed_at` columns
- Sets up Row Level Security (RLS) policies
- Creates a trigger to auto-create profile entries when new users sign up

---

## Steps to Apply Fixes

### Step 1: Deploy Code Changes
The code fixes are already committed. Just redeploy to Vercel:

```bash
git push origin main
# Vercel will automatically deploy
```

Or trigger manual redeploy in Vercel dashboard.

### Step 2: Run Supabase Migration
This **MUST** be done manually in Supabase SQL Editor:

1. Go to your Supabase Project Dashboard
   - URL: https://supabase.com/dashboard/projects

2. Click on your Synthex project

3. Navigate to **SQL Editor** (left sidebar)

4. Click **New Query**

5. Open file: `database/migrations/supabase/add_onboarding_columns.sql`

6. Copy the entire contents

7. Paste into the SQL Editor

8. Click **Run** (green play button)

9. You should see success messages:
   ```
   CREATE TABLE
   ALTER TABLE
   CREATE INDEX
   ALTER TABLE
   CREATE POLICY
   CREATE FUNCTION
   CREATE TRIGGER
   ```

### Step 3: Test the Flow

1. **Clear browser cache/cookies** for your domain
   - Open DevTools (F12)
   - Application → Cookies → Delete all for your domain

2. **Logout completely** (if already logged in)
   - Click your avatar → Log out

3. **Test OAuth login:**
   - Go to login page
   - Click "Sign in with Google"
   - Complete Google OAuth flow
   - Should redirect to `/onboarding` (Step 1: Business Details)

4. **Test dropdown menu:**
   - Once on dashboard, click your avatar in top-right
   - Menu should appear with: Profile, Settings, Billing, Log out
   - Click menu items - they should navigate
   - Click Log out - should clear cookies and go to login page

---

## Manual User Setup (Optional)

If you have an existing user who should skip onboarding:

```sql
UPDATE public.profiles 
SET 
  onboarding_completed = true,
  onboarding_completed_at = NOW()
WHERE email = 'user@example.com';
```

---

## Troubleshooting

### Symptom: Still being sent to signin after OAuth

**Solution:**
1. Make sure migration was run successfully (Step 2 above)
2. Clear browser cookies completely
3. Restart your development server (or wait for Vercel redeploy)
4. Try logging in again

### Symptom: Dropdown menu still not working

**Solution:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh page (Ctrl+F5)
3. If still broken, check browser console (F12) for errors

### Symptom: Onboarding_completed column doesn't exist

**Solution:**
1. Run the SQL migration again, carefully checking for errors
2. Verify the migration ran successfully:
   ```sql
   -- Run this query in SQL Editor to check:
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name='profiles' 
   AND column_name='onboarding_completed';
   ```
   Should return one row.

---

## Architecture

### Auth Flow (After Fixes)

```
User Login (OAuth or Email)
    ↓
Google OAuth Callback
    ↓ Sets auth-token cookie
Redirect to /dashboard
    ↓
Middleware checks:
  - Is user authenticated? (session OR auth-token)
  - Has user completed onboarding?
    ↓
If NOT completed:
  Redirect to /onboarding
    ↓
If completed:
  Allow access to /dashboard
```

### Onboarding Flow (7 Steps)

```
Step 1: Business Identity
  - Business name
  - Website URL (optional)
  - ABN (optional)
  - Location (optional)
    ↓
Step 2: API Credentials
  - OpenAI, Anthropic, Google, OpenRouter API keys
    ↓
Step 3: Platform Connections
  - YouTube, Instagram, TikTok, X, Facebook, LinkedIn, etc.
    ↓
Step 4: Persona Setup
  - Persona name, tone, topics
    ↓
Step 5: Review Vetting Results
  - SEO, AEO, GEO, Social scores
    ↓
Step 6: Review & Launch
  - Summary of all settings
  - Confirm and save
    ↓
Onboarding Complete ✅
Set onboarding_completed = true
Redirect to /dashboard
```

---

## Files Changed

**Backend:**
- `middleware.ts` - Fixed onboarding redirect logic
- `database/migrations/supabase/add_onboarding_columns.sql` - New migration
- `database/migrations/supabase/README.md` - Migration instructions

**Frontend:**
- `app/dashboard/layout.tsx` - Fixed dropdown menu items

**No Prisma schema changes needed** - Using Supabase-managed profiles table.

---

## Questions?

If users are still experiencing issues after following these steps:

1. Check browser console for errors (F12)
2. Check Vercel logs for deployment issues
3. Verify Supabase SQL migration ran without errors
4. Ensure auth-token cookie is being set (check DevTools → Application → Cookies)

