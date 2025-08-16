# 🔧 Database Connection Fix

## Problem
The Prisma migration is failing because the DATABASE_URL in your `.env` file has an incorrect password.

## Current (Incorrect) Configuration
```
DATABASE_URL=postgresql://postgres:postgres@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres
```

## How to Fix

### Step 1: Get Your Database Password from Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project (znyjoyjsvjotlzjppzal)
3. Go to **Settings** → **Database**
4. Find the **Connection string** section
5. Copy the password from the connection string (it will be after `postgres:` and before `@`)

### Step 2: Update Your .env File

Replace the DATABASE_URL and DIRECT_URL with your actual password:

```env
DATABASE_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres
```

### Step 3: Alternative - Use Supabase Connection Pooler

If direct connection doesn't work, use the pooler connection string:

```env
DATABASE_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.znyjoyjsvjotlzjppzal.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres
```

Note: Port 6543 is for the connection pooler, 5432 is for direct connections.

### Step 4: Update Vercel Environment Variables

After fixing locally, update the same variables in your Vercel dashboard:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your Synthex project
3. Go to **Settings** → **Environment Variables**
4. Update DATABASE_URL and DIRECT_URL with the correct password
5. Redeploy to apply changes

## Testing the Connection

After updating, test the connection:

```bash
# Test database connection
npx prisma db pull

# If successful, run migrations
npx prisma migrate deploy
```

## Common Issues

1. **Firewall/IP Restrictions**: Supabase may restrict connections. Check:
   - Settings → Database → Connection Pooling is enabled
   - Your IP is not blocked

2. **SSL Required**: If you get SSL errors, add `?sslmode=require`:
   ```
   DATABASE_URL=postgresql://postgres:PASSWORD@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres?sslmode=require
   ```

3. **Wrong Port**: 
   - Use port 5432 for direct connections
   - Use port 6543 for pooled connections

## SendGrid API Key

You also need to add your SendGrid API key to the .env file:
```env
SENDGRID_API_KEY=your_actual_sendgrid_api_key
EMAIL_PROVIDER=sendgrid
```

## Next Steps

Once database connection is working:
1. Run `npx prisma migrate deploy` to apply migrations
2. Test authentication at https://synthex.social/auth/register
3. Monitor for any errors in Vercel logs
