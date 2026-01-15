---
name: bug-fixing
version: 1.0.0
description: Systematic debugging and bug fixing process
priority: 6
triggers:
  - bug
  - fix bug
  - debug
  - error
  - issue
requires:
  - core/VERIFICATION.md
  - core/SELF_CORRECTION.md
---

# Bug Fixing Workflow

## Purpose

Guide agents through systematic bug fixing: reproduction, root cause analysis, fix, and regression prevention.

## Workflow Phases

### Phase 1: Reproduce the Bug

**Objective**: Confirm bug exists and understand conditions

```markdown
1. Gather Information
   - Error message/stack trace
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details

2. Reproduce Locally
   - Follow reproduction steps
   - Observe behavior
   - Capture error details
   - Document conditions

3. Create Failing Test
   - Write test that triggers bug
   - Test should fail initially
   - Commit failing test
```

**Outputs**:
- Confirmed reproduction steps
- Failing test
- Clear error description

**If Cannot Reproduce**:
- Request more information
- Check environment differences
- Try edge cases
- Escalate if needed

### Phase 2: Locate the Issue

**Objective**: Find where the bug originates

```markdown
1. Analyze Stack Trace
   - Find entry point
   - Follow execution path
   - Identify failing line

2. Add Logging/Debugging
   - Log inputs at key points
   - Check intermediate values
   - Verify assumptions

3. Narrow Down
   - Binary search approach
   - Isolate problematic code
   - Identify exact cause
```

**Debugging Techniques**:

**Python**:
```python
import logging
logger = logging.getLogger(__name__)

def process_data(data):
    logger.debug(f"Input: {data}")  # Check input
    result = transform(data)
    logger.debug(f"Transformed: {result}")  # Check intermediate
    return result
```

**TypeScript**:
```typescript
function processData(data: Data): Result {
    console.log('Input:', data)  // Temporary debug
    const result = transform(data)
    console.log('Result:', result)  // Temporary debug
    return result
}
```

**Remember**: Remove debug logging after fixing!

### Phase 3: Understand Root Cause

**Objective**: Understand WHY it's broken

```markdown
1. Ask Five Whys
   - Why did it fail?
   - Why was that condition true?
   - Why wasn't it handled?
   - Why did we assume that?
   - Why is the design that way?

2. Identify Category
   - Logic error
   - Edge case not handled
   - Race condition
   - Incorrect assumption
   - Missing validation
   - Performance issue

3. Check for Similar Issues
   - Query memory for similar bugs
   - Search codebase for pattern
   - Are other places affected?
```

**Root Cause Categories**:

| Category | Example | Fix Strategy |
|----------|---------|--------------|
| Logic Error | Wrong condition | Fix logic |
| Edge Case | Null not handled | Add validation |
| Race Condition | Async timing | Add synchronization |
| Assumption | Assumed non-null | Validate assumptions |
| Validation | No input check | Add validation |
| Performance | Slow query | Optimize |

### Phase 4: Implement Fix

**Objective**: Fix the bug properly

```markdown
1. Design Fix
   - Address root cause (not symptom)
   - Consider edge cases
   - Avoid breaking changes
   - Check performance impact

2. Implement Fix
   - Minimal code change
   - Follow project patterns
   - Handle errors properly
   - Add comments explaining fix

3. Verify Locally
   - Failing test now passes
   - No new test failures
   - Manual test works
   - No regressions
```

**Fix Patterns**:

**Add Validation**:
```python
# Before (buggy)
def divide(a, b):
    return a / b  # Crashes if b=0

# After (fixed)
def divide(a, b):
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b
```

**Handle Null/None**:
```typescript
// Before (buggy)
function getName(user: User): string {
    return user.name.toUpperCase()  // Crashes if name is null
}

// After (fixed)
function getName(user: User): string {
    return user.name?.toUpperCase() ?? 'Unknown'
}
```

**Add Async Safety**:
```python
# Before (buggy)
async def fetch_data():
    data = requests.get(url)  # Blocks event loop

# After (fixed)
async def fetch_data():
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
```

### Phase 5: Add Regression Test

**Objective**: Ensure bug doesn't come back

```markdown
1. Create Regression Test
   - Test the specific bug scenario
   - Include edge cases found
   - Test should pass now
   - Descriptive test name

2. Test Coverage
   - Cover the fix
   - Cover related edge cases
   - Update existing tests if needed

3. Verify No Regressions
   - All existing tests pass
   - No new failures introduced
   - Performance not degraded
```

**Regression Test Pattern**:
```python
def test_regression_issue_123_divide_by_zero():
    """Regression test for issue #123: Division by zero crash.

    Previously, calling divide(10, 0) would crash with ZeroDivisionError.
    Now it should raise a descriptive ValueError.
    """
    with pytest.raises(ValueError, match="Cannot divide by zero"):
        divide(10, 0)
```

### Phase 6: Document & Learn

**Objective**: Capture learnings

```markdown
1. Update Code
   - Add comment explaining fix
   - Update docstring if behavior changed
   - Note any caveats

2. Update Documentation
   - README if user-facing bug
   - API docs if behavior changed
   - Migration guide if breaking

3. Store to Memory
   - Record failure pattern
   - Store fix approach
   - Document root cause
   - Prevent similar bugs
```

### Phase 7: Create PR

**Objective**: Get fix reviewed and merged

```markdown
1. Create Bug Fix Branch
   - Branch name: `fix/agent-{issue-number}`

2. Commit Changes
   - Clear commit message
   - Reference issue number
   - Include test

3. PR Description
   - Link to issue
   - Describe bug
   - Explain fix
   - Show test evidence

4. Request Review
   - Shadow mode
   - Await human approval
```

## Example: Fixing Authentication Bug

### Phase 1: Reproduce
```
Bug Report: "Login fails with 'user not found' even for valid users"

Reproduction:
1. Create user account
2. Log out
3. Try to log in again
4. Error: "user not found"

Created failing test:
test_login_after_logout() - FAIL
```

### Phase 2: Locate
```
Stack trace points to:
  auth_service.py:45 - find_user_by_email()

Added logging:
  logger.debug(f"Searching for email: {email}")

Found issue:
  Email comparison is case-sensitive
  User registered with "User@Example.com"
  Login attempt with "user@example.com"
```

### Phase 3: Root Cause
```
Root Cause: Case-sensitive email comparison

Why?
1. Used direct string comparison
2. Assumed emails always same case
3. No normalization on registration
4. No normalization on login

Category: Logic error + Missing validation
```

### Phase 4: Implement Fix
```python
# Before (buggy)
def find_user_by_email(email: str):
    return db.query(User).filter(User.email == email).first()

# After (fixed)
def find_user_by_email(email: str):
    # Normalize email to lowercase for comparison
    normalized_email = email.lower().strip()
    return db.query(User).filter(
        func.lower(User.email) == normalized_email
    ).first()

# Also fix registration to store normalized emails
def create_user(email: str, password: str):
    normalized_email = email.lower().strip()
    # ... rest of registration
```

### Phase 5: Regression Test
```python
def test_regression_case_insensitive_email_login():
    """Regression test: Login should work regardless of email case.

    Bug #156: Users couldn't log in if email case didn't match exactly.
    """
    # Register with mixed case
    user = create_user("User@Example.COM", "password123")

    # Should be able to login with any case variation
    assert login("user@example.com", "password123") == user
    assert login("User@Example.com", "password123") == user
    assert login("USER@EXAMPLE.COM", "password123") == user
```

### Phase 6: Document
```
Stored to memory:
- Failure pattern: Case-sensitive comparisons
- Fix approach: Normalize inputs
- Root cause: Missing normalization
- Similar risks: Other string comparisons?
```

### Phase 7: PR
```
Created: PR #157 - "fix(auth): Case-insensitive email login"
Status: Awaiting review
Tests: All passing ✅
```

## Key Principles

1. **Always Reproduce First**: Don't guess at fixes
2. **Root Cause, Not Symptom**: Fix the real problem
3. **Test the Fix**: Prove it works
4. **Regression Test**: Ensure it stays fixed
5. **Learn**: Store pattern to avoid similar bugs

## Common Pitfalls

❌ **Fixing without reproducing**
✅ **Reproduce reliably first**

❌ **Treating symptom not cause**
✅ **Identify and fix root cause**

❌ **No regression test**
✅ **Add test to prevent recurrence**

❌ **Introducing new bugs**
✅ **Run full test suite before committing**

❌ **Over-engineering the fix**
✅ **Minimal, targeted fix**

## Integration with Memory

```python
async def fix_bug(agent, bug_report):
    # Check for similar past bugs
    similar = await agent.memory.find_similar(
        query=bug_report.description,
        domain=MemoryDomain.TESTING,
        category="failure_patterns"
    )

    if similar:
        # Learn from past fixes
        past_fix = similar[0]
        logger.info(f"Similar bug fixed before: {past_fix}")

    # Proceed with fix
    fix_result = await agent.execute_fix(bug_report)

    # Store for future
    await agent.memory.store_failure(
        failure_type=fix_result.bug_category,
        context={
            "bug": bug_report.description,
            "root_cause": fix_result.root_cause,
            "fix_approach": fix_result.approach,
            "lessons": fix_result.lessons
        }
    )
```

---

**Goal**: Fix bugs systematically with tests and prevent regressions.
