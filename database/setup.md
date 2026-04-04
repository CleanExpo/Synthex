# Supabase Database Setup Guide

## Quick Setup Instructions

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for project initialization (2-3 minutes)

### 2. Run Database Schema
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `schema.sql`
3. Click "RUN" to execute the schema

### 3. Get Your Credentials
From your Supabase project dashboard:

```
Project URL: https://[your-project-id].supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Update Environment Variables

Add to your `.env.local` (development):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
DATABASE_URL=postgresql://postgres:[password]@db.your-project-id.supabase.co:5432/postgres
```

Add to Vercel Environment Variables (production):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

### 5. Enable Authentication
1. Go to Authentication → Settings
2. Enable Email authentication
3. Set Site URL to `https://synthex.social`
4. Add redirect URLs:
   - `https://synthex.social/auth/callback`
   - `http://localhost:3000/auth/callback` (for development)

### 6. Configure Storage
The schema automatically creates storage buckets:
- `avatars` - For user profile pictures
- `content-media` - For content images/videos

### 7. Test Connection
Use the health check endpoint:
```
GET https://synthex.social/api/health?detailed=true
```

Should show database status as "connected".

## Database Schema Overview

### Core Tables:
- `profiles` - Extended user data
- `optimized_content` - Saved optimizer results
- `campaigns` - Marketing campaigns
- `analytics` - Usage and performance tracking

### Security Features:
- Row Level Security (RLS) enabled
- User can only access their own data
- Automatic profile creation on signup
- Secure storage policies

### Indexes:
- Optimized for common queries
- User-based filtering
- Time-based analytics queries

## Optional: Sample Data

After setup, you can populate with test data:

```sql
-- Insert sample content (replace user_id with actual user ID)
INSERT INTO optimized_content (user_id, platform, original_content, optimized_content, score, hashtags, suggestions)
VALUES 
('user-id-here', 'instagram', 'Check out our new product!', 'Check out our amazing new product! 🚀✨ What do you think? #newproduct #innovation #startup', 85, ARRAY['#newproduct', '#innovation', '#startup'], ARRAY['Great content! Consider adding more emojis for engagement']);
```

## Troubleshooting

### Connection Issues:
1. Check environment variables are correct
2. Verify Supabase project is active
3. Test with simple query in SQL Editor

### RLS Issues:
1. Ensure user is authenticated
2. Check policy conditions match your use case
3. Use service role key for admin operations

### Performance Issues:
1. Check if indexes are created
2. Monitor query performance in Dashboard
3. Consider adding more specific indexes

## Next Steps
After database setup:
1. Update authentication flow
2. Test user registration
3. Test content saving/loading
4. Enable real-time features