# Verification Gate — Always-On Rule

> **Authority**: Always loaded. Applies to ALL tasks — /build, /minion, /new-feature, and manual instructions.
> **Purpose**: Prevents Claude from declaring work complete before the user has visually confirmed the result.

---

## The Rule

Before claiming any task is done, Claude MUST produce a **VERIFICATION CHECKLIST** containing:

1. **Where to check** — the URL or location in the app
2. **How to get there** — navigation steps from the starting point
3. **What to see** — specific, observable outcomes (not technical descriptions)
4. **What NOT to see** — error states, blank areas, missing elements
5. **Confirmation prompt** — ask the user to reply "looks good" or describe what's different

---

## Banned Completion Phrases

These phrases trigger the verification gate. If Claude is about to say any of these, it MUST produce a verification checklist first:

- "The feature is now complete"
- "Everything is working as expected"
- "I've implemented everything you requested"
- "Ready for testing"
- "This should now work correctly"
- "The changes have been applied successfully"
- "Done"
- "All set"

---

## Checklist Format

```
VERIFICATION CHECKLIST — [Feature/Task Name]

Before this is done, please check:
[ ] Go to: [URL or location]
[ ] [Step-by-step action]
[ ] You should see: [observable result]
[ ] You should NOT see: [what should be absent]

How to get there: [Navigation path]

Reply "looks good" to close this, or describe what's different.
```

---

## Exceptions

The verification gate does NOT apply to:

- **Documentation-only changes** (updating .md files, adding comments)
- **Configuration changes** (env vars, settings files) — but state what changed
- **Test-only changes** (adding tests without modifying production code)
- **Git operations** (commits, branches, PRs)

For these, a simple confirmation of what was done is sufficient.

---

## Recovery

If Claude has already said "done" without a checklist, it must immediately produce one:

```
I should have provided a verification checklist. Here it is:
[checklist]
```
