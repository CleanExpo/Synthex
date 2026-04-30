---
name: ship-loop-watch
description: Chrome MCP browser-watch child loop. Navigates synthex.social surfaces, captures console errors / CSP violations / 4xx-5xx network requests / hydration failures. Runs on a 15-min cadence via the master orchestrator. Classifies findings using the browser-debug skill mappings, applies recipe lookups for known patterns. Use standalone via /loop ship-loop-watch for production-side debugging or wired into the master orchestrator.
type: child-loop
context: persistent
---

# ship-loop-watch — Chrome MCP browser-watch child loop

## Activation

- Standalone: `/loop ship-loop-watch` (production debugging)
- Orchestrated: invoked by `ship-loop-master` every 15 min (most frequent inner loop — production state can change without our action)

## Pre-condition

- Chrome MCP must be connected (verified via `mcp__Claude_in_Chrome__tabs_context_mcp` succeeding)
- If not connected: write event `{"reason":"chrome_mcp_unavailable","skipped":true}` and return without changing watch state

## Process

### Step 1: Surface inventory

Surfaces to watch (ordered most-critical first):

| Surface                                   | Method                                 | Required check                              | Why                       |
| ----------------------------------------- | -------------------------------------- | ------------------------------------------- | ------------------------- |
| `https://synthex.social/api/health`       | GET                                    | 200 + JSON `status` field                   | platform liveness         |
| `https://synthex.social/api/demo/analyze` | POST `{"url":"https://google.com.au"}` | 200 + body has `businessName` AND `caption` | CONSTITUTION.md curl gate |
| `https://synthex.social/login`            | navigate + screenshot                  | rendered + 0 CSP errors                     | auth-page hydration       |
| `https://synthex.social/signup`           | navigate                               | rendered + 0 CSP errors                     | onboarding entry          |
| `https://synthex.social/`                 | navigate                               | rendered + 0 CSP errors                     | marketing root            |
| `https://synthex.social/pricing`          | navigate                               | rendered + JSON-LD present                  | SEO/AEO surface           |
| `https://synthex.social/clients`          | navigate                               | rendered + 0 CSP errors                     | Authority Hub root        |

### Step 2: Per-surface capture

For each browser surface (not the API ones):

1. `mcp__Claude_in_Chrome__navigate` to URL
2. Wait 3s for hydration
3. `mcp__Claude_in_Chrome__read_console_messages` filtered with pattern `error|warn|CSP|Content Security`
4. `mcp__Claude_in_Chrome__read_network_requests` filtered with `urlPattern` matching the host; check for any 4xx/5xx
5. `mcp__Claude_in_Chrome__read_page` filter `interactive` to assert at least 1 element exists (proves hydration)
6. For pages with JSON-LD requirement: `read_page` and grep for `application/ld+json` element

For API surfaces: simple curl with `--ssl-no-revoke` (Windows compat) and JSON parse.

### Step 3: Update state

Atomic update to `layers.watch`:

```json
{
  "state": "green" | "amber" | "red",
  "last_run": "<iso>",
  "details": {
    "surfaces": [
      {
        "url": "https://synthex.social/login",
        "http_code": 200,
        "console_errors": 0,
        "csp_violations": 0,
        "network_5xx": 0,
        "rendered": true,
        "json_ld_present": null
      },
      ...
    ],
    "api_health_status": "healthy" | "degraded" | "unhealthy"
  }
}
```

State levels:

- `green`: all surfaces 200, 0 console errors, 0 CSP violations, 0 5xx
- `amber`: API health `degraded` (cold-start latency tolerated) OR ≤2 console warnings
- `red`: any surface 5xx OR any CSP violation OR API health `unhealthy` OR hydration failure

### Step 4: Recovery / classify on red or amber

**Amber** (degraded health, cold start): retry once after 60s sleep. If still amber, log to events but do not escalate (production cold-start is normal).

**Red** triggers classification (not auto-fix — production code is not loop's to edit):

1. Pull the failing surface details
2. Match against `browser-debug` skill's failure-mode classifier (CSP / hydration / 5xx / cold-start)
3. Check Vercel deploy status via `gh api repos/CleanExpo/Synthex/deployments` for last deploy
4. If last Vercel deploy is `FAILURE`: escalate as `## P0 — Production deploy failure`, master will halt
5. If deploy is `READY` but production red: escalate as `## P1 — Production regression on <surface>` with the recipe lookup result
6. If recipe match: include the recipe's "Suggested fix" in the escalation entry

Production-fix work happens via subsequent PR cycles, not from this loop.

## Recipe priorities for this loop

- #13 (cold-start latency) — auto-retry without escalating
- #14 (production 5xx) — Vercel deploy state check + escalate

## Verification

- Run when production is healthy; expect `state === 'green'` with all surfaces clean
- Manually break production (don't actually do this!); simulate by editing the surface list to include `https://synthex.social/this-route-does-not-exist`; expect red state + escalation

## Out of scope

- Production fixes (loop reports; subsequent PR cycles fix)
- Visual regression (screenshot diff — separate concern, requires baseline images)
- Performance benchmarking beyond cold-start latency (handled by site-smoke-test skill or Lighthouse)
- E2E user journey verification (Playwright suite, separate from this skill)
