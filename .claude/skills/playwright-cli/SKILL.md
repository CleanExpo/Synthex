---
name: playwright-cli
description: >-
  Authenticated browser automation for Synthex — drive real Chrome to log in,
  screenshot, and audit dashboard/integration surfaces. Use for live visual
  verification, "audit the dashboard", "check what's connected", or closing the
  verification gate on /dashboard/* routes. Two backends: the Playwright MCP
  server (interactive, in-session tools) and the committed CLI scripts
  (scripts/browser/*.mjs, reliable + headless). RUNS WHERE THE BROWSER + NETWORK
  + AUTH EXIST — i.e. a local machine, not a network-restricted sandbox.
metadata:
  author: synthex
  version: '1.0'
  type: action-skill
  triggers:
    - audit the dashboard
    - check what's connected
    - browser audit
    - visual verification
    - screenshot the dashboard
    - log in and check
context: fork
---

# Playwright CLI / Browser Automation

## When to use
Live, authenticated checks of synthex.social surfaces: which integrations are
connected, empty/error states, visual regressions — anything that needs a real
logged-in browser. Pairs with `browser-auth`, `browser-verify`, `site-smoke-test`.

## Hard reality (read first)
Browser automation runs **in the environment it's launched from**. A
network-restricted Claude sandbox (no outbound npm, no auth session) **cannot**
reach the authenticated app — run this on a machine with: network access,
Playwright/Chromium installed, and the ability to sign in. Google **SSO**
accounts (`Continue with Google`) cannot be driven headlessly; use a persistent
profile + manual sign-in once, or a dedicated **email/password** test account.

## Backend A — Playwright MCP (interactive, in `claude` sessions)
Wired in `.claude/settings.json` → `mcpServers.playwright` (`npx @playwright/mcp@latest`).
Loads at Claude Code startup; restart the session to pick it up. Key tools:
- `mcp__playwright__browser_navigate` — open a URL
- `mcp__playwright__browser_snapshot` — accessibility/DOM snapshot
- `mcp__playwright__browser_take_screenshot` — capture
- `mcp__playwright__browser_click` / `browser_type` — interact (e.g. sign-in)

For SSO: run headed, complete `Continue with Google` by hand once; the MCP keeps
the context for subsequent navigations in that session.

## Backend B — committed CLI scripts (reliable, scriptable)
No MCP needed; uses the repo's Playwright.
```bash
# SSO (Google) accounts — capture a session once (real Chrome, persistent profile):
node scripts/browser/capture-session.mjs https://synthex.social
# then audit (reuses the profile, headless):
node scripts/browser/dashboard-audit.mjs https://synthex.social

# email/password accounts:
node --env-file=.env.local scripts/browser/dashboard-audit.mjs https://synthex.social
#   (set SYNTHEX_TEST_EMAIL / SYNTHEX_TEST_PASSWORD — a dedicated test account)
```
Output: screenshots in `.artifacts/browser-audit/` + a JSON report (connected /
not-connected / empty / error per surface). Exit: 0 ok · 2 no auth · 3 auth
failed/expired · 4 launch error.

One-time setup: `npm install` · `npx playwright install chrome`.

## Pass / fail
PASS = the audit reaches the dashboard and reports each surface's state with no
unexpected `error` signals. FAIL = auth blocked (fix creds / use email-password
account) or a surface shows an error/empty state that shouldn't be there →
triage into a follow-up issue.

## Reference
- `scripts/browser/capture-session.mjs`, `scripts/browser/dashboard-audit.mjs`
- `.claude/skills/browser-auth/SKILL.md`, `browser-verify`, `site-smoke-test`
- Playwright MCP: https://github.com/microsoft/playwright-mcp
