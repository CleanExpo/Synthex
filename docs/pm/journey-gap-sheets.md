# Journey Gap Sheets — CEO Top 15

One happy-path trace per task. **First broken link** = earliest step that prevents in-house closure without IDE/manual hack.

| Task   | Trigger → … → Measure                             | First broken link                                                                             | Owner   | Effort |
| ------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------- | ------ |
| AT-001 | CEO request → strategist assigns chain → workflow | **Product:** no `senior-strategist` invocation in `lib/` or API                               | Eng     | L      |
| AT-002 | Brief → copywriter draft → gate → CEO queue       | **Product:** generation uses generic AI routes, not skill chain                               | Eng     | L      |
| AT-003 | Draft submitted → mechanical gate                 | **Product:** `brand-voice-enforce` only in `lib/ai/task-routing.ts` intent, not step executor | Eng     | M      |
| AT-004 | Gated drafts → strategist final → CEO queue       | **Product:** no CEO queue entity / UI batch                                                   | Eng     | L      |
| AT-005 | Mon cron → attribution → analytics narrative      | **Product:** reports partial; no Tier-1 auto-compose from gate state                          | Eng     | M      |
| AT-009 | Register change → strategist → enforce rules      | **Product:** `/dashboard/brand-voice` partial; rules live in markdown files                   | Eng     | M      |
| AT-010 | Brief → creative-director → REM asset             | **Product:** video/remotion partial; REM protocol not in workflow steps                       | Eng     | M      |
| AT-011 | Gap audit → CRO test proposal                     | **Policy:** cro-specialist not in v0.1 ship set                                               | SYN-806 | M      |
| AT-006 | Daily Hyper-Care window                           | **Product:** no Hyper-Care cron wiring to performance-attribution output                      | Eng     | M      |
| AT-007 | Monthly brief                                     | **IDE:** Tier-2 composed in Claude Code, not scheduled product job                            | Eng     | M      |
| AT-008 | Quarterly CMO review                              | **Policy:** senior-cmo not shipped (skill-orchestration-spec)                                 | SYN-806 | M      |
| AT-012 | Email sequence design                             | **Policy:** email-specialist next batch                                                       | SYN-806 | M      |
| AT-013 | Audience refresh                                  | **Product:** `/dashboard/audience` partial; JTBD not in org DB                                | Eng     | M      |
| AT-014 | PR package                                        | **Product:** `/dashboard/pr` partial; no gate before export                                   | Eng     | S      |
| AT-015 | DR GBP / schema                                   | **Product:** google-business partial; OAuth blocks publish loop                               | Eng     | M      |

## Cross-cutting breakpoints (validate once, applies to many)

1. **Skills not in runtime** — grep `senior-strategist` / orchestration handoff: zero in `*.ts`/`*.tsx` app paths.
2. **Advisor Mark Done** — **Partial fix (SYN-972):** PATCH spawns `contentCampaignWorkflow` + stores `workflow_execution_id`; senior-skill gates still IDE-only. Queue failure returns `workflowWarning` without blocking mark-done.
3. **Tasks UI** — `components/tasks/task-config.ts` types ≠ agency task IDs (AT-\*).
4. **Single workflow template** — `lib/workflow/workflow-templates.ts` → `contentCampaignWorkflow` only; not H-1 steps.
