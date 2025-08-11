# 🔧 SUPABASE DATABASE SETUP GUIDE

## ⚠️ IMPORTANT: Run These SQL Scripts in Order

### Step 1: Create Tables (REQUIRED)
1. Go to: https://app.supabase.com
2. Open your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy ALL content from: `supabase/schema-step1-tables.sql`
6. Paste into the SQL editor
7. Click **Run** button
8. You should see: "Success. No rows returned"

### Step 2: Add Security & Sample Data (REQUIRED)
1. Still in SQL Editor, click **New Query**
2. Copy ALL content from: `supabase/schema-step2-rls.sql`
3. Paste into the SQL editor
4. Click **Run** button
5. You should see: "Schema setup complete!" message

## ✅ Verification Steps

After running both scripts, verify:

1. **Check Tables Exist:**
   - Go to **Table Editor** in Supabase
   - You should see these tables:
     - profiles
     - personas
     - content
     - campaigns
     - viral_patterns
     - scheduled_posts
     - analytics
     - And more...

2. **Check Sample Data:**
   - Click on `viral_patterns` table
   - You should see 6 sample patterns for different platforms

## 🧪 Test the Integration

### Test Authentication:
1. Visit: https://synthex-z06c5t9bb-unite-group.vercel.app
2. Click **Sign Up**
3. Create an account with email/password
4. Check Supabase: **Authentication** > **Users** - your user should appear

### Test Content Generation:
1. Login to the dashboard
2. Navigate to **Content** section
3. Enter a topic (e.g., "AI marketing tips")
4. Click **Generate**
5. The AI will create content using OpenRouter

## 🔍 Troubleshooting

### If you get "column user_id does not exist" error:
- Make sure you ran Step 1 (tables) BEFORE Step 2 (RLS)
- The tables must exist before we can create policies

### If authentication doesn't work:
1. Check **Authentication** > **Providers** in Supabase
2. Enable **Email** provider if not enabled
3. Check your site URL is added to **Authentication** > **URL Configuration**

### If content generation fails:
1. Check the browser console for errors
2. Verify OpenRouter API key in Vercel environment variables:
   - Go to Vercel Dashboard
   - Project Settings > Environment Variables
   - Add: `OPENROUTER_API_KEY` with your key

## 📊 Database Schema Overview

**Core Tables:**
- `profiles` - User accounts and settings
- `personas` - AI voice personalities
- `content` - Generated social media content
- `campaigns` - Marketing campaigns
- `viral_patterns` - Trending content patterns
- `scheduled_posts` - Post scheduling queue
- `analytics` - Performance metrics

**Security:**
- Row Level Security (RLS) enabled
- Users can only see/edit their own data
- Viral patterns are public read

## 🎉 Success Checklist

- [ ] Ran schema-step1-tables.sql
- [ ] Ran schema-step2-rls.sql
- [ ] Verified tables in Table Editor
- [ ] Created a test user account
- [ ] Generated test content
- [ ] Checked viral patterns table has data

## 🚀 Your App is Ready!

Once both SQL scripts are run successfully, your SYNTHEX application is fully operational with:
- ✅ User authentication
- ✅ AI content generation
- ✅ Data persistence
- ✅ Security policies
- ✅ Sample viral patterns

Visit your live app: https://synthex-z06c5t9bb-unite-group.vercel.app