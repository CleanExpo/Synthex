# 🔄 Complete Deployment Reset Guide for SYNTHEX

## Step 1: Clean DNS Configuration ✅

### DELETE ALL existing DNS records for synthex.social:
1. Go to your DNS provider
2. Delete ALL records:
   - Delete the A record (76.76.21.21)
   - Delete ALL CNAME records
   - Delete ALL ALIAS records
   - Delete the MX record
   - Delete the TXT records (keep only essential ones like domain verification)
   - Delete the CAA record

### ADD ONLY these records:

#### For Root Domain (synthex.social):
```
Type: A
Name: @ (or leave blank)
Value: 76.76.21.21
TTL: Auto or 3600
```

#### For WWW (optional but recommended):
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: Auto or 3600
```

That's it for DNS! Keep it simple.

---

## Step 2: Fix Vercel Project ✅

### In Terminal, run these commands:

```bash
# 1. Remove old Vercel link
rm -rf .vercel

# 2. Link to Vercel fresh
vercel link

# When prompted:
# - Set up and deploy: Y
# - Which scope: Choose your account
# - Link to existing project? N
# - What's your project name? synthex
# - In which directory is your code? ./
```

---

## Step 3: Deploy Fresh Build ✅

```bash
# 1. Clean everything
rm -rf .next node_modules package-lock.json

# 2. Fresh install
npm install

# 3. Build locally to test
npm run build

# 4. If build succeeds, deploy
vercel --prod
```

---

## Step 4: Add Domain in Vercel Dashboard ✅

1. Go to https://vercel.com/dashboard
2. Click on your `synthex` project
3. Go to **Settings** → **Domains**
4. Click **Add Domain**
5. Enter `synthex.social`
6. Follow the verification steps

---

## Step 5: Environment Variables ✅

Make sure these are set in Vercel Dashboard (Settings → Environment Variables):

### Required (MUST HAVE):
```
NEXT_PUBLIC_SUPABASE_URL=your_value
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_value
DATABASE_URL=your_value
JWT_SECRET=your_value
OPENROUTER_API_KEY=your_value
```

### For Redis (if using):
```
REDIS_URL=your_redis_url
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
REDIS_PASSWORD=your_redis_password
```

---

## Step 6: Quick Fix Script ✅

Save this as `reset-deployment.sh` and run it:

```bash
#!/bin/bash

echo "🔄 Resetting SYNTHEX Deployment..."

# Clean
echo "Cleaning old files..."
rm -rf .next .vercel node_modules package-lock.json

# Install
echo "Installing dependencies..."
npm install

# Build test
echo "Testing build..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "Deploying to Vercel..."
    vercel --prod --yes
else
    echo "❌ Build failed. Fix errors before deploying."
    exit 1
fi

echo "🎉 Deployment complete!"
echo "Check your domain in 5-10 minutes at: https://synthex.social"
```

---

## Common Issues & Solutions:

### Issue: "Domain already assigned to another project"
**Solution:** This happens when the domain is linked to another Vercel project. You need to:
1. Log into Vercel Dashboard
2. Find the OLD project using this domain
3. Remove the domain from that project
4. Add it to your current project

### Issue: "Build fails with module errors"
**Solution:** The build is currently working locally. If it fails on Vercel:
```bash
# Add this to package.json scripts:
"vercel-build": "npm run build"
```

### Issue: "Site shows Vercel 404"
**Solution:** This means DNS is working but deployment failed. Check:
1. Build logs in Vercel dashboard
2. Environment variables are set
3. The deployment actually completed

---

## Verification Checklist:

- [ ] DNS records cleaned and simplified (only A record for @)
- [ ] Vercel project linked fresh
- [ ] Build succeeds locally
- [ ] Environment variables set in Vercel
- [ ] Domain added in Vercel dashboard
- [ ] Deployment shows "Ready" in Vercel

---

## Expected Timeline:

1. **DNS Changes:** 5 minutes - 2 hours to propagate
2. **SSL Certificate:** Auto-provisions once DNS is correct (5-10 minutes)
3. **First Deployment:** 3-5 minutes
4. **Site Live:** Should be accessible within 15 minutes total

---

## Test Your Domain:

```bash
# Check DNS propagation
nslookup synthex.social

# Should return:
# Address: 76.76.21.21

# Check if site is live
curl -I https://synthex.social

# Should return:
# HTTP/2 200 (or 308 redirect)
```

---

## 🚨 IMPORTANT: Start with DNS first! 
Delete ALL records and add only the A record. This will eliminate any conflicts.