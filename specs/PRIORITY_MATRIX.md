# SYNTHEX Priority Matrix

**Generated:** 2026-02-05
**Phase:** Discovery (G1)
**Swarm Build System:** v1.0

---

## Priority Framework

Actions are prioritized using the **Eisenhower Matrix** adapted for development:

| Quadrant | Urgency | Importance | Action |
|----------|---------|------------|--------|
| Q1 | HIGH | HIGH | Do First (Blockers) |
| Q2 | LOW | HIGH | Schedule (Strategic) |
| Q3 | HIGH | LOW | Delegate (Quick Wins) |
| Q4 | LOW | LOW | Defer (Nice to Have) |

---

## Priority Matrix Visualization

```
                        IMPORTANCE
                    Low              High
              ┌───────────────┬───────────────┐
              │               │               │
        High  │  Q3: DELEGATE │  Q1: DO FIRST │
              │  Quick Wins   │  Blockers     │
              │               │               │
   URGENCY    ├───────────────┼───────────────┤
              │               │               │
        Low   │  Q4: DEFER    │  Q2: SCHEDULE │
              │  Nice to Have │  Strategic    │
              │               │               │
              └───────────────┴───────────────┘
```

---

## Q1: DO FIRST (Blockers)

*High Urgency + High Importance - Complete this sprint*

### P1-001: Enable ESLint in Production Builds

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 (Critical) |
| **Effort** | 1 day |
| **Risk** | RISK-001 |
| **Owner** | DevOps |
| **Dependencies** | None |

**Actions:**
1. [ ] Set `eslint.ignoreDuringBuilds: false` in `next.config.mjs`
2. [ ] Run `npm run lint` to identify errors
3. [ ] Fix all linting errors
4. [ ] Add lint check to CI pipeline
5. [ ] Verify build succeeds with ESLint enabled

**Success Criteria:** Build completes with ESLint enabled, no errors.

---

### P1-002: Increase Test Coverage Threshold

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 (Critical) |
| **Effort** | 1 week |
| **Risk** | RISK-002 |
| **Owner** | Engineering Lead |
| **Dependencies** | None |

**Actions:**
1. [ ] Update `jest.config.js` threshold to 30%
2. [ ] Identify critical paths needing tests
3. [ ] Write tests for authentication flows
4. [ ] Write tests for payment flows
5. [ ] Write tests for content generation
6. [ ] Add test coverage to CI checks

**Success Criteria:** 30% coverage achieved, all critical paths tested.

---

### P1-003: Fix Security Vulnerabilities

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 (Critical) |
| **Effort** | 2-4 hours |
| **Risk** | RISK-007 |
| **Owner** | DevOps |
| **Dependencies** | None |

**Actions:**
1. [ ] Run `npm audit`
2. [ ] Run `npm audit fix`
3. [ ] Manually update packages that can't be auto-fixed
4. [ ] Test application after updates
5. [ ] Add audit to CI pipeline

**Success Criteria:** Zero high/critical vulnerabilities.

---

## Q2: SCHEDULE (Strategic)

*Low Urgency + High Importance - Plan for next 2-4 weeks*

### P2-001: Implement A/B Testing Backend

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 (High) |
| **Effort** | 3-5 days |
| **Risk** | RISK-004 |
| **Owner** | Backend Lead |
| **Dependencies** | P1-002 |

**Actions:**
1. [ ] Design A/B testing data model
2. [ ] Create Prisma migrations
3. [ ] Implement test creation API
4. [ ] Implement result tracking
5. [ ] Implement statistical analysis
6. [ ] Connect to analytics dashboard
7. [ ] Write tests

**Success Criteria:** Full A/B testing functionality with real data.

---

### P2-002: Implement Psychology Analysis

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 (High) |
| **Effort** | 2-3 days |
| **Risk** | RISK-004 |
| **Owner** | Backend Lead |
| **Dependencies** | None |

**Actions:**
1. [ ] Define psychology principles database
2. [ ] Implement AI-powered analysis
3. [ ] Create scoring algorithm
4. [ ] Connect to content generation
5. [ ] Write tests

**Success Criteria:** Real psychology analysis with AI insights.

---

### P2-003: Add Facebook/Instagram Integration

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 (High) |
| **Effort** | 1-2 weeks |
| **Risk** | RISK-006 |
| **Owner** | Backend Lead |
| **Dependencies** | None |

**Actions:**
1. [ ] Set up Meta Developer account
2. [ ] Implement OAuth flow
3. [ ] Implement post creation API
4. [ ] Implement analytics fetching
5. [ ] Add to UI
6. [ ] Write tests

**Success Criteria:** Users can connect and post to Facebook/Instagram.

---

### P2-004: Decompose Large Components

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 (High) |
| **Effort** | 1 week |
| **Risk** | RISK-005 |
| **Owner** | Frontend Lead |
| **Dependencies** | P1-002 |

**Actions:**
1. [ ] Analyze `app/page.tsx` (48KB)
2. [ ] Extract hero section
3. [ ] Extract feature sections
4. [ ] Extract testimonials
5. [ ] Analyze other large components
6. [ ] Extract reusable sub-components
7. [ ] Write tests for extracted components

**Success Criteria:** No component exceeds 15KB.

---

### P2-005: Complete Report Generation

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 (Medium) |
| **Effort** | 3-4 days |
| **Risk** | RISK-009 |
| **Owner** | Backend Lead |
| **Dependencies** | None |

**Actions:**
1. [ ] Complete PDF generation logic
2. [ ] Add report templates
3. [ ] Implement scheduled reports
4. [ ] Add email delivery
5. [ ] Write tests

**Success Criteria:** Full report export with scheduling.

---

## Q3: DELEGATE (Quick Wins)

*High Urgency + Low Importance - Complete as time permits*

### P3-001: Remove Console Statements

| Attribute | Value |
|-----------|-------|
| **Priority** | P3 (Medium) |
| **Effort** | 2-3 days |
| **Risk** | RISK-003 |
| **Owner** | Any Developer |
| **Dependencies** | None |

**Actions:**
1. [ ] Create structured logger utility
2. [ ] Add ESLint rule to ban console.*
3. [ ] Search and replace console statements
4. [ ] Replace with logger where needed
5. [ ] Remove unnecessary logs

**Success Criteria:** No console.* in production code.

---

### P3-002: Remove Demo User Fallback

| Attribute | Value |
|-----------|-------|
| **Priority** | P3 (Medium) |
| **Effort** | 2 hours |
| **Risk** | RISK-008 |
| **Owner** | Any Developer |
| **Dependencies** | None |

**Actions:**
1. [ ] Find all demo user fallbacks
2. [ ] Remove fallback logic
3. [ ] Return 401 for unauthenticated
4. [ ] Test affected endpoints

**Success Criteria:** No demo fallbacks in API routes.

---

### P3-003: Standardize Error Responses

| Attribute | Value |
|-----------|-------|
| **Priority** | P3 (Medium) |
| **Effort** | 1 day |
| **Risk** | RISK-013 |
| **Owner** | Any Developer |
| **Dependencies** | None |

**Actions:**
1. [ ] Define standard error format
2. [ ] Create error response utility
3. [ ] Update API routes to use utility
4. [ ] Document error codes

**Success Criteria:** All APIs use consistent error format.

---

### P3-004: Configure Alert Routing

| Attribute | Value |
|-----------|-------|
| **Priority** | P3 (Medium) |
| **Effort** | 4 hours |
| **Risk** | RISK-010 |
| **Owner** | DevOps |
| **Dependencies** | None |

**Actions:**
1. [ ] Set up alert destinations (Slack, email)
2. [ ] Configure monitoring endpoints
3. [ ] Test alert delivery
4. [ ] Document escalation process

**Success Criteria:** Alerts delivered to correct channels.

---

## Q4: DEFER (Nice to Have)

*Low Urgency + Low Importance - Backlog items*

### P4-001: Review TODO/FIXME Comments

| Attribute | Value |
|-----------|-------|
| **Priority** | P4 (Low) |
| **Effort** | 2-4 hours |
| **Risk** | RISK-014 |
| **Owner** | Any Developer |
| **Dependencies** | None |

**Actions:**
1. [ ] Review all 15 files with TODOs
2. [ ] Convert to GitHub issues where needed
3. [ ] Fix quick items
4. [ ] Remove stale TODOs

---

### P4-002: Consolidate Configuration Files

| Attribute | Value |
|-----------|-------|
| **Priority** | P4 (Low) |
| **Effort** | 2 hours |
| **Risk** | RISK-015 |
| **Owner** | DevOps |
| **Dependencies** | None |

**Actions:**
1. [ ] Audit all config file variations
2. [ ] Remove unused configs
3. [ ] Document active configs

---

### P4-003: Remove Legacy API Directory

| Attribute | Value |
|-----------|-------|
| **Priority** | P4 (Low) |
| **Effort** | 1 hour |
| **Risk** | RISK-011 |
| **Owner** | Any Developer |
| **Dependencies** | None |

**Actions:**
1. [ ] Verify no code references api.legacy
2. [ ] Archive or remove directory
3. [ ] Update documentation

---

### P4-004: Add JSDoc Documentation

| Attribute | Value |
|-----------|-------|
| **Priority** | P4 (Low) |
| **Effort** | Ongoing |
| **Risk** | RISK-012 |
| **Owner** | All Developers |
| **Dependencies** | None |

**Actions:**
1. [ ] Document public functions as they're touched
2. [ ] Add component prop documentation
3. [ ] Generate API documentation

---

### P4-005: Review Python Scripts

| Attribute | Value |
|-----------|-------|
| **Priority** | P4 (Low) |
| **Effort** | 2-4 hours |
| **Risk** | RISK-017 |
| **Owner** | Any Developer |
| **Dependencies** | None |

**Actions:**
1. [ ] Inventory all Python scripts
2. [ ] Identify which are still used
3. [ ] Remove or archive unused scripts
4. [ ] Document active scripts

---

## Sprint Planning Recommendation

### Sprint 1 (Week 1-2): Stabilization

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| P1-001: Enable ESLint | P1 | 1 day | DevOps |
| P1-003: Fix Vulnerabilities | P1 | 4 hours | DevOps |
| P1-002: Test Coverage | P1 | 1 week | All |
| P3-001: Remove Console | P3 | 2 days | Dev |

### Sprint 2 (Week 3-4): Feature Completion

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| P2-001: A/B Testing | P2 | 5 days | Backend |
| P2-002: Psychology | P2 | 3 days | Backend |
| P3-002: Demo Fallback | P3 | 2 hours | Dev |
| P3-003: Error Format | P3 | 1 day | Dev |

### Sprint 3 (Week 5-6): Enhancement

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| P2-003: Meta Integration | P2 | 2 weeks | Backend |
| P2-004: Component Refactor | P2 | 1 week | Frontend |
| P2-005: Report Generation | P2 | 4 days | Backend |

---

## Progress Tracking

| Priority | Total | Complete | In Progress | Remaining |
|----------|-------|----------|-------------|-----------|
| P1 | 3 | 0 | 0 | 3 |
| P2 | 5 | 0 | 0 | 5 |
| P3 | 4 | 0 | 0 | 4 |
| P4 | 5 | 0 | 0 | 5 |
| **Total** | **17** | **0** | **0** | **17** |

---

## Dependencies Graph

```
P1-001 (ESLint)
    └── (None)

P1-002 (Test Coverage)
    └── (None)

P1-003 (Vulnerabilities)
    └── (None)

P2-001 (A/B Testing)
    └── P1-002 (Tests needed first)

P2-004 (Component Refactor)
    └── P1-002 (Tests before refactoring)

P3-001 (Console Removal)
    └── P1-001 (Lint rule needed)
```

---

## Quality Gates

| Gate | Required Actions | Status |
|------|------------------|--------|
| G1: Discovery | Complete specs | ✅ COMPLETE |
| G2: Stabilization | P1-001, P1-002, P1-003 | ⏳ PENDING |
| G3: Feature Complete | P2-001, P2-002 | ⏳ PENDING |
| G4: Production Ready | All P1, P2, P3 | ⏳ PENDING |

---

*Priority Matrix will be reviewed weekly and updated based on progress and new findings.*
