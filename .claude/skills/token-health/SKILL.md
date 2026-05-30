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
The monitor is the safety net: anything still expired-but-active is a gap the
refreshers can't fix → needs a manual reconnect.

## Reconnect runbook (can't self-heal)

A connection with **no working refresh token** can't be auto-refreshed — the refresh
cron disables it (`isActive=false`) and notifies the user (`requires_reauth`). These
need a human:

- **LinkedIn** — refresh often unavailable; reconnect in **Platforms → LinkedIn → Reconnect**.
- **Facebook page tokens** — when a page token expires, reconnect the Facebook account.
- After reconnecting, re-run the diagnose query — the row's `expires_at` should be in the future and `token_expired = false`.

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
