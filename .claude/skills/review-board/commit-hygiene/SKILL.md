# Commit Hygiene Review Specialist

---
name: commit-hygiene
description: Enforce conventional commits, atomic changes, no merge commits, branch naming, Linear issue references
type: review-specialist
severity_levels: [CRITICAL, HIGH, MEDIUM, LOW]
confidence_threshold: 80
---

## Context

This specialist ensures **commit and branch hygiene** across Synthex development. Clean commit history is essential for:
- Root-cause analysis and bisecting (finding which commit introduced a bug)
- Release notes generation (automated from conventional commit types)
- Code review clarity (atomic commits are easier to review)
- Team collaboration (consistent naming reduces cognitive load)
- Regulatory compliance (audit trails for financial/campaign data)

**Synthex commit standards:**
- **Conventional format**: `type(scope): description (LINEAR-ISSUE)`
- **Valid types**: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `perf`, `style`, `ci`, `build`
- **Valid scopes**: directory names from `app/`, `lib/`, `components/`, `prisma/`, `scripts/`, etc.
- **Atomic commits**: one logical unit per commit (not 10 features in one commit, not one feature split across 20 commits)
- **No merge commits**: all work integrated via rebase or squash
- **No secrets**: credentials never in git history (even if later removed)
- **Linear issue reference**: all non-doc commits should reference a Linear issue (SYN-XXX, UNI-XXXX)

**Example good commit:**
```
feat(dashboard): add campaign performance widget (SYN-234)
```

**Example bad commits:**
```
Update code                          # No type, no scope
feature(everything): big refactor    # Wrong type, too broad scope
fix(auth): WIP                       # Incomplete work
feat: add AI content gen + fix bugs  # Two features in one commit
Add secret key abc123def456          # SECRET IN COMMIT
```

---

## Severity Mapping

### CRITICAL
- **Commit containing secrets/credentials** (API keys, passwords, tokens, database URLs, even if removed in a later commit — git history is persistent)
  - Includes hardcoded: OpenAI/Gemini API keys, Stripe secret keys, database passwords, OAuth tokens, private URLs
  - If found: invalidate the credential immediately, force-push (with human approval), or escalate to security
- **Merge commit in PR** (indicates work was not rebased; should be linear history)

**Impact:** Credentials can be exfiltrated; git history becomes non-linear and hard to bisect.

**Confidence:** Always report if you can confirm the credential is present.

### HIGH
- **Commit message does not follow conventional format** (no `type(scope):`, or type is not in the approved list)
- **Single giant commit** containing 5+ unrelated changes (should be split into atomic commits)
- **fixup! or squash! commits left unresolved** (work in progress left in branch)
- **Commit message is unintelligible** ("asdf", "quick fix", "ugh", "still broken")

**Impact:** Release notes cannot be generated; bisecting is impossible; hard to understand intent.

**Confidence:** Report at 85%+.

### MEDIUM
- **Commit message missing Linear issue reference** (should include SYN-XXX or UNI-XXXX unless doc-only)
- **Scope not matching any directory** (e.g., `fix(something)` where `something/` does not exist)
- **Commit message >100 characters** (harder to scan in log)
- **Multiple logical changes in one commit** (two bug fixes, or a feature + refactor combined)
- **Branch name not following convention** (should be `feature/foo`, `fix/bar`, not `my-branch` or `work`)

**Impact:** Harder to track which issue a commit addresses; navigation less efficient.

**Confidence:** Report at 80%+.

### LOW
- **Commit message missing description** (has `type(scope):` but no explanation of why)
- **Message casing inconsistency** (first word not capitalised: `feat(api): add endpoint` vs `feat(api): Add endpoint`)
- **Trailing punctuation missing** (convention is no period at end of subject)
- **Using past tense** (`feat(auth): added login` instead of `feat(auth): add login`)
- **Scoped to version number or ticket number** (e.g., `fix(SYN-123):` — issue goes in message, not scope)

**Impact:** Minor readability; standards consistency.

**Confidence:** Report at 80%+.

---

## Checklist

Before reporting a finding:

- [ ] Is this a commit in the PR, or a commit from `main` (only flag PR commits)?
- [ ] Does the message follow `type(scope): description`?
- [ ] Is the type in the approved list (feat, fix, docs, chore, test, refactor, perf, style, ci, build)?
- [ ] Does the scope match an actual directory in the codebase?
- [ ] Is the description capitalised and clear?
- [ ] Does the commit message include a Linear issue reference?
- [ ] Is this a merge commit (if so, flag)?
- [ ] Are there any hardcoded secrets/credentials in the commit?
- [ ] Is the commit atomic (one logical change) or does it combine multiple unrelated changes?
- [ ] Is the commit message >100 characters (if so, note but don't flag as HIGH)?
- [ ] Is this a doc-only change (if yes, issue reference is optional)?

---

## Output Format

```json
{
  "specialist": "commit-hygiene",
  "tier": "standard",
  "duration_ms": 0,
  "findings": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "confidence": 90,
      "file": "N/A",
      "line": 0,
      "issue": "Commit message does not follow conventional format: 'add stuff' (no type/scope)",
      "fix": "Reword commit to 'feat(dashboard): add campaign widget (SYN-123)'",
      "reference": "CLAUDE.md — Commit conventions"
    }
  ],
  "summary": {
    "critical": 0,
    "high": 1,
    "medium": 0,
    "low": 0
  },
  "verdict": "BLOCK"
}
```

**Rules:**
- `file` is typically `N/A` (applies to commit, not a file)
- `line` is typically 0 (applies to entire commit)
- `confidence` must be ≥80 to include
- `verdict` = "BLOCK" if any CRITICAL, else "PASS"

---

## Synthex-Specific Rules

### Conventional Commit Format (Strict)
**Pattern:** `type(scope): description (LINEAR-ISSUE)`

**Valid types:**
- `feat` — new feature
- `fix` — bug fix
- `docs` — documentation update
- `chore` — routine maintenance (deps, config, tooling)
- `test` — test additions or fixes
- `refactor` — code restructure without behaviour change
- `perf` — performance improvement
- `style` — formatting, whitespace, lint fixes (no logic change)
- `ci` — CI/CD pipeline changes
- `build` — build system, bundler, deployment changes

**Valid scopes:** any directory name at root level (e.g., `app`, `lib`, `components`, `prisma`, `scripts`, `public`, `config`) or subsystem (e.g., `api`, `auth`, `dashboard`, `forms`)

**Examples:**
```
feat(dashboard): add campaign performance widget (SYN-456)
fix(api): resolve org-scoping bypass in /api/posts (UNI-123)
docs(readme): update installation steps
test(auth): add PKCE flow test cases (SYN-789)
refactor(lib): extract email validation to util (SYN-234)
perf(database): add index on campaign.created_at (SYN-567)
style(components): fix ESLint violations in Button.tsx
ci(github): add type-check to pre-commit hook
chore(deps): upgrade Next.js to v15.1
build(vercel): configure environment variables
```

**Invalid examples:**
```
Update code                           # No type/scope
feature(everything): big change       # Wrong type, too broad scope
fix(SYN-123): something              # Issue goes in message, not scope
Add stuff and refactor utils and fix  # Multiple unrelated changes + no type/scope
Quick fix lol                         # Unintelligible
```

### Atomic Commits
A commit should represent **one logical unit of work**:
- One feature → one commit (or a small series: add types, add logic, add tests)
- One bug fix → one commit
- One refactor → one commit
- Never: feature + bug fix + style cleanup in one commit

**If a commit touches:**
- API route, model, tests, and docs → acceptable as one atomic commit
- Dashboard page + unrelated API endpoint → should be split into two commits

### Linear Issue References
- **All commits** (except doc-only) should include a Linear issue: `(SYN-XXX)` or `(UNI-XXXX)`
- **Location**: end of commit message subject line
- **Format**: `type(scope): description (LINEAR-ISSUE)`
- **Doc-only exception**: `docs(readme): update onboarding steps` (no issue required)

**Examples:**
```
feat(dashboard): add campaign widget (SYN-456)
fix(auth): resolve session timeout (UNI-123)
```

### Branch Naming Convention
- **Feature branch**: `feature/short-descriptive-name` (e.g., `feature/campaign-scheduler`)
- **Bug fix branch**: `fix/short-descriptive-name` (e.g., `fix/org-scoping-bypass`)
- **Documentation branch**: `docs/short-descriptive-name` (e.g., `docs/api-endpoints`)
- **Chore branch**: `chore/short-descriptive-name` (e.g., `chore/upgrade-deps`)

**Invalid examples:**
- `my-branch` (no prefix)
- `SYN-456` (bare issue number)
- `work` (too vague)
- `feature-VERY-LONG-DESCRIPTIVE-NAME-WITH-LOTS-OF-WORDS` (too long)

### No Merge Commits
- Commits in PR should be **linear** (rebased, not merged)
- If history shows a merge commit, flag as CRITICAL
- Before merging to main, ensure no merge commits exist in branch history

**Good:**
```
feat(dashboard): add widget
fix(api): resolve timeout
docs(readme): update
```

**Bad (merge commit):**
```
Merge pull request #123 from ...
```

### Secrets Detection (CRITICAL)
Flag any hardcoded or committed secrets:
- API keys: OpenAI, Gemini, Stripe, AWS, etc.
- Tokens: GitHub, OAuth, Bearer tokens
- Passwords: database, service account, SSH keys
- URLs: private endpoints, database connection strings
- Even if "removed" in a later commit — git history is persistent

**If found:**
1. Report as CRITICAL
2. Note: "Credential visible in git history; if real, invalidate immediately and force-push with caution"

**Safe patterns:**
- Environment variables: `process.env.OPENAI_API_KEY`
- `.env.example`: placeholder values only (`OPENAI_API_KEY=your-key-here`)
- Secrets in `.env.local` or `.env.production` (these files are `.gitignore`d)

### Excluded from Review
- Commits on `main` (review only PR branch commits)
- Revert commits (e.g., `revert: ...` is acceptable for rollbacks)
- Merge commits from automated tools (e.g., Dependabot) — flag only if manual merge in user PR
- Pre-existing commits already merged (historical hygiene is lower priority)

---

## Methodology

1. **Extract commit list** — get all commits in PR branch (not in main)
2. **Parse each commit message** — extract type, scope, description, issue ref
3. **Validate format** — check against conventional commit spec
4. **Check for secrets** — scan message and diff for hardcoded credentials
5. **Assess atomicity** — verify one logical unit per commit
6. **Check branch naming** — verify branch name follows convention
7. **Report findings** — only confidence ≥80%, map to severity

---

## Examples

### Example 1: CRITICAL — Commit contains API key
```
commit abc123def456
Author: dev@synthex.social
Date: 2026-03-31

    feat(api): add OpenAI integration

    OPENAI_API_KEY=sk-proj-abc123def456xyz789...

❌ FAIL
```

**Finding:**
- Severity: CRITICAL
- Issue: OpenAI API key visible in commit message
- Fix: If real key, invalidate immediately. Rewrite history with `git rebase -i` or force-push. If placeholder, reword commit to remove credential.

### Example 2: HIGH — Commit message not conventional
```
commit abc123def456
Author: dev@synthex.social

    Update code
```

**Finding:**
- Severity: HIGH
- Issue: Commit message does not follow conventional format (no type/scope)
- Fix: Reword to `feat(dashboard): add campaign widget (SYN-456)`

### Example 3: MEDIUM — Missing Linear issue reference
```
commit abc123def456

    fix(auth): resolve session timeout

    User session was not being refreshed correctly. Added token refresh logic.
```

**Finding:**
- Severity: MEDIUM
- Issue: Commit message missing Linear issue reference
- Fix: Reword to `fix(auth): resolve session timeout (SYN-789)`

### Example 4: MEDIUM — Commit combining multiple features
```
commit abc123def456

    feat(dashboard): add widget and fix API timeout and update docs

    - Added campaign widget
    - Fixed /api/posts timeout
    - Updated README

❌ FAIL (three unrelated changes)
```

**Finding:**
- Severity: MEDIUM
- Issue: Single commit contains multiple logical changes (should be split into three commits)
- Fix: Split into:
  - `feat(dashboard): add campaign widget (SYN-456)`
  - `fix(api): resolve /api/posts timeout (SYN-457)`
  - `docs(readme): update documentation (no issue ref)`

### Example 5: LOW — Message casing inconsistency
```
commit abc123def456

    feat(auth): add PKCE flow support (SYN-789)

    added support for PKCE...

❌ FAIL (first word of body not capitalised)
```

**Finding:**
- Severity: LOW
- Issue: Message body should be capitalised
- Fix: Reword to `Added support for PKCE...`

---

## References

- [Conventional Commits spec](https://www.conventionalcommits.org/)
- [Git commit message best practices](https://chris.beams.io/posts/git-commit/)
- Synthex conventions: `.claude/CLAUDE.md` section "Code Conventions"
- Linear issue project: [unite-hub Synthex](https://linear.app)
