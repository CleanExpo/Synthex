# Database Setup Guide for SYNTHEX

## Current Status
- ✅ Authentication system is working with demo mode
- ✅ Prisma schema is properly defined
- ❌ Database connection is not configured
- ❌ Supabase project needs to be created or configured

## Option 1: Use Existing Supabase (Recommended)

### Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - Project name: `synthex`
   - Database password: (save this!)
   - Region: Choose closest to you
5. Click "Create new project"

### Step 2: Get Connection Details
Once project is created:
1. Go to Settings → Database
2. Copy the connection strings:
   - Connection string (for DATABASE_URL)
   - Direct connection string (for DIRECT_URL)

### Step 3: Update Environment Variables
Update `.env.local` with real values:
```env
# Database URLs from Supabase
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Supabase Keys (from Settings → API)
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[anon-key]"
SUPABASE_SERVICE_ROLE_KEY="[service-role-key]"
```

### Step 4: Push Schema to Database
```bash
# Push the Prisma schema to Supabase
npx prisma db push

# Generate Prisma Client
npx prisma generate

# (Optional) Seed the database
npx prisma db seed
```

## Option 2: Use Local PostgreSQL

### Step 1: Install PostgreSQL
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
- **Mac**: `brew install postgresql`
- **Linux**: `sudo apt-get install postgresql`

### Step 2: Create Database
```bash
# Access PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE synthex;

# Exit
\q
```

### Step 3: Update Environment Variables
Update `.env.local`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/synthex"
DIRECT_URL="postgresql://postgres:password@localhost:5432/synthex"

# For local dev, Supabase keys can be placeholders
NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-key"
```

### Step 4: Push Schema
```bash
npx prisma db push
npx prisma generate
```

## Option 3: Use a Free PostgreSQL Service

### Services to Consider:
1. **Neon** ([neon.tech](https://neon.tech))
   - Free tier: 0.5 GB storage
   - Serverless PostgreSQL
   - Great for development

2. **Aiven** ([aiven.io](https://aiven.io))
   - Free trial available
   - Managed PostgreSQL

3. **ElephantSQL** ([elephantsql.com](https://www.elephantsql.com))
   - Free tier: 20 MB
   - Good for testing

### Setup Steps:
1. Sign up for service
2. Create a PostgreSQL database
3. Copy connection string
4. Update `.env.local` with connection string
5. Run `npx prisma db push`

## Testing Database Connection

After setting up, test with:
```bash
# Test connection
npx prisma db pull

# If successful, you'll see:
# ✓ Introspected 13 models and wrote them to prisma/schema.prisma

# Open Prisma Studio to view data
npx prisma studio
```

## Next Steps After Database Setup

1. **Test Real User Registration:**
   ```bash
   # The signup endpoint should now work with real database
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'
   ```

2. **Verify Database Tables:**
   ```bash
   npx prisma studio
   # This opens a GUI to view your database tables
   ```

3. **Seed Initial Data (Optional):**
   Create `prisma/seed.js`:
   ```javascript
   const { PrismaClient } = require('@prisma/client');
   const bcrypt = require('bcryptjs');
   
   const prisma = new PrismaClient();
   
   async function main() {
     // Create test user
     const hashedPassword = await bcrypt.hash('test123', 10);
     await prisma.user.create({
       data: {
         email: 'test@synthex.com',
         password: hashedPassword,
         name: 'Test User',
         emailVerified: true
       }
     });
   }
   
   main()
     .catch(console.error)
     .finally(() => prisma.$disconnect());
   ```
   
   Then run: `npx prisma db seed`

## Environment Variables Checklist

Required for production:
- [ ] `DATABASE_URL` - PostgreSQL connection with pooling
- [ ] `DIRECT_URL` - Direct PostgreSQL connection
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep secret!)
- [ ] `JWT_SECRET` - For token generation
- [ ] `NEXTAUTH_URL` - Your production URL
- [ ] `NEXTAUTH_SECRET` - Random secret for NextAuth

## Common Issues & Solutions

### Issue: "Can't reach database server"
**Solution**: Check that your database URL is correct and the database is running

### Issue: "Invalid prisma.user invocation"
**Solution**: Run `npx prisma generate` to regenerate the Prisma Client

### Issue: "Relation does not exist"
**Solution**: Run `npx prisma db push` to create tables

### Issue: "Authentication failed"
**Solution**: Check database password in connection string

## Security Notes

⚠️ **NEVER commit `.env.local` to git**
⚠️ **Keep `SUPABASE_SERVICE_ROLE_KEY` secret**
⚠️ **Use different passwords for development and production**
⚠️ **Enable Row Level Security (RLS) in Supabase**

## Ready to Continue?

Once database is connected:
1. ✅ Real user registration will work
2. ✅ User data will persist
3. ✅ You can build real dashboards
4. ✅ Analytics can be tracked

The authentication system is already set up to work with the database once connected!