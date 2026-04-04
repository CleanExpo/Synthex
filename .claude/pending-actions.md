# Pending Actions

Actions Claude Code cannot perform autonomously due to environment constraints.
Check this file at session start. Remove entries once actioned.

---

## Pending: npx prisma db push
**Added:** 2026-03-01

**Reason:** New schema fields added in onboarding sprint (UNI-1186 to UNI-1189) cannot be pushed from localhost due to Supabase direct connection (IPv6 block).

**Required before:** Onboarding flow will silently fail on save without these columns.

### New fields added:
- `User.openaiApiKey` (String?)
- `User.geminiApiKey` (String?)
- `OnboardingProgress.auditData` (Json?)
- `OnboardingProgress.goalsData` (Json?)
- `OnboardingProgress.postingMode` (String?)
- `OnboardingProgress.socialProfileUrls` (Json?)

### How to run:

**Option A — From Vercel build hook (recommended):**
Add `npx prisma db push` to your Vercel build command:
```
npx prisma generate && npx prisma db push && next build
```

**Option B — From a network that can reach Supabase directly:**
```bash
npx prisma db push
```

**Option C — Via Supabase connection pooler (from localhost):**
In `.env.local`, temporarily set `DATABASE_URL` to the pooler URL from Supabase dashboard
(Settings → Database → Connection pooling → Session mode URL),
then run `npx prisma db push`, then revert.
