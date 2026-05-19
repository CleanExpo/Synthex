# Content Security Policy (CSP)

**Mandate:** `a4aae2cf-6a05-4426-9019-3f38137a9b7b`
**SOC 2 artifact:** #2 of 21 (Margot Q1)
**Status:** Codified. Production header is set by `next.config.js` via the standard Next.js `headers()` function.

## Goal

Block the three classes of attack a CSP can meaningfully prevent in
browser-rendered Synthex pages:

1. Reflected and stored XSS (untrusted script execution)
2. Click-jacking via `<iframe>` embedding from an attacker domain
3. Data exfiltration to attacker-controlled endpoints

CSP is a defence-in-depth layer over input sanitisation. It is not a
substitute for proper output encoding, parameterised queries, and OAuth
state validation.

## Production policy (current)

```
default-src 'self';
script-src   'self' 'unsafe-inline' https://*.vercel-scripts.com https://vercel.live https://js.stripe.com;
style-src    'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src      'self' data: blob: https:;
font-src     'self' data: https://fonts.gstatic.com;
connect-src  'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.stripe.com https://vercel.live;
frame-src    'self' https://js.stripe.com https://hooks.stripe.com;
frame-ancestors 'none';
form-action  'self';
base-uri     'self';
object-src   'none';
upgrade-insecure-requests;
```

## Why `'unsafe-inline'` for scripts (and how we'll remove it)

Next.js' app-router emits inline scripts for streaming hydration. Removing
`'unsafe-inline'` requires either nonce-based CSP (Next.js 15+
`generateNonce` API) or strict-dynamic. Both are in the Phase 3
roadmap — the change is non-trivial because every embedded analytics or
ads script must be nonce-aware.

Until then we accept the risk and compensate with:
- React's default escaping (`{value}` always escapes, `dangerouslySetInnerHTML` is grep-gated)
- DOMPurify on every user-rendered HTML field
- Output encoding linter on shared `<EditorMarkdown />` and `<PostCard />`

## Frame-ancestors `none`

Synthex is never legitimately embedded in another origin's iframe. Hard
block prevents click-jacking + cookie-jacking attacks. If a future use
case ever requires embedding (e.g. partner portal), it must be allowlisted
explicitly with a domain-scoped exception.

## Reporting

CSP violations report to `/api/csp-report` (rate-limited, 200/min/IP).
Daily roll-up to the Sentinel alert pipeline. Single-shot Telegram on
new domains being blocked — per `feedback_no_repeating_alerts`, never
every-cycle.

## Test plan

- Static: `pnpm run csp:lint` (gated in CI) parses the header from the
  build output and asserts the directive list matches this document.
- Dynamic: Playwright spec opens `/`, `/login`, `/app`, captures
  `Content-Security-Policy` header from the response, asserts it
  contains every directive above.

## Out-of-scope

- CSP Level 3 `trusted-types` — Phase 3
- Per-route nonce CSP — Phase 3
- Sub-resource integrity for third-party `<script>` — Phase 3
