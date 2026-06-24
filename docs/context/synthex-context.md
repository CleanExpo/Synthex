# Synthex Context Map

Status: active shared-language layer
Created: 24/06/2026
Purpose: reduce repeated explanation and keep humans, agents, docs, and code aligned.

## Product identity

Synthex is the Unite-Group marketing automation and in-house agency operating system. It prepares, reviews, queues, publishes, and measures content/campaign work behind evidence and human approval gates.

Synthex must not be treated as a generic content generator. The product value is governed, evidence-backed throughput.

## Core terms

| Term                  | Meaning in Synthex                                                                                                             | Notes                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Authority packet      | A content/campaign evidence pack containing sources, claim register, draft assets, approval state, and publish handoff         | Must separate internal queue approval from public publish approval                                   |
| Campaign              | A bounded marketing initiative with objective, audience, source evidence, variants/assets, gate state, and outcome metrics     | A campaign may create drafts before any external action                                              |
| Content lane          | A draft-generation lane that produces content variants and stores them for review                                              | Publish/distribute is a separate gated step                                                          |
| Visual lane           | Human-in-the-loop creative workflow: concept round, choose/refine, platform assets, lock, gated publish                        | Should reuse existing campaign/content mechanics                                                     |
| Governed signal       | A typed input from research, cron, source evidence, or operator notes with confidence, risk, approval, and outcome fields      | Signals are not work until triaged into a Work Packet                                                |
| Opportunity           | A ranked proposed action derived from one or more governed signals                                                             | Must carry source, confidence, risk, and approval bucket                                             |
| Work Packet           | The atomic execution contract for a specialist agent/team                                                                      | Replaces broad prompts with goal, scope, no-gos, done contract, evaluator rubric, and proof commands |
| Approval queue        | Human gate for external effects, risky recommendations, YMYL claims, schema changes, publishing, and provider/account changes  | Approval to queue is not approval to publish                                                         |
| Draft                 | Reversible internal artifact that can be edited or discarded                                                                   | Safe for automation if source and risk are clear                                                     |
| Publish               | Any external website/social/email/client-visible side effect                                                                   | Human-gated by default                                                                               |
| AI citation readiness | Planning metric for whether content is structured, quotable, attributed, and entity-consistent enough to test in AI answers    | `HYPOTHESIS_FOR_TESTING` until measured                                                              |
| Source registry       | The map of accepted research roots and source confidence labels                                                                | Prevents false `DATA_REQUIRED` declarations                                                          |
| Evaluator             | Independent critic that judges a generator's output against a rubric                                                           | The builder must not mark its own work done                                                          |
| Handoff               | Focused markdown transfer for a fresh agent/session                                                                            | Use pointers, not duplicated raw context                                                             |
| Stop/hold policy      | Rule that blocks automation expansion while P0/P1 security, tenant-safety, or data-integrity risks would increase blast radius | Current ShipIt context marks Synthex RED                                                             |

## Canonical operating boundaries

- Supabase auth only; no Clerk, NextAuth, or Auth.js.
- No mock/stub data in product surfaces.
- All queries must be organisation-scoped.
- Mutations need validation and approval gates where appropriate.
- Production deploy, DB migrations, env changes, public publishing, and provider/account changes require explicit human approval.
- No new external vendors or connector platforms without explicit approval.
- Nango is disallowed.

## Workstream language

### Research → Signal → Work Packet

Research notes, YouTube transcripts, cron output, and wiki findings are source material. They become governed signals only after they are labelled with source, confidence, risk, and relevance. They become executable work only when a Work Packet exists.

### Draft → Review → Publish

Drafting is reversible and can be automated when source/risk labels are clear. Publishing is external and remains human-gated.

### Generator → Evaluator → Board

A generator produces the artifact. An evaluator checks the artifact against objective criteria. The Board decides judgment-heavy trade-offs: risk, brand fit, commercial value, and whether to proceed.

## Required vocabulary in future specs

Future Synthex specs should use these statuses consistently:

- `ready`
- `blocked-data`
- `blocked-approval`
- `blocked-security`
- `draft-only`
- `approval-required`
- `never-autonomous`
- `verified`
- `opinion-source`
- `hypothesis-for-testing`

## ADR candidates

Create an ADR when any of these decisions becomes hard to reverse:

1. Source registry roots or source confidence policy changes.
2. Work Packet becomes mandatory for implementation.
3. Evaluator rubrics become a merge/publish gate.
4. Signal intake writes to database tables.
5. AI citation readiness affects public content recommendations.
6. Provider/capacity health becomes more than read-only.
