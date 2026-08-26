# Morning Brief — Daily Routine

**Schedule:** Every weekday at 7:00 AM AEST
**Output:** `.claude/data/morning-brief-YYYY-MM-DD.md`
**Constraint:** Do NOT edit production code. Do NOT open a pull request.

## Prompt

```
Read roadmap.md, review.md, and context/clients/.
Check the last 10 git commits on main: git log --oneline -10 origin/main.
Check open Linear issues: use the Linear MCP or read .planning/linear-packets/ if available.

Then create or update .claude/data/morning-brief-YYYY-MM-DD.md with:

1. TOP CLIENT NEED — the most pressing thing a Synthex client needs right now (1 sentence)
2. PRODUCT RISK — one thing in the current codebase or branch that could bite us today
3. BUILD TASK — the single highest-leverage task to work on today (matches roadmap.md scope)
4. QUESTION TO ASK — one question I should ask a client or stakeholder today

Keep it under 300 words. Australian English. No code changes.
```
