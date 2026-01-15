---
name: self-correction
version: 1.0.0
description: Self-review and iterative improvement procedures for agents
priority: 2
triggers:
  - self review
  - iterate
  - improve
  - feedback loop
  - retry
requires:
  - core/VERIFICATION.md
---

# Self-Correction Skill

## Purpose

Enable agents to review their own work, identify issues, and iterate to improve quality before submitting for independent verification.

## Core Principle

**Self-review is NOT verification.** It's a preliminary quality check. Independent verification by IndependentVerifier is still required.

## Self-Review Checklist

Before submitting any work for verification:

- [ ] Output is complete (not partial or placeholder)
- [ ] All claimed outputs actually exist
- [ ] Basic functionality verified locally
- [ ] No obvious errors or issues
- [ ] Meets basic quality standards
- [ ] Completion criteria defined
- [ ] Evidence can be collected

## Iteration Loop

```python
attempt = 0
while attempt < max_attempts:
    # 1. Execute
    result = await execute_task()

    # 2. Self-review
    review = await self_review(result)

    if review.passed:
        # Ready for independent verification
        return result

    # 3. Analyze failure
    evidence = await collect_failure_evidence()

    # 4. Suggest alternative
    alternative = await suggest_alternative_approach(evidence)

    # 5. Try again with new approach
    attempt += 1
```

## Common Issues to Check

### Code Quality
- [ ] No syntax errors
- [ ] No placeholder code (TODO, FIXME)
- [ ] Type hints present (Python)
- [ ] Explicit return types (TypeScript)
- [ ] Imports resolve correctly

### Functionality
- [ ] Core functionality implemented
- [ ] Edge cases handled
- [ ] Error handling present
- [ ] Validation on inputs

### Testing
- [ ] Tests written for new code
- [ ] Tests actually test the functionality
- [ ] Tests can run independently
- [ ] Test names are descriptive

### Documentation
- [ ] Docstrings on public functions
- [ ] Complex logic has comments
- [ ] README updated if needed
- [ ] API changes documented

## Error Analysis

When self-review finds issues:

1. **Categorize**: What type of issue is it?
   - Syntax error → Fix immediately
   - Logic error → Analyze and fix
   - Missing feature → Implement
   - Quality issue → Refactor

2. **Root Cause**: Why did this happen?
   - Misunderstood requirement
   - Overlooked edge case
   - Incomplete implementation
   - Wrong approach

3. **Alternative Approach**: What to try differently?
   - Different algorithm
   - Better data structure
   - Simpler approach
   - Consult documentation

## Feedback Loop Integration

```python
async def execute_with_feedback_loop(task):
    for attempt in range(3):
        try:
            # Execute
            result = await execute(task)

            # Self-review
            issues = await self_review(result)

            if not issues:
                # Success - ready for verification
                return result

            # Analyze issues
            for issue in issues:
                logger.warning(f"Issue: {issue}")

            # If last attempt, escalate
            if attempt == 2:
                logger.error("Max attempts reached")
                return result  # Let verifier catch issues

            # Suggest fix
            fix_approach = await suggest_fix(issues)

            # Apply fix
            task.context["fix_approach"] = fix_approach

        except Exception as e:
            logger.error(f"Attempt {attempt} failed: {e}")
            if attempt == 2:
                raise

    return result
```

## Alternative Approaches

### When Blocked
- Break problem into smaller parts
- Search for similar examples
- Consult documentation
- Try simpler approach first

### When Tests Fail
- Read error message carefully
- Check test expectations
- Verify test setup is correct
- Run test in isolation
- Add debug logging

### When Performance Poor
- Profile to find bottleneck
- Check algorithm complexity
- Look for N+1 queries
- Consider caching
- Optimize hot paths

## Quality Gates

Before proceeding to verification:

**MUST HAVE**:
- Code compiles/runs
- No critical errors
- Basic functionality works
- Tests pass (if tests exist)

**SHOULD HAVE**:
- Proper error handling
- Edge cases covered
- Code is readable
- Performance acceptable

**NICE TO HAVE**:
- Optimizations applied
- Documentation thorough
- All TODOs resolved

## When to Escalate

Stop iterating and escalate when:

- **Max attempts reached** (usually 3)
- **Fundamentally blocked** (missing dependency, unclear requirement)
- **Circular dependency** (each fix breaks something else)
- **Ambiguous requirements** (unclear what success means)

## Integration with Base Agent

```python
class MyAgent(BaseAgent):
    async def execute(self, task, context):
        # Use iterate_until_passing method
        result, success = await self.iterate_until_passing(
            task_description=task,
            context=context,
            max_attempts=3
        )

        if not success:
            # Escalate after max attempts
            await self.escalate_to_human(task, result)

        return result
```

## Remember

- Self-correction improves quality **before** verification
- It's a **preliminary check**, not a replacement for verification
- Iterate intelligently, don't just retry blindly
- Learn from failures to improve future attempts
- Know when to escalate vs when to iterate

---

**Goal**: Produce high-quality work on first submission to verifier, minimizing verification failures.
