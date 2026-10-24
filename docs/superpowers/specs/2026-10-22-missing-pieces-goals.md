# Missing pieces: goals index (22/10/2026)

Eight design specs written from the Synthex intelligence wiki (`docs/intelligence/README.md`). Each is a proposal, not approved for build, and none has had a second-model review. Ranked by how directly the piece protects or moves the two client metrics (FD-10): **CARSI paid enrolments** and **RestoreAssist trial sign-ups**. Urgent live defects found while writing them come first.

## Urgent, building now (22/10/2026)

| Fix                                                           | Why now                                                                                                     | Spec                                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Close open sign-up (`fix/front-door`, invite-only by default) | Live `/signup` shows "Invite Code (optional)"; the gate is off unless an env var is set                     | [legacy SaaS retirement](2026-10-22-legacy-saas-retirement-design.md) |
| Unsubscribe actually honoured (`fix/unsubscribe-honoured`)    | Spam Act exposure: one-click unsubscribe refused, fake success when unconfigured, drips ignore unsubscribes | [compliance gate](2026-10-22-compliance-gate-design.md)               |
| Retiring model defaults (`fix/retiring-model-defaults`)       | Concept images default to `dall-e-3`; branded content defaults to `gpt-4-turbo-preview`                     | [model registry](2026-10-22-model-registry-design.md)                 |

## Ranked goals

| #   | Spec                                                                      | Client metric                                                                                       | Finish line (short)                                                                | Founder decisions                                                                         |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | [Compliance gate](2026-10-22-compliance-gate-design.md)                   | Both: every CARSI enrolment and RestoreAssist trial email, SMS and ad must survive Australian rules | Send-time suppression check, RFC 8058 one-click, compliance blockers inside Gate 4 | Lawyer review; drips commercial?; CARSI RTO status; suppression table migration           |
| 2   | [Brand rules](2026-10-22-brand-rules-design.md)                           | Both: autonomous CARSI and RestoreAssist posts need a deterministic claims check                    | Rules R10–R13 in `enforceBrandVoice`, reading the `*.claims.md` registers          | Machine/human split; DR "insurance-approved" phrase; protect `*.claims.md`; CCW carve-out |
| 3   | [Channel read-back](2026-10-22-channel-readback-design.md)                | Both: which posts sent people to enrolment and trial pages                                          | YouTube, then Facebook per-post, then TikTok; unread is unknown, never 0           | Which channels CARSI/RA publish to; X spend; reconnect clicks                             |
| 4   | [Legacy SaaS retirement](2026-10-22-legacy-saas-retirement-design.md)     | None: internal plumbing; must not break the RestoreAssist trial page                                | Invite-only default, staged switch-off, then deletion                              | `human-required` label; churn-scorer; Stripe webhook; who on Unite-Group to tell          |
| 5   | [CRM mission bridge](2026-10-22-crm-mission-bridge-design.md)             | Both, indirectly: trigger and read-back path for CARSI and RestoreAssist missions                   | Lane-scoped claim, 10-minute poller, `awaiting_approval` with evidence             | Separate runner secret; spend cap per mission; who marks done                             |
| 6   | [Model registry](2026-10-22-model-registry-design.md)                     | None: internal plumbing; stops CARSI/RestoreAssist campaigns failing on a retired model             | One lifecycle contract across text, image, video registries; CI check              | `human-required` for CI wiring; Prisma default migration                                  |
| 7   | [Media layer](2026-10-22-media-layer-design.md)                           | Both, indirectly: CARSI trailers and RestoreAssist ad video                                         | Retire legacy video service; priced video catalogue; fal behind an adapter         | Second vendor key and cap; Real Images Only wording; Remotion licence                     |
| 8   | [Answer-engine visibility](2026-10-22-answer-engine-visibility-design.md) | Both: how often AI answers name CARSI or RestoreAssist                                              | Weekly grounded meter, `NOT_MEASURED` not 0%; AI referrer tagging                  | OpenAI/Gemini keys under cap (A-18 leans no); weekly cap                                  |

## Shared rule

Every spec keeps open-source code to call-as-service, study-pattern, depend-after-review or reject. Nothing is installed or vendored by these specs.
