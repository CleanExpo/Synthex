---
name: browser-auth
description: >-
  Drives an authenticated browser session on synthex.social (or localhost)
  WITHOUT the flaky Chrome extension. The reliable path is a committed Playwright
  script (scripts/browser/dashboard-audit.mjs) that logs in with the
  SYNTHEX_TEST_EMAIL / SYNTHEX_TEST_PASSWORD test account and audits every
  integration surface. Use whenever asked to "log in", "authenticate", "audit the
  dashboard", "check what's connected", or before browser-verify / site-smoke-test
  on /dashboard/* routes.
metadata:
  author: synthex
  version: '2.0'
  type: action-skill
  triggers:
    - log in to browser
    - authenticate
    - sign in
    - browser session
    - audit the dashboard
    - check what's connected
    - dashboard audit
    - authentication required
context: fork
---

# Browser Auth — the reliable, extension-free path

## Why this skill exists (read once)

Synthex has **two** ways to drive a browser. They are NOT equal:

| Path | Needs | Reliability |
|------|-------|-------------|
| **Playwright script** (`scripts/browser/dashboard-audit.mjs`) | `node` + installed Playwright + test creds | ✅ Deterministic. No bridge, no extension, no human clicks. **Use this.** |
| Chrome extension / `computer_use` (`mcp__Claude_in_Chrome__*`) | a per-session sign-in + tab toggle that drops | ⚠️ Flaky. The cause of recurring "browser broke again". **Fallback only.** |

`computer_use` and the Chrome extension are the **same bridge** — if `list_connected_browsers` is empty or `tabs_context_mcp` says "not connected", `computer` will fail identically. Do not burn time toggling it. Reach for the script.

---

## One-time setup (eliminates the recurring friction)

The script needs a **dedicated test account** (never a real customer login, never Phill's personal account). Put its creds in `.env.local` (plaintext, gitignored):

```
SYNTHEX_TEST_EMAIL=test@…           # a Synthex test account Phill creates
SYNTHEX_TEST_PASSWORD=…             # stored in .env.local only
```

Claude **cannot** create the account or type the password (prohibited actions). This is the single human step — once done, every future dashboard audit is fully autonomous. If the creds are missing the script exits `2` with a clear message; surface that to Phill and stop.

---

## Run it

The test creds live in **Vercel** (Production), not locally — pull them into a
gitignored `.env.local` first, then run with Node's built-in `--env-file`
(Node 20+, no extra deps — do NOT use `npx dotenvx`, the unscoped package 404s):

```bash
# 1. pull the test creds from Vercel into .env.local (gitignored):
npx vercel env pull .env.local --environment=production --yes

# 2. run the audit:
node --env-file=.env.local scripts/browser/dashboard-audit.mjs [baseUrl]

# watch it run (headed):
PWDEBUG_HEADED=1 node --env-file=.env.local scripts/browser/dashboard-audit.mjs
```

> The creds must be set on the **Production** Vercel environment (that's where
> `vercel env pull --environment=production` reads them). `support@…`-style
> mailboxes created via "Continue with Google" have NO email/password and will
> fail with "Invalid login credentials" — use an account with a real password.

**Output:** a JSON report on stdout + full-page screenshots in `.artifacts/browser-audit/`. Each surface is classified `connected / notConnected / empty / error` from its visible text. Read the JSON, open the screenshots, and report exactly which integrations are live vs broken.

**Exit codes:** `0` ok · `2` missing creds · `3` login failed (see `login-failed.png`) · `4` runtime/launch error.

---

## Login contract (verified 2026-05-30)

- Login page: `<base>/login` — form renders client-side, so wait for the selector, not `networkidle` (the dashboard holds connections open and never goes idle).
- Selectors: email `#email`, password `#password`, submit **`button:has-text("Sign in")`** (there are two submit buttons — "Watch Tutorial" and "Sign in").
- Success: URL moves to `/dashboard` (existing user) or `/onboarding` (new user). A Supabase `sb-*` session cookie is set.
- Auth errors surface as Sonner toasts (`[data-sonner-toast]`), not `[role="alert"]`.

---

## Maintenance (keep this skill true)

This skill drifts in exactly two places. When the dashboard changes, update them and re-verify — don't let it rot:

1. **Login selectors** (`SEL` in the script). If login starts failing with exit `3`, re-probe:
   ```bash
   node -e "import('playwright').then(async({chromium})=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('https://synthex.social/login',{waitUntil:'domcontentloaded'});await p.waitForSelector('input');console.log(await p.evaluate(()=>[...document.querySelectorAll('input,button')].map(e=>({tag:e.tagName,type:e.type,id:e.id,text:(e.textContent||'').trim().slice(0,30)}))));await b.close();})"
   ```
   Update `SEL.email / SEL.password / SEL.submit` to match.
2. **Audit routes** (`ROUTES` in the script). Add/rename as `/dashboard/*` surfaces change (`find app/dashboard -maxdepth 1 -type d`).
3. After any edit, re-verify the no-creds gate (`node scripts/browser/dashboard-audit.mjs` → must print `MISSING_CREDS` and exit `2`), and run the full audit once with creds.

Bump the `version` and the "verified" date above whenever you touch the selectors.

---

## Security rules

- **Never** log or print password values.
- **Never** use Phill's personal credentials — dedicated test account only.
- **Never** create a Supabase account (prohibited — Phill does this).
- Screenshots may contain client data — they live in `.artifacts/` (gitignored); never commit them.
- List session-cookie **names** only, never values.
