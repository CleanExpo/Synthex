# PR Review — Triggered on Pull Request Open

**Trigger:** When a pull request is opened or updated
**Output:** PR comments
**Constraint:** Leave comments only. Do NOT merge, close, or edit code.

## Prompt

```
A pull request has been opened. Review it using review.md as the standard.

Steps:
1. Read roadmap.md — does this PR match the current sprint scope?
2. Read review.md — run through every checklist item
3. Read the diff carefully

Leave comments ONLY on issues that could:
- Create a bug or broken user flow
- Cause a security problem
- Violate the Real Images Only rule (.claude/rules/real-images-only.md)
- Violate the design system (emoji, wrong icons, non-Australian English)
- Miss a required test case (401, 403, happy path)

Post a short summary comment with:
- What looks good
- What needs attention (must fix / should fix)
- Whether this is ready for human review

Do not comment on style preferences or things outside the PR's scope.
```
