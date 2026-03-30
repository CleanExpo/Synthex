# Auto-Publish Failure Mode Register

**Status:** Required reading before SYN-523 (Build auto-publish queue) moves from Backlog to In Progress  
**Author:** Lead developer  
**Sign-off required:** Phill McGurk (before SYN-523 → In Progress)  
**Board decision:** SYN-538 / SYN-540 | Session 9 | 2026-03-30

---

## Purpose

This document specifies the runtime failure handling for the 48-hour auto-publish system (SYN-523). It covers **runtime failure states only** — i.e., what happens when auto-publish is active and something breaks. The activation logic (shadow mode, 3-week cold-start gate, 48-hour fallback window) is specified separately in SYN-522/SYN-523 per Session 6's board decision.

All 6 failure states in this register must be implemented in SYN-523 and have corresponding unit tests in `tests/auto-publish/failure-modes.test.ts`.

---

## Failure State 1 — Expired Social Credentials

**Trigger:** Platform API returns HTTP 401, or token refresh endpoint returns an error.

**Expected behaviour:**
1. Immediately pause auto-publish for the affected client (`clients.auto_publish_paused = true`)
2. Fire an in-app notification using the First Win Notification system (SYN-525): _"Your social connection has expired — reconnect to resume auto-scheduling."_
3. Log the failure to `pipeline_cost_ledger` as a zero-cost failed run:  
   `{ pipeline_name: 'auto-publish', client_id, run_id, cost_usd: 0, error_code: 'UNAUTHORIZED' }`
4. **Do NOT retry** — expired tokens do not self-heal. Require explicit client reconnection.

---

## Failure State 2 — Platform Rate Limit

**Trigger:** Platform API returns HTTP 429.

**Expected behaviour:**
1. Read the `Retry-After` header if present. If absent, use exponential backoff: 30s → 60s → 120s.
2. Retry up to **3 times** maximum.
3. After 3 failed attempts: reschedule the post for the next available calendar slot (next 15-minute queue tick).
4. Log each backoff attempt to the run log with the retry count and wait duration.
5. **Do NOT retry indefinitely** — posts that exhaust retries are rescheduled, not abandoned.

---

## Failure State 3 — Partial Post Failure (Post Created, Media Attachment Failed)

**Trigger:** Post text publishes successfully but image/video attachment upload returns an error.

**Expected behaviour:**
1. **Delete the partial post** via the platform's delete endpoint (platform-specific — implement per-platform in SYN-523). Log the deletion.
2. Move the original post back to the manual review queue with flag `requires_media_recheck: true`.
3. **Do not auto-retry** the media attachment within the same run — the attachment failure may be transient (platform processing) or permanent (corrupt file).
4. Fire an in-app alert: _"A scheduled post couldn't complete — please review your media attachments."_
5. The post remains in the manual review queue until the client re-approves it.

---

## Failure State 4 — Client Account Deactivated in Synthex

**Trigger:** Client's `status` field in the Supabase `clients` table is not `'active'` at post execution time.

**Expected behaviour:**
1. Auto-publish checks `clients.status = 'active'` as the **first gate before every post execution** — not only at queue load time. This check must happen at execution time to catch mid-run deactivations (e.g., client cancels subscription while a batch is processing).
2. If the client is inactive: skip the post silently and log the skip. Do not fire a client alert (the client is offboarded).
3. Remove all pending posts from this client's auto-publish queue to prevent future processing.
4. Log the deactivation skip to the run log: `{ client_id, reason: 'account_deactivated', posts_skipped: N }`

---

## Failure State 5 — Content Freshness Validation Failure

**Trigger:** The auto-calendar AI prompt has flagged a queued post as potentially stale — expired promotional date, discontinued product mention, or time-sensitive reference that has passed.

**How freshness is determined:** The calendar generation engine (SYN-521) tags posts with an optional `valid_until` timestamp and a `freshness_confidence` score. If `valid_until` has passed at execution time, or if `freshness_confidence < 0.6`, the post is flagged.

**Expected behaviour:**
1. Move the post to the manual review queue with flag `requires_freshness_review: true`.
2. **Do not auto-publish.** The client must explicitly re-approve the post after reviewing.
3. Fire an in-app alert: _"One of your scheduled posts may need a refresh before publishing."_
4. Log the freshness failure with the post ID and the triggering condition.

---

## Failure State 6 — Network Timeout / Supabase Queue Read Failure

**Trigger:** The queue read fails due to a network error, Supabase timeout, or connection reset at the start of a cron run.

**Expected behaviour:**
1. The queue read is **idempotent** — posts must NOT be marked as published until the platform API explicitly confirms success (`{ id: '...' }` response from the platform). The `published_at` timestamp is only written on confirmed success.
2. On read failure: log the error and exit the current cron run cleanly. The next 15-minute cron tick will re-attempt the queue read.
3. **Do not double-post.** The `published_at` timestamp check prevents re-processing posts that already have a confirmed publish timestamp. Any post without a `published_at` value is considered unpublished and will be re-attempted.
4. If read failures persist for more than 3 consecutive cron ticks (45 minutes), fire an internal alert to the Synthex admin (Slack or email) — do not alert the client.

---

## Implementation Checklist for SYN-523

All 6 failure states must be:
- [ ] Implemented in the auto-publish queue handler
- [ ] Covered by unit tests in `tests/auto-publish/failure-modes.test.ts` (stubs are pre-created — fill them in)
- [ ] Added as acceptance criteria checkboxes in the SYN-523 Linear issue
- [ ] Reviewed and signed off by Phill before SYN-523 is marked In Progress

---

## Related Issues

- **SYN-523** — Build auto-publish queue with 48-hour fallback and safety layer
- **SYN-522** — Build calendar review UI and shadow/live mode toggle
- **SYN-521** — Build weekly content calendar auto-generation engine
- **SYN-525** — Build First Win Notification System (used by Failure State 1)
- **SYN-538** — [Board] Code Enhancement & Cleanup — 2026-03-30 (parent board issue)
