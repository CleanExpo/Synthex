---
name: token-health
description: >-
  Connection token-health for Synthex integrations. Diagnoses "what's connected /
  why is the dashboard empty" by reading live connection state from the DB (no
  login needed), explains the refresh/monitor crons that keep tokens alive, and
  gives the reconnect runbook for connections that can't self-heal. Use on ANY
  "is X connected", "nothing's working", "tokens expired", "GA4/GSC/LinkedIn not
  loading", or integration-health question.
metadata:
  author: synthex
  version: '1.0'
  type: reference-skill
  triggers:
    - what's connected
    - is it connected
    - tokens expired
    - integration health
    - nothing is working
    - dashboard empty
    - reconnect
  context: fork
---

# Token Health — keep integrations connected

## Diagnose first (no login, source of truth)

The dashboard is gated to Google-SSO CEO accounts, so don't try to log in to check
connections — **read the DB directly** (authorised, read-only — see memory
`prod-connection-health-read-authorised`). Supabase MCP, project `znyjoyjsvjotlzjppzal`:

```sql
select u.email, pc.platform, pc.is_active, pc.profile_name, pc.expires_at,
       (pc.expires_at is not null and pc.expires_at < now()) as token_expired,
       pc.last_sync
from platform_connections pc
join users u on u.id = pc.user_id
where pc.is_active = true and pc.deleted_at is null
order by u.email, pc.platform;
```

**Never select** `access_token` / `refresh_token` or any secret. `token_expired = true`
on an `is_active = true` row is the signature of a broken integration (connected, but
every API call uses a dead token → "not connected / no data").

## How tokens are kept alive (the system)

| Cron | Cadence | Covers |
|------|---------|--------|
| `refresh-tokens` | every 6h | the 9 **social** platforms in `lib/social` (`SUPPORTED_PLATFORMS`) |
| `google-token-refresh` | every 30 min | **Google data** platforms — googleanalytics, searchconsole, googlebusiness, googledrive (via `lib/google/google-auth` `getOAuthAccessToken`) |
| `dr-gbp-oauth-refresh` | every 50 min | the single DR GBP **env-var bearer** (not DB rows) |
| `token-health` | daily 07:00 | **monitor** — reports active-but-expired connections + alerts the owner |

Refresh keeps tokens valid *before* they expire (Google access tokens last ~1h).
The monitor is the safety net: it reports anything expired-but-active **and** warns
~7 days ahead for connections that can't self-heal (no refresh token), so a
periodic-reconnect platform never dies as a surprise.

## A token only stops needing manual reconnects two ways

1. **It auto-refreshes** — needs a stored refresh token. The refresh crons keep it alive.
2. **It never expires** — e.g. a Facebook *long-lived page token* (`expires_at` NULL).

If neither is true, it WILL need periodic manual reconnection. The monitor's job is to
make that never a surprise.

## Permanent fixes (per platform)

- **Facebook page tokens** → make them never-expire. Page tokens derived from a
  *long-lived* user token (`getLongLivedToken` → `getPages` in `lib/oauth/providers/meta.ts`)
  don't expire. A page connection with a 60-day `expires_at` was created without that
  exchange — reconnect it through the long-lived flow and it becomes permanent.
- **LinkedIn** → needs **refresh tokens**, which LinkedIn only issues to apps with the
  right *product entitlement* in the **LinkedIn Developer portal** (Sign In with LinkedIn /
  Marketing Developer Platform). The code already captures + refreshes a refresh token if
  LinkedIn returns one — the lever is the app config, not the code. If the entitlement
  isn't available, LinkedIn = 60-day tokens + proactive reconnect (the monitor warns ahead).

## Reconnect runbook (can't self-heal)

A connection with **no working refresh token** can't be auto-refreshed — the refresh
cron disables it (`isActive=false`) and notifies the user (`requires_reauth`). These
need a human:

- **LinkedIn** — reconnect in **Platforms → LinkedIn → Reconnect** (until refresh-token entitlement is enabled, repeat ~every 60 days when the monitor warns).
- **Facebook page tokens** — reconnect through the long-lived flow so it never expires again.
- After reconnecting, re-run the diagnose query — the row's `expires_at` should be in the future (or NULL) and `token_expired = false`.

## Run the monitor manually

```bash
# trigger the monitor (returns expiredActive + byPlatform)
curl -s "$BASE/api/cron/token-health" -H "Authorization: Bearer $CRON_SECRET"
```

## Maintenance

- New Google data platform → add it to `GOOGLE_DATA_PLATFORMS` in
  `app/api/cron/google-token-refresh/route.ts`.
- The monitor alerts the emails in `OWNER_EMAILS`.
- Root cause + history: memory `token-expiry-root-cause`. Tracked: Linear SYN-1013.
