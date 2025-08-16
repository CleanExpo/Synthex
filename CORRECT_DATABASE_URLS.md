# Correct Database URL Format

## The Issue
Your password `a06ju0tuNyXmV9gB@db` contains `@` which is a special character in URLs and needs to be encoded.

## Corrected Environment Variables for Vercel

Copy and paste these EXACTLY into Vercel:

```
DATABASE_URL=postgresql://postgres:a06ju0tuNyXmV9gB%40db@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

DIRECT_URL=postgresql://postgres:a06ju0tuNyXmV9gB%40db@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres

JWT_SECRET=qzsbeYRFMp0CkoHW892NjfPytQEgTwdc

NEXTAUTH_SECRET=25Xtj10eWcT3aoNmusLKC96lAfQri7FB

NEXTAUTH_URL=https://synthex-unite-group.vercel.app

ENABLE_OAUTH=false

ENABLE_NOTIFICATIONS=false

ENABLE_MCP=false
```

## Important Changes:
1. Changed `postgres.` to `postgres:` (colon, not dot)
2. Encoded `@` in password as `%40` (so `a06ju0tuNyXmV9gB@db` becomes `a06ju0tuNyXmV9gB%40db`)

## Steps to Fix:
1. Go to: https://vercel.com/unite-group/synthex/settings/environment-variables
2. Delete the current DATABASE_URL and DIRECT_URL
3. Add them again with the corrected format above
4. Save the changes
5. Redeploy with the command below

## Redeploy Command:
```bash
vercel --prod --force
