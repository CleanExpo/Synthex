---
name: progress-tracker
description: >
  Master progress tracking via PROGRESS.md. Operations: UPDATE (modify phase
  completion, add milestones), LOG (add session entry with date, actions,
  metrics), REPORT (generate status summary). Integrates with session-manager
  for automatic logging. Use when updating project status, logging session
  work, or generating progress reports.
---

# Progress Tracker

## Process

Invoke with one of three operations: UPDATE, LOG, or REPORT.

1. **UPDATE** -- modify phase completion percentages and milestone status
2. **LOG** -- add a session entry to the session log
3. **REPORT** -- generate a formatted status summary

## PROGRESS.md Structure

The master progress file lives at `PROGRESS.md` in the project root (or `.claude/PROGRESS.md` if preferred). It contains four sections: Phase Completion, Milestone Checklist, Metrics Table, and Session Log.

```markdown
# Synthex -- Project Progress

## Phase Completion

| Phase | Status | Completion | Last Updated |
|-------|--------|------------|--------------|
| Foundation | Complete | 100% | YYYY-MM-DD |
| Core Features | In Progress | 65% | YYYY-MM-DD |
| Integration | Not Started | 0% | YYYY-MM-DD |
| Polish & QA | Not Started | 0% | YYYY-MM-DD |
| Launch | Not Started | 0% | YYYY-MM-DD |

## Milestones

- [x] Project scaffolding and repo setup
- [x] Database schema and Prisma models
- [x] Authentication (JWT + Google OAuth)
- [x] Core API endpoints
- [ ] Campaign management CRUD
- [ ] Multi-platform posting
- [ ] Analytics dashboard
- [ ] Stripe billing integration
- [ ] Production deployment hardening
- [ ] Launch checklist complete

## Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| API Endpoints | 12 | 20 | On Track |
| Test Coverage | 45% | 80% | Behind |
| Build Time | 32s | < 30s | At Risk |
| Bundle Size | 18MB | < 25MB | On Track |
| Lighthouse Score | 72 | > 90 | Behind |
| Uptime (30d) | 99.2% | 99.9% | At Risk |

## Session Log

| Date | Session ID | Actions | Metrics Impact | Notes |
|------|-----------|---------|----------------|-------|
| YYYY-MM-DD | session-ID | [summary of work] | [metrics changed] | [notes] |
```

## Operation: UPDATE

Modify phase completion and milestone status in PROGRESS.md.

### Steps
1. Read current PROGRESS.md
2. Update specified phase completion percentage
3. Check/uncheck milestone items as directed
4. Update "Last Updated" timestamp on modified phases
5. Recalculate overall project completion (weighted average of phases)
6. Write updated PROGRESS.md

### Phase Status Rules
| Completion | Status Label |
|------------|-------------|
| 0% | Not Started |
| 1-99% | In Progress |
| 100% | Complete |

### Update Format
```
UPDATE phase="Core Features" completion=75
UPDATE milestone="Campaign management CRUD" status=complete
UPDATE metric="API Endpoints" current=15
```

### Validation Rules
- Completion percentages must be 0-100
- Phases cannot go backward (100% -> 80%) without explicit override
- Milestones cannot be unchecked without explicit override
- Metrics must include units consistent with existing entries

## Operation: LOG

Add a session entry to the Session Log table.

### Steps
1. Read current PROGRESS.md
2. Append new row to Session Log table
3. If session-manager is active, pull session ID and file list automatically
4. Calculate any metrics impact from the session's work
5. Write updated PROGRESS.md

### Log Entry Format
```markdown
| YYYY-MM-DD | session-YYYYMMDD-HHMM | [2-3 sentence summary] | [changed metrics] | [blockers or notes] |
```

### Automatic Integration with Session Manager
When session-manager triggers an END operation:
1. Pull accomplishments list from session summary
2. Condense into 2-3 sentence action summary
3. Identify metrics affected by files modified
4. Auto-append log entry to PROGRESS.md
5. No manual invocation needed

### Log Content Guidelines
- **Actions**: focus on outcomes, not process ("Added 3 API endpoints" not "worked on code")
- **Metrics Impact**: only note metrics that actually changed
- **Notes**: blockers, decisions, or warnings for future sessions

## Operation: REPORT

Generate a formatted status summary from PROGRESS.md data.

### Steps
1. Read current PROGRESS.md
2. Calculate overall project completion
3. Identify blockers (metrics with "Behind" or "At Risk" status)
4. Determine next steps from unchecked milestones
5. Generate report

### Report Format
```markdown
## Progress Report -- YYYY-MM-DD

### Overall Completion: XX%

### Phase Summary
| Phase | Completion | Trend |
|-------|------------|-------|
| [phase] | XX% | [up/down/flat vs last report] |

### Blockers
1. [Metric]: currently at [value], target is [target] -- [suggested action]
2. ...

### Next Milestones
1. [ ] [Next unchecked milestone]
2. [ ] [Following milestone]
3. [ ] [Third milestone]

### Recent Activity (Last 5 Sessions)
| Date | Summary |
|------|---------|
| YYYY-MM-DD | [condensed actions] |

### Recommendations
- [Priority action based on blockers and timeline]
- [Second recommendation]
```

### Report Triggers
- On demand when operator requests status
- Automatically at session START (abbreviated version in session briefing)
- Weekly summary (if scheduled via session-manager)

## File Location

- **Primary file**: `PROGRESS.md` (project root)
- **Backup**: `.claude/PROGRESS.md` (if project root is not appropriate)
- **Created automatically** on first UPDATE or LOG operation if not present
- **Never overwritten** -- only appended to or modified in place
