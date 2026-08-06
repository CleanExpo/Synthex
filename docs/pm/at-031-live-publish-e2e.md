# AT-031 / GAP-005 — X live publish E2E runbook

## Purpose and boundary

This is the human-operated acceptance check for the remaining AT-031 live X
publish path. It verifies a real, approved X post reaches the intended test
account through the production publish queue.

**Do not run this as part of CI or an unattended agent task.** The final
dispatch creates a public post. Use an organisation-owned X test account and a
non-sensitive, pre-approved caption. Do not include customer information,
credentials, access tokens, refresh tokens, client secrets, or production
screenshots containing them in this document, a ticket, or a PR.

Passing this runbook is evidence for a human to update the matrix; until then,
AT-031 remains `UI_PARTIAL` and GAP-005 remains open.

## Preconditions

Perform these checks in production while signed in as the target organisation's
owner:

1. The test X account is organisation-owned, has permission to create posts,
   and is safe to post from publicly.
2. The X developer app has OAuth 2.0 user authentication enabled as a
   confidential web app, with these scopes enabled:
   `tweet.read`, `tweet.write`, `users.read`, and `offline.access`.
3. Its callback URI is exactly the `redirectUri` returned by
   `GET /api/admin/oauth-preflight?platform=twitter`. This endpoint is
   owner-only and intentionally returns no secret.
4. The preflight response reports `configured: true` and `verdict: "OK"`.
   If it returns `WRONG_TYPE_OAUTH1`, replace the configured value with the X
   OAuth 2.0 client ID — an OAuth 1.0a API key is not valid here.
5. The production organisation has the normal publish prerequisites: a live
   calendar, auto-publish not paused, an approved slot with a valid authority
   manifest, an active X connection, and the required digest count. These are
   re-checked by the queue immediately before dispatch.

The expected X callback is
`https://<production-host>/api/auth/callback/twitter`; use the exact host from
the preflight response rather than transcribing this placeholder.

## Procedure

1. In **Dashboard → Platforms**, connect (or reconnect) X for the test
   organisation. Complete the OAuth 2.0 consent flow with the test account.
   Confirm the connection is active and belongs to the intended organisation.
2. Create one ordinary calendar slot for `twitter` with a short, approved,
   unmistakably non-sensitive test caption. Schedule it a few minutes ahead,
   then have the authorised human approve both the slot and its campaign
   authority manifest.
3. Ensure the organisation calendar is in `live` mode and auto-publish is not
   paused. This is the explicit human decision that permits the approved slot
   to be seeded into the queue.
4. Wait for the scheduled Vercel publish pass. Do not invoke production queue
   internals from this runbook and do not retry by creating a second slot.
5. Confirm exactly one post appears on the intended X test account. Record the
   post URL, queue item ID, connection ID, UTC timestamps, and the
   `publishQueue: published` log event in the restricted operations record.
   Record identifiers only; never record token values.
6. Verify the queue row is `published`, has `publishedAt`, and has no
   `lastError`. Check that no duplicate post was created after the next queue
   pass.

The Studio **Review & Release** view is not the AT-031 calendar-slot
approval surface: it releases only `queued_human_gated` derived video cuts.
Do not use it to manufacture a Twitter E2E result.

## Pass and fail criteria

Pass only when all of the following are true:

- OAuth preflight returns configured and `OK`.
- The persisted X connection is OAuth 2.0, active, and scoped to the test
  organisation.
- The approved, live calendar slot seeds one Twitter queue item.
- That item reaches `published` after the scheduled pass and the public post
  URL resolves to the intended test account.
- A later queue pass does not create a duplicate.

Stop and record a failure if the item is held, fails, retries, posts to the
wrong account, or creates a duplicate. For an HTTP 401, leave the queue item
held and preserve the organisation auto-publish pause; reconnect the account
before attempting a new, separately approved test slot.

## Code-backed safeguards being exercised

- `lib/social/twitter-oauth-credentials.ts` classifies bearer/expiry metadata
  as OAuth 2.0, so the encrypted refresh token is not passed as an OAuth 1.0a
  access secret.
- `lib/publish/safetyChecks.ts` fails closed unless the calendar, approval,
  authority, active connection, token, and digest gates pass.
- `lib/publish/publishQueue.ts` claims a due row atomically before dispatch,
  persists `publishedAt` on success, and holds the item plus pauses the
  organisation after a 401.
- `tests/unit/lib/social/twitter-oauth-credentials.test.ts` and
  `__tests__/publish/publishQueue.test.ts` cover the OAuth 2.0 credential
  wiring without posting to X.

## Close-out record

The operator must attach the following to the GAP-005 / AT-031 issue before
changing any status:

- preflight verdict and timestamp (no secret values);
- X account handle and post URL;
- queue item ID, connection ID, and `publishedAt`;
- confirmation of one later queue pass with no duplicate;
- any held/failed queue status and remediation, if applicable.

Only a successful human run with this evidence permits a status review. This
runbook itself does not close GAP-005.
