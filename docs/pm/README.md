# Synthex PM — Agency Gap Audit Pack

**Linear epic:** [SYN-971](https://linear.app/unite-group/issue/SYN-971)  
**Linear doc index:** [Agency Gap Audit — PM Pack Index](https://linear.app/unite-group/document/agency-gap-audit-pm-pack-index-529081214798)  
**Audit date:** 2026-05-25  
**Scope:** In-house agentic marketing agency for Unite portfolio (DR, NRPG, RestoreAssist, CARSI, CCW carve-out) — not external paying-customer SaaS.

## Artifacts

| File                                                           | Purpose                                     |
| -------------------------------------------------------------- | ------------------------------------------- |
| [agency-task-catalog.md](./agency-task-catalog.md)             | AT-001–AT-032 service-line task definitions |
| [capability-matrix.csv](./capability-matrix.csv)               | C1/C2/C3 scores per task                    |
| [capability-matrix-heatmap.md](./capability-matrix-heatmap.md) | Counts by service line and status           |
| [partial-routes-inventory.md](./partial-routes-inventory.md)   | 100 dashboard routes marked `(partial)`     |
| [journey-gap-sheets.md](./journey-gap-sheets.md)               | CEO top-15 journeys — first broken link     |
| [gap-register.md](./gap-register.md)                           | GAP-001+ P0–P3 register                     |
| [roadmap-90-day.md](./roadmap-90-day.md)                       | Three-track remediation                     |
| [linear-epics-backlog.md](./linear-epics-backlog.md)           | SYN-971 children + engineering mapping      |

## Core finding

Synthex is **two disconnected systems**: agency **brain** (`.claude/memory/`, `.claude/skills/`, SYN-806) runs only in IDE; agency **body** (`lib/workflow/`, dashboard) runs generic AI workflows without H-1–H-4 orchestration.

**In-house closure score:** ~52/100 (governance strong, product wiring weak).

## CEO actions

1. Validate **top 15** tasks in `agency-task-catalog.md`.
2. Sign **roadmap-90-day.md** Track 1 scope.
3. Assign engineering to [SYN-972](https://linear.app/unite-group/issue/SYN-972), [SYN-973](https://linear.app/unite-group/issue/SYN-973), [SYN-974](https://linear.app/unite-group/issue/SYN-974).
