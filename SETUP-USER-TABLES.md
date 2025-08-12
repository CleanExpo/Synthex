# Setting Up User Tables in Supabase

## Quick Setup

### Option 1: Run the Migration Script (Recommended)
```bash
node scripts/apply-migrations.js
```

### Option 2: Manual Setup in Supabase Dashboard

1. **Go to SQL Editor:**
   - Open: https://app.supabase.com/project/znyjoyjsvjotlzjppzal/sql/new
   - Or navigate to: Your Project → SQL Editor → New Query

2. **Copy and Run the Migration:**
   - Copy all content from: `supabase/migrations/20250113_create_user_tables.sql`
   - Paste into the SQL editor
   - Click "Run" or press Ctrl+Enter

3. **Verify Tables Were Created:**
   - Go to Table Editor
   - You should see these new tables:
     - `profiles`
     - `user_settings`
     - `social_integrations`

4. **Check Storage Bucket:**
   - Go to Storage
   - You should see an `avatars` bucket
   - If not, create it manually with public access

## What This Migration Does

### 1. **Profiles Table**
   - Stores user profile information (name, bio, company, etc.)
   - Linked to Supabase Auth users
   - Supports avatar URLs

### 2. **User Settings Table**
   - Stores notification preferences
   - Privacy settings
   - Theme and language preferences

### 3. **Social Integrations Table**
   - Stores OAuth tokens for social platforms
   - Tracks which platforms are connected
   - Secure token storage

### 4. **Avatar Storage Bucket**
   - Public bucket for user avatars
   - Automatic permissions based on user ID
   - 2MB file size limit enforced in code

### 5. **Row Level Security (RLS)**
   - Users can only access their own data
   - Automatic profile creation on signup
   - Secure by default

## Testing the Setup

1. **Test Profile Creation:**
   - Sign up a new user
   - Check if profile and settings are auto-created

2. **Test Avatar Upload:**
   - Go to Settings → Profile
   - Click "Change Avatar"
   - Upload an image (JPG, PNG, GIF, max 2MB)

3. **Test Settings Save:**
   - Change any setting
   - Click Save
   - Refresh page to verify persistence

4. **Test Social Connections:**
   - Click Connect on any platform
   - Note: Requires OAuth app credentials in .env

## Environment Variables Needed

Add these to your `.env` file for full functionality:

```env
# Required (you should already have these)
NEXT_PUBLIC_SUPABASE_URL=https://znyjoyjsvjotlzjppzal.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional - For Social Media OAuth
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret

LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret

INSTAGRAM_CLIENT_ID=your-instagram-client-id
INSTAGRAM_CLIENT_SECRET=your-instagram-client-secret

FACEBOOK_CLIENT_ID=your-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-facebook-client-secret

TIKTOK_CLIENT_KEY=your-tiktok-client-key
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret

# For Billing (Stripe)
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
```

## Troubleshooting

### If Tables Don't Create:
1. Check if they already exist in Table Editor
2. Run statements one by one in SQL Editor
3. Check Supabase logs for errors

### If Avatar Upload Fails:
1. Verify `avatars` bucket exists in Storage
2. Check bucket is set to public
3. Verify file size is under 2MB
4. Check file type is image (JPG, PNG, GIF)

### If Settings Don't Save:
1. Check browser console for errors
2. Verify user is authenticated
3. Check Network tab for API responses
4. Verify tables have correct RLS policies

## Next Steps

After setup is complete:

1. **Test all settings tabs:**
   - Profile Information ✓
   - Notifications ✓
   - Integrations ✓
   - Privacy ✓
   - Billing (needs Stripe setup)
   - Advanced ✓

2. **Set up OAuth Apps (Optional):**
   - Create apps on each platform
   - Add credentials to .env
   - Test connection flow

3. **Set up Stripe (For Billing):**
   - Create Stripe account
   - Add products and prices
   - Configure webhooks
   - Add Stripe keys to .env

## Support

If you encounter issues:
1. Check Supabase logs: Project → Logs → Recent Logs
2. Check browser console for JavaScript errors
3. Verify all environment variables are set
4. Contact: support@synthex.social