# Deployment Blockers Resolution Guide

**Last Updated:** 2026-01-18
**Status:** Action Required

---

## Quick Summary

Two issues are blocking deployment:

| Issue | Root Cause | Quick Fix |
|-------|-----------|-----------|
| GitHub Actions Billing | Spending limit set to $0 | Set limit to $1 |
| Vercel Git Author | Email not linked to team | Use Deploy Hooks |

---

## Issue 1: GitHub Actions Billing

### Error Message
```
The job was not started because recent account payments have failed or your spending limit needs to be increased
```

### Why This Happens
Even for public repos with free Actions minutes, GitHub can block ALL Actions if:
- Spending limit is set to $0
- Payment method is invalid/expired
- Account has outstanding billing flags

### Resolution Options

#### Option A: Increase Spending Limit (Recommended - 2 minutes)

1. Go to: https://github.com/settings/billing/spending_limit
2. Under "Actions", change spending limit from `$0` to `$1`
3. Click "Update limit"

**Note:** This unlocks free-tier Actions. You won't be charged unless you exceed the free tier (unlikely for this project).

#### Option B: Update Payment Method

1. Go to: https://github.com/settings/billing/payment_information
2. Remove current payment method
3. Add a new/fresh credit card
4. Ensure card is valid and not expired

#### Option C: Contact GitHub Support

If options A/B don't work:
- URL: https://support.github.com/contact
- Request: Clear billing flags on your account
- Mention: Public repo, free tier Actions being blocked

---

## Issue 2: Vercel Team Permissions

### Error Message
```
Git author phill.mcgurk@gmail.com must have access to the team Team AGI on Vercel
```

### Why This Happens
Vercel's Git integration maps commit authors to team members. If the email isn't linked, deployments fail.

### Resolution Options

#### Option A: Deploy Hooks (Recommended - Works Immediately)

This bypasses Git author verification entirely.

**Step 1: Create Deploy Hook in Vercel**
1. Go to: https://vercel.com/team-agi/synthex/settings/git
2. Scroll to "Deploy Hooks"
3. Click "Create Hook"
4. Settings:
   - Name: `auto-deploy-main`
   - Branch: `main`
5. Copy the generated URL (save it securely!)

**Step 2: Configure GitHub Webhook**
1. Go to: https://github.com/CleanExpo/Synthex/settings/hooks
2. Click "Add webhook"
3. Settings:
   - Payload URL: (paste Deploy Hook URL from Step 1)
   - Content type: `application/json`
   - Secret: (leave empty)
   - SSL verification: Enabled
   - Events: Select "Just the push event"
4. Click "Add webhook"

**Step 3: Test**
```bash
# Manual test
curl -X POST "YOUR_DEPLOY_HOOK_URL"

# Or push a commit
git commit --allow-empty -m "test: trigger deployment"
git push origin main
```

#### Option B: Add User to Vercel Team

1. Have Team AGI admin go to: https://vercel.com/team-agi/settings/members
2. Click "Invite Member"
3. Enter: `phill.mcgurk@gmail.com`
4. Assign role: Member or Admin
5. User accepts invite via email link

#### Option C: Use Team-Scoped Token

1. Go to: https://vercel.com/account/tokens
2. Click "Create Token"
3. Settings:
   - Name: `synthex-deploy`
   - Scope: Select "Team AGI"
4. Copy token
5. Add to GitHub Secrets:
   - Name: `VERCEL_TOKEN`
   - Value: (paste token)
6. Use in deployment:
   ```bash
   npx vercel --prod --yes --token=$VERCEL_TOKEN
   ```

---

## Recommended Resolution Path

### Immediate Fix (5-10 minutes)

1. **Set up Vercel Deploy Hook** (Option A above)
   - Bypasses both GitHub Actions AND Vercel permissions
   - Works with free tier
   - No billing changes needed
   - Deployments trigger automatically on push

### Long-term Fix (When Convenient)

1. Fix GitHub Actions billing (set spending limit to $1)
2. Add user to Vercel team
3. Both CI/CD and direct Git push deployments work

---

## Verification Checklist

After implementing the fix:

### Test Deploy Hook
```bash
# 1. Manual trigger
curl -X POST "YOUR_DEPLOY_HOOK_URL"

# Expected: "Created" or similar success message
```

### Check Vercel Dashboard
1. Go to: https://vercel.com/team-agi/synthex
2. Click "Deployments" tab
3. Verify new deployment appears (status: Building → Ready)

### Test Git Push
```bash
# 2. Test with empty commit
git commit --allow-empty -m "test: verify deployment hook"
git push origin main

# 3. Check Vercel dashboard for new deployment
```

### Verify Production URL
1. Wait for deployment to complete (~2-3 minutes)
2. Check: https://synthex-omega.vercel.app
3. Confirm Phase 9 changes are live

---

## Troubleshooting

### Deploy Hook Not Triggering
- Verify webhook URL is correct
- Check GitHub webhook settings for delivery errors
- Ensure webhook is set to "push" events only

### Still Getting Permission Error
- Clear browser cache and retry
- Try incognito/private window
- Verify team membership in Vercel dashboard

### Deployment Fails After Trigger
- Check Vercel build logs for errors
- Verify environment variables are set
- Run `npm run build` locally to test

---

## Related Documentation

- [GitHub Actions Billing](https://docs.github.com/en/billing/managing-billing-for-github-actions)
- [Vercel Deploy Hooks](https://vercel.com/docs/deployments/deploy-hooks)
- [Vercel Team Management](https://vercel.com/docs/accounts/team-members-and-roles)

---

## Support Contacts

- **GitHub Support:** https://support.github.com/contact
- **Vercel Support:** https://vercel.com/help
- **Project Issues:** https://github.com/CleanExpo/Synthex/issues
