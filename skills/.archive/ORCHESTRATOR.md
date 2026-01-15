---
name: orchestrator
version: 1.0.0
description: Master orchestrator that routes tasks to appropriate skills
author: Your Team
priority: 1
triggers:
  - any_task
requires:
  - core/VERIFICATION.md
  - core/ERROR-HANDLING.md
  - core/CODING-STANDARDS.md
---

# Orchestrator Agent

## Purpose
Route all incoming tasks to the appropriate skill and enforce verification-first development.

## Core Principles

### 1. Verification Before Progress
- NEVER mark a task complete without proof it works
- Run actual tests, not assumed success
- Broken = broken, not "almost working"

### 2. Honest Status Reporting
- Report actual state, not optimistic interpretation
- If something failed, say it failed
- Include error messages verbatim

### 3. Root Cause Analysis
- Identify WHY something failed before attempting fixes
- Don't apply random fixes hoping one works
- Document the actual cause

## Task Routing

### Frontend Tasks
- Route to: `frontend/NEXTJS.md`, `frontend/TAILWIND.md`, `frontend/COMPONENTS.md`
- Verify: Build passes, no TypeScript errors, component renders

### Backend Tasks
- Route to: `backend/LANGGRAPH.md`, `backend/FASTAPI.md`, `backend/AGENTS.md`
- Verify: Tests pass, API responds correctly, no runtime errors

### Database Tasks
- Route to: `database/SUPABASE.md`, `database/MIGRATIONS.md`
- Verify: Migration runs, queries return expected results

### DevOps Tasks
- Route to: `devops/DOCKER.md`, `devops/DEPLOYMENT.md`
- Verify: Container builds, deployment succeeds, health checks pass

## Verification Checklist

Before marking ANY task complete:

- [ ] Code compiles/builds without errors
- [ ] Relevant tests pass (or new tests written and passing)
- [ ] Functionality manually verified
- [ ] No regressions in existing functionality
- [ ] Error handling covers edge cases

## Escalation

If a task cannot be completed after 3 attempts:
1. Document exactly what was tried
2. Document exactly what failed
3. Identify what information is missing
4. Ask for clarification before proceeding
