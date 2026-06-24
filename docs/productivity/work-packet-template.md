# Synthex Work Packet Template

Status: required template for future implementation-ready work
Created: 24/06/2026

Use this template before any non-trivial Synthex implementation, content lane, signal intake, ops task, or publish action.

## Work Packet

### 1. Identity

- **Packet ID:** `SYN-WP-YYYYMMDD-<slug>`
- **Title:**
- **Owner:**
- **Specialist lane:** research | software | content | visual | ops | security | PM
- **Linear issue:**
- **Created:** DD/MM/YYYY
- **Appetite / due date:**
- **CEO/team queue impact:** minutes/hours
- **WIP impact:** new WIP | replaces existing WIP | continuation

### 2. Goal

One sentence describing the end state.

### 3. Why now

- Triggering signal:
- Source evidence:
- Business impact:
- Risk if no:

### 4. Source evidence

| Source | Path/URL | Label                                                                      | What it proves |
| ------ | -------- | -------------------------------------------------------------------------- | -------------- |
|        |          | `VERIFIED` / `OPINION_SOURCE` / `HYPOTHESIS_FOR_TESTING` / `DATA_REQUIRED` |                |

### 5. Scope

#### In scope

-

#### No-gos

- No production deploy unless explicitly approved.
- No DB migration/application unless explicitly approved.
- No `.env*` reads/writes.
- No public publishing or client communication unless explicitly approved.
- No new vendor/account/service.
- No Nango.

### 6. Entry criteria

- [ ] Source evidence has been inspected.
- [ ] Blocked state is known.
- [ ] Approval bucket is known.
- [ ] Evaluator rubric is attached.
- [ ] Proof commands are listed.

### 7. Exit criteria / done contract

- [ ] Artifact exists at exact path(s).
- [ ] Tests/checks listed below are green.
- [ ] Evaluator verdict is pass.
- [ ] Approval gate state is recorded.
- [ ] Rollback/stop rule is recorded.

### 8. Permission bucket

| Action                                            | Bucket                  | Reversibility | Detection speed | Approver                      |
| ------------------------------------------------- | ----------------------- | ------------- | --------------- | ----------------------------- |
| Read source/docs                                  | Auto                    | high          | immediate       | none                          |
| Create/update draft docs                          | Auto                    | high          | immediate       | none                          |
| Product code change                               | Approval or issue-bound | medium        | CI/local tests  | Phill / repo policy           |
| DB write/migration                                | Approval                | low           | varies          | Phill                         |
| Public publish/email/social/client-visible action | Approval                | low           | varies          | Phill/content owner           |
| Destructive file/resource action                  | Never autonomous        | low           | varies          | Phill explicit typed approval |

### 9. Prioritisation

`priority = (impact × confidence) / (risk × effort)`

- Impact:
- Confidence:
- Risk:
- Effort:
- Blocked state: ready | blocked-data | blocked-approval | blocked-security

### 10. Implementation plan

1. Write/verify failing test or doc-drift guard where applicable.
2. Make the smallest scoped change.
3. Run focused verification.
4. Run full verification gate.
5. Request evaluator review.
6. Commit/push only after green and approval.

### 11. Evaluator rubric

Attach the relevant rubric from `docs/productivity/evaluator-rubrics.md`.

### 12. Verification commands

```bash
npm run type-check
npm run lint
npm test
npm run build
```

Use narrower focused tests first when code changes are small; full gate before push.

### 13. Rollback / stop rule

- Rollback path:
- Stop condition:
- Human escalation trigger:

### 14. Handoff

- Fresh-agent handoff path:
- Pointers to source docs:
- Do not duplicate raw transcripts or secret material.
