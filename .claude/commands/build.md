# /build — Structured Requirements for Non-Coders

> Use this command every time you want Claude to build or change something.
> It forces structured input so Claude builds what you actually want.

---

## Usage

```
/build <paste your description here>
```

Or just type `/build` and Claude will prompt you to fill in the template.

---

## STEP 1: EXTRACT REQUIREMENTS

Parse the user's input into the 7-field template. If any field is missing, ask ONE question to fill it — then proceed.

```
WHAT:       [One sentence — what is being built or changed]
WHERE:      [Which page, URL, or area of the app]
WHO:        [Which user role — admin, student, instructor, public, all]
WHEN:       [What triggers this — click, page load, form submit, schedule]
SHOULD SEE: [What the user sees when it works — be specific and visual]
DON'T DO:   [What to avoid — features to preserve, patterns to skip]
SUCCESS:    [Observable outcomes — how Phil will know it's right]
```

---

## STEP 2: ECHO BACK

Before writing any code, restate the requirement in your own words:

```
UNDERSTOOD — Here's what I'll build:

[Plain-English summary of what you understood]

Files I'll create or modify:
- [file path 1]
- [file path 2]

Integration points:
- [ ] Navigation link added to [location]
- [ ] API route mounted in [router file]
- [ ] Auth gate: [role] only
- [ ] Documentation updated

Does this match what you had in mind? Say "go" to proceed.
```

**Do NOT start coding until the user confirms.** If they correct something, update the echo and ask again.

---

## STEP 3: PRE-IMPLEMENTATION CHECK

Before writing code:

1. **Read `ROUTE_REFERENCE.md`** (if it exists) — find the section for the page/feature being changed
2. **Read `CLAUDE.md`** — check architecture routing for correct file locations
3. **Read relevant existing files** — understand what already exists before adding to it
4. **Check for existing implementations** — search before creating (anti-duplication)

---

## STEP 4: BUILD

Execute the implementation. Follow project rules, design system, and testing discipline.

---

## STEP 5: INTEGRATION CHECKLIST

Before claiming completion, verify all integration points:

- [ ] **Navigation**: Can the user get to this page/feature from the existing app?
- [ ] **Route mounting**: Is the backend endpoint registered in the main router?
- [ ] **Auth protection**: Is the page/endpoint behind the correct auth gate?
- [ ] **API client**: Does the frontend actually call the backend endpoint?
- [ ] **Design system**: Are colours, corners, typography from design tokens (not hardcoded)?
- [ ] **Error states**: What happens when the API fails? Empty state shown?

---

## STEP 6: VERIFICATION CHECKLIST

Produce a checklist of OBSERVABLE outcomes the user can verify in their browser:

```
VERIFICATION CHECKLIST — [Feature Name]

Before this is done, please check:
[ ] Go to: [URL]
[ ] [Action to take]
[ ] You should see: [expected visual result]
[ ] You should NOT see: [what should be absent]

How to get there: [Navigation path from login]

Reply "looks good" to close this, or describe what's different.
```

**Do NOT say "done", "complete", "finished", or "ready" without this checklist.**
**Do NOT proceed to next tasks until the user explicitly confirms.**
