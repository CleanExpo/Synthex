# 🚀 Synthex Deployment Guide

## Complete Deployment Instructions for Vercel

### Prerequisites
- GitHub account with repository access
- Vercel account (free tier works)
- Supabase account with project created
- (Optional) OpenAI/Anthropic API keys for AI features

---

## 📋 Step 1: Prepare Your Environment Variables

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Required Environment Variables:**
   ```env
   # Get from Supabase Dashboard > Settings > API
   NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
   SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]

   # Security (generate random strings)
   CRON_SECRET=[RANDOM-STRING-32-CHARS]
   ADMIN_API_KEY=[RANDOM-STRING-32-CHARS]

   # AI (optional but recommended)
   OPENAI_API_KEY=sk-proj-[YOUR-KEY]
   # OR
   ANTHROPIC_API_KEY=sk-ant-[YOUR-KEY]
   ```

---

## 🔗 Step 2: Connect to Vercel

### Method A: Using Vercel CLI (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy: Y
# - Which scope: [Your Account]
# - Link to existing project: N
# - Project name: synthex (or your choice)
# - Directory: ./
# - Override settings: N
```

### Method B: Using Vercel Dashboard

1. **Go to [vercel.com/new](https://vercel.com/new)**

2. **Import Git Repository:**
   - Click "Import" next to your GitHub repo
   - Select "CleanExpo/Synthex"

3. **Configure Project:**
   - Framework Preset: `Next.js`
   - Root Directory: `./`
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `.next` (auto-detected)

---

## 🔐 Step 3: Add Environment Variables in Vercel

1. **Navigate to:** Project Settings > Environment Variables

2. **Add each variable:**
   ```
   NEXT_PUBLIC_SUPABASE_URL         = [Your Supabase URL]
   NEXT_PUBLIC_SUPABASE_ANON_KEY    = [Your Anon Key]
   SUPABASE_SERVICE_ROLE_KEY        = [Your Service Role Key]
   CRON_SECRET                       = [Generate random string]
   ADMIN_API_KEY                     = [Generate random string]
   OPENAI_API_KEY                    = [Your OpenAI Key]
   ```

3. **Environment Selection:**
   - ✅ Production
   - ✅ Preview
   - ✅ Development

4. **Click "Save"**

---

## 🗄️ Step 4: Set Up Supabase Database

### Create Tables via Supabase Dashboard:

1. **Go to:** Supabase Dashboard > SQL Editor

2. **Run this SQL:**
```sql
-- Users table (extends auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Personas table
CREATE TABLE public.personas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  attributes JSONB,
  training_data JSONB,
  accuracy FLOAT DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Content table
CREATE TABLE public.content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES public.personas(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  status TEXT DEFAULT 'draft',
  scheduled_for TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Patterns table
CREATE TABLE public.patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  pattern_type TEXT,
  pattern_data JSONB,
  engagement_score FLOAT DEFAULT 0,
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  goals JSONB,
  status TEXT DEFAULT 'draft',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own personas" ON public.personas
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own content" ON public.content
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Patterns are viewable by all authenticated users" ON public.patterns
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage own campaigns" ON public.campaigns
  FOR ALL USING (auth.uid() = user_id);
```

3. **Enable Authentication:**
   - Go to Authentication > Providers
   - Enable Email/Password
   - (Optional) Enable Google OAuth
   - (Optional) Enable GitHub OAuth

---

## 🚀 Step 5: Deploy

### Initial Deployment:

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Vercel Auto-Deploy:**
   - Vercel automatically builds and deploys
   - Watch progress in Vercel Dashboard
   - Takes ~2-3 minutes

3. **Check Deployment:**
   - Visit: `https://[your-project].vercel.app`
   - Test login/signup functionality
   - Verify all pages load correctly

---

## ⚙️ Step 6: Configure Custom Domain (Optional)

1. **In Vercel Dashboard:**
   - Go to Settings > Domains
   - Add your domain: `synthex.ai`
   - Follow DNS configuration instructions

2. **DNS Settings:**
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com

   Type: A
   Name: @
   Value: 76.76.21.21
   ```

---

## 🔄 Step 7: Set Up Cron Jobs

The platform includes automatic pattern analysis every 6 hours.

1. **Vercel automatically detects** cron configuration from `vercel.json`

2. **To test manually:**
   ```bash
   curl -X POST https://[your-domain]/api/cron/analyze-patterns \
     -H "Authorization: Bearer [YOUR-CRON-SECRET]"
   ```

---

## 📊 Step 8: Monitor Your Deployment

### Vercel Dashboard Features:
- **Analytics:** View real-time traffic
- **Functions:** Monitor API performance
- **Logs:** Check error logs
- **Deployments:** View deployment history

### Recommended Monitoring:
1. Set up Vercel Analytics (free tier available)
2. Enable Vercel Speed Insights
3. Configure error notifications

---

## 🐛 Troubleshooting

### Common Issues:

1. **Build Fails:**
   ```bash
   # Check locally first
   npm run build
   
   # Fix any TypeScript errors
   npm run type-check
   ```

2. **Database Connection Issues:**
   - Verify Supabase URL and keys
   - Check RLS policies
   - Ensure tables are created

3. **Authentication Not Working:**
   - Verify environment variables
   - Check Supabase Auth settings
   - Ensure redirect URLs are configured

4. **API Routes Timeout:**
   - Check function duration in vercel.json
   - Optimize long-running operations
   - Consider using background jobs

---

## 📝 Post-Deployment Checklist

- [ ] All pages load without errors
- [ ] Authentication works (signup/login)
- [ ] Database operations work
- [ ] Content generation works (if AI keys added)
- [ ] Scheduling system displays correctly
- [ ] Pattern analyzer shows mock data
- [ ] Personas can be created
- [ ] Sandbox editor functions properly

---

## 🔧 Maintenance

### Regular Updates:
```bash
# Update dependencies
npm update

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Deploy updates
git push origin main
```

### Database Backups:
- Supabase automatically backs up daily
- Download backups from Dashboard > Settings > Backups

---

## 🆘 Support

### Resources:
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [GitHub Issues](https://github.com/CleanExpo/Synthex/issues)

### Environment Variables Reference:
```env
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Security
CRON_SECRET=
ADMIN_API_KEY=

# AI (Choose one)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Optional Social Media APIs
TWITTER_API_KEY=
LINKEDIN_CLIENT_ID=
INSTAGRAM_ACCESS_TOKEN=
FACEBOOK_APP_ID=
TIKTOK_CLIENT_KEY=
```

---

## ✅ Success!

Your Synthex platform should now be live at:
- **Production:** `https://[your-project].vercel.app`
- **Custom Domain:** `https://yourdomain.com` (if configured)

**Next Steps:**
1. Create your first persona
2. Analyze viral patterns
3. Generate AI content
4. Schedule posts
5. Monitor engagement

🎉 **Congratulations on deploying Synthex!**