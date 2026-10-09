# Approval alert routing

Decision: 8 October 2026, issue #984.

Alerts and HERMES escalations use Slack in the Unite-Group workspace. Human
decisions require an explicit `requiresApproval: true` flag and go to
`C0C8GB2TBMW` (#approvals). FYI and monitoring go to #ops-alerts. Content is
escaped and user/mass mentions are neutralised.

Telegram additionally receives alerts explicitly marked both urgent and requiring
approval. For AlertManager use `urgent: true, requiresApproval: true`; for
sendEscalation use `priority: 'urgent', requiresApproval: true`. A critical
severity or urgent monitoring signal alone never permits a Telegram send.
This is enforced in code and cannot be disabled by an environment flag.

## Slack transport

Use `ALERT_SLACK_BOT_TOKEN` for a Unite-Group bot with chat:write access and
membership of both channels. Channel IDs/names are selected per alert.

Alternatively set two incoming webhooks, each created in its destination:
`ALERT_SLACK_APPROVALS_WEBHOOK_URL` for C0C8GB2TBMW and
`ALERT_SLACK_OPS_WEBHOOK_URL` for #ops-alerts. The legacy
`ALERT_SLACK_WEBHOOK_URL` is an ops-only fallback; verify it is bound to
#ops-alerts before deployment. Modern incoming webhooks cannot change their
channel using a payload field. A missing approvals destination reports failure;
it never sends a decision to an ops webhook.

## Telegram identity

`TELEGRAM_OWNER_ID` is the independent owner identity. It is also the default
urgent approval recipient when no separate `TELEGRAM_URGENT_APPROVAL_CHAT_ID`
is set. Legacy TELEGRAM_CHAT_ID, SYNTHEX_TELEGRAM_CHAT_ID and
HERMES_TELEGRAM_CHAT_ID remain compatible fallbacks with their matching tokens.
Dedicated urgent destination takes precedence over owner, then legacy targets.

No inbound Telegram command/callback handler, reply_markup or Approve/Deny
implementation exists in this repository. Existing external owner permissions
and buttons are untouched. This PR makes no production environment changes.
Before removing legacy IDs from a separate bot service, ensure that service's
owner authorisation reads TELEGRAM_OWNER_ID independently; never mute alerts by
removing the owner identity.

## Verification

Run `npm run lint`, `npm run type-check`, and `npm test -- --runInBand`.
Focused tests are tests/unit/lib/notification-channels.test.ts and
__tests__/api/connections-status.test.ts. All fetches in routing tests are mocked.
After configuration, verify a routine decision reaches only Slack approvals, a
monitoring alert reaches only ops-alerts, and an urgent approval preserves the
existing Telegram owner controls. Do not use a routine Telegram channel test to
bypass the urgent approval policy.
