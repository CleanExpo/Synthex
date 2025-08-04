# Supabase Environment Variables Setup

## Required Supabase Environment Variables

Based on your Supabase project, you'll need these environment variables:

### 1. Supabase Project Settings
Get these from your Supabase Dashboard → Project Settings → API:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Database URL (from Supabase Dashboard → Settings → Database)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres
POSTGRES_URL_NON_POOLING=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1

# Optional: Direct database connection
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 2. How to Find Your Keys:

#### NEXT_PUBLIC_SUPABASE_ANON_KEY:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy the **"anon" "public"** key

#### NEXT_PUBLIC_SUPABASE_URL:
1. Same location as above
2. Copy the **Project URL**

#### DATABASE_URL:
1. Go to Settings → Database
2. Copy the **Connection string** 
3. Replace `[YOUR-PASSWORD]` with your actual database password

### 3. Update Your Vercel Environment Variables:

Add these to your Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
- `DATABASE_URL`
- `POSTGRES_URL_NON_POOLING`

### 4. For Local Development:

Add to your `.env` file:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres
POSTGRES_URL_NON_POOLING=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1
```

## Current Project Setup:

Your project uses:
- **Prisma ORM** for database operations
- **PostgreSQL** (hosted on Supabase)
- **JWT authentication** for user sessions

The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is needed for client-side database operations and real-time subscriptions.

---

**After adding these variables, redeploy your Vercel project for the changes to take effect.**