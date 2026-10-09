# Alert routing (#984)

Decision: 8 October 2026. Human decisions go to Unite-Group Slack
#approvals (`C0C8GB2TBMW`) without user or broadcast mentions. Monitoring,
reports and FYI messages go to #ops-alerts. Telegram is reserved for urgent
approvals; severity alone does not qualify a message.

## Delivery configuration

Prefer `ALERT_SLACK_BOT_TOKEN`: a Unite-Group Slack bot with `chat:write` and
access to both channels. The approvals channel ID is fixed. Monitoring uses `#ops-alerts`. The old `ALERT_SLACK_CHANNEL` cannot change the approvals target.

Alternatively, set `ALERT_SLACK_APPROVALS_WEBHOOK_URL` to an incoming webhook **bound to
#approvals**, and `ALERT_SLACK_OPS_WEBHOOK_URL` to one **bound to #ops-alerts**.
Slack incoming webhooks ignore channel overrides. An absent ops webhook causes
FYI delivery to fail explicitly unless a legacy `ALERT_SLACK_WEBHOOK_URL` ops
webhook is present; that legacy webhook never receives approval asks.
Bot-token delivery takes precedence when both mechanisms are configured.

## Approval markers

`AlertManager.sendAlert` and `/api/monitoring/alerts` accept `requiresApproval`
and `urgent` boolean fields. Only messages with both fields explicitly `true`
can reach Telegram. Approval asks reach Slack even below its severity threshold.

`sendEscalation` accepts `requiresApproval`; combine it with `priority: 'urgent'`
and `channel: NotificationChannel.TELEGRAM` for urgent Telegram approvals.
Those asks also go to Slack #approvals. Existing Telegram and Linear escalation
requests without approval markers go to Slack #ops-alerts; author questions are
explicitly marked as decisions and go to #approvals. Non-urgent Telegram fallbacks obey the same
Slack routing policy. The existing author-question Linear fallback remains best-effort. Telegram channel tests do not send routine messages.

## Telegram owner configuration

`TELEGRAM_OWNER_ID` remains the owner identity; `TELEGRAM_URGENT_APPROVAL_CHAT_ID`
can select a separate urgent destination. Owner identity also supplies the fallback independently of
legacy outbound chat-ID variables. Existing `TELEGRAM_CHAT_ID`,
`SYNTHEX_TELEGRAM_CHAT_ID`, and `HERMES_TELEGRAM_CHAT_ID` remain compatible.
No inbound owner command or Approve/Deny callback handler is implemented in this
repository, and their permissions/buttons are not changed by this fix. Do not
unset shared owner configuration in the separate Telegram bot deployment.

Missing Telegram configuration is optional in the connection manifest; it does
not block Hermes routing. No Vercel environment changes are part of this PR.
