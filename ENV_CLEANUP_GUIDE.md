# 🧹 Environment Variables Cleanup Guide

## ❌ Variables to REMOVE (Not Used in Code)

The following variables in your current .env file are NOT being used and can be safely removed:

### Unused AI/API Keys
- `OPENROUTER_API_KEY` - Not referenced in code
- `OPENROUTER_BASE_URL` - Not referenced
- `OPENROUTER_SITE_URL` - Not referenced
- `OPENROUTER_SITE_NAME` - Not referenced
- `OPENROUTER_MODEL` - Not referenced
- `OPENAI_API_KEY` - Not referenced
- `ANTHROPIC_API_KEY` - Not referenced
- `GOOGLE_API_KEY` - Not referenced

### Unused Redis Configuration
- `REDIS_HOST` - Not referenced
- `REDIS_PORT` - Not referenced
- `REDIS_PASSWORD` - Not referenced
- `REDIS_USERNAME` - Not referenced
- `REDIS_URL` - Not referenced

### Unused OAuth Configuration
- `GOOGLE_CLIENT_ID` - Not referenced
- `GOOGLE_CLIENT_SECRET` - Not referenced
- `GOOGLE_CALLBACK_URL` - Not referenced
- `GOOGLE_PROJECT_NUMBER` - Not referenced
- `GOOGLE_PROJECT_ID` - Not referenced
- `GITHUB_CLIENT_ID` - Not referenced
- `GITHUB_CLIENT_SECRET` - Not referenced

### Unused Feature Flags & Settings
- All `ENABLE_*` flags - Not referenced
- All `TRACK_*` settings - Not referenced
- All rate limiting settings - Not referenced
- All budget/tier limits - Not referenced
- All platform API limits - Not referenced
- All internationalization settings - Not referenced
- All monitoring settings - Not referenced

### Unused Security/Session Variables
- `SESSION_SECRET` - Not referenced
- `API_KEY_SALT` - Not referenced
- `ADMIN_API_KEY` - Not referenced
- `CRON_SECRET` - Not referenced
- `CORS_ORIGIN` - Not referenced
- `NEXTAUTH_URL` - Not referenced
- `NEXTAUTH_SECRET` - Not referenced

## ✅ Variables Actually NEEDED

Based on code analysis, here are the ONLY environment variables your application currently uses:

### 1. **Core Configuration**
```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://synthex.social
```

### 2. **Supabase (Required)**
```env
NEXT_PUBLIC_SUPABASE_URL=https://znyjoyjsvjotlzjppzal.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. **Database (Required)**
```env
# CRITICAL: You MUST replace the password!
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.znyjoyjsvjotlzjppzal.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:YOUR_PASSWORD@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres
```

### 4. **Authentication (Required)**
```env
JWT_SECRET=your-secure-jwt-secret
```

### 5. **Email Service (Optional)**
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-key
EMAIL_FROM=noreply@synthex.social  # Optional
EMAIL_FROM_NAME=SYNTHEX            # Optional
```

## 🔧 How to Fix Your Database Connection

The reason you're getting database connection errors is because your DATABASE_URL has a placeholder password ("postgres"). Here's how to fix it:

### Step 1: Get Your Real Database Password

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project (znyjoyjsvjotlzjppzal)
3. Go to **Settings** → **Database**
4. Find **Connection string** section
5. Copy the password (it's the part after `postgres:` and before `@`)

### Step 2: Update Your .env File

Replace both DATABASE_URL and DIRECT_URL with your actual password:

```env
# Use connection pooler (port 6543) for DATABASE_URL
DATABASE_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.znyjoyjsvjotlzjppzal.supabase.co:6543/postgres?pgbouncer=true

# Use direct connection (port 5432) for DIRECT_URL
DIRECT_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres
```

### Step 3: Test the Connection

```bash
# This should work now
npx prisma db pull

# Then run migrations
npx prisma migrate deploy
```

## 📝 Clean .env File Template

I've created `.env.clean` with ONLY the variables you need. To use it:

```bash
# Backup your current .env
cp .env .env.backup

# Use the clean version
cp .env.clean .env

# Edit to add your database password and SendGrid key
nano .env
```

## 🚀 Deployment Checklist

1. ✅ Use `.env.clean` as your new .env file
2. ✅ Add your actual Supabase database password
3. ✅ Add your SendGrid API key (if using email)
4. ✅ Update these same variables in Vercel Dashboard
5. ✅ Test database connection locally
6. ✅ Deploy to production

## 💡 Summary

- **Current .env**: Has 100+ variables
- **Actually needed**: Only 9-10 variables
- **Main issue**: Wrong database password

The application was trying to use variables that don't exist in the code, causing confusion. The cleaned-up environment will be much easier to manage and debug.
