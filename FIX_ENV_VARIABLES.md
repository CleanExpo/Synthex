# 🚨 URGENT: Fix Environment Variables in Vercel

## The Problem
You've added the environment variables but used placeholder values like:
- `YOUR_PASSWORD` (should be your actual Supabase password)
- `your-32-character-secret-here` (should be actual random secrets)

This is causing the build to fail because Prisma can't connect to the database with these invalid values.

## 🔧 Immediate Fix Required

### 1. Get Your Actual Supabase Password

Go to: https://supabase.com/dashboard/project/znyjoyjsvjotlzjppzal/settings/database

Look for the section "Connection string" and find your database password. It will look something like:
- A long string of random characters
- Example format: `AbCd1234EfGh5678`

### 2. Generate Real Secret Keys

Run these commands in PowerShell to generate secure secrets:

```powershell
# Generate JWT_SECRET
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})

# Generate NEXTAUTH_SECRET  
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

Or use an online generator: https://generate-secret.vercel.app/32

### 3. Update Your Vercel Environment Variables

Go to: https://vercel.com/unite-group/synthex/settings/environment-variables

**DELETE the current incorrect variables and ADD them again with REAL values:**

```bash
# CORRECT FORMAT (replace with your actual values):

DATABASE_URL=postgresql://postgres.AbCd1234EfGh5678@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

DIRECT_URL=postgresql://postgres.AbCd1234EfGh5678@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres

JWT_SECRET=A8B2C4D6E8F0G2H4J6K8L0M2N4P6Q8R0

NEXTAUTH_SECRET=S2T4U6V8W0X2Y4Z6A8B0C2D4E6F8G0

NEXTAUTH_URL=https://synthex-unite-group.vercel.app

ENABLE_OAUTH=false

ENABLE_NOTIFICATIONS=false

ENABLE_MCP=false
```

### 4. Example of CORRECT Values

❌ **WRONG** (what you have now):
```
DATABASE_URL=postgresql://postgres.YOUR_PASSWORD@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
JWT_SECRET=your-32-character-secret-here
```

✅ **CORRECT** (what you need):
```
DATABASE_URL=postgresql://postgres.MyActualSupabasePassword123@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
JWT_SECRET=kL9mN3oP5qR7sT1uV2wX4yZ6aB8cD0eF
```

## 📋 Quick Checklist

1. [ ] Get your ACTUAL Supabase password from: https://supabase.com/dashboard/project/znyjoyjsvjotlzjppzal/settings/database
2. [ ] Generate 2 random 32-character secrets for JWT_SECRET and NEXTAUTH_SECRET
3. [ ] Delete the incorrect environment variables in Vercel
4. [ ] Add the environment variables again with REAL values
5. [ ] Click "Save" in Vercel
6. [ ] Redeploy with: `vercel --prod --force`

## 🔍 How to Verify Your Database Password

1. Go to Supabase dashboard: https://supabase.com/dashboard/project/znyjoyjsvjotlzjppzal/settings/database
2. Look for "Connection string" section
3. You'll see something like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres
   ```
4. The `[YOUR-PASSWORD]` part is what you need to use

## ⚠️ Important Notes

- The password is case-sensitive
- Don't include brackets or quotes around the values
- Make sure there are no spaces at the beginning or end of values
- The secrets should be random strings, not readable words

## 🚀 After Fixing

Once you've updated the environment variables with real values:

1. The current building deployment might fail - that's OK
2. Trigger a new deployment:
   ```bash
   vercel --prod --force
   ```
3. Monitor the deployment:
   ```bash
   vercel ls
   ```

The deployment should now succeed with the correct environment variables!
