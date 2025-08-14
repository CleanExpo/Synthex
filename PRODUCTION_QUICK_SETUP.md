# 🚀 Synthex Production Quick Setup

## ⚡ Your Generated Secrets (SAVE THESE!)

```env
ENCRYPTION_KEY=9c17d99f4d5441b20b8e52a84a041be8
JWT_SECRET=0da255528b98ca4657bcc82f0d8343c6def0450cfa525988c1bf2cc0d9f9f842
NEXTAUTH_SECRET=2d114cc403607a4c9d3620a1f3a372b6417c34a22bd0b8d003038f6e9f7f4cc1
```

## 📋 Quick Steps

### 1. Supabase (10 minutes)
1. Create account at [supabase.com](https://supabase.com)
2. Create new project "synthex-production"
3. Go to SQL Editor → New Query
4. Run both migration files from `supabase/migrations/`
5. Copy credentials from Settings → API

### 2. Vercel Environment (5 minutes)
Add these to Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=<from-supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-supabase>
SUPABASE_SERVICE_ROLE_KEY=<from-supabase>
ENCRYPTION_KEY=9c17d99f4d5441b20b8e52a84a041be8
JWT_SECRET=0da255528b98ca4657bcc82f0d8343c6def0450cfa525988c1bf2cc0d9f9f842
NEXTAUTH_SECRET=2d114cc403607a4c9d3620a1f3a372b6417c34a22bd0b8d003038f6e9f7f4cc1
NEXTAUTH_URL=https://synthex.social
OPENROUTER_API_KEY=<your-key>
```

### 3. Deploy (1 minute)
```bash
git push origin main
```
Vercel auto-deploys from GitHub

### 4. Test
1. Visit https://synthex.social
2. Sign up for account
3. Go to /dashboard/integrations
4. Connect a test platform

## ✅ Success Checklist
- [ ] Supabase tables created
- [ ] Environment variables in Vercel
- [ ] Site loads with glassmorphic UI
- [ ] Can create user account
- [ ] Can connect integrations
- [ ] Credentials encrypted in database

## 🔥 Common Issues

**Auth not working?**
→ Check Supabase keys in Vercel

**Integrations not saving?**
→ Verify ENCRYPTION_KEY is set

**Site not loading?**
→ Check Vercel build logs

## 📞 Need Help?

1. Check `docs/PRODUCTION_SETUP_GUIDE.md` for detailed guide
2. Review `DEPLOYMENT_CHECKLIST.md` for all steps
3. Test locally with `.env.local.example`

---
*Keys generated: 2025-01-14*
*Keep this file secure!*