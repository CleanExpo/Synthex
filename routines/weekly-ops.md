# Weekly Ops Review — Friday Routine

**Schedule:** Every Friday at 3:00 PM AEST
**Output:** `context/spec/weekly-ops-YYYY-MM-DD.md`
**Constraint:** Do NOT edit code. Do NOT open pull requests.

## Prompt

```
Read roadmap.md, review.md, and context/clients/.
Check recent commits: git log --oneline --since="7 days ago" origin/main.
Check open Linear issues if available.

Then create context/spec/weekly-ops-YYYY-MM-DD.md with:

1. SHIPPED THIS WEEK — bullet list of what landed on main
2. PATTERNS — any repeated issues, client themes, or recurring friction (1–3 items)
3. HIGHEST-LEVERAGE FIX — the single change that would unblock the most work next week
4. RISKS — anything that could cause a production problem or client complaint if left alone
5. NEXT WEEK FOCUS — suggested top 3 tasks for the week ahead (aligned to roadmap.md)

Keep it under 500 words. Australian English. No code changes.
```
