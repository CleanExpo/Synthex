---
name: ship-loop-sanity
description: Security/quality gate child loop. Runs auth ratchet test, npm audit, parallel auth-coverage script, and a secret-leak diff-scan. Updates ship-loop-state.json with per-gate state. On failure applies one recovery recipe (typically auth ratchet triage or audit fix), retries once, escalates. Use standalone via /loop ship-loop-sanity or wired into the master orchestrator.
type: child-loop
context: persistent
---

# ship-loop-sanity — security/quality gate child loop

## Activation

- Standalone: `/loop ship-loop-sanity`
- Orchestrated: invoked by `ship-loop-master` every 60 min OR when `sanity.state !== 'green'`

## Process

### Step 1: Run four sanity gates in order

```bash
cd D:/Synthex

# Gate A: auth ratchet — already-built jest test, baseline VIOLATION_BASELINE = 0
npx jest --config jest.worktree.cjs tests/auth/route-coverage.test.ts

# Gate B: npm audit (production deps only)
npm audit --omit=dev --json > /tmp/sanity-audit.json
# Parse for HIGH severity count

# Gate C: parallel CLI auth-coverage script (catches mismatches with ratchet test)
npx tsx scripts/check-auth-coverage.ts

# Gate D: secret leak diff-scan (uncommitted + ahead-of-origin diff)
git diff origin/main...HEAD | grep -nE "(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]{20,}|SUPABASE_SERVICE_ROLE_KEY=[a-zA-Z0-9]|STRIPE_SECRET_KEY=[a-zA-Z0-9]|ANTHROPIC_API_KEY=[a-zA-Z0-9])" || echo "secret_scan_clean"
```

### Step 2: Update state

Atomic update to `layers.sanity`:

```json
{
  "state": "green" | "red",
  "last_run": "<iso>",
  "retries": <int>,
  "details": {
    "auth_ratchet": { "pass": true|false, "violations": <int>, "baseline": <int> },
    "npm_audit": { "pass": true|false, "high": <int>, "moderate": <int> },
    "auth_script": { "pass": true|false, "violations": <int> },
    "secret_scan": { "pass": true|false, "leaks": ["<file:line>", ...] }
  }
}
```

`state === 'green'` IFF all four gates pass. Note for `npm_audit`: `pass = (high === 0)` only — moderates are noted but don't block.

### Step 3: Recovery sub-loop on red

For each failing gate:

#### Gate A failed (auth ratchet)

- Recipe #7: parse stderr for "New unprotected routes detected" list
- For each: read the route, classify (admin / public / inline-supabase / other auth pattern)
- If clear pattern: wrap with `withAuth` from `@/lib/auth/with-auth` OR add prefix to `EXEMPT_PREFIXES` with comment
- If ambiguous: escalate to `escalations.md` with the route path and three options for human

#### Gate B failed (HIGH npm vuln introduced)

- Recipe #8: `npm audit fix` (non-`--force`)
- Re-run gate; if still HIGH, escalate (likely needs `--force` which is a CEO-only call)

#### Gate C failed (script mismatch with ratchet test)

- Indicates `AUTH_IMPORT_PATTERNS` or `EXEMPT_PREFIXES` diverged between `tests/auth/route-coverage.test.ts` and `scripts/check-auth-coverage.ts`
- Diff the two files; suggest sync edit; escalate (don't auto-edit — CEO needs to confirm intent)

#### Gate D failed (secret leak)

- **HALT IMMEDIATELY** — do not retry, do not auto-fix
- Append to `escalations.md` as `## P0 — Secret leak detected`
- The P0 will block the master loop from advancing until human clears it (per master's hard-stop logic)
- Do NOT log the matched secret value into the events file (that would defeat the purpose)

## Recipe priorities for this loop

- #7 auth ratchet (Gate A) — high priority match
- #8 npm audit (Gate B) — high priority match
- Custom secret-leak P0 (Gate D) — never recipe; always escalate

## Verification

- Add an unprotected route to `app/api/test-route/route.ts` and re-run; expect Gate A red, recipe #7 attempts wrap, escalates if pattern unclear
- Stage a fake API key string in a tracked file and re-run; expect Gate D red, P0 escalation, master halts on next tick
- Add a low-severity vuln (none should be auto-detected as HIGH but verify gate handles 0 HIGH correctly)

## Out of scope

- Snyk / Trivy deeper scans (those run in CI, not the loop — noisy and slow)
- License compliance scanning (separate concern)
- Dependency update suggestions (out of scope — Renovate/Dependabot domain)
