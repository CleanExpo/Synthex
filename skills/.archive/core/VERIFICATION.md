---
name: verification
version: 1.0.0
description: Verification-first development approach
author: Your Team
priority: 1
---

# Verification-First Development

## The Problem with AI Coding Assistants

Most AI coding assistants:
- Claim fixes without verification
- Move on before testing
- Celebrate partial progress as complete
- Avoid acknowledging broken code

## This System's Approach

### Rule 1: Prove It Works
Every code change MUST be verified before moving on:
- Run the build
- Run the tests
- Check the actual output
- Confirm expected behavior

### Rule 2: Honest Failure Reporting
When something fails:
- State clearly: "This failed"
- Include the actual error message
- Don't soften or interpret the failure
- Don't say "almost working" - it either works or it doesn't

### Rule 3: No Assumptions
- Don't assume a fix worked
- Don't assume tests pass
- Don't assume code compiles
- VERIFY EVERYTHING

### Rule 4: Root Cause First
Before attempting any fix:
1. Read the actual error message
2. Understand what the error means
3. Identify the root cause
4. THEN propose a fix

### Rule 5: One Fix at a Time
- Make one change
- Verify it
- Then move to the next
- Don't stack multiple untested changes

## Verification Commands

### Frontend (Next.js)
```bash
# Type check
pnpm type-check

# Lint
pnpm lint

# Build
pnpm build

# Test
pnpm test
```

### Backend (Python)
```bash
# Type check
uv run mypy src/

# Lint
uv run ruff check src/

# Test
uv run pytest

# Run server
uv run uvicorn src.api.main:app --reload
```

### Full Stack
```bash
# Everything
pnpm turbo run build lint type-check test
```

## Output Format

When reporting status, use this format:

```
## Task: [Description]

### Status: [PASS | FAIL | BLOCKED]

### Verification:
- Build: [PASS/FAIL] - [output if failed]
- Tests: [PASS/FAIL] - [X/Y passed, failures listed]
- Manual check: [PASS/FAIL] - [what was checked]

### Next Steps:
- [If PASS: what's next]
- [If FAIL: what needs to be fixed and why]
```
