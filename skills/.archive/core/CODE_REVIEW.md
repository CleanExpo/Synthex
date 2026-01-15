---
name: code-review
version: 1.0.0
description: Automated code review checklist and quality assessment
priority: 3
triggers:
  - review
  - code review
  - quality check
  - pr review
---

# Code Review Skill

## Purpose

Provide systematic code review guidelines for the ReviewAgent and other agents performing code quality assessment.

## Review Dimensions

### 1. Correctness
- Does the code do what it's supposed to?
- Are edge cases handled?
- Are error conditions managed?
- Are assumptions documented?

### 2. Security
- Input validation present?
- SQL injection prevented? (parameterized queries)
- XSS prevented? (sanitized output)
- Authentication/authorization checked?
- Secrets not hardcoded or logged?
- Dependencies up to date?

### 3. Performance
- Algorithm complexity acceptable?
- No N+1 queries?
- Expensive operations cached?
- Database queries indexed?
- Memory leaks prevented?

### 4. Maintainability
- Code is readable?
- Functions are focused (single responsibility)?
- Magic numbers explained?
- Complex logic has comments?
- Naming is clear and consistent?

### 5. Testing
- Tests cover new functionality?
- Tests cover edge cases?
- Tests are independent?
- Test names are descriptive?
- Mocking is appropriate (not excessive)?

### 6. Style
- Follows project conventions?
- Type hints present?
- Proper error handling?
- No debug code (console.log, print)?
- Imports organized?

## Review Checklist

### Python
- [ ] Type hints on all functions
- [ ] Docstrings on public functions
- [ ] No bare `except:`
- [ ] Use `async/await` properly
- [ ] Pydantic models for validation
- [ ] No `time.sleep()` in async code
- [ ] Proper logging (not print)

### TypeScript/React
- [ ] No `any` types
- [ ] Explicit return types
- [ ] Props properly typed
- [ ] No `console.log` in production
- [ ] Server vs Client components correct
- [ ] Hooks rules followed
- [ ] Accessibility (ARIA labels)

### SQL
- [ ] Migrations idempotent (IF EXISTS)
- [ ] Wrapped in transaction (BEGIN/COMMIT)
- [ ] RLS policies defined
- [ ] Indexes for common queries
- [ ] Foreign keys with ON DELETE
- [ ] Rollback script documented

## Severity Levels

### Critical 🔴
Must fix before merge:
- Security vulnerabilities
- Data corruption risks
- Breaking changes without migration
- Critical functionality broken

### High 🟠
Should fix before merge:
- Potential bugs in edge cases
- Performance issues
- Missing error handling
- Test coverage gaps

### Medium 🟡
Should address:
- Code quality issues
- Maintainability concerns
- Minor performance issues
- Suboptimal patterns

### Low 🟢
Nice to have:
- Style inconsistencies
- TODO comments
- Minor refactoring opportunities
- Documentation improvements

## Review Process

```python
async def review_changes(files_changed, diff, task_type):
    issues = []

    # 1. File-by-file review
    for file_path in files_changed:
        if file_path.endswith(".py"):
            issues.extend(await review_python(file_path, diff))
        elif file_path.endswith((".ts", ".tsx")):
            issues.extend(await review_typescript(file_path, diff))
        elif file_path.endswith(".sql"):
            issues.extend(await review_sql(file_path, diff))

    # 2. Cross-file checks
    issues.extend(await review_cross_file(files_changed, task_type))

    # 3. Categorize and prioritize
    issues_by_severity = categorize_issues(issues)

    # 4. Determine approval
    approved = (
        issues_by_severity["critical"] == 0 and
        issues_by_severity["high"] <= 2
    )

    return ReviewResult(
        issues=issues,
        approved=approved
    )
```

## Common Antipatterns

### Python
❌ **Bare except**:
```python
try:
    risky_operation()
except:  # Catches everything!
    pass
```

✅ **Specific exception**:
```python
try:
    risky_operation()
except ValueError as e:
    logger.error(f"Invalid value: {e}")
```

❌ **Blocking in async**:
```python
async def fetch_data():
    time.sleep(5)  # Blocks event loop!
```

✅ **Async sleep**:
```python
async def fetch_data():
    await asyncio.sleep(5)  # Non-blocking
```

### TypeScript
❌ **Any type**:
```typescript
function process(data: any) {
    return data.value
}
```

✅ **Specific type**:
```typescript
interface Data {
    value: string
}
function process(data: Data): string {
    return data.value
}
```

### SQL
❌ **Unsafe DROP**:
```sql
DROP TABLE users;
```

✅ **Safe DROP**:
```sql
DROP TABLE IF EXISTS users;
```

## Cross-File Checks

### Missing Tests
If implementation files changed but no test files:
- **Severity**: High
- **Message**: "Implementation changes without tests"
- **Suggestion**: "Add tests for new/changed functionality"

### Large Changeset
If > 20 files changed:
- **Severity**: Medium
- **Message**: "PR touches N files, may be too large"
- **Suggestion**: "Consider breaking into smaller PRs"

### Breaking Changes
If public API modified without migration:
- **Severity**: Critical
- **Message**: "Breaking API change detected"
- **Suggestion**: "Add migration or version API"

## Approval Criteria

**Auto-approve** when:
- No critical issues
- ≤ 2 high severity issues
- All tests pass
- Type checking passes
- Linting passes

**Request changes** when:
- ≥ 1 critical issue
- > 2 high severity issues

**Comment only** when:
- Only medium/low issues
- Suggestions for improvement
- Questions about approach

## Review Output Format

```markdown
## Code Review: {feature_name}

### Overall Assessment: {✅ Approved / ⚠️ Changes Requested}

### Summary
- Critical: 0
- High: 1
- Medium: 3
- Low: 2

### Issues

#### 🔴 Critical
None

#### 🟠 High
1. **Bare except clause** (src/api/main.py:45)
   - Description: Using bare except: can hide errors
   - Suggestion: Catch specific exceptions

#### 🟡 Medium
1. **Missing type hints** (src/utils/helper.py:12)
   - Description: Function lacks return type annotation
   - Suggestion: Add explicit return type

### Recommendations
- Add tests for the new authentication flow
- Consider breaking this into smaller PRs
- Document the new API endpoints
```

---

**Goal**: Ensure all code meets quality standards before reaching production.
