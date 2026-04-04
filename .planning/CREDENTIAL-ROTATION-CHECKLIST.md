# CRITICAL: Credential Rotation Checklist

**Issue:** UNI-449
**Severity:** CRITICAL (CVSS 9.8)
**Date:** 2026-02-10
**Status:** In Progress

## Exposure Summary

The following credentials were committed to git history in multiple documentation files:
- `deploy-to-vercel.md`
- `VERCEL_ENV_CHECKLIST.md`
- `deploy-fix.ps1`
- `scripts/setup-vercel-env.sh`
- `FIX-DEPLOYMENT-ISSUES.md`
- `PRODUCTION_READY_STATUS.md`

---

## IMMEDIATE ACTIONS REQUIRED

### Priority 1: Critical (Rotate within 24 hours)

| Service | Credential | Dashboard URL | Status |
|---------|------------|---------------|--------|
| **Supabase** | SERVICE_ROLE_KEY | https://supabase.com/dashboard/project/znyjoyjsvjotlzjppzal/settings/api | [ ] |
| **Stripe** | sk_live_* | https://dashboard.stripe.com/apikeys | [ ] |
| **Anthropic** | sk-ant-api03-* | https://console.anthropic.com/settings/keys | [ ] |
| **OpenAI** | sk-proj-* | https://platform.openai.com/api-keys | [ ] |

### Priority 2: High (Rotate within 48 hours)

| Service | Credential | Dashboard URL | Status |
|---------|------------|---------------|--------|
| **OpenRouter** | sk-or-v1-* | https://openrouter.ai/keys | [ ] |
| **Google OAuth** | GOCSPX-* | https://console.cloud.google.com/apis/credentials | [ ] |
| **GitHub OAuth** | client_secret | https://github.com/settings/developers | [ ] |
| **Google API** | AIzaSy* | https://console.cloud.google.com/apis/credentials | [ ] |

### Priority 3: Medium (Rotate within 7 days)

| Service | Credential | Dashboard URL | Status |
|---------|------------|---------------|--------|
| **Resend** | re_* | https://resend.com/api-keys | [ ] |
| **SendGrid** | SG.* | https://app.sendgrid.com/settings/api_keys | [ ] |
| **Redis Cloud** | password | https://cloud.redis.io | [ ] |
| **Sentry** | DSN | https://sentry.io/settings/projects/ | [ ] |

### Priority 4: Regenerate Secrets

| Secret | Action | Status |
|--------|--------|--------|
| JWT_SECRET | Generate new 64-byte hex: `openssl rand -hex 64` | [ ] |
| SESSION_SECRET | Generate new 64-byte hex | [ ] |
| ENCRYPTION_KEY | Generate new 32-byte hex: `openssl rand -hex 32` | [ ] |
| NEXTAUTH_SECRET | Generate new base64: `openssl rand -base64 32` | [ ] |
| CRON_SECRET | Generate new: `openssl rand -base64 48` | [ ] |
| API_KEY_SALT | Generate new unique salt | [ ] |

---

## Git History Remediation

### Option A: BFG Repo-Cleaner (Recommended)

```bash
# 1. Clone fresh copy
git clone --mirror git@github.com:CleanExpo/Synthex.git synthex-mirror

# 2. Download BFG
# https://rtyley.github.io/bfg-repo-cleaner/

# 3. Remove secrets by pattern
java -jar bfg.jar --replace-text secrets.txt synthex-mirror

# 4. Clean and push
cd synthex-mirror
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

### Option B: git filter-repo

```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove sensitive files from history
git filter-repo --invert-paths --path deploy-to-vercel.md --path VERCEL_ENV_CHECKLIST.md --path deploy-fix.ps1 --path scripts/setup-vercel-env.sh --path FIX-DEPLOYMENT-ISSUES.md --path PRODUCTION_READY_STATUS.md
```

---

## Verification Steps

After rotation, verify:

1. [ ] All new keys work in Vercel production
2. [ ] Application can authenticate with Supabase
3. [ ] AI features work (OpenAI, Anthropic, OpenRouter)
4. [ ] OAuth login works (Google, GitHub)
5. [ ] Email sending works (Resend/SendGrid)
6. [ ] Stripe payments work
7. [ ] Redis caching works

---

## Update Vercel Environment Variables

After rotating keys, update in Vercel Dashboard:
https://vercel.com/unite-group/synthex/settings/environment-variables

---

## Post-Incident Actions

1. [ ] Document incident in security log
2. [ ] Review access logs for suspicious activity
3. [ ] Enable API key rotation reminders
4. [ ] Set up secret scanning in CI/CD
5. [ ] Review all team members with access

---

## Files Removed from Git Tracking

- [x] .env.production
- [x] deploy-to-vercel.md
- [x] VERCEL_ENV_CHECKLIST.md
- [x] deploy-fix.ps1
- [x] scripts/setup-vercel-env.sh
- [x] FIX-DEPLOYMENT-ISSUES.md
- [x] PRODUCTION_READY_STATUS.md

---

## Contact Information

- **Supabase Support:** support@supabase.io
- **Anthropic:** support@anthropic.com
- **OpenAI:** support@openai.com
- **Stripe:** https://support.stripe.com

---

**IMPORTANT:** Complete all Priority 1 rotations immediately. Exposed service role keys grant full database admin access.
