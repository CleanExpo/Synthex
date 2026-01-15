---
name: feature-development
version: 1.0.0
description: End-to-end workflow for developing new features from spec to PR
priority: 5
triggers:
  - feature
  - new feature
  - implement feature
  - add functionality
requires:
  - core/VERIFICATION.md
  - core/SELF_CORRECTION.md
  - core/CODE_REVIEW.md
---

# Feature Development Workflow

## Purpose

Guide agents through the complete feature development lifecycle: from specification to production-ready code.

## Workflow Phases

### Phase 1: Requirements Analysis

**Objective**: Understand what needs to be built

```markdown
1. Parse User Story/Spec
   - Extract acceptance criteria
   - Identify edge cases
   - Note constraints

2. Query Memory
   - Search for similar features
   - Load relevant patterns
   - Check failure patterns to avoid

3. Clarify Ambiguities
   - Ask questions if unclear
   - Confirm assumptions
   - Document decisions
```

**Outputs**:
- Clear understanding of requirements
- List of acceptance criteria
- Known constraints and assumptions

### Phase 2: Design Approach

**Objective**: Plan the implementation

```markdown
1. Architecture Decision
   - Which layer(s) affected? (frontend/backend/database)
   - Existing patterns to follow?
   - New components needed?

2. File Planning
   - Files to create
   - Files to modify
   - Dependencies to add

3. Test Strategy
   - Unit tests needed
   - Integration tests needed
   - E2E tests needed
   - Test data requirements

4. Break Into Subtasks
   - Database schema (if needed)
   - Backend API (if needed)
   - Frontend UI (if needed)
   - Tests
   - Documentation
```

**Outputs**:
- Implementation plan
- List of files to touch
- Test strategy
- Dependency changes

### Phase 3: Implementation

**Objective**: Build the feature following TDD

```markdown
For each component (database → backend → frontend):

  1. Write Failing Test
     - Define expected behavior
     - Write test that fails
     - Commit test

  2. Implement Feature
     - Minimal code to pass test
     - Follow project patterns
     - Handle errors properly

  3. Refactor
     - Improve code quality
     - Remove duplication
     - Add documentation

  4. Verify
     - Tests pass
     - Type check passes
     - Lint passes

  5. Self-Review
     - Check completeness
     - Verify edge cases
     - Ensure quality
```

**Implementation Order**:
1. **Database**: Create migrations if schema changes needed
2. **Backend**: Implement API endpoints/business logic
3. **Frontend**: Build UI components
4. **Integration**: Wire everything together
5. **Tests**: Ensure comprehensive coverage

### Phase 4: Testing & Verification

**Objective**: Prove the feature works

```markdown
1. Unit Tests
   - All new functions tested
   - Edge cases covered
   - Error cases handled
   - Run: `pnpm test` or `pytest`

2. Integration Tests
   - Components work together
   - API endpoints respond correctly
   - Database operations succeed
   - Run: Integration test suite

3. E2E Tests (if applicable)
   - User flow works end-to-end
   - UI interactions work
   - Run: `pnpm test:e2e`

4. Manual Verification
   - Start dev server
   - Test feature manually
   - Check edge cases
   - Verify UX is good

5. Independent Verification
   - Submit to IndependentVerifier
   - Collect evidence
   - Address any failures
```

**Verification Checklist**:
- [ ] All tests passing
- [ ] Type check passing
- [ ] Lint passing
- [ ] Feature works manually
- [ ] No regressions
- [ ] Performance acceptable

### Phase 5: Documentation

**Objective**: Document the feature

```markdown
1. Code Documentation
   - Docstrings on functions
   - Complex logic has comments
   - Type hints present

2. API Documentation
   - Endpoint descriptions
   - Request/response examples
   - Error codes documented

3. User Documentation (if needed)
   - README updated
   - Usage examples
   - Migration guide (if breaking)

4. Memory Storage
   - Store successful patterns
   - Document design decisions
   - Record learnings
```

### Phase 6: PR Creation

**Objective**: Create shadow-mode PR for human review

```markdown
1. Create Feature Branch
   - Branch name: `feature/agent-{task-id}`
   - Based on main

2. Commit Changes
   - Descriptive commit message
   - Include co-author line
   - Link to task/issue

3. Run All Checks
   - `pnpm turbo run type-check lint test`
   - All must pass

4. Generate PR Description
   - Summary of changes
   - Test plan
   - Verification evidence
   - Agent metadata

5. Create PR
   - Shadow mode (awaits human review)
   - Request reviewers
   - Link to task tracker
```

## Example: Adding Authentication Feature

### Phase 1: Requirements
```
Feature: Add OAuth 2.0 authentication

Acceptance Criteria:
- Users can sign in with Google
- Session persists across refreshes
- Protected routes redirect to login
- User profile displayed in header
```

### Phase 2: Design
```
Components Needed:
- Database: users table (already exists)
- Backend: /api/auth/google endpoint
- Frontend: LoginButton component
- Frontend: useAuth hook

Tests:
- Unit: useAuth hook behavior
- Integration: /api/auth/google endpoint
- E2E: Full login flow
```

### Phase 3: Implementation
```
Order:
1. Backend: Implement Google OAuth flow
   - Install dependencies
   - Add OAuth config
   - Create auth endpoint
   - Write tests

2. Frontend: Create login UI
   - LoginButton component
   - useAuth hook
   - Protected route wrapper
   - Write tests

3. Integration: Wire together
   - Test full flow
   - Verify session management
```

### Phase 4: Testing
```
✅ pytest tests/test_auth.py - Passed (3/3)
✅ pnpm test --filter=web - Passed (5/5)
✅ pnpm test:e2e - Passed (1/1)
✅ Manual test: Login with Google - Works
✅ Independent verification - Passed
```

### Phase 5: Documentation
```
Updated:
- README: Added authentication section
- API docs: Documented auth endpoints
- Code: Added docstrings

Stored to Memory:
- Pattern: OAuth 2.0 implementation
- Decision: Using Supabase auth
```

### Phase 6: PR
```
Created: PR #42 - "feat(auth): Add Google OAuth authentication"
Status: Awaiting human review
Checks: All passing ✅
```

## Key Principles

1. **TDD First**: Write failing tests before implementation
2. **Incremental**: Build in small, testable pieces
3. **Verify Continuously**: Test after each change
4. **Self-Correct**: Iterate if issues found
5. **Document**: Update docs as you go
6. **Learn**: Store patterns for future use

## Common Pitfalls

❌ **Building everything then testing**
✅ **Test-driven: Test → Code → Refactor**

❌ **Skipping edge cases**
✅ **Cover edge cases in tests**

❌ **Forgetting error handling**
✅ **Handle errors explicitly**

❌ **No performance consideration**
✅ **Think about scale and performance**

❌ **Missing documentation**
✅ **Document as you build**

## Integration with Orchestrator

```python
async def develop_feature(orchestrator, spec):
    # Phase 1: Analyze
    requirements = await orchestrator.analyze_requirements(spec)

    # Phase 2: Design
    plan = await orchestrator.design_approach(requirements)

    # Phase 3: Implement (parallel if possible)
    if plan.has_database_changes:
        db_agent = await orchestrator.spawn_subagent("database", plan.db_tasks)

    if plan.has_backend_changes:
        backend_agent = await orchestrator.spawn_subagent("backend", plan.backend_tasks)

    if plan.has_frontend_changes:
        frontend_agent = await orchestrator.spawn_subagent("frontend", plan.frontend_tasks)

    # Wait for all agents
    results = await orchestrator.collect_results([db_agent, backend_agent, frontend_agent])

    # Phase 4: Test & Verify
    test_agent = await orchestrator.spawn_subagent("test", results)
    verification = await orchestrator.verify_independently(test_agent.output)

    # Phase 5: Document
    await orchestrator.generate_documentation(results)

    # Phase 6: Create PR
    pr = await orchestrator.create_pr(results, verification)

    return pr
```

---

**Goal**: Deliver production-ready features with tests, documentation, and human review in shadow mode.
