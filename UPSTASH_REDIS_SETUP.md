# 🚀 Upstash Redis Setup Guide for SYNTHEX

## 📋 Table of Contents
1. [Create Upstash Account](#1-create-upstash-account)
2. [Create Redis Database](#2-create-redis-database)
3. [Get Connection Credentials](#3-get-connection-credentials)
4. [Configure Vercel Environment Variables](#4-configure-vercel-environment-variables)
5. [Update Application Code](#5-update-application-code)
6. [Test the Connection](#6-test-the-connection)
7. [Deploy to Production](#7-deploy-to-production)

---

## 1. Create Upstash Account

### Steps:
1. **Go to Upstash**: https://upstash.com
2. **Click "Sign Up"** (top right)
3. **Sign up with GitHub** (recommended for easy integration)
   - Or use email/password
4. **Verify your email** if needed

---

## 2. Create Redis Database

### Steps:
1. **From Upstash Console**: Click **"Create Database"**
2. **Configure your database**:
   ```
   Name: synthex-production
   Type: Regional (for better performance)
   Region: US-East-1 (or closest to your Vercel region)
   ```
3. **Select Plan**: 
   - **Free Plan** includes:
     - 10,000 commands daily
     - 256 MB storage
     - Perfect for starting out
4. **Click "Create"**

### Your Dashboard Should Show:
```
Database Name: synthex-production
Region: us-east-1
Type: Regional
State: Active ✅
```

---

## 3. Get Connection Credentials

### Steps:
1. **Click on your database** (synthex-production)
2. **Go to "REST API" tab**
3. **Copy these values**:

```bash
# You'll see something like this:
UPSTASH_REDIS_REST_URL=https://us1-xxxxx-xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AX_xASQgODU4ODUyODExOTcwLTUyxxxxxxxxxxxxxx
```

4. **IMPORTANT**: Also copy from "Node.js" tab:
```bash
# Traditional connection (backup)
REDIS_URL=redis://default:xxxxxx@us1-xxxxx-xxxxx.upstash.io:6379
```

### Save These Securely!
Create a temporary file locally (DELETE AFTER SETUP):
```bash
# temp-redis-creds.txt
UPSTASH_REDIS_REST_URL=https://your-actual-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-actual-token
REDIS_URL=redis://your-actual-redis-url
```

---

## 4. Configure Vercel Environment Variables

### Option A: Via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project**: `synthex`
3. **Go to Settings** → **Environment Variables**
4. **Add each variable**:

   #### Variable 1:
   ```
   Key: UPSTASH_REDIS_REST_URL
   Value: [paste your URL from Upstash]
   Environment: ✅ Production ✅ Preview ✅ Development
   ```
   Click **"Save"**

   #### Variable 2:
   ```
   Key: UPSTASH_REDIS_REST_TOKEN
   Value: [paste your token from Upstash]
   Environment: ✅ Production ✅ Preview ✅ Development
   ```
   Click **"Save"**

   #### Variable 3 (Optional Backup):
   ```
   Key: REDIS_URL
   Value: [paste your redis:// URL]
   Environment: ✅ Production ✅ Preview ✅ Development
   ```
   Click **"Save"**

### Option B: Via Vercel CLI

```bash
# Set for production
vercel env add UPSTASH_REDIS_REST_URL production
# Paste your URL when prompted

vercel env add UPSTASH_REDIS_REST_TOKEN production
# Paste your token when prompted

vercel env add REDIS_URL production
# Paste your redis URL when prompted
```

### Option C: Via Supabase Integration (If you have it)

Since you have Supabase integration, you can also add these through Supabase:
1. Go to Supabase Dashboard → Project Settings → Secrets
2. Add the same environment variables there
3. They'll sync to Vercel automatically

---

## 5. Update Application Code

### Step 1: Update Local .env.local (for testing)

Add to your `.env.local` file:
```bash
# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
REDIS_URL=redis://your-redis-url
```

### Step 2: Replace Current Middleware

```bash
# Backup current middleware
cp middleware.ts middleware.backup.ts

# Use Upstash-compatible middleware
cp middleware-upstash.ts middleware.ts
```

Or manually in the file:

### Step 3: Update Rate Limiting to Use Upstash

In `lib/rate-limit.ts`, add at the top:
```typescript
// Check if Upstash is configured
const USE_UPSTASH = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

if (USE_UPSTASH) {
  console.log('✅ Using Upstash Redis for rate limiting');
} else {
  console.log('⚠️ Using in-memory rate limiting (not recommended for production)');
}
```

---

## 6. Test the Connection

### Create Test Script

Create `test-redis.js`:
```javascript
// test-redis.js
async function testUpstashConnection() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.error('❌ Upstash credentials not found in environment variables');
    return;
  }
  
  try {
    // Test SET command
    const setResponse = await fetch(`${url}/set/test-key/test-value`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!setResponse.ok) {
      throw new Error(`SET failed: ${setResponse.statusText}`);
    }
    
    // Test GET command
    const getResponse = await fetch(`${url}/get/test-key`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!getResponse.ok) {
      throw new Error(`GET failed: ${getResponse.statusText}`);
    }
    
    const data = await getResponse.json();
    
    if (data.result === 'test-value') {
      console.log('✅ Upstash Redis connection successful!');
      console.log('✅ SET and GET operations working');
      
      // Cleanup
      await fetch(`${url}/del/test-key`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Cleanup completed');
    } else {
      console.error('❌ Value mismatch:', data.result);
    }
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

// Load env vars
require('dotenv').config({ path: '.env.local' });
testUpstashConnection();
```

### Run Test:
```bash
node test-redis.js
```

Expected output:
```
✅ Upstash Redis connection successful!
✅ SET and GET operations working
✅ Cleanup completed
```

---

## 7. Deploy to Production

### Step 1: Verify Environment Variables in Vercel

```bash
# Check that variables are set
vercel env ls

# Should see:
# UPSTASH_REDIS_REST_URL
# UPSTASH_REDIS_REST_TOKEN
# REDIS_URL
```

### Step 2: Deploy

```bash
# Deploy to production
vercel --prod

# Or with force flag if needed
vercel --prod --force
```

### Step 3: Verify Deployment

1. **Check Build Logs**: Look for:
   ```
   ✅ Using Upstash Redis for rate limiting
   ```

2. **Test Rate Limiting**: 
   ```bash
   # Test API rate limiting
   for i in {1..10}; do
     curl -X GET https://synthex.vercel.app/api/health
     echo ""
   done
   ```

3. **Check Upstash Dashboard**:
   - Go to Upstash Console
   - Click on your database
   - Check "Metrics" tab
   - You should see commands being executed

---

## 📊 Monitoring & Maintenance

### Upstash Dashboard Features:
1. **Metrics**: View commands, bandwidth, storage
2. **Data Browser**: Inspect stored keys
3. **CLI**: Execute Redis commands directly
4. **Logs**: View recent operations

### Daily Limits (Free Tier):
- **10,000 commands/day**: Sufficient for ~400 users/day
- **256 MB storage**: Thousands of sessions
- **Upgrade when needed**: Pay-as-you-go pricing

### Monitoring Commands:
```bash
# Check Redis stats from Upstash CLI
DBSIZE  # Number of keys
INFO    # Server information
PING    # Connection test
```

---

## 🔧 Troubleshooting

### Issue: "Connection refused"
```bash
# Solution: Check environment variables
vercel env pull .env.local
# Verify UPSTASH_REDIS_REST_URL and token are present
```

### Issue: "Rate limit not working"
```bash
# Solution: Ensure middleware.ts is using Upstash version
cp middleware-upstash.ts middleware.ts
git add middleware.ts
git commit -m "Use Upstash Redis middleware"
git push
vercel --prod
```

### Issue: "Unauthorized" errors
```bash
# Solution: Token might be incorrect
# 1. Go to Upstash dashboard
# 2. Click "Show" next to REST Token
# 3. Copy entire token (it's long!)
# 4. Update in Vercel dashboard
```

---

## ✅ Success Checklist

- [ ] Upstash account created
- [ ] Redis database created (free tier)
- [ ] REST URL copied
- [ ] REST Token copied
- [ ] Environment variables added to Vercel
- [ ] Local .env.local updated
- [ ] Test script runs successfully
- [ ] Middleware updated to use Upstash
- [ ] Deployed to production
- [ ] Rate limiting working
- [ ] Monitoring set up

---

## 🎉 Congratulations!

Your Redis is now properly configured for serverless deployment!

### What You Get:
- ✅ **Persistent rate limiting** across all serverless functions
- ✅ **Session management** that survives function cold starts
- ✅ **Caching** for improved performance
- ✅ **Real-time features** ready when needed
- ✅ **Automatic scaling** with Vercel

### Next Steps:
1. Monitor usage in Upstash dashboard
2. Set up alerts for limits
3. Consider paid plan when you exceed free tier
4. Implement caching for expensive operations

---

## 📚 Additional Resources

- **Upstash Docs**: https://docs.upstash.com/redis
- **Vercel + Upstash Guide**: https://vercel.com/guides/using-upstash-redis
- **Redis Commands**: https://redis.io/commands
- **Support**: https://upstash.com/discord

---

*Last Updated: 2025-08-15*
*Tested with: Upstash Redis, Next.js 14.2.31, Vercel*